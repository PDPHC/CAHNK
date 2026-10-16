(()=>{'use strict';
 const instances=[];
 function create({isDirty,canSave,save,onState=()=>{},delay=900}){
  let timer=null,running=null,stopped=false;
  const report=(kind,text)=>onState(text,kind);
  async function flush(force=false){
   clearTimeout(timer);timer=null;
   if(running){await running;if(isDirty())return flush();return;}
   if(!isDirty()&&!force)return;
   const focus=document.activeElement,start=focus?.selectionStart,end=focus?.selectionEnd;
   const job=(async()=>{let waits=0;while(!canSave()){if(++waits>100)throw Error('ยังไม่พร้อมบันทึก กรุณารอแล้วลองอีกครั้ง');await new Promise(r=>setTimeout(r,50));}
    report('saving','กำลังบันทึกอัตโนมัติ…');await save();if(!isDirty())report('saved','บันทึกอัตโนมัติสำเร็จแล้ว '+new Date().toLocaleTimeString('th-TH'));
   })();running=job;
   try{await job;}catch(error){report('error','บันทึกอัตโนมัติไม่สำเร็จ: '+(error.message||String(error))+' • ข้อมูลยังอยู่ในหน้านี้ กรุณาลองบันทึกอีกครั้ง');throw error;}finally{running=null;if(focus?.isConnected&&!focus.disabled&&document.activeElement===document.body){focus.focus({preventScroll:true});if(start!==null&&start!==undefined&&typeof focus.setSelectionRange==='function')try{focus.setSelectionRange(start,end);}catch{}}}
   if(isDirty())return flush();
  }
  function schedule(){if(stopped)return;clearTimeout(timer);report('pending','รอบันทึกอัตโนมัติ…');timer=setTimeout(()=>{timer=null;flush().catch(()=>{});},delay);}
  const active=()=>isDirty()||!!running;
  document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||!a||a.download||a.target==='_blank'||!active())return;const u=new URL(a.href,location.href);if(u.origin!==location.origin||!/^https?:$/.test(u.protocol)||u.href.split('#')[0]===location.href.split('#')[0])return;e.preventDefault();e.stopImmediatePropagation();flush().then(()=>location.assign(u.href)).catch(()=>{});},true);
  addEventListener('online',()=>{if(isDirty())schedule();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&isDirty())flush().catch(()=>{});});
  const instance={schedule,flush,active,cancel(){clearTimeout(timer);timer=null;},stop(){stopped=true;clearTimeout(timer);}};instances.push(instance);return instance;
 }
 window.HNKAutoSave={create,flushAll:()=>Promise.all(instances.map(x=>x.flush()))};
})();
