(()=>{'use strict';
 const sb=window.cloudClient;if(!sb)return;
 const script=document.currentScript,style=document.createElement('link');style.rel='stylesheet';style.href=new URL('school-system.css?v=20261017',script.src).href;document.head.append(style);
 const create=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
 const news=create('aside',undefined,'school-notice-bar');news.id='schoolNoticeBar';news.hidden=true;news.setAttribute('aria-label','ประกาศจากโรงเรียน');
 const accessBar=create('aside',undefined,'school-entry-bar');accessBar.id='pp5EntryBanner';accessBar.hidden=true;accessBar.setAttribute('aria-label','ช่วงเปิดรับข้อมูล ปพ.5 และ ปพ.6');
 document.body.prepend(news);news.after(accessBar);
 // Admin and the responsive shell also prepend navigation after startup.
 new MutationObserver(()=>{if(document.body.firstElementChild!==news)document.body.prepend(news);}).observe(document.body,{childList:true});
 let policy=null,room=null,offset=0,request=0,boundaryTimer,stale=true,lastSuccess=0;
 const now=()=>Date.now()+offset;
 const termOpen=term=>{if(!room)return true;if(!policy||stale)return false;if(policy.exempt)return true;const p=policy.terms.find(p=>p.term===Number(term));return !!p&&(p.mode==='open'||p.mode==='scheduled'&&now()>=Date.parse(p.opens_at)&&now()<Date.parse(p.closes_at));};
 const sharedOpen=()=>termOpen(1)||termOpen(2),ratioOpen=()=>termOpen(1)&&termOpen(2);
 const date=value=>value?new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Bangkok'}).format(new Date(value)):'';
 function updateAccess(){
  clearTimeout(boundaryTimer);accessBar.replaceChildren();accessBar.hidden=!room;if(!room)return;
  accessBar.append(create('strong','กำหนดการกรอก ปพ.5 / ปพ.6 · '+(policy?.education_level==='secondary'?'มัธยมศึกษา':'ประถมศึกษา')+' · ปี '+room.academic_year));
  if(!policy||stale){accessBar.append(create('span','ตรวจสอบช่วงเปิดรับข้อมูลไม่ได้ — เปิดดูและพิมพ์ได้ กรุณาลองใหม่', 'entry-closed'));const retry=create('button','ลองใหม่');retry.type='button';retry.onclick=()=>refresh();accessBar.append(retry);}
  else{
   for(const p of policy.terms){const open=termOpen(p.term),label=create('span','เทอม '+p.term+' · '+(open?'เปิดกรอก':'ปิดกรอก'),open?'entry-open':'entry-closed');
    if(p.mode==='scheduled')label.append(create('small',date(p.opens_at)+' – '+date(p.closes_at)+' (เวลาไทย)'));
    accessBar.append(label);
   }
   accessBar.append(create('small',policy.exempt?'บัญชีผู้บริหาร / วิชาการ: ใช้สิทธิ์เดิมตามบทบาท':'ช่วงปิดยังดูและพิมพ์ได้ · ข้อมูลร่วมทั้งปีกรอกได้เมื่อมีอย่างน้อยหนึ่งเทอมเปิด'));
   const next=policy.terms.flatMap(p=>p.mode==='scheduled'?[Date.parse(p.opens_at),Date.parse(p.closes_at)]:[]).filter(t=>t>now()).sort((a,b)=>a-b)[0];
   if(next)boundaryTimer=setTimeout(updateAccess,Math.min(next-now()+25,2147483647));
  }
  dispatchEvent(new CustomEvent('hnk:entry-access'));
 }
 async function refresh(){if(!room)return;const id=++request,cid=room.id;try{
  let timeout;const r=await Promise.race([sb.rpc('pp5_entry_access',{p_room:cid}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('หมดเวลาตรวจสอบกำหนดการ')),8000);})]).finally(()=>clearTimeout(timeout));if(r.error)throw r.error;if(id!==request)return;
  if(!r.data||r.data.room!==cid||!Array.isArray(r.data.terms)||r.data.terms.length!==2)throw Error('ข้อมูลกำหนดการไม่ครบ');
  policy=r.data;offset=Date.parse(policy.server_now)-Date.now();stale=false;lastSuccess=Date.now();
 }catch(error){if(id!==request)return;stale=true;console.error('ตรวจสอบช่วงเปิดรับข้อมูลไม่สำเร็จ',error);}updateAccess();}
 async function use(selected){if(!selected){room=null;policy=null;stale=true;request++;updateAccess();return;}room=selected;policy=null;stale=true;updateAccess();await refresh();}
 window.HNKEntryWindows={use,refresh,termOpen,sharedOpen,ratioOpen,assertShared(){if(!sharedOpen())throw Error('ปิดรับข้อมูล ปพ.5 / ปพ.6 — ข้อมูลที่กรอกยังอยู่ในหน้านี้');}};
 const pp5start=window.startPP5Home;if(pp5start)window.startPP5Home=init=>pp5start(async rooms=>{
  const cid=new URL(location.href).searchParams.get('classroom'),selected=rooms.find(r=>r.id===cid);if(selected)await use(selected);await init(rooms);
 });
 const protectedStart=window.startProtectedPage;if(protectedStart)window.startProtectedPage=init=>protectedStart(async()=>{
  if(location.pathname.endsWith('/modules/pp5.html')&&cloudState.classroom)await use(cloudState.classroom);if(typeof init==='function')await init();
 });
 let fetching=false;
 async function notices(){if(fetching)return;fetching=true;try{
  const r=await sb.rpc('school_notice_feed');if(r.error)throw r.error;const items=r.data?.announcements||[];news.replaceChildren();news.hidden=!items.length;
  for(const item of items){const article=create('details',undefined,'school-notice '+(['info','important','urgent'].includes(item.tone)?item.tone:'info'));article.open=items.length===1||item.tone==='urgent';
   const summary=create('summary');summary.append(create('span',item.tone==='urgent'?'ประกาศด่วน':item.tone==='important'?'ประกาศสำคัญ':'ประกาศโรงเรียน','notice-label'),create('strong',item.title));article.append(summary);if(item.body)article.append(create('p',item.body));news.append(article);
  }
 }catch(error){console.error('โหลดประกาศไม่สำเร็จ',error);}finally{fetching=false;}}
 notices();setInterval(notices,60000);setInterval(()=>{if(document.visibilityState!=='hidden'){if(room&&Date.now()-lastSuccess>90000){stale=true;updateAccess();}refresh();}},30000);
 addEventListener('focus',()=>{notices();refresh();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){if(room&&Date.now()-lastSuccess>90000){stale=true;updateAccess();}notices();refresh();}});
 sb.auth.onAuthStateChange?.(()=>setTimeout(()=>{notices();refresh();},0));
})();
