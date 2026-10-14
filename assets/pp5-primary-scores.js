(()=>{'use strict';const $=id=>document.getElementById(id);let courses=[],room;
 const isPrimary=level=>/^(?:ประถมศึกษาปีที่|ป\.?)[1-6]$/.test(String(level||'').replace(/\s/g,'').replace(/[๐-๙]/g,c=>'๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
 startPP5Home(async rooms=>{
  room=rooms.find(r=>r.id===new URL(location.href).searchParams.get('classroom')&&isPrimary(r.class_level));if(!room){location.replace('pp5-primary.html');return;}
  for(const id of ['scoresHome','scoresDashboard'])$(id).href='pp5-primary.html?classroom='+encodeURIComponent(room.id);
  $('editScoreStructure').href='pp5-primary-structure.html?classroom='+encodeURIComponent(room.id);
  $('scoresRoom').textContent=room.class_level+'/'+room.room+' • ปีการศึกษา '+room.academic_year+' • ภาคเรียน '+room.term;
  const {data,error}=await cloudClient.from('pp5_primary_structures').select('data').eq('classroom_id',room.id).maybeSingle();if(error)throw error;
  courses=(data?.data?.courses||[]).filter(c=>c.code&&c.name);
  function render(){const query=$('scoresSearch').value.trim().toLocaleLowerCase('th'),visible=courses.map((c,i)=>({c,i})).filter(({c})=>(c.code+' '+c.name).toLocaleLowerCase('th').includes(query));$('scoresCourses').replaceChildren();
   for(const {c,i} of visible){const row=document.createElement('tr');for(const [label,value] of [['ลำดับ',i+1],['รหัสรายวิชา',c.code],['รายวิชา',c.name]]){const cell=document.createElement('td');cell.dataset.label=label;cell.textContent=value;row.append(cell)}const action=document.createElement('td'),button=document.createElement('button');button.className='course-score-button';button.type='button';button.textContent='✎ กรอกคะแนน';button.setAttribute('aria-label','กรอกคะแนน '+c.code+' '+c.name);button.onclick=()=>{location.href='pp5-primary-score-editor.html?classroom='+encodeURIComponent(room.id)+'&course='+encodeURIComponent(c.code)};action.append(button);row.append(action);$('scoresCourses').append(row);}
   $('scoresStatus').textContent=courses.length?(query?'แสดง '+visible.length+' จาก '+courses.length+' รายวิชา':'ทั้งหมด '+courses.length+' รายวิชา • ดึงจากโครงสร้างที่บันทึกไว้'):'ยังไม่มีรายวิชาที่บันทึกไว้ในโครงสร้างของห้องนี้';$('scoresEmpty').hidden=visible.length>0;$('scoresEmpty').querySelector('h3').textContent=courses.length?'ไม่พบรายวิชาที่ค้นหา':'ยังไม่มีรายวิชา';$('scoresEmpty').querySelector('p').textContent=courses.length?'ลองค้นหาด้วยรหัสหรือชื่อวิชาอื่น':'เพิ่มรายวิชาในโครงสร้างและบันทึกก่อน รายวิชาจะแสดงที่นี่อัตโนมัติ';
  }
  $('scoresSearch').disabled=!courses.length;$('scoresSearch').oninput=render;render();
 });
})();
