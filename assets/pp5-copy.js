(()=>{'use strict';
 function snapshot(value,patches){
  const numeric=(sheet,ref)=>{const raw=value(sheet,ref);return raw==null||String(raw).trim()===''?'':Number(raw)};
  const result={__pp5_indicator_count:Number(patches.__pp5_indicator_count||0),__pp5_deleted_indicators:[...(patches.__pp5_deleted_indicators||[])]};
  const rows=[...Array.from({length:15},(_,i)=>i+8),...Array.from({length:100},(_,i)=>i+54)];
  for(const row of rows)for(const c of ['C','O','P','Q','R','T'])result['D!'+c+row]=c==='C'?String(value('D',c+row)??''):numeric('D',c+row);
  for(const ref of ['N24','O24','P24','Q24','R24','T24','C28','C29','C30'])result['D!'+ref]=ref.startsWith('C')?String(value('D',ref)??''):numeric('D',ref);
  for(const c of ['E','F','G','H','I','J'])result['IN!'+c+'3']=numeric('IN',c+'3');
  return result;
 }
 async function open({client,sourceId,sourceRevision,values,onCopied}){
  const {data:targets,error}=await client.rpc('pp5_indicator_copy_targets',{p_source:sourceId});if(error)throw error;
  if(!targets?.length)throw Error('ไม่พบรายวิชาปลายทางที่มีระดับชั้น รหัสวิชา ปีการศึกษาและภาคเรียนเดียวกัน หรือคุณไม่มีสิทธิ์แก้ไขห้องปลายทาง');
  const dialog=document.createElement('dialog');dialog.className='pp5-copy-dialog';
  dialog.innerHTML='<h2>คัดลอกตัวชี้วัดไปอีกห้อง</h2><p>เลือกห้องที่มีระดับชั้น รหัสวิชา ปีการศึกษาและภาคเรียนเดียวกัน หากยังไม่มีเล่ม ระบบจะสร้างเล่มจากรายชื่อของห้องปลายทางเมื่อคัดลอก</p><label>ห้อง / รายวิชาปลายทาง<select aria-label="ห้องและรายวิชาปลายทาง"></select></label><p>จะแทนที่ตัวชี้วัด คะแนนเต็ม ชั่วโมง ภาคปฏิบัติ / ชิ้นงาน และเงื่อนไขในเมนูนี้ของเล่มปลายทาง โดยรายชื่อ คะแนนนักเรียน และเวลาเรียนยังอยู่ครบ</p><p role="status" aria-live="polite"></p><div class="actions"><button class="btn primary" type="button" data-copy-apply>คัดลอกไปห้องที่เลือก</button><button class="btn" type="button" data-copy-close>ยกเลิก</button></div>';
  const select=dialog.querySelector('select'),apply=dialog.querySelector('[data-copy-apply]'),close=dialog.querySelector('[data-copy-close]'),state=dialog.querySelector('[role=status]');
  for(const target of targets){const option=document.createElement('option');option.value=target.id;option.textContent=target.class_level+'/'+target.room+' · '+target.title+(target.assignment_id?' (สร้างเล่มเมื่อคัดลอก)':'');select.append(option)}
  close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  apply.onclick=async()=>{
   const target=targets.find(item=>item.id===select.value);if(!target)return;
   apply.disabled=true;select.disabled=true;close.disabled=true;state.textContent='กำลังคัดลอก…';
   try{
    let result;
    if(target.assignment_id){
     const response=await fetch('../assets/pp5-template.json?v=2');if(!response.ok)throw Error('โหลดแม่แบบไม่สำเร็จ');const template=await response.json();
     result=await client.rpc('pp5_copy_indicators_to_assignment',{p_source:sourceId,p_source_revision:sourceRevision,p_assignment:target.assignment_id,p_template_base64:template.base64,p_values:values});
    }else result=await client.rpc('pp5_copy_indicators',{p_source:sourceId,p_source_revision:sourceRevision,p_target:target.id,p_target_revision:target.revision,p_values:values});
    if(result.error)throw result.error;
    state.textContent='คัดลอกสำเร็จไป '+target.class_level+'/'+target.room+' · '+target.title;close.textContent='ปิด';onCopied?.(target);
   }catch(error){state.textContent=error.message||String(error);apply.disabled=false;select.disabled=false}
   finally{close.disabled=false}
  };
  document.body.append(dialog);dialog.showModal();return dialog;
 }
 window.PP5Copy={snapshot,open};
})();
