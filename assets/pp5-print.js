Warning: truncated output (original token count: 6346)
Total output lines: 159

(()=>{'use strict';
 const status=document.getElementById('printStatus'),button=document.getElementById('printButton'),pages=document.getElementById('pages');
 const job=new URLSearchParams(location.search).get('job');let received=false;
 const fail=e=>{status.textContent='เปิดหน้าพิมพ์ไม่สำเร็จ: '+(e.message||e);status.className='error';button.disabled=true;document.body.classList.remove('ready')};
 const sum=a=>a.reduce((s,v)=>s+v,0),offsets=a=>{let n=0;return [0,...a.map(v=>n+=v)]};
 function display(v,s){if(v==null)return '';if(typeof v==='boolean')return v?'TRUE':'FALSE';if(typeof v!=='number')return String(v).replaceAll('อาจารย์ประจำชั้น','ครูประจำชั้น').replaceAll('ครูที่ปรึกษา','ครูประจำชั้น');
  if([14,15,16,17,22,164,165,166,167].includes(s.format)){if(!v)return '';const date=new Date((v-25569)*86400000),day=date.getUTCDate(),month=date.toLocaleString('th-TH',{month:'short',timeZone:'UTC'});return s.format===164?String(day):s.format===165?month:s.format===166?day+'/'+month:day+'/'+month+'/'+(date.getUTCFullYear()+543)}
  if(s.format===9)return Math.round(v*100)+'%';if(s.format===10)return (v*100).toFixed(2)+'%';if(s.format===2)return v.toFixed(2);return String(Math.round(v*1e10)/1e10);
 }
 async function render(data){
  const response=await fetch('../assets/pp5-print-template.json?v=2');if(!response.ok)throw Error('โหลดแบบฟอร์มไม่สำเร็จ');const packed=await response.json();const zip=await JSZip.loadAsync(packed.base64,{base64:true});const template=JSON.parse(await zip.file('print.json').async('string'));
  const printPatches={...(data.patches||{})},sourceCalc=new PP5Calc.Calculator(template.cells,printPatches),finalColumns=['CD','CE','CF','CG','CH','CI','CJ','CK','CL','CM'];
  // The summary score in IN!J is a single total. When no objective-level final scores were entered,
  // distribute that total across the configured final objectives by their full-mark weights.
  for(let studentRow=4;studentRow<=47;studentRow++){
   const rawTotal=sourceCalc.get('IN','J'+studentRow);
   if(rawTotal==null||rawTotal==='')continue;
   const detailRow=studentRow+3,active=finalColumns.map(column=>({column,max:Number(sourceCalc.get('F',column+'6')),label:String(sourceCalc.get('F',column+'5')??'').trim()})).filter(item=>item.label&&Number.isFinite(item.max)&&item.max>0);
   if(!active.length||active.some(item=>Object.hasOwn(printPatches,'F!'+item.column+detailRow)))continue;
   const maxTotal=active.reduce((sum,item)=>sum+item.max,0),total=Math.min(maxTotal,Math.max(0,Math.round(Number(rawTotal)*100)/100));
   let assigned=0;active.forEach((item,index)=>{const score=index===active.length-1?Math.round((total-assigned)*10000)/10000:Math.round((total*item.max/maxTotal)*10000)/10000;printPatches['F!'+item.column+detailRow]=score;assigned+=score});
  }
  const scoreCalc=new PP5Calc.Calculator(template.cells,printPatches),printColumns=['BG','BH','BI','BJ','BK','BL','BM','BN','BO','BP'];
  for(let studentRow=4;studentRow<=47;studentRow++){
   if(!scoreCalc.get('IN','C'+studentRow)&&!scoreCalc.get('IN','D'+studentRow))continue;
   for(let i=0;i<finalColumns.length;i++){const score=scoreCalc.get('F',finalColumns[i]+(studentRow+3));if(score!=null&&score!=='')printPatches['C!'+printColumns[i]+(studentRow+5)]=score}
  }
  const calc=new PP5Calc.Calculator(template.cells,printPatches),errors=[];pages.replaceChildren();
  // Never silently omit pupils beyond the original 44-row printed score form.
  for(let r=48;r<=63;r++)if(calc.get('IN','C'+r)||calc.get('IN','D'+r))throw Error('แบบพิมพ์ต้นฉบับมีช่องคะแนน 44 คน ห้องนี้มีรายชื่อเกินช่วงพิมพ์ กรุณาดาวน์โหลด Excel เพื่อขยายช่วงพิมพ์ให้ครบก่อน');
  await document.fonts.ready;
  const selectedPages=template.pages.filter(p=>!data.report||p.sheet===data.report);if(!selectedPages.length)throw Error('ไม่พบรายงานที่เลือก');
  let lastStudent=0;for(let r=4;r<=63;r++)if(calc.get('IN','C'+r)||calc.get('IN','D'+r))lastStudent=r-3;
  for(const [index,sourcePage] of selectedPages.entries()){
   if(sourcePage.sheet==='G'){const response=await fetch('../assets/pp5-criteria-page.json?v=1');if(!response.ok)throw Error('โหลดหน้าเกณฑ์การประเมินผลไม่สำเร็จ');const reference=await response.json();const paper=document.createElement('section');paper.className='paper a4';paper.setAttribute('aria-label','กำหนดเกณฑ์การประเมินผล');const image=document.createElement('img');image.src=reference.image;image.alt='กำหนดเกณฑ์การประเมินผล ตามเอกสารของโรงเรียน';image.style.cssText='display:block;width:100%;height:100%;object-fit:contain';paper.append(image);const ratio=PP5Calc.scoreRatio((sheet,ref)=>calc.get(sheet,ref));[92.42,114.26].forEach((top,i)=>{const number=document.createElement('span');number.dataset.criteriaRatio=String(i);number.textContent=ratio?String(ratio[i]):'—';number.setAttribute('aria-label',(i?'คะแนนปลายภาค ':'คะแนนระหว่างเรียน ')+number.textContent);Object.assign(number.style,{position:'absolute',left:(322.01/reference.width*100)+'%',top:(top/reference.height*100)+'%',width:(63.26/reference.width*100)+'%',height:(21.24/reference.height*100)+'%',display:'flex',alignItems:'center',justifyContent:'center',font:'14pt Tahoma,sans-serif',color:'#000'});paper.append(number)});pages.append(paper);continue;}
   const page={...sourcePage,heights:[...sourcePage.heights]},start={B:11,C:9,E:9}[page.sheet],firstRow=Number(page.area.split(':')[0].match(/\d+/)[0]);
   if(start)page.heights=page.heights.map((height,i)=>firstRow+i>=start+lastStudent&&firstRow+i<=({B:55,C:52,E:52}[page.sheet])?0:height);
   if(page.sheet==='D'){
    for(const row of [28,29,30]){const text=String(calc.get('D','C'+row)||''),lines=text.split('\n').reduce((n,s)=>n+Math.max(1,Math.ceil(s.length/(row<24?65:85))),0);page.heights[row-firstRow]=Math.max(page.heights[row-firstRow],lines*17+5)}
    page.heights[26-firstRow]=38;
    for(const r of data.patches.__pp5_deleted_indicators||[])page.heights[r-firstRow]=0;
    // Use the unused bottom of the original sheet for wrapped indicator rows.
    for(let r=43;r<=52;r++)page.heights[r-firstRow]=0;
    const widths=offsets(page.widths),pw=210*72/25.4,ph=297*72/25.4,[left,right,top,bottom]=page.margins;
    const widthScale=Math.min(page.fit?1:(page.scale||1),(pw-Math.max(left,25*72/25.4)-right)/sum(page.widths));
    const rowIds=Array.from({length:15},(_,i)=>i+8).filter(r=>!(data.patches.__pp5_deleted_indicators||[]).includes(r)),other=sum(page.heights)-sum(rowIds.map(r=>page.heights[r-firstRow])),budget=(ph-top-bottom)/widthScale-other-2;
    const source=page.cells.find(c=>c[2]==='C8'),merge=page.merges.find(m=>m[0]===source[0]&&m[1]===source[1]),style=template.styles[source[3]];
    const measure=document.createElement('div');Object.assign(measure.style,{position:'absolute',visibility:'hidden',width:(widths[merge[2]+1]-widths[source[0]]-4)+'pt',fontFamily:'"'+style.font+'", "TH Sarabun New", Tahoma, sans-serif',whiteSpace:'pre-wrap',overflowWrap:'anywhere',lineHeight:'1.2'});document.body.append(measure);
    let size=12,heights;do{measure.style.fontSize=size+'pt';heights=rowIds.map(r=>{measure.textContent=String(calc.get('D','C'+r)||' ');return Math.max(sourcePage.heights[r-firstRow],measure.getBoundingClientRect().height*72/96+4)});if(sum(heights)<=budget||size<=4)break;size-=.25;}while(true);measure.remove();page.indicatorFont=size;rowIds.forEach((r,i)=>page.heights[r-firstRow]=heights[i]);
   }
   const paper=document.createElement('section');paper.className='paper '+page.paper;paper.setAttribute('aria-label','หน้าที่ '+(index+1)+' ชีต '+page.sheet);
   const sheet=document.createElement('div');sheet.className='sheet';const xs=offsets(page.widths),ys=offsets(page.heights),w=sum(page.widths),h=sum(page.heights),pw=page.paper==='legal'?612:210*72/25.4,ph=page.paper==='legal'?1008:297*72/25.4,[originalLeft,mr,mt,mb]=page.margins,ml=Math.max(originalLeft,25*72/25.4);
   // Reserve at least 25 mm on the binding edge; fit proportionally inside the remaining paper.
   const scale=Math.min(page.fit?1:(page.scale||1),(pw-ml-mr)/w,(ph-mt-mb)/h);
   const left=ml+(page.centerX?Math.max(0,pw-ml-mr-w*scale)/2:0),top=mt+(page.centerY?Math.max(0,ph-mt-mb-h*scale)/2:0);
   Object.assign(sheet.style,{left:left+'pt',top:top+'pt',width:w+'pt',height:h+'pt',transform:'scale('+scale+')'});
   const merged=new Map(page.merges.map(m=>[m[0]+','+m[1],m])),edges=new Set();
   for(const [x,y,ref,style] of page.cells){const m=merged.get(x+','+y),cw=xs[(m?m[2]:x)+1]-xs[x],ch=ys[(m?m[3]:y)+1]-ys[y];if(!cw||!ch)continue;const s=template.styles[style],cell=document.createElement('div'),span=document.createElement('span');cell.className='cell'+(s.wrap?' wrap':'')+(s.rotation?' rotated':'');cell.dataset.ref=page.sheet+'!'+ref;
    Object.assign(cell.style,{left:xs[x]+'pt',top:ys[y]+'pt',width:cw+'pt',height:ch+'pt',fontFamily:'"'+s.font+'", "TH Sarabun New", Tahoma, sans-serif',fontSize:s.size+'pt',fontWeight:s.bold?'bold':'normal',fontStyle:s.italic?'italic':'normal',color:s.color,background:s.fill,borderLeft:s.borders[0],borderRight:s.borders[1],borderTop:s.borders[2],borderBottom:s.borders[3],alignItems:s.vertical==='top'?'flex-start':s.vertical==='center'?'center':'flex-end',justifyContent:s.align==='center'||s.align==='centerContinuous'?'center':s.align==='right'?'flex-…1346 tokens truncated…';logo.src='data:image/png;base64,'+template.logo;Object.assign(logo.style,{left:(xs[6]+424816/12700)+'pt',top:(ys[1]+13849/12700)+'pt',width:(859155/12700)+'pt',height:(859155/12700)+'pt'});sheet.append(logo)}
   if(page.sheet==='A'){
    const roles={37:'ครูผู้สอน/ครูประจำรายวิชา',39:'หัวหน้ากลุ่มสาระการเรียนรู้',41:PP5Assessment.resolve(calc.get('IN','Q23'))?.[1]||'หัวหน้างานวัดผล',};
    for(const [row,role] of Object.entries(roles)){
     const line=document.createElement('div');line.className='signature-row';line.dataset.signatureRow=row;
     Object.assign(line.style,{left:xs[3]+'pt',top:ys[Number(row)-3]+'pt',width:(xs[xs.length-1]-xs[3]-4)+'pt',height:page.heights[Number(row)-3]+'pt'});
     const label=document.createElement('span');label.textContent='ลงชื่อ';
     const rule=document.createElement('span');rule.className='signature-rule';
     const title=document.createElement('span');title.className='signature-role';title.textContent=role;
     line.append(label,rule,title);sheet.append(line);
    }
    const choices=document.createElement('div');choices.className='approval-choices';
    Object.assign(choices.style,{left:'0pt',top:ys[43]+'pt',width:w+'pt',height:page.heights[43]+'pt'});
    for(const text of ['อนุมัติ','ไม่อนุมัติ']){const choice=document.createElement('span');choice.className='approval-choice';const box=document.createElement('span');box.className='approval-box';box.setAttribute('aria-hidden','true');choice.append(box,document.createTextNode(text));choices.append(choice)}
    sheet.append(choices);
   }
   if(page.sheet==='A'&&Object.keys(data.signatures||{}).length){
    // Render the signed approval area inside the original cover frame.
    sheet.querySelectorAll('[data-ref]').forEach(cell=>{if(Number(cell.dataset.ref.match(/\d+$/)?.[0])>=36)cell.style.visibility='hidden'});
    sheet.querySelectorAll('.signature-row,.approval-choices').forEach(el=>el.remove());
    const region=document.createElement('section');region.className='signed-approval';Object.assign(region.style,{position:'absolute',left:(xs[1]+3)+'pt',top:ys[33]+'pt',width:(w-xs[1]-6)+'pt',height:(h-ys[33]-3)+'pt',display:'flex',flexDirection:'column',fontSize:'12pt',background:'#fff'});
    const heading=document.createElement('div');heading.textContent='การอนุมัติผลการพัฒนาคุณภาพผู้เรียน';heading.style.height='16pt';region.append(heading);
    const roles=[['teacher','ครูผู้สอน/ครูประจำรายวิชา','Q16'],['department','หัวหน้ากลุ่มสาระการเรียนรู้','Q18'],['assessment',PP5Assessment.resolve(calc.get('IN','Q23'))?.[1]||'หัวหน้างานวัดผล','Q19'],['deputy','รองผู้อำนวยการฝ่ายบริหารงานวิชาการ','Q11'],['director','ผู้อำนวยการโรงเรียน','Q10']];
    for(const [key,title,ref] of roles){
     if(key==='director'){const choices=document.createElement('div');choices.style.cssText='text-align:center;height:20pt;flex-shrink:0';choices.textContent=(data.signatures.director?'☑':'□')+' อนุมัติ       □ ไม่อนุมัติ';region.append(choices)}
     const row=document.createElement('div');row.dataset.signedStage=key;row.style.cssText='position:relative;flex:1;min-height:0;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center';
     const sig=data.signatures[key],image=document.createElement('div');image.style.cssText='height:23pt;width:105pt;flex-shrink:0;border-bottom:0.5pt dotted #444';
     if(sig&&/^data:image\/(png|jpeg|webp);base64,/.test(sig.image)){const img=document.createElement('img');img.alt='ลายเซ็น'+title;img.src=sig.image;img.style.cssText='width:100%;height:100%;object-fit:contain';image.append(img)}
     const name=document.createElement('span');name.textContent='( '+(sig?.name||calc.get('IN',ref)||'')+' )';name.style.cssText='font-size:12pt;line-height:15pt;max-width:100%';
     const label=document.createElement('span');label.textContent=title;label.style.cssText='position:absolute;right:4pt;top:3pt;width:140pt;text-align:right;font-size:11pt;line-height:1.1';row.append(image,name,label);region.append(row);
    }
    const dated=document.createElement('div');dated.style.cssText='text-align:center;font-size:11pt;height:15pt';dated.textContent=data.signatures.director?'อนุมัติวันที่ '+new Date(data.signatures.director.at).toLocaleDateString('th-TH'):'วันที่ .......... / .......... / ..........';region.append(dated);sheet.append(region);
   }
   const grid=document.createElementNS('http://www.w3.org/2000/svg','svg');grid.setAttribute('viewBox','0 0 '+w+' '+h);Object.assign(grid.style,{position:'absolute',left:'0',top:'0',width:w+'pt',height:h+'pt',overflow:'visible',pointerEvents:'none',zIndex:'3'});const path=document.createElementNS(grid.namespaceURI,'path');path.setAttribute('d',[...edges].map(e=>{const [x1,y1,x2,y2]=e.split(',');return 'M'+x1+' '+y1+'L'+x2+' '+y2}).join(''));path.setAttribute('fill','none');path.setAttribute('stroke','#222');path.setAttribute('stroke-width','0.6');grid.append(path);sheet.append(grid);
   paper.append(sheet);
   if(start){const legend=document.createElement('p');legend.className='student-status-legend';legend.textContent='† ย้ายออก   ‡ ไม่มีตัวตน   ★ นักเรียนห้องพิเศษ';paper.append(legend)}
   pages.append(paper);
  }
  const extraCount=Number(data.patches.__pp5_indicator_count||0);let appendixPages=0,appendixAnchor=[...pages.children].find(p=>p.getAttribute('aria-label')?.endsWith('ชีต D'));
  if(extraCount&&(!data.report||data.report==='D'))for(let start=0;start<extraCount;start+=15){
   const paper=document.createElement('section');paper.className='paper a4 indicator-appendix';const title=document.createElement('h2');title.textContent='ตัวชี้วัด / ผลการเรียนรู้ (เพิ่มเติม)';paper.append(title);const course=document.createElement('p');course.textContent=[calc.get('IN','Q7'),calc.get('IN','Q8'),calc.get('IN','Q23')].filter(Boolean).join(' • ');paper.append(course);
   const table=document.createElement('table');table.innerHTML='<colgroup><col style="width:5%"><col style="width:59%">'+Array(6).fill('<col style="width:6%">').join('')+'</colgroup><thead><tr><th rowspan="2">ข้อที่</th><th rowspan="2">ตัวชี้วัด/ผลการเรียนรู้</th><th colspan="6">คะแนนการประเมินผล</th></tr><tr><th>1</th><th>2</th><th>3</th><th>4</th><th>รวม</th><th>ชม.</th></tr></thead>';const body=document.createElement('tbody');
   for(let i=start;i<Math.min(extraCount,start+15);i++){const row=54+i,tr=document.createElement('tr'),scores=['O','P','Q','R'].map(c=>Number(data.patches['D!'+c+row]||0));for(const v of [16+i,data.patches['D!C'+row]||'',...scores,scores.reduce((a,b)=>a+b,0),data.patches['D!T'+row]||0]){const td=document.createElement('td');td.textContent=String(v);tr.append(td)}body.append(tr)}table.append(body);paper.append(table);if(appendixAnchor)appendixAnchor.after(paper);else pages.append(paper);appendixAnchor=paper;appendixPages++;
  }
  await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));
  for(const cell of pages.querySelectorAll('[data-shrink]')){const span=cell.firstChild;const ratio=Math.min(1,(cell.clientWidth-3)/Math.max(1,span.scrollWidth),(cell.clientHeight-2)/Math.max(1,span.scrollHeight));if(ratio<1)span.style.fontSize=(parseFloat(cell.style.fontSize)*ratio)+'pt'}
  // Use one shared font size for the six attendance summary headings.
  const attendanceHeads=['DI10','DJ10','DK10','DL10','DM10','DN10'].map(ref=>pages.querySelector('[data-ref="B!'+ref+'"]')).filter(Boolean);
  if(attendanceHeads.length){const size=Math.min(...attendanceHeads.map(cell=>parseFloat(cell.firstChild.style.fontSize||cell.style.fontSize)));attendanceHeads.forEach(cell=>cell.firstChild.style.fontSize=size+'pt')}
  if(errors.length)throw Error('พบสูตรที่คำนวณไม่ได้ '+errors.slice(0,4).join(' • ')+' กรุณาส่งออก Excel เพื่อตรวจสอบ');
  document.title=data.title||'ปพ.5';document.body.classList.add('ready');status.textContent='พร้อมพิมพ์ '+(selectedPages.length+appendixPages)+' หน้า • ข้อมูล ณ เวลาที่เปิดหน้านี้ หากแก้ไขเล่มให้เปิดหน้าพิมพ์ใหม่'+(selectedPages.some(p=>p.sheet!=='G'&&p.paper==='legal')?' • หน้ากำหนดเกณฑ์ใช้กระดาษ Legal ตามต้นฉบับ':' • กระดาษ A4');button.disabled=false;
 }
 button.addEventListener('click',()=>window.print());
 window.addEventListener('message',event=>{if(received||event.origin!==location.origin||event.source!==window.opener||event.data?.type!=='pp5-print-data'||event.data.job!==job)return;received=true;clearInterval(ping);render(event.data).catch(fail)});
 const ping=setInterval(()=>{if(window.opener&&!window.opener.closed)window.opener.postMessage({type:'pp5-print-ready',job},location.origin)},300);
 setTimeout(()=>{if(!received){clearInterval(ping);fail(Error('กลับไปที่เล่ม ปพ.5 แล้วกด “พิมพ์ / PDF” เพื่อเปิดหน้านี้ใหม่'))}},30000);
})();

