/* Friendly entry controls keep the workbook cell mappings used by export. */
(()=>{'use strict';
 const legend='† ย้ายออก   ‡ ไม่มีตัวตน   ★ นักเรียนห้องพิเศษ';
 const compactName=s=>(s?.name??s?.full_name??'')+({transferred:' †',not_present:' ‡',special:' ★'}[s?.record_status]||'');
 let cells;
  function distributeFinalScore(total,items){const active=items.filter(x=>x.label&&Number.isFinite(Number(x.max))&&Number(x.max)>0),maxTotal=active.reduce((sum,x)=>sum+Number(x.max),0);if(!active.length||!maxTotal)return {};const amount=Math.min(maxTotal,Math.max(0,Number(total)||0));let assigned=0;return Object.fromEntries(active.map((item,index)=>{const score=index===active.length-1?Math.round((amount-assigned)*10000)/10000:Math.round((amount*Number(item.max)/maxTotal)*10000)/10000;assigned+=score;return [item.column,score]}))}
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
  function refresh(){if(!panel.isConnected)return;const scorePatches={...literal,...patches};for(let row=4;row<=63;row++){if(!value('IN','C'+row)&&!value('IN','D'+row))continue;scorePatches['IN!L'+row]=['E','F','H','I','J'].reduce((sum,column)=>{const score=Number(value('IN',column+row));return sum+(Number.isFinite(score)?score:0)},0)}const calc=new PP5Calc.Calculator(cells,scorePatches);panel.querySelectorAll('[data-result]').forEach(el=>{try{el.textContent=calc.get('IN',el.dataset.result)??''}catch(e){el.textContent='ตรวจสูตร';el.title=e.message}});panel.querySelectorAll('[data-auto-score]').forEach(el=>{try{el.textContent=calc.get('F',el.dataset.autoScore)??0}catch(e){el.textContent='ตรวจสูตร';el.title=e.message}});panel.querySelectorAll('[data-ch-result]').forEach(el=>{try{const row=Number(el.dataset.chResult.match(/\d+$/)?.[0]);el.textContent=calc.get('CH',el.dataset.chResult)??''}catch(e){el.textContent='ตรวจสูตร';el.title=e.message}});const finalColumns=['CD','CE','CF','CG','CH','CI','CJ','CK','CL','CM'];panel.querySelectorAll('input[data-final-score]').forEach(el=>{const match=el.dataset.finalScore.match(/^([A-Z]+)(\d+)$/);if(!match)return;const column=match[1],studentRow=Number(match[2])-3,items=finalColumns.map(column=>({column,label:String(calc.get('F',column+'5')??'').trim(),max:Number(calc.get('F',column+'6'))})),scores=distributeFinalScore(value('IN','J'+studentRow),items);el.value=String(scores[column]??'')});panel.querySelectorAll('input[data-sheet="F"]').forEach(el=>{try{const v=calc.get('F',el.dataset.ref);el.placeholder=String(v??'');el.title='ค่าจากสูตร '+(v??'')+' • ล้างช่องเพื่อคืนสูตร'}catch(e){el.title=e.message}})}
  refresh();let timer;panel.oninput=()=>{clearTimeout(timer);timer=setTimeout(refresh,150)};panel.onchange=()=>{clearTimeout(timer);timer=setTimeout(refresh,0)};
  panel.querySelectorAll('input[type="number"]').forEach(el=>el.addEventListener('keydown',e=>{if(e.key!=='Enter')return;e.preventDefault();const inputs=[...panel.querySelectorAll('input[type="number"]:not(:disabled):not([readonly])')],i=inputs.indexOf(el);inputs[i+1]?.focus();inputs[i+1]?.select()}));
 }
 window.PP5Entry={load,enhance,compactName,legend,distributeFinalScore};
})();
