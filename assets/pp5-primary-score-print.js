(()=>{'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=v=>v===null||v===undefined?'':String(PrimaryScoreModel.round(Number(v)));
 function render(root,{room,course,roster,data,ratio}){
  const M=PrimaryScoreModel,chunks=Math.max(1,Math.ceil(roster.length/25));let html='';
  for(let term=0;term<2;term++)for(let page=0;page<chunks;page++){
   const rows=roster.slice(page*25,(page+1)*25),maximum=M.round(ratio.collect+ratio.exam+data.maxima[term].mid),identity='<col style="width:7mm"><col style="width:12mm"><col style="width:39mm">';
   html+='<section class="primary-semester-print-page" data-print-term="'+(term+1)+'"><header class="semester-document-header"><div class="semester-logo"><img src="assets/obec-emblem.webp" alt="ตรา สพฐ."></div><div><h2>สรุปผลการประเมินผลตัวชี้วัดชั้น'+esc(room.class_level)+' ปีการศึกษา '+esc(room.academic_year)+'</h2><p>รายวิชา '+esc(course.name)+' &nbsp; รหัสวิชา '+esc(course.code)+'</p><p class="semester-ratio">อัตราส่วนคะแนนเก็บ/คะแนนสอบ '+ratio.collect+' : '+ratio.exam+' &nbsp; คะแนนเต็มต่อภาคเรียน '+maximum+'</p></div></header>';
   html+='<table class="semester-score-print-table"><colgroup>'+identity+Array(16).fill('<col>').join('')+'<col style="width:6mm"><col style="width:6mm"><col style="width:6mm"><col style="width:7mm">'+(term===1?'<col style="width:7mm"><col style="width:7mm">':'')+'</colgroup><thead><tr><th rowspan="3">ที่</th><th rowspan="3"><span class="print-vertical">รหัสนักเรียน</span></th><th rowspan="3">ชื่อ-นามสกุล</th><th colspan="17">คะแนนระหว่างเรียน ภาคเรียนที่ '+(term+1)+'</th><th rowspan="2"><span class="print-vertical">กลางภาค</span></th><th rowspan="2"><span class="print-vertical">ปลายภาค</span></th><th rowspan="2"><span class="print-vertical">รวมภาคเรียนที่ '+(term+1)+'</span></th>'+(term===1?'<th rowspan="3"><span class="print-vertical">รวมคะแนนทั้งปี</span></th><th rowspan="3"><span class="print-vertical">ผลการเรียน</span></th>':'')+'</tr><tr>'+Array.from({length:16},(_,i)=>'<th>'+(i+1)+'</th>').join('')+'<th>รวม</th></tr><tr class="semester-max-row">'+data.maxima[term].tasks.map(v=>'<th>'+text(v)+'</th>').join('')+'<th>'+ratio.collect+'</th><th>'+(data.maxima[term].mid||'')+'</th><th>'+ratio.exam+'</th><th>'+maximum+'</th></tr></thead><tbody>';
   for(let row=0;row<25;row++){
    const student=rows[row];if(!student){html+='<tr class="print-empty-row">'+Array(term===1?25:23).fill('<td></td>').join('')+'</tr>';continue;}
    const record=data.scores[student.id]||{terms:[M.blankTerm(),M.blankTerm()]},scores=record.terms[term],result=M.result(record,data.maxima,ratio),blocked=StudentStatus.blocked(student);
    html+='<tr class="'+(blocked?'print-blocked-row':'')+'"><td>'+(page*25+row+1)+'</td><td>'+esc(student.student_code)+'</td><td class="semester-student-name">'+esc(student.full_name+({transferred:' †',not_present:' ‡',special:' ★'}[student.record_status]||''))+'</td>'+scores.tasks.map(v=>'<td>'+text(v)+'</td>').join('')+'<td>'+ (blocked?'-':result.terms[term].has?text(result.terms[term].collect):'')+'</td><td>'+text(scores.mid)+'</td><td>'+text(scores.final)+'</td><td>'+(blocked?'-':result.terms[term].has?text(result.terms[term].total):'')+'</td>'+(term===1?'<td>'+(blocked?'-':result.terms.some(t=>t.has)?text(result.total):'')+'</td><td>'+(blocked||result.grade===null?'-':result.grade)+'</td>':'')+'</tr>';
   }
   html+='</tbody></table><footer class="semester-print-footer"><p>หมายเหตุ: ต้องกรอกคะแนนครบทั้งสองภาคเรียนในทุกช่องที่มีคะแนนเต็มมากกว่า 0 จึงแสดงเกรด</p><span>ภาคเรียนที่ '+(term+1)+' &bull; หน้า '+(term*chunks+page+1)+'/'+(chunks*2)+'</span></footer></section>';
  }
  root.innerHTML=html;
 }
 window.PrimaryScorePrint={render};
})();
