(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const isPrimary=level=>/^(?:ประถมศึกษาปีที่|ป\.?)[1-6]$/.test(String(level||'').replace(/\s/g,'').replace(/[๐-๙]/g,c=>'๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
 startPP5Home(async allRooms=>{
  const rooms=allRooms.filter(room=>isPrimary(room.class_level));
  const termKey=room=>room.academic_year+'/'+room.term;
  const terms=[...new Set(rooms.map(termKey))];
  $('primaryTerm').replaceChildren(...terms.map(term=>{const option=document.createElement('option');option.value=term;option.textContent='ปี '+term.split('/')[0]+' • ภาคเรียน '+term.split('/')[1];return option}));
  $('primaryTerm').disabled=!terms.length;
  function selectRoom(room){
   for(const card of $('primaryRooms').children)card.setAttribute('aria-pressed',String(card.dataset.room===room.id));
   $('primarySelectedRoom').textContent=room.class_level+'/'+room.room;
   $('primaryStatus').textContent='ปีการศึกษา '+room.academic_year+' • ภาคเรียน '+room.term;
   $('primaryEmptyTitle').textContent='เตรียมเพิ่มเมนูแรก';
   $('primaryEmptyText').textContent='พื้นที่ ปพ.5 ประถมศึกษาของห้องนี้พร้อมแล้ว จะจัดทำทีละเมนูตามที่กำหนด';
   const url=new URL(location.href);url.searchParams.set('classroom',room.id);history.replaceState(null,'',url);
  }
  function renderRooms(){
   const filtered=rooms.filter(room=>termKey(room)===$('primaryTerm').value);
   $('primaryRooms').replaceChildren();$('primaryRoomCount').textContent=filtered.length+' ห้อง';
   $('primarySelectedRoom').textContent='ยังไม่ได้เลือกชั้นเรียน';
   $('primaryStatus').textContent=filtered.length?'เลือกชั้นเรียนเพื่อเปิดพื้นที่ ปพ.5 ประถมศึกษา':'ยังไม่มีห้องประถมศึกษาที่คุณมีสิทธิ์เข้าถึง';
   $('primaryEmptyTitle').textContent=filtered.length?'เลือกชั้นเรียนประถมศึกษา':'ยังไม่มีชั้นเรียนประถมศึกษา';
   $('primaryEmptyText').textContent=filtered.length?'จะเพิ่มแต่ละเมนูตามลำดับที่กำหนด':'เพิ่มห้องเรียนประถมศึกษาและกำหนดสิทธิ์ในหน้าจัดการห้องเรียนก่อน';
   for(const room of filtered){const card=document.createElement('button');card.type='button';card.className='room-card';card.dataset.room=room.id;card.setAttribute('aria-pressed','false');const name=document.createElement('strong');name.textContent=room.class_level+'/'+room.room;card.append(name);card.onclick=()=>selectRoom(room);$('primaryRooms').append(card)}
   const selected=filtered.find(room=>room.id===new URL(location.href).searchParams.get('classroom'));
   if(selected)selectRoom(selected);
  }
  $('primaryTerm').onchange=renderRooms;
  const initial=rooms.find(room=>room.id===new URL(location.href).searchParams.get('classroom'));if(initial)$('primaryTerm').value=termKey(initial);
  renderRooms();
 });
})();
