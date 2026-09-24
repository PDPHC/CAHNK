(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labels={comment:'ความคิดเห็น / เหตุผลการส่งกลับ',submitted_to_academic:'ครูส่งงานให้วิชาการ',forwarded_to_deputy:'วิชาการส่งต่อรอง ผอ.',returned_by_academic:'คืนงานให้ครูแก้ไข',returned_by_deputy:'รอง ผอ. ส่งกลับวิชาการ',approved:'อนุมัติเล่ม',archive_removed:'นำเล่มออกจากคลังและล้างสถานะ',reopened:'คืนเล่มที่อนุมัติให้ครูแก้ไข'};
  window.workflowToast=function(text){let box=document.getElementById('workflowToast');if(!box){box=document.createElement('div');box.id='workflowToast';box.setAttribute('role','status');document.body.appendChild(box)}box.textContent=text;box.hidden=false;clearTimeout(box.timer);box.timer=setTimeout(()=>box.hidden=true,6000)};
  function dialog(title){let d=document.getElementById('workflowDialog');if(!d){d=document.createElement('dialog');d.id='workflowDialog';d.className='workflow-dialog';document.body.appendChild(d)}d.innerHTML='<div class="dialog-heading"><h2 id="workflowDialogTitle">'+esc(title)+'</h2><button class="btn gray" id="closeWorkflowDialog" aria-label="ปิดหน้าต่าง">ปิด</button></div><div id="workflowDialogBody"></div>';d.setAttribute('aria-labelledby','workflowDialogTitle');document.getElementById('closeWorkflowDialog').onclick=()=>d.close();if(!d.open)d.showModal();return d}
  window.workflowHistory=async function(cid,month){
    const d=dialog('ประวัติการดำเนินการ'),body=document.getElementById('workflowDialogBody');body.textContent='กำลังโหลดประวัติ...';
    try{const r=await window.cloudClient.from('workflow_events').select('id,action,reason,actor_name,created_at').eq('classroom_id',cid).eq('report_month',month.slice(0,7)+'-01').order('created_at',{ascending:false});if(r.error)throw r.error;
      if(!d.open||!body.isConnected)return;
      body.innerHTML='<p class="sub">เดือน '+esc(new Date(month.slice(0,7)+'-01T12:00:00').toLocaleDateString('th-TH',{month:'long',year:'numeric'}))+' • ประวัติเริ่มเก็บตั้งแต่เปิดใช้ระบบนี้</p>'+(r.data.length?'<ol class="workflow-timeline">'+r.data.map(e=>'<li><strong>'+esc(labels[e.action]||e.action)+'</strong><p>'+esc(e.actor_name)+' • '+esc(new Date(e.created_at).toLocaleString('th-TH'))+'</p>'+(e.reason?'<p>'+esc(e.reason)+'</p>':'')+(e.action==='reopened'?'<a class="btn gray" href="review-book.html?event='+encodeURIComponent(e.id)+'" target="_blank" rel="noopener">ดูเล่มก่อนคืนแก้ไข</a>':'')+'</li>').join('')+'</ol>':'<div class="empty-room-state">ยังไม่มีประวัติการดำเนินการ</div>');
    }catch(e){body.textContent='โหลดประวัติไม่สำเร็จ: '+e.message}
  };
  window.workflowReturnBook=function(id,label){
    const d=dialog('คืนเล่มให้ครูแก้ไข'),body=document.getElementById('workflowDialogBody');
    body.innerHTML='<div class="return-context">'+esc(label)+'</div><p>ครูจะกลับไปแก้ข้อมูลและส่งตรวจใหม่ เล่มที่อนุมัติรอบเดิมและความคิดเห็นจะเก็บไว้ในประวัติ</p><label for="returnBookReason">ระบุสิ่งที่ต้องแก้ไข</label><textarea id="returnBookReason" rows="4" placeholder="เช่น ตรวจข้อมูลการมาเรียนวันที่…"></textarea><p id="returnBookError" role="alert"></p><button id="confirmReturnBook" class="btn primary">ยืนยันคืนให้ครูแก้ไข</button>';
    const button=document.getElementById('confirmReturnBook');button.onclick=async()=>{const reason=document.getElementById('returnBookReason').value.trim(),error=document.getElementById('returnBookError');if(reason.length<3){error.textContent='กรุณาระบุสิ่งที่ต้องแก้ไขอย่างน้อย 3 ตัวอักษร';return}button.disabled=true;button.textContent='กำลังคืนงาน...';
      try{const r=await window.cloudClient.rpc('return_archived_book',{p_archive_id:id,p_reason:reason});if(r.error)throw r.error;d.close();try{if(window.workflowRefresh)await window.workflowRefresh();workflowToast('คืนเล่มให้ครูแก้ไขแล้ว และเก็บเล่มเดิมไว้ในประวัติ')}catch(_){workflowToast('คืนเล่มสำเร็จแล้ว กรุณารีเฟรชหน้าเพื่อโหลดสถานะล่าสุด')}}
      catch(e){error.textContent='ดำเนินการไม่สำเร็จ: '+e.message}finally{button.disabled=false;button.textContent='ยืนยันคืนให้ครูแก้ไข'}
    };
  };
  window.addEventListener('focus',()=>{if(window.workflowRefresh&&!document.querySelector('dialog[open], textarea:focus'))window.workflowRefresh().catch(()=>{})});
})();
