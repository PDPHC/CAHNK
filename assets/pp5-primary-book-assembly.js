(()=>{'use strict';
 const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function plan(courses,courseCode=null){const selected=courseCode?courses.filter(c=>c.code===courseCode):courses;return [
  {title:'หน้าปก',kind:'cover'},
  {title:'เช็กเวลาเรียน ภาคเรียนที่ 1',url:'pp5-primary-attendance.html',term:1},
  {title:'เช็กเวลาเรียน ภาคเรียนที่ 2',url:'pp5-primary-attendance.html',term:2},
  {title:'เกณฑ์คุณลักษณะอันพึงประสงค์',kind:'criteria',key:'traits'},
  {title:'สรุปผลคุณลักษณะอันพึงประสงค์',url:'pp5-primary-traits.html'},
  {title:'เกณฑ์อ่าน คิดวิเคราะห์ และเขียน',kind:'criteria',key:'reading'},
  {title:'ผลอ่าน คิดวิเคราะห์ และเขียน',url:'pp5-primary-reading.html'},
  ...selected.map((course,i)=>({title:'วิชาที่ '+(i+1)+' · '+course.code+' '+course.name,url:'pp5-primary-score-editor.html',course:course.code})),
  {title:'กิจกรรมพัฒนาผู้เรียน',url:'pp5-primary-activities.html'},
  ...(!courseCode?[{title:'รวมผลการเรียน',url:'pp5-primary-summary.html'}]:[])];}
 function showOrder(courses){const select=$('bookCourseSelect'),current=select.value;select.innerHTML=courses.map(c=>'<option value="'+esc(c.code)+'">'+esc(c.code+' · '+c.name)+'</option>').join('');if(courses.some(c=>c.code===current))select.value=current;$('bookCourseRows').innerHTML=courses.map((c,i)=>'<tr><td>'+(i+1)+'</td><td><strong>'+esc(c.name)+'</strong><small>'+esc(c.code)+'</small></td><td><button type="button" data-book-course-action="preview" data-course="'+esc(c.code)+'">ดูตัวอย่างปก</button><button type="button" class="course-print-action" data-book-course-action="print" data-course="'+esc(c.code)+'">พิมพ์ / บันทึก PDF</button></td></tr>').join('');}
 async function section(item,room){
  const frame=document.createElement('iframe'),url=new URL(item.url,location.href);url.searchParams.set('classroom',room.id);url.searchParams.set('book','1');if(item.term)url.searchParams.set('term',item.term);if(item.course)url.searchParams.set('course',item.course);
  frame.title=item.title;frame.src=url.href;$('bookFrameHost').append(frame);
  try{const started=Date.now();while(Date.now()-started<90000){
   if(frame.contentWindow?.PrimaryBookSection?.ready())return await frame.contentWindow.PrimaryBookSection.prepare();
   await new Promise(resolve=>setTimeout(resolve,150));
  }throw Error('โหลดข้อมูลไม่สำเร็จหรือหมดเวลา กรุณาเปิดเมนูนี้เพื่อตรวจสอบ');}finally{frame.remove();}
 }
 async function print({room,courses,cover,status,selectedCourse=null}){
  const root=$('wholeBookPrint');root.replaceChildren();if(!courses.length)throw Error('ยังไม่มีรายวิชาในโครงสร้าง');if(selectedCourse&&!courses.some(c=>c.code===selectedCourse.code))throw Error('ไม่พบรายวิชาที่เลือกในโครงสร้าง');
  const criteriaResponse=await fetch('assets/pp5-primary-book-criteria.json?v=20261016');if(!criteriaResponse.ok)throw Error('โหลดหน้าเกณฑ์ไม่ได้');const criteria=await criteriaResponse.json(),items=plan(courses,selectedCourse?.code),cache=new Map();
  try{for(const [i,item] of items.entries()){
   status('เตรียมเอกสาร '+(i+1)+'/'+items.length+' · '+item.title);
   let part;
   try{part=item.kind==='cover'?{classes:'primary-book-print primary-workspace',css:'assets/pp5-primary-book-print.css',html:cover.outerHTML.replace(/ hidden(?:="")?/g,'')}:item.kind==='criteria'?{classes:'',html:criteria[item.key].map(src=>'<section class="book-criteria-page"><img alt="'+esc(item.title)+'" src="'+src+'"></section>').join('')}:await section(item,room);}catch(error){throw Error(item.title+': '+error.message);}
   const host=document.createElement('section');host.className='whole-book-section';host.dataset.title=item.title;root.append(host);
   const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');let css='';
   if(part.css){if(!cache.has(part.css)){const r=await fetch(part.css+'?v=20261017-signatures');if(!r.ok)throw Error('โหลดรูปแบบเอกสารไม่ได้');cache.set(part.css,await r.text());}css=cache.get(part.css).replace(/@page\s*\{[^}]*\}/g,'').replace(/url\(["']?([^)'"\s]+)["']?\)/g,(_,path)=>'url("'+new URL(path,new URL(part.css,location.href)).href+'")');}
   style.textContent=css+'\n:host{display:block;color:#000;background:white} :host,*{font-family:"PP5 TH Sarabun","TH Sarabun New",serif!important}*,*::before,*::after{box-sizing:border-box} .book-criteria-page{width:186mm;height:263mm;break-after:page}.book-criteria-page:last-child{break-after:auto}.book-criteria-page img{display:block;width:100%;height:100%;object-fit:contain} .book-cover{margin:0 auto!important}';
   const wrapper=document.createElement('div');wrapper.className=part.classes;wrapper.innerHTML=part.html;shadow.append(style,wrapper);
  }
  document.body.classList.add('printing-whole-book');await document.fonts.load('14pt "PP5 TH Sarabun"');await document.fonts.ready;
  for(const host of root.children)await Promise.all([...host.shadowRoot.querySelectorAll('img')].map(img=>img.decode()));
  // Let layout settle before the print preview snapshots the shadow trees.
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));window.print();status('เตรียมเอกสารทั้งเล่มครบ '+items.length+' ส่วนแล้ว');
  }catch(error){root.replaceChildren();throw error;}finally{document.body.classList.remove('printing-whole-book');$('bookFrameHost').replaceChildren();}
 }
 window.PrimaryBookAssembly={plan,showOrder,print};
})();
