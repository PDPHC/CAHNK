/* Render the editable sheets from the same OOXML template used for export. */
(()=>{'use strict';
 const nodes=(d,n)=>[...d.getElementsByTagNameNS('*',n)],parse=s=>new DOMParser().parseFromString(s,'application/xml');
 const pos=r=>{const m=r.replace(/\$/g,'').match(/([A-Z]+)(\d+)/);return [[...m[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),+m[2]]};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const cache=new WeakMap();let formulas;
 async function load(){if(formulas)return;const r=await fetch('../assets/pp5-print-template.json?v=2');if(!r.ok)throw Error('โหลดแบบฟอร์ม ปพ.5 ไม่สำเร็จ');const data=await r.json(),z=await JSZip.loadAsync(data.base64,{base64:true});formulas=JSON.parse(await z.file('print.json').async('string')).cells}
 async function prepare(book){if(cache.has(book))return;const raw=await book.zip.file('xl/styles.xml').async('string'),d=parse(raw);
  const fonts=nodes(d,'fonts')[0].children,fills=nodes(d,'fills')[0].children,borders=nodes(d,'borders')[0].children;
  const rgb=(e,fallback)=>{const c=e&&nodes(e,'color')[0],v=c?.getAttribute('rgb');return v?'#'+v.slice(-6):fallback};
  const styles=[...nodes(d,'cellXfs')[0].children].map(x=>{const f=fonts[+x.getAttribute('fontId')],fill=fills[+x.getAttribute('fillId')],b=borders[+x.getAttribute('borderId')],a=nodes(x,'alignment')[0];const fg=nodes(fill,'fgColor')[0]?.getAttribute('rgb');
   let css='font-family:'+JSON.stringify(nodes(f,'name')[0]?.getAttribute('val')||'Tahoma')+',Tahoma,sans-serif;font-size:'+(nodes(f,'sz')[0]?.getAttribute('val')||11)+'pt;color:'+rgb(f,'#111')+';font-weight:'+(nodes(f,'b').length?'bold':'normal')+';background:'+(fg?'#'+fg.slice(-6):'#fff')+';text-align:'+(a?.getAttribute('horizontal')||'left')+';vertical-align:'+(a?.getAttribute('vertical')==='center'?'middle':a?.getAttribute('vertical')||'bottom')+';';
   for(const side of ['left','right','top','bottom']){const edge=nodes(b,side)[0],s=edge?.getAttribute('style');if(s)css+='border-'+side+':'+(['medium','thick','double'].includes(s)?1.5:.5)+'pt '+(s==='dotted'?'dotted':s.includes('dash')?'dashed':'solid')+' '+rgb(edge,'#000')+';'}return {css,format:+x.getAttribute('numFmtId'),unlocked:nodes(x,'protection')[0]?.getAttribute('locked')==='0'};});
  const sheets={};for(const name of ['IN','D','F','W1','CH']){const xml=parse(book.sheets[name].raw);sheets[name]={cells:new Map(nodes(xml,'c').map(c=>[c.getAttribute('r'),+c.getAttribute('s')])),rows:new Map(nodes(xml,'row').map(r=>[+r.getAttribute('r'),+r.getAttribute('ht')||15])),cols:nodes(xml,'col').map(c=>({min:+c.getAttribute('min'),max:+c.getAttribute('max'),width:c.getAttribute('hidden')==='1'?0:Math.floor(((256*(+c.getAttribute('width')||8.43)+18)/256)*7)})),merges:nodes(xml,'mergeCell').map(c=>c.getAttribute('ref').split(':').map(pos))};}cache.set(book,{styles,sheets});}
 function show(panel,{book,patches,tab,week,input,editable,value}){
  const mapping={scores:['IN',2,63,2,18],info:['IN',2,63,2,18],indicators:['D',3,47,2,20],detail:['F',2,66,2,114],schedule:['W1',2,24,4,10],attendance:['CH',3,66,2,6]};if(!mapping[tab])return;
  const [name,r1,r2,c1,c2]=mapping[tab],layout=cache.get(book);if(!layout)throw Error('ยังโหลดรูปแบบไม่ครบ');const s=layout.sheets[name];
  const columns=Array.from({length:c2-c1+1},(_,i)=>i+c1);if(name==='CH')columns.push(...Array.from({length:5},(_,i)=>7+(week-1)*5+i));
  const department=panel.querySelector('#pp5Department');const toolbar=panel.querySelector('.pp5-toolbar'),search=panel.querySelector('#pp5Search'),weekSelect=panel.querySelector('#pp5Week')?.parentElement;
  const title={IN:'รายชื่อ คะแนนรวม และข้อมูลพื้นฐาน',D:'ตัวชี้วัด / ผลการเรียนรู้',F:'คะแนนย่อยรายจุดประสงค์',W1:'ตารางรายสัปดาห์',CH:'เช็กการมาเรียน'}[name];
  panel.replaceChildren();if(toolbar)panel.append(toolbar);else{const h=document.createElement('h2');h.textContent=title;panel.append(h)}
  const note=document.createElement('p');note.className='pp5-note';note.textContent='แบบฟอร์มตามไฟล์ ปพ.5 • กรอกช่องที่เปิดให้แก้ไข ส่วนช่องสูตรคำนวณให้อัตโนมัติ'+(name==='F'?' • ล้างคะแนนย่อยเพื่อคืนสูตรเดิม':'')+(name==='CH'?' • / มาเรียน, - ไม่มีคาบ, ป ป่วย, ล ลา, ส สาย, ข ขาด':'');panel.append(note);if(search)panel.append(search);if(weekSelect)panel.append(weekSelect);
  const wrap=document.createElement('div');wrap.className='pp5-original-scroll';wrap.tabIndex=0;wrap.setAttribute('aria-label','ตาราง '+title+' เลื่อนแนวนอนเพื่อดูทุกช่อง');
  let html='<table class="pp5-original-sheet" aria-label="'+title+'"><colgroup>'+columns.map(x=>{const c=s.cols.find(c=>c.min<=x&&c.max>=x);return '<col style="width:'+Math.max(c?.width??64,24)+'px">'}).join('')+'</colgroup><tbody>';
  for(let y=r1;y<=r2;y++){if(['F','CH'].includes(name)&&y>=7&&!value('IN','C'+(y-3)))continue;html+='<tr data-sheet-row="'+y+'" style="height:'+Math.max(s.rows.get(y)||15,20)+'pt">';for(const x of columns){const merge=s.merges.find(([a,b])=>x>=a[0]&&x<=b[0]&&y>=a[1]&&y<=b[1]);if(merge&&(merge[0][0]!==x||merge[0][1]!==y))continue;
   const ref=PP5Workbook.col(x)+y,style=layout.styles[s.cells.get(ref)||0],can=PP5Workbook.allowed(name,ref)&&(name!=='D'||style.unlocked)&&(name==='F'||book.cells[name]?.[ref]?.formula==null);let content;
   if(can){const label=name+' '+ref;
    if(name==='CH')content='<select data-sheet="CH" data-ref="'+ref+'" aria-label="'+label+'" '+(!editable?'disabled':'')+'>'+['','/','-','ป','ล','ส','ข'].map(v=>'<option value="'+v+'" '+(value(name,ref)===v?'selected':'')+'>'+esc(v||'—')+'</option>').join('')+'</select>';
    else if(name==='F')content='<input type="number" min="0" step="any" data-sheet="F" data-ref="'+ref+'" aria-label="'+label+'" data-auto-score="'+ref+'" placeholder="สูตร" value="'+esc(patches['F!'+ref]??'')+'" '+(!editable?'disabled':'')+'>';
    else if(name==='IN'&&ref==='Q17')content=department?department.outerHTML:'<input readonly aria-label="กลุ่มสาระการเรียนรู้" value="'+esc(value(name,ref))+'">';
    else content=input(name,ref,{label,numeric:name==='W1'||name==='IN'&&((x>=5&&x<=10)||(x===17&&[9,12,13,14,15].includes(y)))||name==='D'&&x>=15});
   }else content='<span data-formula-sheet="'+name+'" data-formula-ref="'+ref+'" data-format="'+style.format+'"></span>';
   html+='<td data-cell="'+name+'!'+ref+'" style="'+esc(style.css)+'"'+(merge?' colspan="'+columns.filter(c=>c>=x&&c<=merge[1][0]).length+'" rowspan="'+(Math.min(r2,merge[1][1])-y+1)+'"':'')+'>'+content+'</td>';
  }html+='</tr>'}wrap.innerHTML=html+'</tbody></table>';panel.append(wrap);
  const literals={};for(const [sheet,cells] of Object.entries(book.cells))for(const [ref,c] of Object.entries(cells))if(c.formula==null)literals[sheet+'!'+ref]=c.value??'';
  function refresh(){if(!wrap.isConnected)return;const calc=new PP5Calc.Calculator(formulas,{...literals,...patches});wrap.querySelectorAll('[data-auto-score]').forEach(el=>{try{el.placeholder=String(calc.get('F',el.dataset.autoScore)??'');el.title='ค่าจากสูตร '+el.placeholder+' — กรอกเพื่อแทนค่า หรือล้างเพื่อคืนสูตร'}catch(e){el.placeholder='สูตร';el.title=e.message}});wrap.querySelectorAll('[data-formula-ref]').forEach(el=>{try{let v=calc.get(el.dataset.formulaSheet,el.dataset.formulaRef),fmt=+el.dataset.format;if(typeof v==='number'&&[14,15,16,17,22,164,165,166,167].includes(fmt)){const d=new Date((v-25569)*86400000);v=v?(fmt===164?d.getUTCDate():d.toLocaleDateString('th-TH',{timeZone:'UTC'})):'';}el.textContent=v??'';el.removeAttribute('title')}catch(e){el.textContent='ตรวจสูตร';el.title=e.message}})}
  refresh();let timer;wrap.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(refresh,180)});wrap.addEventListener('change',()=>{clearTimeout(timer);timer=setTimeout(refresh,0)});
  if(search)search.oninput=()=>wrap.querySelectorAll('tr[data-sheet-row]').forEach(row=>{const y=+row.dataset.sheetRow;row.hidden=y>=4&&!(String(value('IN','C'+y))+' '+value('IN','D'+y)).includes(search.value.trim())});
 }
 window.PP5SheetForm={load,prepare,show};
})();
