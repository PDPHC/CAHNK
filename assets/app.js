const P="hnk_admin_v3_";
const OLD_P="hnk_admin_v2_";
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const get=(k,d=null)=>{
  try{
    let v=localStorage.getItem(P+k);
    if(v===null){
      const old=localStorage.getItem(OLD_P+k);
      if(old!==null){localStorage.setItem(P+k,old);v=old}
    }
    return v?JSON.parse(v):d
  }catch(e){return d}
};
const set=(k,v)=>localStorage.setItem(P+k,JSON.stringify(v));
window.hnkGet=get;window.hnkSet=set;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const monthNames=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const dayNames=["อา.","จ.","อ.","พ.","พฤ.","ศ.","ส."];
function buddhistYear(y){return Number(y)+543}
function isoLocal(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
function parseDate(s){if(!s)return null;const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function settings(){
 const defaults={
  school:"โรงเรียนห้วยน้ำขุ่นวิทยา",
  office:"สำนักงานเขตพื้นที่การศึกษาประถมศึกษาเชียงราย เขต 2",
  classLevel:"มัธยมศึกษาปีที่ 1",room:"1",
  academicYear:String(buddhistYear(new Date().getFullYear())),
  term:"1",teacher1:"",teacher2:"",academicHead:"",deputy:"",
  openDate:"2026-05-18",closeDate:"2026-10-12",targetDays:"100",targetWeeks:"20",
  useThaiHolidays:true
 };
 return {...defaults,...get("settings",{})}
}
function students(){return get("students",[])}
function classText(){const s=settings();return `${s.classLevel}/${s.room}`}
function monthInfo(ym){let [y,m]=ym.split("-").map(Number);return {year:y,be:buddhistYear(y),month:m,name:monthNames[m-1],days:new Date(y,m,0).getDate()}}
function monthsInTerm(){
 const s=settings(),a=parseDate(s.openDate),b=parseDate(s.closeDate); if(!a||!b||a>b)return [];
 const out=[],d=new Date(a.getFullYear(),a.getMonth(),1),end=new Date(b.getFullYear(),b.getMonth(),1);
 while(d<=end){out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);d.setMonth(d.getMonth()+1)}
 return out
}

const THAI_HOLIDAY_2026 = [
 ["2026-01-01","วันขึ้นปีใหม่"],["2026-01-02","วันหยุดพิเศษ"],
 ["2026-03-03","วันมาฆบูชา"],
 ["2026-04-06","วันจักรี"],["2026-04-13","วันสงกรานต์"],["2026-04-14","วันสงกรานต์"],["2026-04-15","วันสงกรานต์"],
 ["2026-05-04","วันฉัตรมงคล"],["2026-05-13","วันพืชมงคล"],
 ["2026-06-01","ชดเชยวันวิสาขบูชา"],["2026-06-03","วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี"],
 ["2026-07-28","วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว"],["2026-07-29","วันอาสาฬหบูชา"],["2026-07-30","วันเข้าพรรษา"],
 ["2026-08-12","วันแม่แห่งชาติ"],
 ["2026-10-13","วันนวมินทรมหาราช"],["2026-10-23","วันปิยมหาราช"],
 ["2026-12-07","วันหยุดชดเชยวันพ่อแห่งชาติ/วันชาติ"],["2026-12-10","วันรัฐธรรมนูญ"],["2026-12-31","วันสิ้นปี"]
];
function defaultHolidays(){
 const x=get("holidays",null);
 if(x)return x;
 const rows=THAI_HOLIDAY_2026.map(([date,name])=>({uid:uid(),date,name,type:"ราชการ"}));
 set("holidays",rows); return rows
}
function holidays(){return defaultHolidays()}
function holidayMap(){const m={};holidays().forEach(h=>m[h.date]=h);return m}
function dayInfo(dateStr){
 const s=settings(),d=parseDate(dateStr); if(!d)return {off:true,reason:""};
 const wd=d.getDay(),weekend=wd===0||wd===6;
 const h=(s.useThaiHolidays===false||s.useThaiHolidays==="false")?null:holidayMap()[dateStr];
 const before=s.openDate && dateStr<s.openDate, after=s.closeDate && dateStr>s.closeDate;
 const outTerm=before||after;
 return {date:d,wd,weekend,holiday:h,holidayName:h?.name||"",outTerm,off:weekend||!!h||outTerm,
  reason:outTerm?"นอกภาคเรียน":weekend?(wd===6?"วันเสาร์":"วันอาทิตย์"):(h?h.name:"")}
}
function isInstructionDay(ds){return !dayInfo(ds).off}
function countInstructionDays(a,b){
 const start=parseDate(a),end=parseDate(b); if(!start||!end||start>end)return 0;
 let n=0,d=new Date(start);
 while(d<=end){if(isInstructionDay(isoLocal(d)))n++;d.setDate(d.getDate()+1)}
 return n
}
function calculateCloseFromTarget(openDate,target){
 const start=parseDate(openDate); if(!start||!target)return "";
 let count=0,d=new Date(start),guard=0;
 while(count<target && guard<500){
  if(isInstructionDay(isoLocal(d)))count++;
  if(count>=target)break;
  d.setDate(d.getDate()+1);guard++
 }
 return isoLocal(d)
}
function saveSettingsForm(){
 const f=$("#settingsForm"), old=settings(), o={};
 new FormData(f).forEach((v,k)=>o[k]=v);
 o.useThaiHolidays=!!f.elements.useThaiHolidays?.checked;
 set("settings",{...old,...o}); window.cloudSaveSettings?.(); renderTermSummary(); alert("บันทึกข้อมูลห้องเรียนและภาคเรียนแล้ว");
}
function calculateTargetClose(){
 const f=$("#settingsForm"), open=f.elements.openDate.value, target=Number(f.elements.targetDays.value||100);
 const original=get("settings",{}),temp=settings();
 set("settings",{...temp,openDate:open,closeDate:"2099-12-31",useThaiHolidays:!!f.elements.useThaiHolidays.checked});
 const end=calculateCloseFromTarget(open,target);
 set("settings",original);
 if(end){f.elements.closeDate.value=end;renderTermSummaryFromForm()}
}
function renderTermSummaryFromForm(){
 const f=$("#settingsForm");if(!f)return;
 const old=get("settings",{}),tmp={...settings()};
 new FormData(f).forEach((v,k)=>tmp[k]=v);tmp.useThaiHolidays=!!f.elements.useThaiHolidays.checked;
 set("settings",tmp);renderTermSummary();set("settings",old)
}
function renderTermSummary(){
 const el=$("#termSummary");if(!el)return; const s=settings();
 const days=countInstructionDays(s.openDate,s.closeDate),weeks=days/5;
 el.innerHTML=`วันเปิดเรียน: <b>${esc(s.openDate||"-")}</b> &nbsp; ถึง &nbsp; วันปิดเรียน: <b>${esc(s.closeDate||"-")}</b><br>
 วันเรียนที่ระบบนับได้: <b>${days} วัน</b> ≈ <b>${weeks.toFixed(1)} สัปดาห์</b>
 ${Number(s.targetDays||100)===days?'<span class="badge">ครบเป้าหมาย</span>':`<br>เป้าหมาย ${esc(s.targetDays||100)} วัน / ${esc(s.targetWeeks||20)} สัปดาห์`}`;
}
function renderRoster(){
 const body=$("#rosterBody"); if(!body)return;
 const rows=students();
 body.innerHTML=rows.length?rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.id)}</td><td>${esc(r.name)}</td><td><button class="btn danger" onclick="removeStudent('${r.uid}')">ลบ</button></td></tr>`).join(""):`<tr><td colspan="4" style="text-align:center;color:#64748b;padding:25px">ยังไม่มีรายชื่อนักเรียน</td></tr>`;
 $("#studentCount").textContent=rows.length;
}
function addStudent(){
 const id=$("#studentId").value.trim(), name=$("#studentName").value.trim();
 if(!name)return alert("กรอกชื่อ-สกุลนักเรียน");
 const a=students();a.push({uid:uid(),id,name});set("students",a);window.cloudSaveStudents?.();$("#studentId").value="";$("#studentName").value="";renderRoster()
}
function removeStudent(id){if(!confirm("ลบนักเรียนรายการนี้?"))return;set("students",students().filter(x=>x.uid!==id));window.cloudSaveStudents?.();renderRoster()}
function importRoster(){
 const lines=$("#rosterPaste").value.trim().split(/\r?\n/).filter(Boolean), out=[];
 lines.forEach(line=>{const p=line.split(/,|\t/).map(x=>x.trim()); if(!p.length)return;
   if(p.length>=3 && /^\d+$/.test(p[0])) out.push({uid:uid(),id:p[1],name:p.slice(2).join(" ")});
   else if(p.length>=2) out.push({uid:uid(),id:p[0],name:p.slice(1).join(" ")});
 });
 if(!out.length)return alert("ไม่พบข้อมูลที่นำเข้า");set("students",out);window.cloudSaveStudents?.();renderRoster();alert(`นำเข้า ${out.length} คน`);
}
function initSettings(){
 const s=settings(),f=$("#settingsForm");Object.entries(s).forEach(([k,v])=>{if(f.elements[k]){if(f.elements[k].type==="checkbox")f.elements[k].checked=!!v;else f.elements[k].value=v}});
 ["openDate","closeDate"].forEach(k=>f.elements[k]?.addEventListener("change",renderTermSummaryFromForm));
 f.elements.targetDays?.addEventListener("change",()=>{const n=Number(f.elements.targetDays.value||0);f.elements.targetWeeks.value=n?(n/5).toFixed(n%5?1:0):"";renderTermSummaryFromForm()});
 f.elements.targetWeeks?.addEventListener("change",()=>{const n=Number(f.elements.targetWeeks.value||0);f.elements.targetDays.value=n?Math.round(n*5):"";renderTermSummaryFromForm()});
 f.elements.useThaiHolidays?.addEventListener("change",renderTermSummaryFromForm);
 renderRoster();renderHolidayList();renderTermSummary();
}
function renderHolidayList(){
 const body=$("#holidayList");if(!body)return;
 const rows=holidays().sort((a,b)=>a.date.localeCompare(b.date));
 body.innerHTML=rows.map(h=>`<div class="holiday-row"><input type="date" value="${h.date}" onchange="editHoliday('${h.uid}','date',this.value)"><input value="${esc(h.name)}" onchange="editHoliday('${h.uid}','name',this.value)"><button class="btn danger" onclick="removeHoliday('${h.uid}')">ลบ</button></div>`).join("");
}
function addHoliday(){const d=$("#holidayDate").value,n=$("#holidayName").value.trim();if(!d||!n)return alert("กรอกวันที่และชื่อวันหยุด");const a=holidays();a.push({uid:uid(),date:d,name:n,type:"กำหนดเอง"});set("holidays",a);window.cloudSaveSettings?.();$("#holidayDate").value="";$("#holidayName").value="";renderHolidayList();renderTermSummary()}
function editHoliday(id,k,v){const a=holidays();const x=a.find(h=>h.uid===id);if(x)x[k]=v;set("holidays",a);window.cloudSaveSettings?.();renderTermSummary()}
function removeHoliday(id){set("holidays",holidays().filter(h=>h.uid!==id));window.cloudSaveSettings?.();renderHolidayList();renderTermSummary()}
function restoreHolidayPreset(){if(!confirm("คืนค่ารายการวันหยุด พ.ศ. 2569 ตามชุดเริ่มต้น?"))return;set("holidays",THAI_HOLIDAY_2026.map(([date,name])=>({uid:uid(),date,name,type:"ราชการ"})));window.cloudSaveSettings?.();renderHolidayList();renderTermSummary()}
function fillMonth(id){const el=$(id);if(el&&!el.value){const ms=monthsInTerm();el.value=ms[0]||new Date().toISOString().slice(0,7)}}
async function openPrint(module,ymSelector,all=false){let extra=all?"&all=1":"";if(ymSelector&&!all){const v=$(ymSelector).value;extra+=`&month=${encodeURIComponent(v)}`}try{if(window.cloudRefreshApprovalSignature)await window.cloudRefreshApprovalSignature()}catch(e){console.error(e)}window.open(`../print/form.html?module=${encodeURIComponent(module)}${extra}`,"_blank")}
function moduleStore(k){return get("module_"+k,{})}
function saveModule(k,v){set("module_"+k,v);window.cloudQueueModuleSave?.(k,v)}
function rosterRows(){return students().map((s,i)=>({...s,no:i+1}))}

function normalizeAttendanceStatus(v){
 return v==="ม"?"/":(v||"");
}
function isAttendancePresent(v){
 const s=normalizeAttendanceStatus(v);
 return s==="/" || s==="ส";
}

/* ---------- Attendance ---------- */
function initAttendance(){
 fillMonth("#month"); const s=settings();
 $("#month").addEventListener("change",renderAttendanceMatrix);
 const daily=$("#attendanceDate");
 const now=new Date(),open=parseDate(s.openDate),close=parseDate(s.closeDate);
 daily.value=(open&&close&&now>=open&&now<=close)?isoLocal(now):(s.openDate||isoLocal(now));
 daily.addEventListener("change",renderDailyAttendance);
 renderAttendanceMatrix();renderDailyAttendance();
}
function renderAttendanceMatrix(){
 const ym=$("#month").value,inf=monthInfo(ym),roster=rosterRows(),store=moduleStore("attendance"),data=store[ym]||{},today=isoLocal(new Date());
 const days=Array.from({length:inf.days},(_,i)=>{
   const day=i+1,ds=`${ym}-${String(day).padStart(2,"0")}`,x=dayInfo(ds);
   return {day,ds,x};
 });
 $("#matrixHead").innerHTML=`<tr><th rowspan="2">เลขที่</th><th rowspan="2">เลขประจำตัว</th><th rowspan="2" class="name">ชื่อ - สกุล</th><th colspan="${inf.days}">ประจำเดือน ${inf.name} พ.ศ. ${inf.be}</th><th rowspan="2">รวมมา</th></tr><tr>${days.map(z=>{
   const cl=z.x.outTerm?"out-term":z.x.off?"day-off":z.ds===today?"today-col":"";
   return `<th class="${cl} ${z.x.holiday?"holiday-special":""}" title="${esc(z.x.reason)}"><span class="day-number">${z.day}</span>${!z.x.holiday?`<span class="day-note">${z.x.off?esc(z.x.reason):dayNames[parseDate(z.ds).getDay()]}</span>`:""}</th>`
 }).join("")}</tr>`;
 $("#matrixBody").innerHTML=roster.map((r,rowIndex)=>{
  const d=data[r.uid]||{};
  const cells=days.map(z=>{
   const val=d[z.day]??"",cl=z.x.outTerm?"out-term":z.x.off?"day-off":z.ds===today?"today-col":"";
   if(z.x.holiday){
     if(rowIndex!==0)return "";
     const span=Math.max(roster.length,1);
     return `<td class="holiday-merged-cell" rowspan="${span}"><div class="holiday-merged-label">${esc(z.x.holidayName||z.x.reason||"วันหยุด")}</div></td>`;
   }
   if(z.x.off)return `<td class="${cl}" title="${esc(z.x.reason)}">—</td>`;
   const nv=normalizeAttendanceStatus(val);
   return `<td class="${cl}"><select data-u="${r.uid}" data-d="${z.day}" onchange="attendanceMatrixChange(this)"><option value=""></option><option value="/" ${nv==="/"?"selected":""}>/</option><option value="ข" ${nv==="ข"?"selected":""}>ข</option><option value="ล" ${nv==="ล"?"selected":""}>ล</option><option value="น" ${nv==="น"?"selected":""}>น</option><option value="ส" ${nv==="ส"?"selected":""}>ส</option></select></td>`;
  }).join("");
  const total=Object.entries(d).filter(([day,v])=>isAttendancePresent(v) && isInstructionDay(`${ym}-${String(day).padStart(2,"0")}`)).length;
  return `<tr><td>${r.no}</td><td>${esc(r.id)}</td><td class="name">${esc(r.name)}</td>${cells}<td>${total||""}</td></tr>`
 }).join("")||`<tr><td colspan="${inf.days+4}" style="padding:20px">กรุณาเพิ่มรายชื่อนักเรียนใน “ข้อมูลห้องเรียน” ก่อน</td></tr>`;
}
function attendanceMatrixChange(el){
 const ym=$("#month").value,st=moduleStore("attendance");st[ym]=st[ym]||{};st[ym][el.dataset.u]=st[ym][el.dataset.u]||{};
 st[ym][el.dataset.u][el.dataset.d]=el.value;saveModule("attendance",st);renderDailyAttendance();
}
function setAttendance(studentUid,date,status){
 const x=dayInfo(date);if(x.off)return;
 const ym=date.slice(0,7),day=String(Number(date.slice(8,10))),st=moduleStore("attendance");
 st[ym]=st[ym]||{};st[ym][studentUid]=st[ym][studentUid]||{};st[ym][studentUid][day]=status;saveModule("attendance",st);
 renderDailyAttendance();if($("#month").value===ym)renderAttendanceMatrix();
}
function markAllPresent(){
 const date=$("#attendanceDate").value,x=dayInfo(date);if(x.off)return alert(`วันนี้ปิดการเช็กชื่อ: ${x.reason}`);
 const ym=date.slice(0,7),day=String(Number(date.slice(8,10))),st=moduleStore("attendance");st[ym]=st[ym]||{};
 students().forEach(s=>{st[ym][s.uid]=st[ym][s.uid]||{};st[ym][s.uid][day]="/"});saveModule("attendance",st);renderDailyAttendance();if($("#month").value===ym)renderAttendanceMatrix();
}
function clearAttendanceDay(){
 const date=$("#attendanceDate").value;if(!confirm("ล้างสถานะการมาเรียนของวันที่เลือกทั้งหมด?"))return;
 const ym=date.slice(0,7),day=String(Number(date.slice(8,10))),st=moduleStore("attendance");if(st[ym])Object.values(st[ym]).forEach(x=>{if(x)delete x[day]});saveModule("attendance",st);renderDailyAttendance();if($("#month").value===ym)renderAttendanceMatrix();
}
function renderDailyAttendance(){
 const date=$("#attendanceDate").value,body=$("#dailyAttendanceBody");if(!date||!body)return;
 const x=dayInfo(date),ym=date.slice(0,7),day=String(Number(date.slice(8,10))),d=moduleStore("attendance")[ym]||{},rows=rosterRows();
 $("#dailyDateInfo").innerHTML=x.off?`<span class="badge">${esc(x.reason)} — ปิดการเช็กชื่อ</span>`:`วันเรียนปกติ`;
 body.innerHTML=rows.map(r=>{const v=normalizeAttendanceStatus((d[r.uid]||{})[day]||"");const statuses=["/","ข","ล","น","ส"],labels=["มา","ขาด","ลา","หนี","สาย"];return `<tr class="${x.off?"day-off":""}"><td>${r.no}</td><td>${esc(r.id)}</td><td>${esc(r.name)}</td><td><div class="daily-status">${statuses.map((z,i)=>`<button class="status-btn ${v===z?"active":""} ${x.off?"off":""}" onclick="setAttendance('${r.uid}','${date}','${z}')">${labels[i]}</button>`).join("")}</div></td></tr>`}).join("");
 const vals=rows.map(r=>normalizeAttendanceStatus((d[r.uid]||{})[day]||""));const c=z=>vals.filter(v=>v===z).length;
 const presentCount=c("/")+c("ส");
 $("#dailySummary").innerHTML=`<div><strong>${rows.length}</strong>ทั้งหมด</div><div><strong>${presentCount}</strong>มาเรียน<br><small>(รวมสาย)</small></div><div><strong>${c("ข")}</strong>ขาด</div><div><strong>${c("ล")}</strong>ลา</div><div><strong>${c("น")}</strong>หนี</div><div><strong>${c("ส")}</strong>สาย</div>`;
}

/* ---------- Savings monthly ---------- */
function savingsMonthTotal(studentUid,ym){
 const st=moduleStore("savings"),data=st[ym]?.[studentUid]||{};
 return Object.entries(data).reduce((sum,[day,val])=>{
  const ds=`${ym}-${String(day).padStart(2,"0")}`;
  return sum+(isInstructionDay(ds)?(Number(val)||0):0);
 },0)
}
function savingsCumulative(studentUid,uptoYm){
 let ms=monthsInTerm();
 if(!ms.length)ms=Object.keys(moduleStore("savings")).sort();
 return ms.filter(m=>m<=uptoYm).reduce((sum,m)=>sum+savingsMonthTotal(studentUid,m),0)
}
function initMonthlyMatrix(kind,type="text"){fillMonth("#month");$("#month").addEventListener("change",()=>renderMonthlyMatrix(kind,type));renderMonthlyMatrix(kind,type)}
function renderMonthlyMatrix(kind,type){
 const ym=$("#month").value,inf=monthInfo(ym),roster=rosterRows(),store=moduleStore(kind),data=store[ym]||{};
 const days=Array.from({length:inf.days},(_,i)=>{
   const day=i+1,ds=`${ym}-${String(day).padStart(2,"0")}`,x=dayInfo(ds);
   return {day,ds,x};
 });
 $("#matrixHead").innerHTML=`<tr><th rowspan="2">เลขที่</th><th rowspan="2">เลขประจำตัว</th><th rowspan="2" class="name">ชื่อ - สกุล</th><th colspan="${inf.days}">ประจำเดือน ${inf.name} พ.ศ. ${inf.be}</th><th rowspan="2">รวม</th></tr><tr>${days.map(z=>`<th class="${z.x.off?"day-off":""} ${z.x.holiday?"holiday-special":""}" title="${esc(z.x.reason)}"><span class="day-number">${z.day}</span>${!z.x.holiday?`<span class="day-note">${z.x.off?esc(z.x.reason):""}</span>`:""}</th>`).join("")}</tr>`;
 $("#matrixBody").innerHTML=roster.map((r,rowIndex)=>{
   const d=data[r.uid]||{};
   const cells=days.map(z=>{
     const val=d[z.day]??"";
     if(z.x.holiday){
       if(rowIndex!==0)return "";
       const span=Math.max(roster.length,1);
       return `<td class="holiday-merged-cell" rowspan="${span}"><div class="holiday-merged-label">${esc(z.x.holidayName||z.x.reason||"วันหยุด")}</div></td>`;
     }
     if(z.x.off)return `<td class="day-off">—</td>`;
     return `<td><input type="number" min="0" step="1" value="${esc(val)}" data-u="${r.uid}" data-d="${z.day}" onchange="matrixChange('${kind}',this)"></td>`;
   }).join("");
   const total=Object.entries(d).reduce((a,[day,b])=>a+(isInstructionDay(`${ym}-${String(day).padStart(2,"0")}`)?(Number(b)||0):0),0);
   return `<tr><td>${r.no}</td><td>${esc(r.id)}</td><td class="name">${esc(r.name)}</td>${cells}<td>${total||""}</td></tr>`
 }).join("")||`<tr><td colspan="${inf.days+4}" style="padding:20px">กรุณาเพิ่มรายชื่อนักเรียนก่อน</td></tr>`;
}
function matrixChange(kind,el){const ym=$("#month").value,st=moduleStore(kind);st[ym]=st[ym]||{};st[ym][el.dataset.u]=st[ym][el.dataset.u]||{};st[ym][el.dataset.u][el.dataset.d]=el.value;saveModule(kind,st);renderMonthlyMatrix(kind,"number")}

/* ---------- Behavior custom table ---------- */
function behaviorRatingValue(v){
 return ["ดีมาก","ดี","พอใช้","ปรับปรุง"].includes(v)?v:"";
}
function initBehavior(){
 fillMonth("#month");
 $("#month").addEventListener("change",renderBehavior);
 renderBehavior();
}
function renderBehavior(){
 const ym=$("#month").value,inf=monthInfo(ym),data=moduleStore("behavior")[ym]||{},roster=rosterRows(),s=settings();
 $("#behaviorYear").textContent=s.academicYear||inf.be;
 $("#behaviorClass").textContent=classText();
 $("#behaviorMonthName").textContent=inf.name;
 $("#behaviorBE").textContent=inf.be;
 const ratings=["ดีมาก","ดี","พอใช้","ปรับปรุง"];
 $("#behaviorBody").innerHTML=roster.map(r=>{
   const x=data[r.uid]||{},rating=behaviorRatingValue(x.rating),advice=x.advice||"";
   return `<tr>
     <td class="b-no">${r.no}</td>
     <td class="b-id">${esc(r.id)}</td>
     <td class="b-name">${esc(r.name)}</td>
     ${ratings.map(z=>`<td class="b-rating-cell"><input type="radio" name="behavior-${r.uid}" ${rating===z?"checked":""} onclick="setBehaviorRating('${r.uid}','${z}')"></td>`).join("")}
     <td class="b-advice-cell"><input value="${esc(advice)}" oninput="setBehaviorAdvice('${r.uid}',this.value)"></td>
   </tr>`;
 }).join("")||`<tr><td colspan="8" class="empty">กรุณาเพิ่มรายชื่อนักเรียนก่อน</td></tr>`;
}
function setBehaviorRating(studentUid,rating){
 const ym=$("#month").value,st=moduleStore("behavior");
 st[ym]=st[ym]||{};st[ym][studentUid]=st[ym][studentUid]||{};
 const current=st[ym][studentUid].rating||"";
 st[ym][studentUid].rating=current===rating?"":rating;
 saveModule("behavior",st);
 renderBehavior();
}
function setBehaviorAdvice(studentUid,value){
 const ym=$("#month").value,st=moduleStore("behavior");
 st[ym]=st[ym]||{};st[ym][studentUid]=st[ym][studentUid]||{};
 st[ym][studentUid].advice=value;
 saveModule("behavior",st);
}

/* ---------- Roster monthly tables ---------- */
const schemas={
 health:{cols:[["age","อายุ","text"],["weight","น้ำหนัก","text"],["height","ส่วนสูง","text"],["hair","ผม/ทรงผม","text"],["nails","เล็บมือ","text"],["clothes","เสื้อผ้า","text"],["mouth","ช่องปาก/กลิ่นตัว","text"],["note","หมายเหตุ/คำแนะนำ","text"]]},
 behavior:{cols:[["rating","พฤติกรรม","select"],["advice","ข้อแนะนำ/แก้ไข","text"]]},
 literacy:{cols:[["spell","แจกลูกสะกดคำ","check"],["read","อ่านออกเสียง","check"],["copy","คัดคำและเรื่อง","check"],["dictation","เขียนตามคำบอก","check"]]}
};
function initRosterTable(kind){fillMonth("#month");$("#month").addEventListener("change",()=>renderRosterTable(kind));renderRosterTable(kind)}
function renderRosterTable(kind){
 const ym=$("#month").value,store=moduleStore(kind),data=store[ym]||{},cols=schemas[kind].cols,roster=rosterRows();
 $("#rosterHead").innerHTML=`<tr><th>เลขที่</th><th>เลขประจำตัว</th><th>ชื่อ - สกุล</th>${cols.map(c=>`<th>${c[1]}</th>`).join("")}</tr>`;
 $("#rosterEditBody").innerHTML=roster.map(r=>`<tr><td>${r.no}</td><td>${esc(r.id)}</td><td>${esc(r.name)}</td>${cols.map(c=>{
   const val=(data[r.uid]||{})[c[0]]??"";
   if(c[2]==="select")return `<td><select data-u="${r.uid}" data-f="${c[0]}" onchange="rosterCell('${kind}',this)"><option></option>${["ดีมาก","ดี","พอใช้","ปรับปรุง"].map(x=>`<option ${val===x?"selected":""}>${x}</option>`).join("")}</select></td>`;
   if(c[2]==="check")return `<td style="text-align:center"><input class="checkbox-big" type="checkbox" ${val===true||val==="true"?"checked":""} data-u="${r.uid}" data-f="${c[0]}" onchange="rosterCell('${kind}',this)"></td>`;
   return `<td><input value="${esc(val)}" data-u="${r.uid}" data-f="${c[0]}" onchange="rosterCell('${kind}',this)"></td>`;
 }).join("")}</tr>`).join("")||`<tr><td colspan="${cols.length+3}" style="padding:20px">กรุณาเพิ่มรายชื่อนักเรียนก่อน</td></tr>`;
}
function rosterCell(kind,el){const ym=$("#month").value,st=moduleStore(kind);st[ym]=st[ym]||{};st[ym][el.dataset.u]=st[ym][el.dataset.u]||{};st[ym][el.dataset.u][el.dataset.f]=el.type==="checkbox"?el.checked:el.value;saveModule(kind,st)}



/* ---------- Literacy custom table ---------- */
const LITERACY_FIELDS=[
 ["spell","แจกลูกสะกดคำ"],
 ["read","อ่านออกเสียง"],
 ["copy","คัดคำและเรื่อง"],
 ["dictation","เขียนตามคำบอก"]
];
function literacyRowData(data,uid){
 const x=data[uid]||{};
 return {
   spell:x.spell===true||x.spell==="true",
   read:x.read===true||x.read==="true",
   copy:x.copy===true||x.copy==="true",
   dictation:x.dictation===true||x.dictation==="true",
   note:x.note||""
 };
}
function initLiteracy(){
 fillMonth("#month");
 $("#month").addEventListener("change",renderLiteracy);
 renderLiteracy();
}
function renderLiteracy(){
 const ym=$("#month").value,inf=monthInfo(ym),data=moduleStore("literacy")[ym]||{},roster=rosterRows();
 $("#literacyClass").textContent=classText();
 $("#literacyMonthName").textContent=inf.name;
 $("#literacyBE").textContent=inf.be;
 $("#literacyBody").innerHTML=roster.map(r=>{
   const x=literacyRowData(data,r.uid);
   return `<tr>
     <td class="center">${r.no}</td>
     <td class="center">${esc(r.id)}</td>
     <td class="left literacy-name-cell">${esc(r.name)}</td>
     ${LITERACY_FIELDS.map(([key])=>`<td class="literacy-check-cell"><input class="checkbox-big" type="checkbox" ${x[key]?"checked":""} onchange="setLiteracyCheck('${r.uid}','${key}',this.checked)"></td>`).join("")}
     <td class="literacy-note-cell"><input class="literacy-note-input" value="${esc(x.note)}" oninput="setLiteracyNote('${r.uid}',this.value)"></td>
   </tr>`;
 }).join("") || `<tr><td colspan="8" class="empty">กรุณาเพิ่มรายชื่อนักเรียนก่อน</td></tr>`;
}
function setLiteracyCheck(studentUid,field,checked){
 const ym=$("#month").value,st=moduleStore("literacy");
 st[ym]=st[ym]||{};st[ym][studentUid]=st[ym][studentUid]||{};
 st[ym][studentUid][field]=checked;
 saveModule("literacy",st);
}

function literacyCheckAll(field){
 const ym=$("#month").value,st=moduleStore("literacy");
 st[ym]=st[ym]||{};
 students().forEach(s=>{
   st[ym][s.uid]=st[ym][s.uid]||{};
   st[ym][s.uid][field]=true;
 });
 saveModule("literacy",st);
 renderLiteracy();
}

function setLiteracyNote(studentUid,value){
 const ym=$("#month").value,st=moduleStore("literacy");
 st[ym]=st[ym]||{};st[ym][studentUid]=st[ym][studentUid]||{};
 st[ym][studentUid].note=value;
 saveModule("literacy",st);
}

/* ---------- Health custom table ---------- */
const HEALTH_RATE_OPTIONS=["","3","2","1"];
const HEALTH_RATE_FIELDS=[
 ["hair","ผม/ทรงผม"],
 ["hygiene","เล็บมือ"],
 ["clothes","เสื้อผ้า"],
 ["mouth","ช่องปาก/กลิ่นตัว"]
];
function healthRowData(data,uid){
 const x=data[uid]||{};
 return {
   age:x.age||"",
   weight:x.weight||"",
   height:x.height||"",
   hair:x.hair||"",
   hygiene:x.hygiene||x.nails||"",
   clothes:x.clothes||"",
   mouth:x.mouth||"",
   note:x.note||""
 };
}
function initHealth(){
 fillMonth("#month");
 $("#month").addEventListener("change",renderHealth);
 renderHealth();
}
function renderHealth(){
 const ym=$("#month").value,inf=monthInfo(ym),data=moduleStore("health")[ym]||{};
 $("#healthClass").textContent=classText();
 $("#healthMonthName").textContent=inf.name;
 $("#healthBE").textContent=inf.be;
 const roster=rosterRows();
 $("#healthBody").innerHTML=roster.map(r=>{
   const x=healthRowData(data,r.uid);
   return `<tr>
     <td class="center">${r.no}</td>
     <td class="center">${esc(r.id)}</td>
     <td class="left">${esc(r.name)}</td>
     <td><input class="health-text" value="${esc(x.age)}" oninput="setHealthCell('${r.uid}','age',this.value)"></td>
     <td><input class="health-text" value="${esc(x.weight)}" oninput="setHealthCell('${r.uid}','weight',this.value)"></td>
     <td><input class="health-text" value="${esc(x.height)}" oninput="setHealthCell('${r.uid}','height',this.value)"></td>
     ${HEALTH_RATE_FIELDS.map(([key])=>`<td><select class="health-rate-select" onchange="setHealthCell('${r.uid}','${key}',this.value)">${HEALTH_RATE_OPTIONS.map(v=>`<option value="${v}" ${x[key]===v?"selected":""}>${v}</option>`).join("")}</select></td>`).join("")}
     <td><input class="health-note-input" value="${esc(x.note)}" oninput="setHealthCell('${r.uid}','note',this.value)"></td>
   </tr>`;
 }).join("") || `<tr><td colspan="11" class="empty">กรุณาเพิ่มรายชื่อนักเรียนก่อน</td></tr>`;
}
function setHealthCell(studentUid,field,value){
 const ym=$("#month").value,st=moduleStore("health");
 st[ym]=st[ym]||{};
 st[ym][studentUid]=st[ym][studentUid]||{};
 st[ym][studentUid][field]=value;
 saveModule("health",st);
}

/* ---------- Other modules ---------- */


const TH_SHORT_MONTHS=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function formatThaiShortDate(dateStr){
 if(!dateStr)return "";
 const d=parseDate(dateStr);
 if(!d)return dateStr;
 return `${d.getDate()} ${TH_SHORT_MONTHS[d.getMonth()]} ${String(d.getFullYear()+543).slice(-2)}`;
}

function scholarshipResolveStudent(row){
 const roster=students();
 if(row.studentUid){
   const s=roster.find(x=>x.uid===row.studentUid);
   if(s)return {uid:s.uid,id:s.id||row.studentId||"",name:s.name||row.student||""};
 }
 const oldName=String(row.student||row.studentName||"").trim();
 const oldId=String(row.studentId||"").trim();
 let s=null;
 if(oldId)s=roster.find(x=>String(x.id||"").trim()===oldId);
 if(!s && oldName)s=roster.find(x=>String(x.name||"").trim()===oldName);
 if(s)return {uid:s.uid,id:s.id||oldId,name:s.name||oldName};
 return {uid:row.studentUid||"",id:oldId,name:oldName};
}
function scholarshipRows(){
 const st=moduleStore("scholarship");
 const rows=Array.isArray(st.rows)?st.rows:[];
 let changed=false;
 rows.forEach(r=>{
   const s=scholarshipResolveStudent(r);
   if(s.uid && r.studentUid!==s.uid){r.studentUid=s.uid;changed=true}
   if(s.id && r.studentId!==s.id){r.studentId=s.id;changed=true}
   if(s.name && r.student!==s.name){r.student=s.name;changed=true}
 });
 if(changed)saveModule("scholarship",{rows});
 return rows;
}
function scholarshipStudentOptions(selected=""){
 return `<option value="">-- เลือกนักเรียน --</option>`+students().map(s=>`<option value="${esc(s.uid)}" ${selected===s.uid?"selected":""}>${esc(s.id||"")} ${esc(s.name)}</option>`).join("");
}
function scholarshipSetEditMode(editing){
 $("#schSubmitBtn").textContent=editing?"บันทึกการแก้ไข":"บันทึก";
 $("#schCancelEdit").style.display=editing?"inline-block":"none";
}
function initScholarship(){
 fillMonth("#printMonth");
 $("#schStudent").innerHTML=scholarshipStudentOptions();
 $("#printMonth").addEventListener("change",renderScholarship);
 $("#schForm").elements.date.addEventListener("change",()=>{
   const d=$("#schForm").elements.date.value;
   if(d)$("#printMonth").value=d.slice(0,7);
   renderScholarship();
 });
 scholarshipRows();
 renderScholarship();

 $("#schForm").addEventListener("submit",e=>{
   e.preventDefault();
   const form=e.target, studentUid=form.elements.studentUid.value;
   const student=students().find(s=>s.uid===studentUid);
   if(!student)return alert("กรุณาเลือกนักเรียน");
   if(!form.elements.date.value)return alert("กรุณาเลือกวันที่ได้รับทุน");

   const editId=$("#schEditingId").value;
   const o={
     uid:editId||uid(),
     studentUid:student.uid,
     studentId:student.id||"",
     student:student.name||"",
     fund:form.elements.fund.value.trim(),
     type:form.elements.type.value,
     amount:form.elements.amount.value.trim(),
     date:form.elements.date.value,
     org:form.elements.org.value.trim()
   };

   const rows=scholarshipRows();
   const idx=rows.findIndex(x=>x.uid===o.uid);
   if(idx>=0)rows[idx]=o; else rows.unshift(o);
   saveModule("scholarship",{rows});

   $("#printMonth").value=o.date.slice(0,7);
   form.reset();
   $("#schEditingId").value="";
   $("#schStudent").innerHTML=scholarshipStudentOptions();
   scholarshipSetEditMode(false);
   renderScholarship();
 })
}
function renderScholarship(){
 const ym=$("#printMonth").value;
 const allRows=scholarshipRows()
   .filter(r=>!ym || (r.date||"").slice(0,7)===ym)
   .sort((a,b)=>(a.date||"").localeCompare(b.date||""));
 const roster=rosterRows();
 const inf=ym?monthInfo(ym):null;
 const studentsWithGrant=new Set(allRows.map(r=>scholarshipResolveStudent(r).uid).filter(Boolean));
 $("#schMonthSummary").textContent=inf?`เดือน ${inf.name} พ.ศ. ${inf.be} • นักเรียนทั้งหมด ${roster.length} คน • มีข้อมูลรับทุน ${studentsWithGrant.size} คน`:`นักเรียนทั้งหมด ${roster.length} คน`;

 $("#schBody").innerHTML=roster.map(r=>{
   const records=allRows.filter(x=>scholarshipResolveStudent(x).uid===r.uid);
   const join=(fn)=>records.map(fn).filter(Boolean).join("<br>");
   const actions=records.length?records.map(x=>`<div class="actions sch-row-actions"><button class="btn gray" type="button" onclick="editScholarship('${x.uid}')">แก้ไข</button><button class="btn danger" type="button" onclick="delSch('${x.uid}')">ลบ</button></div>`).join(""):"";
   return `<tr>
     <td>${r.no}</td>
     <td>${esc(r.id)}</td>
     <td>${esc(r.name)}</td>
     <td>${join(x=>esc(x.fund||""))}</td>
     <td>${join(x=>esc(x.type||""))}</td>
     <td>${join(x=>esc(x.amount||""))}</td>
     <td>${join(x=>esc(formatThaiShortDate(x.date)))}</td>
     <td>${join(x=>esc(x.org||""))}</td>
     <td>${actions}</td>
   </tr>`;
 }).join("")||`<tr><td colspan="9" style="padding:20px;text-align:center">กรุณาเพิ่มรายชื่อนักเรียนก่อน</td></tr>`;
}
function editScholarship(id){
 const r=scholarshipRows().find(x=>x.uid===id);
 if(!r)return;
 const s=scholarshipResolveStudent(r),form=$("#schForm");
 $("#schEditingId").value=r.uid;
 $("#schStudent").innerHTML=scholarshipStudentOptions(s.uid);
 form.elements.fund.value=r.fund||"";
 form.elements.type.value=r.type||"ทุนการศึกษา";
 form.elements.amount.value=r.amount||"";
 form.elements.date.value=r.date||"";
 form.elements.org.value=r.org||"";
 if(r.date)$("#printMonth").value=r.date.slice(0,7);
 scholarshipSetEditMode(true);
 renderScholarship();
 window.scrollTo({top:0,behavior:"smooth"});
}
function cancelScholarshipEdit(){
 const form=$("#schForm");
 form.reset();
 $("#schEditingId").value="";
 $("#schStudent").innerHTML=scholarshipStudentOptions();
 scholarshipSetEditMode(false);
}
function delSch(id){
 if(!confirm("ยืนยันการลบข้อมูลรับทุนรายการนี้?"))return;
 const rows=scholarshipRows().filter(x=>x.uid!==id);
 saveModule("scholarship",{rows});
 if($("#schEditingId").value===id)cancelScholarshipEdit();
 renderScholarship();
}
function studentOptions(){return students().map(s=>`<option value="${esc(s.name)}">${esc(s.name)}</option>`).join("")}


const VOLUNTEER_STATUSES=["","/","ข","ล","น"];
function normalizeVolunteerStatus(v){
 if(v==="ม")return "/";
 return VOLUNTEER_STATUSES.includes(v)?v:(v||"");
}
function volunteerMonthStore(ym){
 const st=moduleStore("volunteer");
 st.months=st.months||{};
 if(!Object.keys(st.months).length && (st.headers||st.data)){
  const first=monthsInTerm()[0]||ym;
  st.months[first]={headers:st.headers||Array(10).fill(""),data:st.data||{}};
  delete st.headers;delete st.data;saveModule("volunteer",st);
 }
 st.months[ym]=st.months[ym]||{headers:Array(10).fill(""),data:{}};
 return st;
}
function initVolunteer(){
 fillMonth("#month");
 $("#month").addEventListener("change",renderVolunteer);
 $("#eventHeaders").addEventListener("change",()=>{
  const ym=$("#month").value,st=volunteerMonthStore(ym);
  st.months[ym].headers=$("#eventHeaders").value.split(/\r?\n/).slice(0,10);
  while(st.months[ym].headers.length<10)st.months[ym].headers.push("");
  saveModule("volunteer",st);
  renderVolunteer();
 });
 renderVolunteer()
}
function renderVolunteer(){
 const ym=$("#month").value,st=volunteerMonthStore(ym),m=st.months[ym],
   headers=m.headers||Array(10).fill(""),data=m.data||{},roster=rosterRows();

 $("#eventHeaders").value=headers.join("\n");

 $("#volHead").innerHTML=`<tr>
   <th>เลขที่</th>
   <th>เลขประจำตัว</th>
   <th>ชื่อ - สกุล</th>
   ${headers.map((h,i)=>`<th class="vol-status-head">
     <div class="vol-event-name">${esc(h||("กิจกรรม "+(i+1)))}</div>
     <button type="button" class="btn vol-mark-all" onclick="volMarkAll(${i})">เช็กทุกคน /</button>
   </th>`).join("")}
 </tr>`;

 $("#volBody").innerHTML=roster.map(r=>`<tr>
   <td>${r.no}</td>
   <td>${esc(r.id)}</td>
   <td>${esc(r.name)}</td>
   ${headers.map((h,i)=>{
      const raw=(data[r.uid]||{})[i]||"",v=normalizeVolunteerStatus(raw);
      const legacy=v && !VOLUNTEER_STATUSES.includes(v);
      return `<td class="vol-status-cell">
        <select data-u="${r.uid}" data-i="${i}" onchange="volCell(this)">
          <option value=""></option>
          <option value="/" ${v==="/"?"selected":""}>/</option>
          <option value="ข" ${v==="ข"?"selected":""}>ข</option>
          <option value="ล" ${v==="ล"?"selected":""}>ล</option>
          <option value="น" ${v==="น"?"selected":""}>น</option>
          ${legacy?`<option value="${esc(v)}" selected>${esc(v)}</option>`:""}
        </select>
      </td>`;
   }).join("")}
 </tr>`).join("") || `<tr><td colspan="${3+headers.length}" style="padding:20px;text-align:center">กรุณาเพิ่มรายชื่อนักเรียนก่อน</td></tr>`;
}
function volCell(el){
 const ym=$("#month").value,st=volunteerMonthStore(ym),m=st.months[ym];
 m.data=m.data||{};
 m.data[el.dataset.u]=m.data[el.dataset.u]||{};
 m.data[el.dataset.u][el.dataset.i]=el.value;
 saveModule("volunteer",st);
}
function volMarkAll(activityIndex){
 const ym=$("#month").value,st=volunteerMonthStore(ym),m=st.months[ym];
 m.data=m.data||{};
 students().forEach(s=>{
   m.data[s.uid]=m.data[s.uid]||{};
   m.data[s.uid][activityIndex]="/";
 });
 saveModule("volunteer",st);
 renderVolunteer();
}


const HOMEROOM_DAYS=["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์"];
const HOMEROOM_DEFAULT_TIMES={
 "จันทร์":{start:"14:40",end:"15:30"},
 "อังคาร":{start:"14:40",end:"15:30"},
 "พุธ":{start:"14:40",end:"15:30"},
 "พฤหัสบดี":{start:"14:40",end:"15:30"},
 "ศุกร์":{start:"14:40",end:"15:30"}
};
function homeroomTimeSettings(){
 const saved=get("homeroom_time_settings",{})||{}, out={};
 HOMEROOM_DAYS.forEach(day=>{
   out[day]={
     start:saved[day]?.start||HOMEROOM_DEFAULT_TIMES[day].start,
     end:saved[day]?.end||HOMEROOM_DEFAULT_TIMES[day].end
   };
 });
 return out;
}
function homeroomTimeForDay(day){
 const t=homeroomTimeSettings()[day]||{start:"14:40",end:"15:30"};
 return t;
}
function homeroomTimeLabel(day){
 const t=homeroomTimeForDay(day);
 const fmt=v=>String(v||"").replace(":",".");
 return `เวลา ${fmt(t.start)} น. – ${fmt(t.end)} น.`;
}
function openHomeroomSettings(){
 const modal=$("#homeTimeSettingsModal"), body=$("#homeTimeSettingsBody"), times=homeroomTimeSettings();
 body.innerHTML=HOMEROOM_DAYS.map(day=>`<div class="home-time-row" data-day="${day}">
   <div class="home-time-day">${day}</div>
   <div class="field"><label>เริ่ม</label><input class="home-time-start" type="time" value="${times[day].start}"></div>
   <div class="field"><label>สิ้นสุด</label><input class="home-time-end" type="time" value="${times[day].end}"></div>
 </div>`).join("");
 modal.style.display="flex";
}
function closeHomeroomSettings(){
 const modal=$("#homeTimeSettingsModal");
 if(modal)modal.style.display="none";
}
function saveHomeroomTimes(){
 const out={};
 $$(".home-time-row").forEach(row=>{
   const day=row.dataset.day,start=row.querySelector(".home-time-start").value,end=row.querySelector(".home-time-end").value;
   if(!start||!end)return;
   out[day]={start,end};
 });
 set("homeroom_time_settings",out);
 closeHomeroomSettings();
 updateHomeroomTimeHint();
 alert("บันทึกเวลาโฮมรูมแล้ว");
}
function resetHomeroomTimes(){
 if(!confirm("คืนค่าเวลาโฮมรูมทุกวันเป็น 14:40 – 15:30?"))return;
 set("homeroom_time_settings",HOMEROOM_DEFAULT_TIMES);
 openHomeroomSettings();
 updateHomeroomTimeHint();
}
function updateHomeroomTimeHint(){
 const el=$("#homeTimeHint"), form=$("#homeForm");
 if(!el||!form)return;
 const day=form.elements.day.value;
 el.textContent=day?`เวลาโฮมรูมวัน${day}: ${homeroomTimeLabel(day).replace("เวลา ","")}`:"";
}

function homeroomTopicState(x){
 const has=v=>v===true||v==="true"||v==="on"||v===1||v==="1";
 let math=has(x.hmMath), poem=has(x.hmPoem), other=has(x.hmOther);
 let otherText=String(x.hmOtherText||"").trim();
 const legacy=String(x.topic||"").trim();
 if(legacy){
   if(!math && legacy.includes("แม่สูตรคูณ")) math=true;
   if(!poem && legacy.includes("อาขยาน")) poem=true;
   if(!otherText && !["ท่องแม่สูตรคูณ","ท่องอาขยาน"].includes(legacy)) otherText=legacy;
   if(otherText) other=true;
 }
 return {math,poem,other,otherText};
}
function homeroomTopicSummary(x){
 const t=homeroomTopicState(x), out=[];
 if(t.math) out.push("✓ ท่องแม่สูตรคูณ");
 if(t.poem) out.push("✓ ท่องอาขยาน");
 if(t.other || t.otherText) out.push(`✓ อื่น ๆ ${t.otherText||""}`.trim());
 return out.join("<br>") || "-";
}


function homeroomThaiDay(dateStr){
 const d=parseDate(dateStr);
 if(!d)return "";
 return ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"][d.getDay()];
}
function homeroomMonday(d){
 const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
 const wd=x.getDay();
 const shift=wd===0?-6:1-wd;
 x.setDate(x.getDate()+shift);
 x.setHours(0,0,0,0);
 return x;
}
function homeroomDateIso(d){
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function homeroomMondayIso(dateStr){
 const d=parseDate(dateStr);
 return d?homeroomDateIso(homeroomMonday(d)):"";
}
function homeroomWeekNumber(dateStr){
 const d=parseDate(dateStr),open=parseDate(settings().openDate);
 if(!d||!open)return "";
 const a=homeroomMonday(open),b=homeroomMonday(d);
 if(b<a)return "";
 return Math.floor((b-a)/604800000)+1;
}
const HOMEROOM_DAY_OFFSETS={"จันทร์":0,"อังคาร":1,"พุธ":2,"พฤหัสบดี":3,"ศุกร์":4};
function homeroomDateFromMonday(mondayStr,day){
 const d=parseDate(mondayStr);
 if(!d)return "";
 const offset=HOMEROOM_DAY_OFFSETS[day]??0;
 d.setDate(d.getDate()+offset);
 return homeroomDateIso(d);
}
function normalizeHomeMonday(){
 const form=$("#homeForm");
 let monday=form.elements.weekMonday.value;
 if(!monday){
   form.elements.week.value="";
   form.elements.date.value="";
   updateHomeroomTimeHint();
   return;
 }
 monday=homeroomMondayIso(monday);
 form.elements.weekMonday.value=monday;
 form.elements.week.value=homeroomWeekNumber(monday);
 if(!form.elements.day.value)form.elements.day.value="จันทร์";
 form.elements.date.value=homeroomDateFromMonday(monday,form.elements.day.value);
 updateHomeroomTimeHint();
 const pm=$("#printMonth");
 if(pm&&form.elements.date.value)pm.value=form.elements.date.value.slice(0,7);
}
function autoFillHomeroomDateFields(){
 normalizeHomeMonday();
}
function setHomeEditMode(editing){
 $("#homeSubmitBtn").textContent=editing?"บันทึกการแก้ไข":"บันทึก";
 $("#homeCancelEdit").style.display=editing?"inline-block":"none";
}
function cancelHomeEdit(){
 const form=$("#homeForm");
 form.reset();
 form.elements.day.value="จันทร์";
 $("#homeEditingId").value="";
 setHomeEditMode(false);
 normalizeHomeMonday();
}
function editHome(id){
 const r=(moduleStore("homeroom").rows||[]).find(x=>x.uid===id);
 if(!r)return;
 const form=$("#homeForm"),t=homeroomTopicState(r);
 $("#homeEditingId").value=r.uid;
 form.elements.weekMonday.value=r.weekMonday||homeroomMondayIso(r.date);
 form.elements.day.value=r.day||homeroomThaiDay(r.date)||"จันทร์";
 form.elements.hmMath.checked=!!t.math;
 form.elements.hmPoem.checked=!!t.poem;
 form.elements.hmOther.checked=!!(t.other||t.otherText);
 form.elements.hmOtherText.value=t.otherText||"";
 form.elements.absent.value=r.absent||"";
 form.elements.note.value=r.note||"";
 normalizeHomeMonday();
 setHomeEditMode(true);
 window.scrollTo({top:0,behavior:"smooth"});
}
function initHomeroom(){
 fillMonth("#printMonth");
 const form=$("#homeForm");
 form.elements.day.value="จันทร์";
 form.elements.weekMonday.addEventListener("change",normalizeHomeMonday);
 form.elements.day.addEventListener("change",normalizeHomeMonday);
 renderHomeroom();

 form.addEventListener("submit",e=>{
   e.preventDefault();
   normalizeHomeMonday();
   const monday=form.elements.weekMonday.value,ds=form.elements.date.value,day=form.elements.day.value;
   if(!monday)return alert("กรุณากำหนดวันจันทร์ของสัปดาห์");
   if(!ds)return alert("ไม่สามารถคำนวณวันที่ได้");

   const editId=$("#homeEditingId").value;
   const fd=new FormData(form),o={uid:editId||uid()};
   fd.forEach((v,k)=>o[k]=v);
   o.weekMonday=monday;
   o.date=ds;
   o.week=homeroomWeekNumber(monday);
   o.day=day;
   o.hmMath=!!form.elements.hmMath.checked;
   o.hmPoem=!!form.elements.hmPoem.checked;
   o.hmOther=!!form.elements.hmOther.checked;
   o.hmOtherText=(form.elements.hmOtherText.value||"").trim();

   const a=moduleStore("homeroom").rows||[];
   const idx=a.findIndex(x=>x.uid===o.uid);
   if(idx>=0)a[idx]=o; else a.unshift(o);
   saveModule("homeroom",{rows:a});

   // Keep the same weekly anchor for faster entry of Mon–Fri.
   const keepMonday=monday,keepDay=day;
   form.reset();
   form.elements.weekMonday.value=keepMonday;
   form.elements.day.value=keepDay;
   $("#homeEditingId").value="";
   setHomeEditMode(false);
   normalizeHomeMonday();
   if($("#printMonth"))$("#printMonth").value=ds.slice(0,7);
   renderHomeroom();
 })
}
function renderHomeroom(){
 const a=(moduleStore("homeroom").rows||[]).slice().sort((x,y)=>(y.date||"").localeCompare(x.date||""));
 $("#homeBody").innerHTML=a.map(r=>`<tr>
   <td>${esc(r.week)}</td>
   <td>${esc(r.date)}</td>
   <td>${esc(r.day)}</td>
   <td>${homeroomTopicSummary(r)}</td>
   <td>${esc(r.absent)}</td>
   <td>${esc(r.note)}</td>
   <td><div class="actions"><button class="btn gray" type="button" onclick="editHome('${r.uid}')">แก้ไข</button><button class="btn danger" type="button" onclick="delHome('${r.uid}')">ลบ</button></div></td>
 </tr>`).join("")||`<tr><td colspan="7" style="padding:20px;text-align:center">ยังไม่มีข้อมูล</td></tr>`
}
function delHome(id){
 if(!confirm("ยืนยันการลบรายการนี้?"))return;
 const a=(moduleStore("homeroom").rows||[]).filter(x=>x.uid!==id);
 saveModule("homeroom",{rows:a});
 if($("#homeEditingId")?.value===id)cancelHomeEdit();
 renderHomeroom()
}


const CLASSROOM_BOOK_MODULES=[
 ["homeroom","โฮมรูม"],
 ["attendance","มาโรงเรียน"],
 ["savings","ออมทรัพย์"],
 ["behavior","พฤติกรรม"],
 ["health","สุขภาพ"],
 ["scholarship","รับทุน"],
 ["volunteer","จิตอาสา"]
];

function hasMeaningfulValue(v){
 if(v===null||v===undefined||v===false)return false;
 if(typeof v==="string")return v.trim()!=="";
 if(typeof v==="number")return true;
 if(Array.isArray(v))return v.some(hasMeaningfulValue);
 if(typeof v==="object")return Object.values(v).some(hasMeaningfulValue);
 return !!v;
}
function moduleHasUserData(key){
 const st=moduleStore(key);
 if(key==="homeroom")return Array.isArray(st.rows)&&st.rows.some(r=>hasMeaningfulValue(r.date)||hasMeaningfulValue(r.topic)||hasMeaningfulValue(r.absent)||hasMeaningfulValue(r.note)||r.hmMath||r.hmPoem||r.hmOther);
 if(key==="scholarship")return Array.isArray(st.rows)&&st.rows.length>0;
 if(key==="volunteer"){
   const months=st.months||{};
   return Object.values(months).some(m=>hasMeaningfulValue(m?.data));
 }
 return hasMeaningfulValue(st);
}
function classroomDataProgress(){
 const rows=CLASSROOM_BOOK_MODULES.map(([key,label])=>({key,label,done:moduleHasUserData(key)}));
 const done=rows.filter(x=>x.done).length;
 return {rows,done,total:rows.length,pct:rows.length?Math.round(done/rows.length*100):0};
}
function daysBetweenCalendar(a,b){
 const x=parseDate(a),y=parseDate(b);
 if(!x||!y)return 0;
 x.setHours(0,0,0,0);y.setHours(0,0,0,0);
 return Math.ceil((y-x)/86400000);
}
function dashboardTermProgress(){
 const s=settings(),today=isoLocal(new Date()),open=s.openDate,close=s.closeDate;
 const total=countInstructionDays(open,close);
 let elapsed=0;
 if(today<open)elapsed=0;
 else if(today>=close)elapsed=total;
 else elapsed=countInstructionDays(open,today);
 elapsed=Math.max(0,Math.min(total,elapsed));
 const remain=Math.max(0,total-elapsed);
 const pct=total?Math.round(elapsed/total*100):0;
 const calendarRemain=today>=close?0:Math.max(0,daysBetweenCalendar(today,close));
 return {today,total,elapsed,remain,pct,calendarRemain,before:today<open,closed:today>=close};
}

function openClearAllDataModal(){
 const modal=$("#clearAllDataModal"),input=$("#clearAllConfirmInput"),btn=$("#clearAllConfirmButton");
 if(!modal)return;
 input.value="";
 btn.disabled=true;
 modal.style.display="flex";
 setTimeout(()=>input.focus(),50);
}
function closeClearAllDataModal(){
 const modal=$("#clearAllDataModal");
 if(modal)modal.style.display="none";
 const input=$("#clearAllConfirmInput"),btn=$("#clearAllConfirmButton");
 if(input)input.value="";
 if(btn)btn.disabled=true;
}
function validateClearAllDataConfirmation(){
 const input=$("#clearAllConfirmInput"),btn=$("#clearAllConfirmButton");
 if(!input||!btn)return;
 btn.disabled=input.value.trim()!=="ยืนยัน";
}
function clearAllCoreModuleData(){
 const input=$("#clearAllConfirmInput"),btn=$("#clearAllConfirmButton");
 if(!input||input.value.trim()!=="ยืนยัน"){
   if(btn)btn.disabled=true;
   return;
 }
 const coreKeys=["homeroom","attendance","savings","behavior","health","scholarship","volunteer"];
 coreKeys.forEach(key=>saveModule(key,{}));
 closeClearAllDataModal();
 dashboard();
 alert("ล้างข้อมูลที่กรอกในแบบบันทึกทั้ง 7 แบบเรียบร้อยแล้ว");
}

async function openClassroomBook(){
 try{if(window.cloudRefreshApprovalSignature)await window.cloudRefreshApprovalSignature()}catch(e){console.error(e)}
 window.open("print/form.html?module=book&all=1","_blank");
}
function renderDashboardProgress(){
 const t=dashboardTermProgress();
 const tp=$("#termProgressPercent"),tb=$("#termProgressBar"),td=$("#termProgressDetail"),tc=$("#termCountdown");
 if(tp)tp.textContent=`${t.pct}%`;
 if(tb)tb.style.width=`${t.pct}%`;
 if(td){
   if(t.before)td.textContent=`ยังไม่เปิดภาคเรียน • วันเรียนทั้งหมด ${t.total} วัน`;
   else if(t.closed)td.textContent=`สิ้นสุดภาคเรียนแล้ว • ครบ ${t.total} วันเรียน`;
   else td.textContent=`ผ่านแล้ว ${t.elapsed}/${t.total} วันเรียน • เหลือ ${t.remain} วันเรียน`;
 }
 if(tc){
   if(t.before)tc.innerHTML=`เปิดภาคเรียนวันที่ <strong>${settings().openDate}</strong> • ปิดภาคเรียนอีก <strong>${t.calendarRemain}</strong> วันปฏิทิน`;
   else if(t.closed)tc.innerHTML=`ปิดภาคเรียนแล้ว • ความคืบหน้า <strong>100%</strong>`;
   else tc.innerHTML=`ปิดภาคเรียนอีก <strong>${t.calendarRemain}</strong> วันปฏิทิน • เหลือวันเรียน <strong>${t.remain}</strong> วัน`;
 }
}
function dashboard(){
 const r=students();
 $("#dashStudents").textContent=r.length;
 const keys=["attendance","savings","health","behavior","literacy","scholarship","volunteer","homeroom"];
 $("#dashUsed").textContent=keys.filter(k=>moduleHasUserData(k)).length;
 const s=settings();
 $("#dashClass").textContent=`${s.classLevel}/${s.room}`;
 $("#dashYear").textContent=s.academicYear;
 const el=$("#termDash");
 if(el)el.textContent=`${countInstructionDays(s.openDate,s.closeDate)} วันเรียน`;
 renderDashboardProgress();
}
