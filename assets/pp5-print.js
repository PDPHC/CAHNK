(()=>{'use strict';
 const status=document.getElementById('printStatus'),button=document.getElementById('printButton'),pages=document.getElementById('pages');
 const job=new URLSearchParams(location.search).get('job');let received=false;
 const fail=e=>{status.textContent='เปิดหน้าพิมพ์ไม่สำเร็จ: '+(e.message||e);status.className='error';button.disabled=true;document.body.classList.remove('ready')};
 const sum=a=>a.reduce((s,v)=>s+v,0),offsets=a=>{let n=0;return [0,...a.map(v=>n+=v)]};
 function display(v,s){if(v==null)return '';if(typeof v==='boolean')return v?'TRUE':'FALSE';if(typeof v!=='number')return String(v);
  if([14,15,16,17,22,164,165,166,167].includes(s.format)){if(!v)return '';const date=new Date((v-25569)*86400000),day=date.getUTCDate(),month=date.toLocaleString('th-TH',{month:'short',timeZone:'UTC'});return s.format===164?String(day):s.format===165?month:s.format===166?day+'/'+month:day+'/'+month+'/'+(date.getUTCFullYear()+543)}
  if(s.format===9)return Math.round(v*100)+'%';if(s.format===10)return (v*100).toFixed(2)+'%';if(s.format===2)return v.toFixed(2);return String(Math.round(v*1e10)/1e10);
 }
 async function render(data){
  const response=await fetch('../assets/pp5-print-template.json?v=2');if(!response.ok)throw Error('โหลดแบบฟอร์มไม่สำเร็จ');const packed=await response.json();const zip=await JSZip.loadAsync(packed.base64,{base64:true});const template=JSON.parse(await zip.file('print.json').async('string'));
  const calc=new PP5Calc.Calculator(template.cells,data.patches),errors=[];pages.replaceChildren();
  // Never silently omit pupils beyond the original 44-row printed score form.
  for(let r=48;r<=63;r++)if(calc.get('IN','C'+r)||calc.get('IN','D'+r))throw Error('แบบพิมพ์ต้นฉบับมีช่องคะแนน 44 คน ห้องนี้มีรายชื่อเกินช่วงพิมพ์ กรุณาดาวน์โหลด Excel เพื่อขยายช่วงพิมพ์ให้ครบก่อน');
  const selectedPages=template.pages.filter(p=>!data.report||p.sheet===data.report);if(!selectedPages.length)throw Error('ไม่พบรายงานที่เลือก');
  let lastStudent=0;for(let r=4;r<=63;r++)if(calc.get('IN','C'+r)||calc.get('IN','D'+r))lastStudent=r-3;
  for(const [index,sourcePage] of selectedPages.entries()){
   const page={...sourcePage,heights:[...sourcePage.heights]},start={B:11,C:9,E:9}[page.sheet],firstRow=Number(page.area.split(':')[0].match(/\d+/)[0]);
   if(start)page.heights=page.heights.map((height,i)=>firstRow+i>=start+lastStudent&&firstRow+i<=({B:55,C:52,E:52}[page.sheet])?0:height);
   if(page.sheet==='D'){
    for(const row of [28,29,30]){const text=String(calc.get('D','C'+row)||''),lines=text.split('\n').reduce((n,s)=>n+Math.max(1,Math.ceil(s.length/(row<24?65:85))),0);page.heights[row-firstRow]=Math.max(page.heights[row-firstRow],lines*17+5)}
    page.heights[26-firstRow]=38;
   }
   const paper=document.createElement('section');paper.className='paper '+page.paper;paper.setAttribute('aria-label','หน้าที่ '+(index+1)+' ชีต '+page.sheet);
   const sheet=document.createElement('div');sheet.className='sheet';const xs=offsets(page.widths),ys=offsets(page.heights),w=sum(page.widths),h=sum(page.heights),pw=page.paper==='legal'?612:210*72/25.4,ph=page.paper==='legal'?1008:297*72/25.4,[originalLeft,mr,mt,mb]=page.margins,ml=Math.max(originalLeft,25*72/25.4);
   // Reserve at least 25 mm on the binding edge; fit proportionally inside the remaining paper.
   const scale=Math.min(page.fit?1:(page.scale||1),(pw-ml-mr)/w,(ph-mt-mb)/h);
   const left=ml+(page.centerX?Math.max(0,pw-ml-mr-w*scale)/2:0),top=mt+(page.centerY?Math.max(0,ph-mt-mb-h*scale)/2:0);
   Object.assign(sheet.style,{left:left+'pt',top:top+'pt',width:w+'pt',height:h+'pt',transform:'scale('+scale+')'});
   const merged=new Map(page.merges.map(m=>[m[0]+','+m[1],m])),edges=new Set();
   for(const [x,y,ref,style] of page.cells){const m=merged.get(x+','+y),cw=xs[(m?m[2]:x)+1]-xs[x],ch=ys[(m?m[3]:y)+1]-ys[y];if(!cw||!ch)continue;const s=template.styles[style],cell=document.createElement('div'),span=document.createElement('span');cell.className='cell'+(s.wrap?' wrap':'')+(s.rotation?' rotated':'');cell.dataset.ref=page.sheet+'!'+ref;
    Object.assign(cell.style,{left:xs[x]+'pt',top:ys[y]+'pt',width:cw+'pt',height:ch+'pt',fontFamily:'"'+s.font+'", "TH Sarabun New", Tahoma, sans-serif',fontSize:s.size+'pt',fontWeight:s.bold?'bold':'normal',fontStyle:s.italic?'italic':'normal',color:s.color,background:s.fill,borderLeft:s.borders[0],borderRight:s.borders[1],borderTop:s.borders[2],borderBottom:s.borders[3],alignItems:s.vertical==='top'?'flex-start':s.vertical==='center'?'center':'flex-end',justifyContent:s.align==='center'||s.align==='centerContinuous'?'center':s.align==='right'?'flex-end':'flex-start',textAlign:s.align==='center'?'center':s.align==='right'?'right':'left',paddingLeft:(1+s.indent*6)+'pt'});
    let v;try{v=calc.get(page.sheet,ref);span.textContent=display(v,s)}catch(e){errors.push(page.sheet+'!'+ref+': '+e.message);span.textContent='ตรวจสูตร';cell.classList.add('error')}
    const lines=[[xs[x],ys[y],xs[x],ys[y]+ch],[xs[x]+cw,ys[y],xs[x]+cw,ys[y]+ch],[xs[x],ys[y],xs[x]+cw,ys[y]],[xs[x],ys[y]+ch,xs[x]+cw,ys[y]+ch]];
    for(let side=0;side<4;side++)if(s.borders[side])edges.add(lines[side].map(n=>n.toFixed(3)).join(','));cell.style.border='0';
    // Fit bordered cells, including narrow attendance summary headings.
    if(s.borders.some(Boolean)&&!s.rotation){cell.dataset.shrink='true';cell.style.overflow='hidden';span.style.minWidth='0';}
    if(page.sheet==='D'&&(ref==='B26'||/^C(?:[89]|1\d|2[01289]|30)$/.test(ref))){
     cell.style.whiteSpace='pre-wrap';cell.style.alignItems='center';span.style.whiteSpace='pre-wrap';span.style.overflowWrap='anywhere';span.style.flexShrink='1';
     if(ref==='B26'||['C28','C29','C30'].includes(ref)){cell.style.width=(xs[xs.length-1]-xs[x])+'pt';cell.style.background='#fff';cell.style.zIndex='2'}
    }
    if(start&&/^D\d+$/.test(ref)&&Number(ref.slice(1))>=start){cell.style.whiteSpace='nowrap';cell.dataset.shrink='true';}
    // Central classroom names can be longer than the abbreviations in Excel.
    if(page.sheet==='A'&&ref==='I12')span.textContent=String(v??'').replace(/มัธยมศึกษาปีที่\s*/g,'ม.').replace(/ประถมศึกษาปีที่\s*/g,'ป.').replace(/อนุบาล(?:ปีที่)?\s*/g,'อ.');
    if(page.sheet==='A'&&['I12','G17','G18'].includes(ref)){cell.style.whiteSpace='nowrap';cell.dataset.shrink='true'}
    // These Excel labels overflow narrow, unmerged cells. Render a complete
    // signature row below instead of clipping wrapped text to column C.
    if(page.sheet==='A'&&['C37','C39','C41','C44','C46','C47','L47'].includes(ref))span.textContent='';
    if(page.sheet==='A'&&['L43','L47'].includes(ref)){const school=String(calc.get('IN','Q20')||'');span.textContent=(ref==='L43'?'รองผู้อำนวยการ':'ผู้อำนวยการ')+(school.startsWith('โรงเรียน')?school:'โรงเรียน'+school);cell.style.overflow='visible';cell.style.whiteSpace='nowrap';cell.dataset.shrink='true'}
    if(page.sheet==='G'&&['C31','D31','E31','F31','G31'].includes(ref))span.textContent='';
    if(page.sheet==='G'&&['A32','A33'].includes(ref)){
     // Template indentation was made from spaces and manual line breaks.
     // Keep every word while letting the browser wrap each instruction normally.
     span.textContent=String(v??'').replace(/\s+/g,' ').trim().replace(/ +(?=\*\*|-(?:ช่วงคะแนน|ความหมาย|ระดับผล))/g,'\n');
     cell.classList.add('criteria-notes');cell.style.alignItems='flex-start';
    }
    if(!s.align&&typeof v==='number')cell.style.justifyContent='flex-end';if(s.rotation)span.style.transform='rotate('+(s.rotation>90?180-s.rotation:-s.rotation)+'deg)';if(s.shrink)cell.dataset.shrink='true';
    // Excel allows labels to span adjacent empty cells; preserve that space before fitting.
    const labelEnd=page.sheet==='A'?({C36:xs.length-1,C43:11,C49:xs.length-1}[ref]):page.sheet==='D'?(ref==='B27'||ref==='I42'?xs.length-1:/^I(?:34|36|38|40)$/.test(ref)?9:/^K(?:34|35|36|37|38|39|40)$/.test(ref)?xs.length-1:undefined):undefined;
    if(labelEnd!==undefined){cell.style.width=(xs[labelEnd]-xs[x])+'pt';cell.style.fontSize='12pt';cell.style.whiteSpace='pre-wrap';cell.style.alignItems='center';span.textContent=String(v??'').trim();span.style.whiteSpace='pre-wrap';span.style.flexShrink='1';span.style.overflowWrap='anywhere';if(page.sheet==='A'&&ref==='C49'){cell.style.justifyContent='center';cell.style.textAlign='center';}}
    if(page.sheet==='D'&&/^(?:B|O|P|Q|R|S|T)(?:[89]|1\d|2[0-5])$/.test(ref)){Object.assign(cell.style,{alignItems:'center',justifyContent:'center',textAlign:'center'});}
    if(page.sheet==='D'&&/^C(?:[89]|1\d|2[012])$/.test(ref)){cell.style.fontSize='12pt';cell.style.lineHeight='1.25';delete cell.dataset.shrink;}

    if(page.sheet==='B'&&ref==='DO6'){
     // The template stores a rotated, non-wrapped heading with a manual break.
     // Render its two words explicitly instead of inheriting rotated nowrap CSS.
     cell.classList.remove('rotated');cell.dataset.shrink='true';
     Object.assign(cell.style,{whiteSpace:'pre-line',overflow:'hidden',justifyContent:'center',textAlign:'center',padding:'2pt',lineHeight:'1.2'});
     Object.assign(span.style,{position:'static',transform:'none',whiteSpace:'pre-line',display:'block',width:'100%',maxWidth:'100%',flexShrink:'1'});
     span.textContent='หมาย\nเหตุ';
    }
    if(page.sheet==='A'&&['E45','L47','E48','C49'].includes(ref)){Object.assign(cell.style,{left:'0pt',width:w+'pt',justifyContent:'center',textAlign:'center',alignItems:'center',padding:'0'});span.textContent=String(span.textContent).trim();}
    cell.append(span);sheet.append(cell);
   }
   if(page.sheet==='A'){const logo=document.createElement('img');logo.className='school-logo';logo.alt='ตราโรงเรียน';logo.src='data:image/png;base64,'+template.logo;Object.assign(logo.style,{left:(xs[6]+424816/12700)+'pt',top:(ys[1]+13849/12700)+'pt',width:(859155/12700)+'pt',height:(859155/12700)+'pt'});sheet.append(logo)}
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
   const grid=document.createElementNS('http://www.w3.org/2000/svg','svg');grid.setAttribute('viewBox','0 0 '+w+' '+h);Object.assign(grid.style,{position:'absolute',left:'0',top:'0',width:w+'pt',height:h+'pt',overflow:'visible',pointerEvents:'none',zIndex:'3'});const path=document.createElementNS(grid.namespaceURI,'path');path.setAttribute('d',[...edges].map(e=>{const [x1,y1,x2,y2]=e.split(',');return 'M'+x1+' '+y1+'L'+x2+' '+y2}).join(''));path.setAttribute('fill','none');path.setAttribute('stroke','#222');path.setAttribute('stroke-width','0.6');grid.append(path);sheet.append(grid);
   paper.append(sheet);
   if(start){const legend=document.createElement('p');legend.className='student-status-legend';legend.textContent='† ย้ายออก   ‡ ไม่มีตัวตน   ★ นักเรียนพิเศษ';paper.append(legend)}
   pages.append(paper);
  }
  const extraCount=Number(data.patches.__pp5_indicator_count||0);let appendixPages=0,appendixAnchor=[...pages.children].find(p=>p.getAttribute('aria-label')?.endsWith('ชีต D'));
  if(extraCount&&(!data.report||data.report==='D'))for(let start=0;start<extraCount;start+=15){
   const paper=document.createElement('section');paper.className='paper a4 indicator-appendix';const title=document.createElement('h2');title.textContent='ตัวชี้วัด / ผลการเรียนรู้ (เพิ่มเติม)';paper.append(title);const course=document.createElement('p');course.textContent=[calc.get('IN','Q7'),calc.get('IN','Q8'),calc.get('IN','Q23')].filter(Boolean).join(' • ');paper.append(course);
   const table=document.createElement('table');table.innerHTML='<colgroup><col style="width:5%"><col style="width:59%">'+Array(6).fill('<col style="width:6%">').join('')+'</colgroup><thead><tr><th rowspan="2">ข้อที่</th><th rowspan="2">ตัวชี้วัด/ผลการเรียนรู้</th><th colspan="6">คะแนนการประเมินผล</th></tr><tr><th>1</th><th>2</th><th>3</th><th>4</th><th>รวม</th><th>ชม.</th></tr></thead>';const body=document.createElement('tbody');
   for(let i=start;i<Math.min(extraCount,start+15);i++){const row=54+i,tr=document.createElement('tr'),scores=['O','P','Q','R'].map(c=>Number(data.patches['D!'+c+row]||0));for(const v of [16+i,data.patches['D!C'+row]||'',...scores,scores.reduce((a,b)=>a+b,0),data.patches['D!T'+row]||0]){const td=document.createElement('td');td.textContent=String(v);tr.append(td)}body.append(tr)}table.append(body);paper.append(table);if(appendixAnchor)appendixAnchor.after(paper);else pages.append(paper);appendixAnchor=paper;appendixPages++;
  }
  await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));
  // Keep the original indicator geometry. Overflow text is continued at readable size.
  const overflowIndicators=[];
  for(let row=8;row<=22;row++){const cell=pages.querySelector('[data-ref="D!C'+row+'"]');if(!cell)continue;const span=cell.firstChild;if(span.scrollHeight>cell.clientHeight-2||span.scrollWidth>cell.clientWidth-3){overflowIndicators.push({number:row-7,text:span.textContent});span.textContent='ข้อ '+(row-7)+' — ดูข้อความเต็มในหน้าต่อ';}}
  if(overflowIndicators.length){
   let paper,space,anchor=appendixAnchor;const newPage=()=>{paper=document.createElement('section');paper.className='paper a4 indicator-text-continuation';const title=document.createElement('h2');title.textContent='ตัวชี้วัด / ผลการเรียนรู้ — ข้อความต่อ';paper.append(title);space=document.createElement('div');space.className='indicator-text-space';paper.append(space);if(anchor)anchor.after(paper);else pages.append(paper);anchor=paper;appendixPages++;};newPage();
   for(const item of overflowIndicators){let rest=Array.from(new Intl.Segmenter('th',{granularity:'grapheme'}).segment(item.text),x=>x.segment),continued=false;
    while(rest.length){const block=document.createElement('p');space.append(block);const prefix='ข้อ '+item.number+(continued?' (ต่อ)':'')+'  ';let lo=0,hi=rest.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);block.textContent=prefix+rest.slice(0,mid).join('');if(space.scrollHeight<=space.clientHeight)lo=mid;else hi=mid-1;}
     if(!lo){block.remove();newPage();continue;}block.textContent=prefix+rest.slice(0,lo).join('');rest=rest.slice(lo);continued=true;if(rest.length)newPage();
    }
   }
  }
  for(const cell of pages.querySelectorAll('[data-shrink]')){const span=cell.firstChild;const ratio=Math.min(1,(cell.clientWidth-3)/Math.max(1,span.scrollWidth),(cell.clientHeight-2)/Math.max(1,span.scrollHeight));if(ratio<1)span.style.fontSize=(parseFloat(cell.style.fontSize)*ratio)+'pt'}
  // Use one shared font size for the six attendance summary headings.
  const attendanceHeads=['DI10','DJ10','DK10','DL10','DM10','DN10'].map(ref=>pages.querySelector('[data-ref="B!'+ref+'"]')).filter(Boolean);
  if(attendanceHeads.length){const size=Math.min(...attendanceHeads.map(cell=>parseFloat(cell.firstChild.style.fontSize||cell.style.fontSize)));attendanceHeads.forEach(cell=>cell.firstChild.style.fontSize=size+'pt')}
  if(errors.length)throw Error('พบสูตรที่คำนวณไม่ได้ '+errors.slice(0,4).join(' • ')+' กรุณาส่งออก Excel เพื่อตรวจสอบ');
  document.title=data.title||'ปพ.5';document.body.classList.add('ready');status.textContent='พร้อมพิมพ์ '+(selectedPages.length+appendixPages)+' หน้า • ข้อมูล ณ เวลาที่เปิดหน้านี้ หากแก้ไขเล่มให้เปิดหน้าพิมพ์ใหม่'+(selectedPages.some(p=>p.paper==='legal')?' • หน้ากำหนดเกณฑ์ใช้กระดาษ Legal ตามต้นฉบับ':' • กระดาษ A4');button.disabled=false;
 }
 button.addEventListener('click',()=>window.print());
 window.addEventListener('message',event=>{if(received||event.origin!==location.origin||event.source!==window.opener||event.data?.type!=='pp5-print-data'||event.data.job!==job)return;received=true;clearInterval(ping);render(event.data).catch(fail)});
 const ping=setInterval(()=>{if(window.opener&&!window.opener.closed)window.opener.postMessage({type:'pp5-print-ready',job},location.origin)},300);
 setTimeout(()=>{if(!received){clearInterval(ping);fail(Error('กลับไปที่เล่ม ปพ.5 แล้วกด “พิมพ์ / PDF” เพื่อเปิดหน้านี้ใหม่'))}},30000);
})();
