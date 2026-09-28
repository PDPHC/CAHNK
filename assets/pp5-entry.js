/* Friendly entry controls keep the workbook cell mappings used by export. */
(()=>{'use strict';
 const legend='† ย้ายออก   ‡ ไม่มีตัวตน   ★ นักเรียนพิเศษ';
 const compactName=s=>(s?.name??s?.full_name??'')+({transferred:' †',not_present:' ‡',special:' ★'}[s?.record_status]||'');
 let cells;
 async function load(){const r=await fetch('../assets/pp5-print-template.json?v=2');if(!r.ok)throw Error('โหลดสูตร ปพ.5 ไม่สำเร็จ');const packed=await r.json(),zip=await JSZip.loadAsync(packed.base64,{base64:true});cells=JSON.parse(await zip.file('print.json').async('string')).cells;}
 function enhance(panel,{book,patches,tab,value}){
  if(!['scores','detail','attendance'].includes(tab))return;
  panel.oninput=null;
  const note=document.createElement('p');note.className='pp5-status-legend';note.textContent=legend+' • ย้ายออกและไม่มีตัวตนไม่สามารถกรอกข้อมูลได้';panel.append(note);
  const literal={};for(const [sheet,rows] of Object.entries(book.cells))for(const [ref,c] of Object.entries(rows))if(c.formula==null)literal[sheet+'!'+ref]=c.value??'';
  if(tab==='scores'){
   const table=panel.querySelector('table');['รวม','เกรด','อ่านคิด','คุณลักษณะ'].forEach(label=>{const th=document.createElement('th');th.textContent=label;table.tHead.rows[0].append(th)});
   for(const row of table.tBodies[0].rows){const n=Number(row.cells[0].textContent)+3;for(const col of ['L','M','N','O']){const td=document.createElement('td');td.dataset.result=col+n;td.className='pp5-result';row.append(td)}}
  }
  function refresh(){if(!panel.isConnected)return;const calc=new PP5Calc.Calculator(cells,{...literal,...patches});panel.querySelectorAll('[data-result]').forEach(el=>{try{el.textContent=calc.get('IN',el.dataset.result)??''}catch(e){el.textContent='ตรวจสูตร';el.title=e.message}});panel.querySelectorAll('[data-ch-result]').forEach(el=>{try{el.textContent=calc.get('CH',el.dataset.chResult)??''}catch(e){el.textContent='ตรวจสูตร';el.title=e.message}});panel.querySelectorAll('input[data-sheet="F"]').forEach(el=>{try{const v=calc.get('F',el.dataset.ref);el.placeholder=String(v??'');el.title='ค่าจากสูตร '+(v??'')+' • ล้างช่องเพื่อคืนสูตร'}catch(e){el.title=e.message}})}
  refresh();let timer;panel.oninput=()=>{clearTimeout(timer);timer=setTimeout(refresh,150)};panel.onchange=()=>{clearTimeout(timer);timer=setTimeout(refresh,0)};
  panel.querySelectorAll('input[type="number"]').forEach(el=>el.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const inputs=[...panel.querySelectorAll('input[type="number"]:not(:disabled):not([readonly])')],i=inputs.indexOf(el);inputs[i+1]?.focus();inputs[i+1]?.select()}));
 }
 window.PP5Entry={load,enhance,compactName,legend};
})();
