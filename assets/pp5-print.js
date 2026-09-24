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
  for(const [index,page] of selectedPages.entries()){
   const paper=document.createElement('section');paper.className='paper '+page.paper;paper.setAttribute('aria-label','หน้าที่ '+(index+1)+' ชีต '+page.sheet);
   const sheet=document.createElement('div');sheet.className='sheet';const xs=offsets(page.widths),ys=offsets(page.heights),w=sum(page.widths),h=sum(page.heights),pw=page.paper==='legal'?612:210*72/25.4,ph=page.paper==='legal'?1008:297*72/25.4,[ml,mr,mt,mb]=page.margins;
   // Honor Excel's zoom and centering; do not independently shrink every page.
   const scale=page.fit?Math.min((pw-ml-mr)/w,(ph-mt-mb)/h,1):(page.scale||1);
   const left=ml+(page.centerX?Math.max(0,pw-ml-mr-w*scale)/2:0),top=mt+(page.centerY?Math.max(0,ph-mt-mb-h*scale)/2:0);
   Object.assign(sheet.style,{left:left+'pt',top:top+'pt',width:w+'pt',height:h+'pt',transform:'scale('+scale+')'});
   const merged=new Map(page.merges.map(m=>[m[0]+','+m[1],m]));
   for(const [x,y,ref,style] of page.cells){const m=merged.get(x+','+y),cw=xs[(m?m[2]:x)+1]-xs[x],ch=ys[(m?m[3]:y)+1]-ys[y];if(!cw||!ch)continue;const s=template.styles[style],cell=document.createElement('div'),span=document.createElement('span');cell.className='cell'+(s.wrap?' wrap':'')+(s.rotation?' rotated':'');cell.dataset.ref=page.sheet+'!'+ref;
    Object.assign(cell.style,{left:xs[x]+'pt',top:ys[y]+'pt',width:cw+'pt',height:ch+'pt',fontFamily:'"'+s.font+'", "TH Sarabun New", Tahoma, sans-serif',fontSize:s.size+'pt',fontWeight:s.bold?'bold':'normal',fontStyle:s.italic?'italic':'normal',color:s.color,background:s.fill,borderLeft:s.borders[0],borderRight:s.borders[1],borderTop:s.borders[2],borderBottom:s.borders[3],alignItems:s.vertical==='top'?'flex-start':s.vertical==='center'?'center':'flex-end',justifyContent:s.align==='center'||s.align==='centerContinuous'?'center':s.align==='right'?'flex-end':'flex-start',textAlign:s.align==='center'?'center':s.align==='right'?'right':'left',paddingLeft:(1+s.indent*6)+'pt'});
    let v;try{v=calc.get(page.sheet,ref);span.textContent=display(v,s)}catch(e){errors.push(page.sheet+'!'+ref+': '+e.message);span.textContent='ตรวจสูตร';cell.classList.add('error')}
    if(!s.align&&typeof v==='number')cell.style.justifyContent='flex-end';if(s.rotation)span.style.transform='rotate('+(s.rotation>90?180-s.rotation:-s.rotation)+'deg)';if(s.shrink)cell.dataset.shrink='true';cell.append(span);sheet.append(cell);
   }
   if(page.sheet==='A'){const logo=document.createElement('img');logo.className='school-logo';logo.alt='ตราโรงเรียน';logo.src='data:image/png;base64,'+template.logo;Object.assign(logo.style,{left:(xs[6]+424816/12700)+'pt',top:(ys[1]+13849/12700)+'pt',width:(859155/12700)+'pt',height:(859155/12700)+'pt'});sheet.append(logo)}
   paper.append(sheet);pages.append(paper);
  }
  await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));
  for(const cell of pages.querySelectorAll('[data-shrink]')){const span=cell.firstChild;if(span.scrollWidth>cell.clientWidth&&span.scrollWidth>0)span.style.fontSize=(parseFloat(cell.style.fontSize)*cell.clientWidth/span.scrollWidth)+'pt'}
  if(errors.length)throw Error('พบสูตรที่คำนวณไม่ได้ '+errors.slice(0,4).join(' • ')+' กรุณาส่งออก Excel เพื่อตรวจสอบ');
  document.title=data.title||'ปพ.5';document.body.classList.add('ready');status.textContent='พร้อมพิมพ์ '+selectedPages.length+' หน้า • ข้อมูล ณ เวลาที่เปิดหน้านี้ หากแก้ไขเล่มให้เปิดหน้าพิมพ์ใหม่'+(selectedPages.some(p=>p.paper==='legal')?' • หน้ากำหนดเกณฑ์ใช้กระดาษ Legal ตามต้นฉบับ':' • กระดาษ A4');button.disabled=false;
 }
 button.addEventListener('click',()=>window.print());
 window.addEventListener('message',event=>{if(received||event.origin!==location.origin||event.source!==window.opener||event.data?.type!=='pp5-print-data'||event.data.job!==job)return;received=true;clearInterval(ping);render(event.data).catch(fail)});
 const ping=setInterval(()=>{if(window.opener&&!window.opener.closed)window.opener.postMessage({type:'pp5-print-ready',job},location.origin)},300);
 setTimeout(()=>{if(!received){clearInterval(ping);fail(Error('กลับไปที่เล่ม ปพ.5 แล้วกด “พิมพ์ / PDF” เพื่อเปิดหน้านี้ใหม่'))}},30000);
})();
