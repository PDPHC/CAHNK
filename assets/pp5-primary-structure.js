(()=>{'use strict';
 const $=id=>document.getElementById(id),escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fields={courses:['code','name','type','hours','weight','department','teacher'],activities:['code','name','type','hours']};
 const blank=group=>Object.fromEntries(fields[group].map(k=>[k,k==='type'?(group==='courses'?'พื้นฐาน':'กิจกรรม'):['hours','weight'].includes(k)?0:'']));
 const sum=(rows,key)=>Math.round(rows.reduce((a,r)=>a+(Number(r[key])||0),0)*10000)/10000;
 function grid(text){const rows=[];let row=[],v='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){v+='"';i++}else quoted=!quoted;continue}if(!quoted&&/[\t\r\n]/.test(c)){row.push(v);v='';if(c==='\r'&&text[i+1]==='\n')i++;if(c!=='\t'){rows.push(row);row=[]}continue}v+=c}row.push(v);rows.push(row);return rows.filter(r=>r.some(v=>v.trim()))}
 function validate(data){
  for(const group of Object.keys(fields)){if(data[group].length>100)throw Error('รองรับไม่เกิน 100 แถวต่อตาราง');const codes=new Set();for(const [i,row] of data[group].entries()){
   if(!row.code.trim()||!row.name.trim())throw Error((group==='courses'?'รายวิชา':'กิจกรรม')+' แถว '+(i+1)+' กรุณากรอกรหัสและชื่อให้ครบ');
   if(codes.has(row.code.trim()))throw Error('รหัสซ้ำในตาราง: '+row.code);codes.add(row.code.trim());
   if(group==='courses'&&!['พื้นฐาน','เพิ่มเติม'].includes(row.type))throw Error('ประเภทวิชาต้องเป็น พื้นฐาน หรือ เพิ่มเติม');
   for(const k of fields[group])if(String(row[k]).length>500)throw Error('ข้อความยาวเกิน 500 ตัวอักษร');
   for(const k of group==='courses'?['hours','weight']:['hours'])if(row[k]===''||!Number.isFinite(Number(row[k]))||Number(row[k])<0||Number(row[k])>10000)throw Error('ชั่วโมงและน้ำหนักต้องเป็นตัวเลข 0–10000');
  }}
  for(const key of ['collect','exam'])if(data.ratio[key]===''||!Number.isFinite(Number(data.ratio[key]))||Number(data.ratio[key])<0||Number(data.ratio[key])>100)throw Error('คะแนนเก็บและคะแนนสอบต้องอยู่ระหว่าง 0–100');
  if(Number(data.ratio.collect)+Number(data.ratio.exam)>100)throw Error('คะแนนรวมต้องไม่เกิน 100');return data;
 }
 window.PP5PrimaryStructure={grid,validate,sum};
 let data={courses:[],activities:[],ratio:{collect:40,exam:10}},revision=0,room=null,canEdit=false,dirty=false,busy=false;
 const state=text=>$('structureState').textContent=text;
 const auto=HNKAutoSave.create({isDirty:()=>dirty,canSave:()=>!busy&&canEdit&&!!room,save:()=>window.savePrimaryStructureNow(true),onState:state});
 function mark(){auto.schedule();dirty=true;state('มีการแก้ไขที่ยังไม่บันทึก');totals()}
 function totals(){for(const [id,group,key] of [['courseHours','courses','hours'],['courseWeight','courses','weight'],['activityHours','activities','hours']])$(id).textContent=sum(data[group],key);$('courseHours').textContent=Math.round((sum(data.courses,'hours')+sum(data.activities,'hours'))*10000)/10000;$('courseHours').title='รวมชั่วโมงรายวิชาและกิจกรรมพัฒนาผู้เรียน';$('ratioText').textContent=(data.ratio.collect===''?'—':data.ratio.collect)+' : '+(data.ratio.exam===''?'—':data.ratio.exam);$('ratioTotal').textContent=Math.round(((Number(data.ratio.collect)||0)+(Number(data.ratio.exam)||0))*10000)/10000;}
 let copyTargets=[];
 const grade=level=>{const text=String(level||'').replace(/\s/g,'').replace(/[๐-๙]/g,c=>'๐๑๒๓๔๕๖๗๘๙'.indexOf(c));return /^(ประถมศึกษาปีที่|ป\.?)[1-6]$/.test(text)?Number(text.slice(-1)):null;};
 function chosenTargets(){return copyTargets.filter(t=>$('structureCopyTargets').querySelector('input[value="'+t.id+'"]')?.checked);}
 function copyControls(){const selected=chosenTargets(),overwrite=selected.some(t=>t.revision>0);$('structureCopyOverwriteLabel').hidden=!overwrite;$('structureCopySelected').textContent='เลือก '+selected.length+' ห้อง';$('applyStructureCopy').disabled=busy||!selected.length||(overwrite&&!$('structureCopyOverwrite').checked);$('selectAllStructureTargets').disabled=busy||!copyTargets.length;}
 function lock(){document.querySelectorAll('.structure-panel input,.structure-panel select,.structure-panel button,#saveStructure,#copyStructure').forEach(el=>el.disabled=!canEdit||busy);document.querySelectorAll('#structureCopyDialog input,#structureCopyDialog button').forEach(el=>el.disabled=busy);copyControls();}
 function render(){
  for(const group of Object.keys(fields))$(group+'Table').querySelector('tbody').innerHTML=data[group].map((row,i)=>'<tr data-row="'+i+'"><td>'+(i+1)+'</td>'+fields[group].map(k=>'<td>'+ (k==='type'&&group==='courses'?'<select data-field="type" aria-label="ประเภทวิชา แถว '+(i+1)+'">'+['พื้นฐาน','เพิ่มเติม'].map(type=>'<option '+(type===row.type?'selected':'')+'>'+type+'</option>').join(''):'<input data-field="'+k+'" aria-label="'+$(group+'Table').querySelectorAll('thead th')[fields[group].indexOf(k)+1].textContent+' แถว '+(i+1)+'" '+(['hours','weight'].includes(k)?'type="number" min="0" max="10000" step="any"':'type="text" maxlength="500"')+(k==='department'?' list="departments"':'')+' value="'+escape(row[k])+'">')+'</td>').join('')+'<td><button class="structure-delete" data-delete="'+i+'" aria-label="ลบแถว '+(i+1)+'">ลบ</button></td></tr>').join('');
  $('ratioCollect').value=data.ratio.collect;$('ratioExam').value=data.ratio.exam;totals();lock();
 }
 startPP5Home(async rooms=>{
  room=rooms.find(r=>r.id===new URL(location.href).searchParams.get('classroom')&&/^(?:ประถมศึกษาปีที่|ป\.?)[1-6]$/.test(String(r.class_level).replace(/\s/g,'').replace(/[๐-๙]/g,c=>'๐๑๒๓๔๕๖๗๘๙'.indexOf(c))));
  if(!room){location.replace('pp5-primary.html');return}
  $('structureRoom').textContent=room.class_level+'/'+room.room+' • ปีการศึกษา '+room.academic_year+' • ภาคเรียน '+room.term;
  for(const id of ['structureBack','backDashboard'])$(id).href='pp5-primary.html?classroom='+encodeURIComponent(room.id);
  $('goPrimaryScores').href='pp5-primary-scores.html?classroom='+encodeURIComponent(room.id);
  const results=await Promise.all([cloudClient.from('pp5_primary_structures').select('*').eq('classroom_id',room.id).maybeSingle(),cloudClient.from('classroom_teachers').select('permission').eq('classroom_id',room.id).eq('teacher_id',cloudState.user.id).maybeSingle(),cloudClient.from('teaching_assignments').select('*,subject_catalog(*)').eq('classroom_id',room.id).eq('active',true)]);
  for(const r of results)if(r.error)throw r.error;
  canEdit=['admin','director','deputy_director'].includes(cloudState.profile?.role)||['owner','editor'].includes(results[1].data?.permission);
  const saved=results[0].data;
  if(saved){data=structuredClone(saved.data);revision=saved.revision;state('บันทึกล่าสุด '+new Date(saved.updated_at).toLocaleString('th-TH')+(!canEdit?' • เปิดดูอย่างเดียว':''));}
  else{const departments=[...$('departments').options].map(o=>o.value);data.courses=results[2].data.filter(a=>a.subject_catalog?.active).map(a=>({code:a.subject_catalog.code,name:a.subject_catalog.name,type:'พื้นฐาน',hours:Number(a.subject_catalog.total_hours??Number(a.subject_catalog.weekly_hours)*40)||0,weight:Number(a.subject_catalog.credits)||0,department:departments[a.subject_catalog.department]||'',teacher:a.teacher_name||''}));if(!data.courses.length)data.courses.push(blank('courses'));data.activities.push(blank('activities'));state(canEdit?'เล่มใหม่ — บันทึกอัตโนมัติเมื่อกรอกข้อมูลครบ':'ยังไม่มีโครงสร้างรายวิชาที่บันทึกไว้ • เปิดดูอย่างเดียว');}
  render();
  for(const group of Object.keys(fields)){
   const table=$(group+'Table');table.addEventListener('input',e=>{if(!canEdit||busy||!e.target.dataset.field)return;const row=data[group][Number(e.target.closest('tr').dataset.row)],k=e.target.dataset.field;row[k]=['hours','weight'].includes(k)?(e.target.value===''?'':Number(e.target.value)):e.target.value;mark()});table.addEventListener('change',e=>{if(e.target.tagName==='SELECT')e.target.dispatchEvent(new Event('input',{bubbles:true}))});
   table.addEventListener('click',e=>{const button=e.target.closest('[data-delete]');if(!button||!canEdit||busy)return;const index=Number(button.dataset.delete);if((data[group][index].code||data[group][index].name)&&!confirm('ลบแถวนี้ออกจากโครงสร้าง?'))return;data[group].splice(index,1);mark();render()});
   table.addEventListener('paste',e=>{
    const control=e.target.closest('[data-field]');if(!control||!canEdit||busy)return;const text=e.clipboardData?.getData('text/plain')||'';if(!/[\t\r\n]/.test(text))return;e.preventDefault();
    try{const rows=grid(text),next=structuredClone(data[group]);let index=Number(control.closest('tr').dataset.row),start=fields[group].indexOf(control.dataset.field);let changed=0;
     for(let cells of rows){if(cells.some(v=>/^(รหัสวิชา|รหัสกิจกรรม|ชื่อวิชา|ชื่อกิจกรรม)$/.test(v.trim()))||cells.some(v=>/^รวมเวลาเรียน/.test(v.trim())))continue;if(start===0&&cells.length===fields[group].length+1&&/^\d+$/.test(cells[0].trim()))cells=cells.slice(1);if(index>=100)throw Error('รองรับไม่เกิน 100 แถว');if(cells.length>fields[group].length-start)throw Error('จำนวนคอลัมน์ไม่ตรง กรุณาวางเริ่มที่รหัสวิชาหรือรหัสกิจกรรม');next[index]??=blank(group);cells.forEach((v,i)=>{const k=fields[group][start+i];if(['hours','weight'].includes(k)){const raw=v.trim().replace(/,/g,''),n=raw===''?'':Number(raw);if(raw!==''&&(!Number.isFinite(n)||n<0||n>10000))throw Error('ชั่วโมงหรือน้ำหนักไม่ถูกต้อง');next[index][k]=n;}else if(k==='type'&&group==='courses'&&!['พื้นฐาน','เพิ่มเติม'].includes(v.trim()))throw Error('ประเภทวิชาต้องเป็น พื้นฐาน หรือ เพิ่มเติม');else next[index][k]=v.trim();changed++});index++;}
     data[group]=next;mark();render();state('วางข้อมูลจาก Excel แล้ว '+changed+' ช่อง — รอบันทึกอัตโนมัติ');
    }catch(error){state(error.message)}
   });
  }
  document.querySelectorAll('[data-add]').forEach(button=>button.onclick=()=>{if(!canEdit||busy)return;const group=button.dataset.add;if(data[group].length>=100)return state('รองรับไม่เกิน 100 แถว');data[group].push(blank(group));mark();render();$(group+'Table').querySelector('tbody tr:last-child input')?.focus()});
  for(const [id,key] of [['ratioCollect','collect'],['ratioExam','exam']])$(id).oninput=e=>{if(!canEdit||busy)return;data.ratio[key]=e.target.value===''?'':Number(e.target.value);mark()};
  async function saveStructure(automatic=false){if(!canEdit||busy)throw Error('ยังไม่พร้อมบันทึก');try{
   const payload=structuredClone(data);for(const group of Object.keys(fields)){payload[group]=payload[group].filter(row=>row.code||row.name||Number(row.hours)||Number(row.weight)||row.department||row.teacher);for(const row of payload[group]){row.code=row.code.trim();row.name=row.name.trim();}}validate(payload);
   busy=true;lock();state('กำลังบันทึก…');const values={classroom_id:room.id,data:payload,revision:revision+1,updated_by:cloudState.user.id};
   const result=revision?await cloudClient.from('pp5_primary_structures').update(values).eq('classroom_id',room.id).eq('revision',revision).select('*').maybeSingle():await cloudClient.from('pp5_primary_structures').insert(values).select('*').single();
   if(result.error)throw result.error;if(!result.data)throw Error('ข้อมูลถูกแก้ไขจากหน้าต่างอื่น กรุณาเก็บข้อมูลที่กรอกไว้แล้วโหลดหน้าใหม่');revision=result.data.revision;if(!automatic)data=structuredClone(result.data.data);dirty=false;if(!automatic)render();state('บันทึกบนคลาวด์สำเร็จ '+new Date(result.data.updated_at).toLocaleString('th-TH'));
  }finally{busy=false;lock()}};
  window.savePrimaryStructureNow=saveStructure;
  $('saveStructure').onclick=async()=>{try{await auto.flush(true);}catch{}};
  $('copyStructure').onclick=async()=>{if(!canEdit||busy)return;try{await auto.flush(!revision);busy=true;lock();copyTargets=[];$('structureCopyTargets').replaceChildren();$('structureCopyOverwrite').checked=false;$('structureCopyState').textContent='กำลังค้นหาห้องระดับชั้นเดียวกัน…';$('structureCopySource').textContent='ต้นทาง: '+room.class_level+'/'+room.room+' • ปี '+room.academic_year+' • ภาคเรียน '+room.term;$('structureCopyDialog').showModal();
   const result=await cloudClient.rpc('pp5_primary_structure_copy_targets',{p_source:room.id});if(result.error)throw result.error;
   copyTargets=(result.data||[]).filter(t=>t.id!==room.id&&grade(t.class_level)!==null&&grade(t.class_level)===grade(room.class_level)&&Number(t.academic_year)===Number(room.academic_year)&&Number(t.term)===Number(room.term));
   $('structureCopyTargets').innerHTML=copyTargets.map(t=>'<label><input type="checkbox" value="'+escape(t.id)+'"><span><strong>'+escape(t.class_level+'/'+t.room)+'</strong><small>'+(t.revision?'มีโครงสร้างแล้ว — จะถูกแทนที่เมื่อยืนยัน':'ยังไม่มีโครงสร้าง — สร้างจากห้องต้นทาง')+'</small></span></label>').join('');$('structureCopyState').textContent=copyTargets.length?'เลือกห้องที่ต้องการนำโครงสร้างไปใช้':'ไม่พบห้องระดับชั้นเดียวกันที่คุณมีสิทธิ์แก้ไข ในปีการศึกษาและภาคเรียนนี้';
  }catch(error){if($('structureCopyDialog').open)$('structureCopyState').textContent=error.message;else state(error.message);}finally{busy=false;lock();}};
  $('structureCopyTargets').onchange=()=>{$('structureCopyOverwrite').checked=false;copyControls();};$('structureCopyOverwrite').onchange=copyControls;
  $('selectAllStructureTargets').onclick=()=>{if(busy)return;$('structureCopyTargets').querySelectorAll('input').forEach(el=>el.checked=true);$('structureCopyOverwrite').checked=false;copyControls();};
  $('closeStructureCopy').onclick=()=>{if(!busy)$('structureCopyDialog').close();};$('structureCopyDialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  $('applyStructureCopy').onclick=async()=>{if(busy||!canEdit||$('applyStructureCopy').disabled)return;const selected=chosenTargets();if(!selected.length)return;try{await auto.flush();busy=true;lock();$('structureCopyState').textContent='กำลังคัดลอกโครงสร้าง…';const result=await cloudClient.rpc('pp5_copy_primary_structure',{p_source:room.id,p_source_revision:revision,p_targets:selected.map(t=>({classroom_id:t.id,revision:t.revision})),p_overwrite:$('structureCopyOverwrite').checked});if(result.error)throw result.error;if(!Array.isArray(result.data)||result.data.length!==selected.length)throw Error('ไม่สามารถยืนยันผลการคัดลอกได้ กรุณาตรวจสอบห้องปลายทาง');$('structureCopyDialog').close();state('นำโครงสร้างไปใช้แล้ว '+selected.length+' ห้อง: '+selected.map(t=>t.class_level+'/'+t.room).join(', '));}catch(error){$('structureCopyState').textContent='คัดลอกไม่สำเร็จ: '+error.message;}finally{busy=false;lock();}};
 });
 $('goPrimaryScores').onclick=async e=>{if(!revision&&!dirty){e.preventDefault();try{await auto.flush(true);location.href=$('goPrimaryScores').href;}catch{}}};
 addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
})();
