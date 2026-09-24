(() => {
 'use strict';
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let list=[],record=null,book=null,patches={},dirty=false,tab='scores',busy=false,week=1;
 const columns=['E','F','G','H','I','J'],names=['ก่อนกลางภาค','กลางภาค','แก้/ซ่อม','หลังกลางภาค','ชิ้นงาน','ปลายภาค'];
 const editable=()=>['owner','editor'].includes(window.cloudState?.permission);
 const value=(s,r)=>book.value(s,r,patches);
 const message=(title,text)=>{$('dialogTitle').textContent=title;$('dialogMessage').textContent=text;$('pp5Dialog').showModal()};
 function status(text){$('pp5Status').textContent=text}
 function mark(){dirty=true;$('saveState').textContent='มีการแก้ไขที่ยังไม่บันทึก';updateHeading()}
 function put(sheet,ref,v){if(!editable())throw Error('ไม่มีสิทธิ์แก้ไข');patches[sheet+'!'+ref]=v;mark()}
 function input(sheet,ref,options={}){const v=value(sheet,ref);return '<input data-sheet="'+sheet+'" data-ref="'+ref+'" aria-label="'+esc(options.label||ref)+'" '+(options.numeric?'type="number" min="0" step="any"':'type="text"')+' class="'+(options.className||'')+'" value="'+esc(v)+'" '+(!editable()?'disabled':'')+'>'}
 function updateHeading(){$('bookHeading').textContent=[value('IN','Q7'),value('IN','Q8')].filter(Boolean).join(' · ')||record?.title||'เล่มรายวิชาใหม่'}
 function lock(on){busy=on;for(const id of ['saveBook','newBook','exportBook','exportPdf','bookSelect'])$(id).disabled=on||(['saveBook','newBook'].includes(id)&&!editable());document.querySelectorAll('#pp5Panel [data-ref]').forEach(el=>el.disabled=on||!editable());document.querySelectorAll('[data-tab]').forEach(el=>el.disabled=on)}
 async function guard(fn){if(busy)return;lock(true);try{await fn()}catch(e){message('ดำเนินการไม่สำเร็จ',e.message||String(e));status('ดำเนินการไม่สำเร็จ — ข้อมูลที่แก้ไขยังอยู่ในหน้านี้')}finally{lock(false)}}
 const toBase64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(s)};
 const fromBase64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const serialToDate=n=>n===''?'':new Date((Number(n)-25569)*86400000).toISOString().slice(0,10);
 async function createFromRoom(){
  const roster=students();if(!roster.length)throw Error('ยังไม่มีนักเรียนในห้องนี้ กรุณาเพิ่มรายชื่อในข้อมูลห้องเรียนก่อน');
  if(roster.length>60)throw Error('แม่แบบรองรับไม่เกิน 60 คน');
  const response=await fetch('../assets/pp5-template.json?v=2');if(!response.ok)throw Error('โหลดแม่แบบไม่สำเร็จ กรุณาลองอีกครั้ง');
  const template=await response.json(),next=await PP5Workbook.Book.open(fromBase64(template.base64));
  const s=settings(),p={};roster.forEach((student,i)=>{p['IN!C'+(i+4)]=String(student.id||'');p['IN!D'+(i+4)]=student.name||''});
  const fields={Q4:s.classLevel?.includes('มัธยม')?(Number(s.classLevel.match(/\d+/)?.[0])>3?'ม.ปลาย':'ม.ต้น'):s.classLevel,Q5:s.teacher1,Q6:s.teacher2,Q11:s.deputy,Q12:Number(s.academicYear)||'',Q13:Number(s.term)||'',Q16:cloudState.profile?.display_name||'',Q20:s.school,Q22:s.office,Q23:(s.classLevel||'').replace('มัธยมศึกษาปีที่ ','ม.').replace('ประถมศึกษาปีที่ ','ป.')+'/'+(s.room||'')};
  for(const [ref,v] of Object.entries(fields))p['IN!'+ref]=v??'';
  book=next;record={template_name:template.filename,title:'รายวิชาใหม่'};patches=p;dirty=true;tab='info';
  document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===tab);b.setAttribute('aria-selected',String(b.dataset.tab===tab))});
  show();$('bookSelect').value='';status('ดึงรายชื่อ '+roster.length+' คนจากห้องนี้แล้ว — กรอกข้อมูลรายวิชาและบันทึก');
 }
 function options(){const selected=record?.id||'';$('bookSelect').innerHTML='<option value="">เลือกรายวิชา</option>'+list.map(r=>'<option value="'+r.id+'">'+esc(r.title)+'</option>').join('');$('bookSelect').value=selected}
 async function refreshList(){const {data,error}=await cloudClient.from('pp5_books').select('id,title,template_name,revision,updated_at').eq('classroom_id',cloudState.classroom.id).order('updated_at',{ascending:false});if(error)throw error;list=data||[];options()}
 function show(){ $('emptyBook').hidden=true;$('bookEditor').hidden=false;$('bookMeta').textContent=record.template_name;updateHeading();render();status(book.externalLinks?'แม่แบบมีสูตรอ้างอิงไฟล์ภายนอก โปรดตรวจลิงก์ใน Excel ก่อนใช้ผลสรุป':'พร้อมกรอกข้อมูล');$('saveState').textContent=dirty?'เล่มใหม่ — ยังไม่บันทึกบนคลาวด์':'บันทึกล่าสุด '+new Date(record.updated_at).toLocaleString('th-TH')}
 async function open(id){const {data,error}=await cloudClient.from('pp5_books').select('*').eq('id',id).eq('classroom_id',cloudState.classroom.id).single();if(error)throw error;const next=await PP5Workbook.Book.open(fromBase64(data.template_base64));record=data;book=next;patches=data.patches||{};dirty=false;show();options()}
 function validate(){const errors=[];let count=0;const codes=new Set();
  for(let r=4;r<=63;r++){const code=String(value('IN','C'+r)).trim(),name=String(value('IN','D'+r)).trim();if(!code&&!name)continue;count++;
   if(!code||!name)errors.push('เลขที่ '+(r-3)+': กรอกเลขประจำตัวและชื่อให้ครบ');
   if(code&&codes.has(code))errors.push('เลขประจำตัวซ้ำ: '+code);codes.add(code);
   for(const c of columns){const n=value('IN',c+r),max=Number(value('IN',c==='G'&&!Number(value('IN','G3'))?'F3':c+'3'));if(n!==''&&(!Number.isFinite(Number(n))||Number(n)<0||Number(n)>max))errors.push('เลขที่ '+(r-3)+': '+names[columns.indexOf(c)]+' ต้องอยู่ระหว่าง 0–'+max)}
   const special=String(value('IN','K'+r)).trim();if(special&&!['ร','มส','มส.','-'].includes(special))errors.push('เลขที่ '+(r-3)+': ผลพิเศษใช้ ร, มส. หรือ -');
  }
  for(const c of columns){const n=value('IN',c+'3');if(n===''||!Number.isFinite(Number(n))||Number(n)<0)errors.push('คะแนนเต็ม '+names[columns.indexOf(c)]+' ไม่ถูกต้อง')}
  if(!count)errors.push('ยังไม่มีรายชื่อนักเรียน');return errors;
 }
 async function save(){if(!editable())throw Error('ไม่มีสิทธิ์บันทึก');const issues=validate();if(issues.length)throw Error(issues.slice(0,12).join('\n'));const title=[value('IN','Q7'),value('IN','Q8')].filter(Boolean).join(' · ');if(!title)throw Error('กรอกรหัสวิชาหรือชื่อวิชาก่อนบันทึก');
  const base={title:title.slice(0,160),patches,updated_by:cloudState.user.id};let query;
  if(record.id)query=cloudClient.from('pp5_books').update(base).eq('id',record.id).eq('classroom_id',cloudState.classroom.id).eq('revision',record.revision);
  else query=cloudClient.from('pp5_books').insert({...base,classroom_id:cloudState.classroom.id,template_name:record.template_name,template_base64:toBase64(book.bytes)});
  const {data,error}=await query.select('id,title,revision,updated_at').maybeSingle();if(error)throw error;if(!data)throw Error('มีผู้แก้ไขเล่มนี้จากหน้าต่างอื่นแล้ว กรุณาดาวน์โหลด Excel เก็บงานในหน้านี้ก่อน แล้วเปิดเล่มล่าสุดเพื่อรวมข้อมูล');
  Object.assign(record,data);dirty=false;$('saveState').textContent='บันทึกบนคลาวด์แล้ว '+new Date(data.updated_at).toLocaleTimeString('th-TH');status('บันทึกสำเร็จ');await refreshList();
 }
 function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
 function pdf(){
  const issues=validate();if(issues.length)throw Error(issues.slice(0,12).join('\n'));
  if(book.externalLinks)throw Error('เล่มนี้ใช้ไฟล์นำเข้ารุ่นเก่าที่มีลิงก์ภายนอก กรุณาดาวน์โหลด Excel เพื่อพิมพ์ หรือสร้างเล่มด้วยแม่แบบในระบบ');
  for(let r=48;r<=63;r++)if(value('IN','C'+r)||value('IN','D'+r))throw Error('แบบพิมพ์ต้นฉบับมีช่องคะแนน 44 คน กรุณาดาวน์โหลด Excel เพื่อขยายช่วงพิมพ์ให้ครบทุกคน');
  const printPatches={};for(const [sheet,cells] of Object.entries(book.cells))for(const [ref,c] of Object.entries(cells))if(c.formula==null)printPatches[sheet+'!'+ref]=c.value??'';
  Object.assign(printPatches,patches);
  const job=crypto.randomUUID(),child=window.open('../print/pp5.html?job='+encodeURIComponent(job),'_blank');
  if(!child)throw Error('เบราว์เซอร์ปิดกั้นหน้าพิมพ์ กรุณาอนุญาตป๊อปอัปสำหรับเว็บไซต์นี้ แล้วกดอีกครั้ง');
  const listener=e=>{if(e.origin!==location.origin||e.source!==child||e.data?.type!=='pp5-print-ready'||e.data.job!==job)return;child.postMessage({type:'pp5-print-data',job,patches:printPatches,title:'ปพ5_'+String(value('IN','Q7')||'รายวิชา')},location.origin);window.removeEventListener('message',listener);clearTimeout(timeout)};
  window.addEventListener('message',listener);const timeout=setTimeout(()=>window.removeEventListener('message',listener),60000);
  status('เปิดหน้าพิมพ์แล้ว — กดพิมพ์และเลือก Save as PDF');
 }
 async function excel(){const issues=validate();if(issues.length)throw Error(issues.slice(0,12).join('\n'));download(await book.export(patches),'ปพ5_'+String(value('IN','Q7')||'รายวิชา').replace(/[\\/:*?"<>|]/g,'_')+'.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');status('ดาวน์โหลด Excel แล้ว — เปิดไฟล์เพื่อคำนวณสูตรล่าสุดก่อนพิมพ์')}
 function render(){const panel=$('pp5Panel');if(tab==='info'){
  const labels=['ระดับ','ครูที่ปรึกษา 1','ครูที่ปรึกษา 2','รหัสวิชา','ชื่อวิชา','หน่วยกิต','ชื่อ ผอ.','รองวิชาการ','ปีการศึกษา','ภาคเรียน','ชั่วโมงต่อสัปดาห์','ช่วงชั้น','ชื่อผู้สอน','กลุ่มสาระ','หัวหน้ากลุ่มสาระ','หัวหน้างานวัดผล','โรงเรียน','ที่อยู่โรงเรียน','สังกัด','ชั้น/ห้อง'];
  panel.innerHTML='<h2>ข้อมูลรายวิชาและหน้าปก</h2><div class="pp5-grid">'+labels.map((s,i)=>'<label>'+s+input('IN','Q'+(i+4),{label:s,numeric:[9,12,13,14,15].includes(i+4)})+'</label>').join('')+'</div>';
 }else if(tab==='indicators'){
  panel.innerHTML='<h2>ตัวชี้วัด / ผลการเรียนรู้</h2><p class="sub">บันทึกในชีต D ของแม่แบบโดยตรง</p><div class="table-wrap"><table class="pp5-table"><thead><tr><th>ข้อที่</th><th>ตัวชี้วัด / ผลการเรียนรู้</th>'+[1,2,3,4,5,6].map(n=>'<th>ประเมิน '+n+'</th>').join('')+'</tr></thead><tbody>'+Array.from({length:40},(_,i)=>'<tr><td>'+(i+1)+'</td><td>'+input('D','C'+(i+8),{className:'pp5-indicator',label:'ตัวชี้วัดข้อ '+(i+1)})+'</td>'+['O','P','Q','R','S','T'].map(c=>'<td>'+input('D',c+(i+8),{numeric:true,label:'คะแนนประเมินข้อ '+(i+1)+' '+c})+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 }else if(tab==='attendance'){
  panel.innerHTML='<h2>บันทึกเวลาเรียนรายวิชา</h2><p class="pp5-note">เลือกวันที่เรียนในสัปดาห์แรก ระบบใช้สูตรเดิมคำนวณสัปดาห์ถัดไป • ช่องเวลาเรียนใช้เครื่องหมายตามแม่แบบเดิม: / มาเรียน, - ไม่มีคาบเรียน, ป ป่วย, ล ลา, ส สาย, ข ขาด<br>แต่ละสัปดาห์มี 5 ช่องตามต้นฉบับ กรุณาตรวจตารางเรียนใน Excel ก่อนพิมพ์</p><div class="pp5-max">'+['F','G','H','I','J'].map((c,i)=>'<label>วันที่เรียนช่อง '+(i+1)+input('W1',c+'5',{numeric:true,label:'วันที่เริ่มเรียนช่อง '+(i+1)})+'</label>').join('')+'</div><label>สัปดาห์ <select id="pp5Week" class="cloud-allow">'+Array.from({length:20},(_,i)=>'<option '+(week===i+1?'selected':'')+'>'+(i+1)+'</option>').join('')+'</select></label><div class="table-wrap"><table class="pp5-table"><thead><tr><th>เลขที่</th><th>ชื่อ-สกุล</th>'+[1,2,3,4,5].map(n=>'<th>ช่อง '+n+'</th>').join('')+'</tr></thead><tbody>'+Array.from({length:60},(_,i)=>{if(!value('IN','C'+(i+4))&&!value('IN','D'+(i+4)))return '';return '<tr><td>'+(i+1)+'</td><td>'+esc(value('IN','D'+(i+4)))+'</td>'+[0,1,2,3,4].map(k=>{const ref=PP5Workbook.col(7+(week-1)*5+k)+(i+7);return '<td><select data-sheet="CH" data-ref="'+ref+'" '+(!editable()?'disabled':'')+' aria-label="เวลาเรียนเลขที่ '+(i+1)+' ช่อง '+(k+1)+'">'+['','/','-','ป','ล','ส','ข'].map(v=>'<option value="'+v+'" '+(value('CH',ref)===v?'selected':'')+'>'+({'':'ยังไม่บันทึก','/':'มา','-':'ไม่มีคาบ','ป':'ป่วย','ล':'ลา','ส':'สาย','ข':'ขาด'}[v])+'</option>').join('')+'</select></td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>';
  $('pp5Week').onchange=e=>{week=+e.target.value;render()};
 }else{
  panel.innerHTML='<div class="pp5-toolbar"><div><h2>คะแนนและรายชื่อนักเรียน</h2><span class="pp5-count">รองรับ 60 คนตามแม่แบบ • ช่องว่างคือยังไม่กรอก และ 0 คือคะแนนศูนย์</span></div><button id="importRoster" class="btn" '+(!editable()?'disabled':'')+'>ใช้รายชื่อจากห้องนี้</button></div><div class="pp5-max">'+columns.map((c,i)=>'<label>เต็ม: '+names[i]+input('IN',c+'3',{numeric:true,label:'คะแนนเต็ม '+names[i]})+'</label>').join('')+'</div><input id="pp5Search" class="pp5-search cloud-allow" type="search" placeholder="ค้นหาเลขที่ รหัส หรือชื่อ" aria-label="ค้นหานักเรียน"><div class="table-wrap"><table class="pp5-table"><thead><tr><th>เลขที่</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th>'+names.map(n=>'<th>'+n+'</th>').join('')+'<th>ร / มส.</th></tr></thead><tbody>'+Array.from({length:60},(_,i)=>{const r=i+4;return '<tr><td>'+(i+1)+'</td><td>'+input('IN','C'+r,{className:'student-code',label:'เลขประจำตัวเลขที่ '+(i+1)})+'</td><td>'+input('IN','D'+r,{className:'student-name',label:'ชื่อเลขที่ '+(i+1)})+'</td>'+columns.map((c,k)=>'<td>'+input('IN',c+r,{numeric:true,label:names[k]+' เลขที่ '+(i+1)})+'</td>').join('')+'<td>'+input('IN','K'+r,{label:'ผลพิเศษเลขที่ '+(i+1)})+'</td></tr>'}).join('')+'</tbody></table></div>';
  $('pp5Search').oninput=e=>panel.querySelectorAll('tbody tr').forEach(row=>row.hidden=!(row.textContent+' '+[...row.querySelectorAll('input')].map(x=>x.value).join(' ')).includes(e.target.value.trim()));
  $('importRoster').onclick=()=>{const roster=students();if(!roster.length)return message('ยังไม่มีรายชื่อ','เพิ่มนักเรียนในข้อมูลห้องเรียนก่อน');if(roster.length>60)return message('จำนวนเกินแม่แบบ','แม่แบบนี้รองรับไม่เกิน 60 คน');
   const ids=roster.map(s=>String(s.id||'').trim());if(ids.some(x=>!x)||new Set(ids).size!==ids.length)return message('ตรวจเลขประจำตัว','นักเรียนในห้องต้องมีเลขประจำตัวที่ไม่ซ้ำกัน เพื่อเชื่อมคะแนนให้ถูกคน');
   const previous=new Map();for(let i=0;i<60;i++){const id=String(value('IN','C'+(i+4))).trim();if(!id)continue;if(previous.has(id))return message('เลขประจำตัวซ้ำในเล่ม','กรุณาแก้เลขประจำตัวซ้ำก่อนเชื่อมรายชื่อ');previous.set(id,{scores:[...columns,'K'].map(c=>value('IN',c+(i+4))),attendance:Array.from({length:100},(_,c)=>value('CH',PP5Workbook.col(c+7)+(i+7)))})}
   if(!confirm('อัปเดตรายชื่อจากห้องเรียน โดยรักษาคะแนนและเวลาเรียนตามเลขประจำตัวเดิม? นักเรียนที่ออกจากห้องจะถูกนำออกจากเล่มนี้'))return;
   for(let i=0;i<60;i++){const r=i+4,id=String(roster[i]?.id||'').trim(),old=previous.get(id);put('IN','C'+r,id);put('IN','D'+r,roster[i]?.name||'');[...columns,'K'].forEach((c,k)=>put('IN',c+r,old?.scores[k]??''));for(let c=7;c<=106;c++)if(book.cells.CH[PP5Workbook.col(c)+(i+7)]?.formula==null)put('CH',PP5Workbook.col(c)+(i+7),old?.attendance[c-7]??'')}
   render();
  };
 }
 panel.querySelectorAll('[data-ref]').forEach(el=>{
  if(el.dataset.sheet==='W1'){const serial=el.value;el.type='date';el.value=serialToDate(serial)}
  el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{const v=el.type==='date'?(el.value?Math.round(Date.parse(el.value+'T00:00:00Z')/86400000)+25569:''):el.type==='number'&&el.value!==''?Number(el.value):el.value;put(el.dataset.sheet,el.dataset.ref,v)});
 });
 }
 window.initPP5=async()=>{
  await refreshList();status(list.length?'เลือกรายวิชาที่ต้องการ':'ยังไม่มีเล่ม ปพ.5 ในห้องนี้');lock(false);
  $('newBook').onclick=()=>{if(dirty&&!confirm('มีข้อมูลที่ยังไม่บันทึก ต้องการละทิ้งแล้วเพิ่มเล่มใหม่หรือไม่?'))return;guard(createFromRoom)};
  $('bookSelect').onchange=e=>{const id=e.target.value;if(!id){e.target.value=record?.id||'';return}if(dirty&&!confirm('ละทิ้งการแก้ไขที่ยังไม่บันทึกแล้วเปิดเล่มอื่นหรือไม่?')){e.target.value=record?.id||'';return}guard(()=>open(id))};
  $('saveBook').onclick=()=>guard(save);$('exportBook').onclick=()=>guard(excel);
  $('exportPdf').onclick=()=>guard(pdf);
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-selected',String(x===b))});render()});
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
 };
})();
