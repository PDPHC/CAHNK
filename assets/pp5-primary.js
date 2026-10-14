(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const isPrimary=level=>/^(?:ประถมศึกษาปีที่|ป\.?)[1-6]$/.test(String(level||'').replace(/\s/g,'').replace(/[๐-๙]/g,c=>'๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
 startPP5Home(async allRooms=>{
  const rooms=allRooms.filter(room=>isPrimary(room.class_level)),termKey=room=>room.academic_year+'/'+room.term;
  const terms=[...new Set(rooms.map(termKey))],initial=rooms.find(room=>room.id===new URL(location.href).searchParams.get('classroom'));
  const option=(value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;return o};
  $('primaryTerm').replaceChildren(...terms.map(term=>option(term,'ปี '+term.split('/')[0]+' • ภาคเรียน '+term.split('/')[1])));
  $('primaryTerm').disabled=!terms.length;if(initial)$('primaryTerm').value=termKey(initial);
  function updateRoom(){
   const room=rooms.find(room=>room.id===$('primaryRoomSelect').value),url=new URL(location.href);
   if(room){url.searchParams.set('classroom',room.id);$('primaryStatus').textContent=room.class_level+'/'+room.room+' • ปีการศึกษา '+room.academic_year+' • ภาคเรียน '+room.term;}
   else{url.searchParams.delete('classroom');$('primaryStatus').textContent=rooms.length?'เลือกห้องเรียนก่อนเปิดเมนูบันทึกข้อมูล':'ยังไม่มีห้องประถมศึกษาที่คุณมีสิทธิ์เข้าถึง';}
   history.replaceState(null,'',url);
  }
  function renderRooms(){
   const selected=new URL(location.href).searchParams.get('classroom'),filtered=rooms.filter(room=>termKey(room)===$('primaryTerm').value);
   $('primaryRoomSelect').replaceChildren(option('','เลือกชั้นเรียน'),...filtered.map(room=>option(room.id,room.class_level+'/'+room.room)));
   $('primaryRoomSelect').disabled=!filtered.length;
   if(filtered.some(room=>room.id===selected))$('primaryRoomSelect').value=selected;
   else if(filtered.length===1)$('primaryRoomSelect').value=filtered[0].id;
   updateRoom();
  }
  $('primaryTerm').onchange=renderRooms;$('primaryRoomSelect').onchange=updateRoom;renderRooms();
  const labels={structure:'โครงสร้างรายวิชา',reading:'อ่าน คิดวิเคราะห์ เขียน',attendance1:'เวลาเรียน ภาคเรียนที่ 1',attendance2:'เวลาเรียน ภาคเรียนที่ 2',traits:'คุณลักษณะอันพึงประสงค์',scores:'กรอกคะแนนรายวิชา',activities:'กิจกรรมพัฒนาผู้เรียน',summary:'สรุปผลการเรียน'};
  for(const button of document.querySelectorAll('[data-primary-menu]'))button.onclick=()=>{
   const room=rooms.find(room=>room.id===$('primaryRoomSelect').value);
   if(!room){$('primaryStatus').textContent='กรุณาเลือกห้องเรียนประถมศึกษาก่อน';$('primaryRoomSelect').focus();return;}
   if(button.dataset.primaryMenu==='structure'){location.href='pp5-primary-structure.html?classroom='+encodeURIComponent(room.id);return;}
   if(button.dataset.primaryMenu==='scores'){location.href='pp5-primary-scores.html?classroom='+encodeURIComponent(room.id);return;}
   $('primaryMenuTitle').textContent=labels[button.dataset.primaryMenu];$('primaryMenuRoom').textContent=room.class_level+'/'+room.room;
   $('primaryMenuDialog').showModal();
  };
  $('closePrimaryMenu').onclick=()=>{$('primaryMenuDialog').close();const url=new URL(location.href);url.searchParams.delete('menu');history.replaceState(null,'',url)};
  if(new URL(location.href).searchParams.get('menu')==='scores')document.querySelector('[data-primary-menu="scores"]').click();
 });
})();
