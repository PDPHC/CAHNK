const P="hnk_admin_v3_",OLD_P="hnk_admin_v2_";
const get=(k,d=null)=>{if(window.__reviewBookData)return Object.prototype.hasOwnProperty.call(window.__reviewBookData,k)?window.__reviewBookData[k]:d;try{let v=localStorage.getItem(P+k);if(v===null)v=localStorage.getItem(OLD_P+k);return v?JSON.parse(v):d}catch(e){return d}};
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));

function applyVerticalIdentityHeaders(root){
 const normalizedTargets=new Set([
   "เลขที่","ที่",
   "เลขประจำตัว","รหัส","รหัสนักเรียน",
   "ชื่อ - สกุล","ชื่อ-สกุล","ชื่อ - นามสกุล","ชื่อ-นามสกุล","ชื่อ นามสกุล"
 ]);
 root.querySelectorAll("th").forEach(th=>{
   const label=(th.textContent||"").replace(/\s+/g," ").trim();
   if(!normalizedTargets.has(label) || th.classList.contains("no-vertical-header") || th.classList.contains("use-own-vertical"))return;
   th.classList.add("vertical-key-header");
   th.innerHTML=`<span class="vertical-key-label">${esc(label)}</span>`;
 });
}
const months=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const q=new URLSearchParams(location.search),mod=q.get("module"),requestedMonth=q.get("month")||new Date().toISOString().slice(0,7),all=q.get("all")==="1";
const SETTINGS_DEFAULTS={school:"โรงเรียนห้วยน้ำขุ่นวิทยา",office:"สำนักงานเขตพื้นที่การศึกษาประถมศึกษาเชียงราย เขต 2",classLevel:"มัธยมศึกษาปีที่ 1",room:"1",academicYear:"2569",term:"1",teacher1:"",teacher2:"",academicHead:"",deputy:"",openDate:"2026-05-18",closeDate:"2026-10-12",targetDays:"100",targetWeeks:"20",useThaiHolidays:true};
const S={...SETTINGS_DEFAULTS,...(get("settings",{})||{})};
const APPROVALS=get("workflow_approvals",{})||{};
const R=(get("students",[])||[]).map((x,i)=>({...x,no:i+1}));
const H=(get("holidays",[])||[]),HM=Object.fromEntries(H.map(h=>[h.date,h]));
const store=k=>get("module_"+k,{});
const cls=()=>`${S.classLevel}/${S.room}`;
const parseDate=s=>{if(!s)return null;const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
function mi(ym){const [y,m]=ym.split("-").map(Number);return {ym,y,m,name:months[m-1],be:y+543,days:new Date(y,m,0).getDate()}}
function dayInfo(ds){const d=parseDate(ds),wd=d.getDay(),weekend=wd===0||wd===6,h=(S.useThaiHolidays===false||S.useThaiHolidays==="false")?null:HM[ds],out=(S.openDate&&ds<S.openDate)||(S.closeDate&&ds>S.closeDate);return {off:weekend||!!h||out,out,weekend,holiday:!!h,holidayName:h?.name||"",reason:out?"นอกภาคเรียน":weekend?(wd===6?"ส.":"อา."):(h?h.name:"")}}
function monthsInTerm(){
 const a=parseDate(S.openDate),b=parseDate(S.closeDate);
 if(!a||!b||a>b){
   const be=Number(S.academicYear)||2569,ce=be-543;
   return String(S.term)==="2"?[`${ce}-11`,`${ce}-12`,`${ce+1}-01`,`${ce+1}-02`,`${ce+1}-03`]:[`${ce}-05`,`${ce}-06`,`${ce}-07`,`${ce}-08`,`${ce}-09`,`${ce}-10`];
 }
 const o=[],d=new Date(a.getFullYear(),a.getMonth(),1),e=new Date(b.getFullYear(),b.getMonth(),1);
 while(d<=e){o.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`);d.setMonth(d.getMonth()+1)}
 return o
}
const printMonths=all?monthsInTerm():[requestedMonth];
window.__printMonths=printMonths;
function spacedSignatureName(value){
 const v=String(value||"").trim();
 return `( ${esc(v||"................................................")} )`;
}

function approvalThaiDate(value){
 if(!value)return "";
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))return "";
 return d.toLocaleString("th-TH",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function approvedSignature(name,at,signatureData,fallbackName,roleHtml){
 const approved=!!at;
 const display=String(name||fallbackName||"").trim();
 if(!approved){
  return `<div><div class="signature-space"></div><div class="signature-name">${spacedSignatureName(display)}</div><div class="signature-role">${roleHtml}</div></div>`;
 }
 const image=signatureData?`<img class="electronic-signature-image" src="${esc(signatureData)}" alt="ลายเซ็น">`:`<div class="electronic-signature-mark">✓ ลงนามอิเล็กทรอนิกส์</div>`;
 return `<div class="approved-signature-block">
   <div class="signature-space electronic-signature">
     ${image}
     <div class="electronic-signature-person">${esc(display||"ผู้อนุมัติ")}</div>
   </div>
   <div class="signature-name">${spacedSignatureName(display)}</div>
   <div class="signature-role">${roleHtml}<div class="signature-approved-date">อนุมัติ ${esc(approvalThaiDate(at))}</div></div>
 </div>`;
}
const signatures=(ym)=>{
 const approval=APPROVALS[ym]||{};
 const hasTeacher2=String(S.teacher2||"").trim()!=="";
 const blocks=[
  `<div><div class="signature-space"></div><div class="signature-name">${spacedSignatureName(S.teacher1)}</div><div class="signature-role">ครูประจำชั้น</div></div>`,
  ...(hasTeacher2?[`<div><div class="signature-space"></div><div class="signature-name">${spacedSignatureName(S.teacher2)}</div><div class="signature-role">ครูประจำชั้น</div></div>`]:[]),
  approvedSignature(approval.academic_approved_name,approval.academic_approved_at,approval.academic_signature_data,S.academicHead,"วิชาการระดับมัธยมศึกษา"),
  approvedSignature(approval.approved_name,approval.approved_at,approval.deputy_signature_data,S.deputy,"รองผู้อำนวยการ<br>ฝ่ายบริหารงานวิชาการ")
 ];
 return `<div class="signature-section"><div class="signatures ${hasTeacher2?"four":"three"}">${blocks.join("")}</div></div>`;
};

function savingsMonthTotal(studentUid,ym){
 const data=store("savings")[ym]?.[studentUid]||{};
 return Object.entries(data).reduce((sum,[day,val])=>{const ds=`${ym}-${String(day).padStart(2,"0")}`;return sum+(!dayInfo(ds).off?(Number(val)||0):0)},0)
}
function savingsCumulative(studentUid,uptoYm){
 return monthsInTerm().filter(m=>m<=uptoYm).reduce((sum,m)=>sum+savingsMonthTotal(studentUid,m),0)
}

function attendancePrintSymbol(v){
 return v==="ม"?"/":(v||"");
}

function noActivityNote(kind,ym){
 const checks=store("report_checks")[ym]||{};
 if(kind==="savings"&&checks.savings_none===true){
  const values=Object.values(store("savings")[ym]||{}).flatMap(x=>Object.values(x||{}));
  if(!values.some(v=>String(v).trim()!==""&&(!Number.isFinite(Number(v))||Number(v)!==0)))return '<p class="no-activity-note" style="font-weight:bold;margin:8px 0">หมายเหตุ: เดือนนี้ไม่มีการออมทรัพย์</p>';
 }
 if(kind==="scholarship"&&checks.scholarship_none===true&&!(store("scholarship").rows||[]).some(x=>String(x.date||"").slice(0,7)===ym))return '<p class="no-activity-note" style="font-weight:bold;margin:8px 0">หมายเหตุ: เดือนนี้ไม่มีการมอบทุนใด ๆ</p>';
 return "";
}
function monthly(kind,title,ym){
 const inf=mi(ym),d=store(kind)[ym]||{},isSavings=kind==="savings";
 const days=Array.from({length:inf.days},(_,i)=>{
   const day=i+1,ds=`${ym}-${String(day).padStart(2,"0")}`,di=dayInfo(ds);
   return {day,ds,di};
 });
 return `<div class="month-page"><div class="center title">${title} &nbsp; ชั้น${esc(cls())}</div>
 <div class="center subtitle">ภาคเรียนที่ ${esc(S.term)} ปีการศึกษา ${esc(S.academicYear)} &nbsp; ประจำเดือน ${inf.name} พ.ศ. ${inf.be}</div>
 ${noActivityNote(kind,ym)}<table class="print-table month-grid"><thead><tr><th class="cno" rowspan="2">เลขที่</th><th class="cid" rowspan="2">เลขประจำตัว</th><th class="cname" rowspan="2">ชื่อ - สกุล</th><th colspan="${inf.days}">${inf.name} ${inf.be}</th><th class="sum" rowspan="2">${kind==="attendance"?"รวมมา":isSavings?"รวมสะสม":"รวม"}</th></tr>
 <tr>${days.map(z=>`<th class="day ${z.di.off?(z.di.out?"out-print":"off-print"):""} ${z.di.holiday?"holiday-special":""}" title="${esc(z.di.reason)}"><span class="day-number">${z.day}</span></th>`).join("")}</tr></thead><tbody>
 ${R.map((r,rowIndex)=>{
   const x=d[r.uid]||{};
   const vals=days.map(z=>({v:kind==="attendance"?attendancePrintSymbol(x[z.day]||""):(x[z.day]||""),...z}));
   const total=isSavings?savingsCumulative(r.uid,ym):vals.filter(z=>!z.di.off&&(z.v==="/"||z.v==="ส")).length;
   const dayCells=vals.map(z=>{
     if(z.di.holiday){
       if(rowIndex!==0)return "";
       const span=Math.max(R.length,1);
       return `<td class="holiday-merged-cell" rowspan="${span}"><div class="holiday-merged-label">${esc(z.di.holidayName||z.di.reason||"วันหยุด")}</div></td>`;
     }
     return `<td class="${z.di.off?(z.di.out?"out-print":"off-print"):""}">${z.di.off?"":esc(z.v)}</td>`;
   }).join("");
   return `<tr><td class="no">${r.no}</td><td class="sid">${esc(r.id)}</td><td class="name">${esc(r.name)}</td>${dayCells}<td>${total||""}</td></tr>`
 }).join("") || `<tr><td colspan="${inf.days+4}" style="height:150mm"></td></tr>`}</tbody></table>
 <div class="term-note">ช่องสีเทา = เสาร์/อาทิตย์/วันหยุด/นอกช่วงเปิดเรียน${kind==="attendance"?" • / = มา • ข = ขาด • ล = ลา • น = หนี • ส = สาย":""}${isSavings?" • รวมสะสม = ยอดเดือนก่อนทั้งหมด + เดือนปัจจุบัน":""}</div>${signatures(ym)}</div>`;
}
function rosterTemplate(kind,title,heads,ym){
 const inf=mi(ym),d=store(kind)[ym]||{};
 return `<div class="month-page"><div class="center title">${title}</div><div class="center meta">นักเรียนชั้น ${esc(cls())} &nbsp;&nbsp; เดือน ${inf.name} &nbsp;&nbsp; พ.ศ. ${inf.be}</div>
 <table class="print-table"><thead>${heads}</thead><tbody>${R.map(r=>rowFor(kind,r,d[r.uid]||{})).join("")||`<tr><td colspan="11" style="height:170mm"></td></tr>`}</tbody></table>${signatures(ym)}</div>`;
}
function rowFor(kind,r,x){
 if(kind==="health")return `<tr><td class="no">${r.no}</td><td class="sid">${esc(r.id)}</td><td class="name">${esc(r.name)}</td><td>${esc(x.age)}</td><td>${esc(x.weight)}</td><td>${esc(x.height)}</td><td>${esc(x.hair)}</td><td>${esc(x.nails)}</td><td>${esc(x.clothes)}</td><td>${esc(x.mouth)}</td><td>${esc(x.note)}</td></tr>`;
 if(kind==="behavior"){const marks=["ดีมาก","ดี","พอใช้","ปรับปรุง"].map(z=>`<td>${x.rating===z?"✓":""}</td>`).join("");return `<tr><td class="no">${r.no}</td><td class="sid">${esc(r.id)}</td><td class="name">${esc(r.name)}</td>${marks}<td>${esc(x.advice)}</td></tr>`}
 const ck=v=>(v===true||v==="true")?"✓":"";
 return `<tr><td class="no">${r.no}</td><td class="sid">${esc(r.id)}</td><td class="name">${esc(r.name)}</td><td class="checkmark">${ck(x.spell)}</td><td class="checkmark">${ck(x.read)}</td><td class="checkmark">${ck(x.copy)}</td><td class="checkmark">${ck(x.dictation)}</td></tr>`;
}



function literacyPrint(ym){
 const inf=mi(ym),data=store("literacy")[ym]||{};
 const ok=v=>v===true||v==="true";
 return `<div class="month-page literacy-print-page">
   <div class="center literacy-print-title">แบบบันทึกครูอาสาอ่านออก-เขียนได้</div>
   <div class="center literacy-print-meta">นักเรียนชั้น<span class="literacy-meta-line">${esc(cls())}</span> เดือน<span class="literacy-meta-line">${esc(inf.name)}</span> พ.ศ.<span class="literacy-meta-line">${esc(inf.be)}</span></div>
   <table class="print-table literacy-print-table">
     <colgroup>
       <col class="lp-no">
       <col class="lp-id">
       <col class="lp-name">
       <col class="lp-skill"><col class="lp-skill"><col class="lp-skill"><col class="lp-skill">
       <col class="lp-note">
     </colgroup>
     <thead>
       <tr>
         <th rowspan="2" class="use-own-vertical">เลขที่</th>
         <th rowspan="2" class="use-own-vertical">เลขประจำตัว</th>
         <th rowspan="2" class="no-vertical-header">ชื่อ - สกุล</th>
         <th colspan="4">เนื้อหา/กิจกรรม</th>
         <th rowspan="2">หมายเหตุ/คำแนะนำ</th>
       </tr>
       <tr>
         <th>แจกลูกสะกดคำ</th>
         <th>อ่านออกเสียง</th>
         <th>คัดคำและเรื่อง</th>
         <th>เขียนตามคำบอก</th>
       </tr>
     </thead>
     <tbody>
       ${R.map(r=>{
         const x=data[r.uid]||{};
         return `<tr>
           <td class="center">${r.no}</td>
           <td class="center">${esc(r.id)}</td>
           <td class="left literacy-name-print">${esc(r.name)}</td>
           <td class="literacy-mark">${ok(x.spell)?"✓":""}</td>
           <td class="literacy-mark">${ok(x.read)?"✓":""}</td>
           <td class="literacy-mark">${ok(x.copy)?"✓":""}</td>
           <td class="literacy-mark">${ok(x.dictation)?"✓":""}</td>
           <td class="left">${esc(x.note||"")}</td>
         </tr>`;
       }).join("")}
     </tbody>
   </table>
   ${signatures(ym)}
 </div>`;
}

function healthPrint(ym){
 const inf=mi(ym),data=store("health")[ym]||{};
 const healthValue=(uid,key)=>{
   const x=data[uid]||{};
   if(key==="hygiene")return x.hygiene||x.nails||"";
   return x[key]||"";
 };
 return `<div class="month-page health-print-page">
   <div class="center health-print-title">แบบบันทึกการตรวจสุขภาพของนักเรียน</div>
   <div class="center health-print-meta">นักเรียนชั้น<span class="health-meta-line">${esc(cls())}</span> เดือน<span class="health-meta-line">${esc(inf.name)}</span> พ.ศ.<span class="health-meta-line">${esc(inf.be)}</span></div>
   <table class="print-table health-print-table">
     <colgroup>
       <col class="hp-no">
       <col class="hp-id">
       <col class="hp-name">
       <col class="hp-small"><col class="hp-small"><col class="hp-small">
       <col class="hp-rate"><col class="hp-rate"><col class="hp-rate"><col class="hp-rate">
       <col class="hp-note">
     </colgroup>
     <thead>
       <tr>
         <th rowspan="2" class="use-own-vertical">เลขที่</th>
         <th rowspan="2" class="use-own-vertical">เลขประจำตัว</th>
         <th rowspan="2" class="no-vertical-header">ชื่อ - สกุล</th>
         <th colspan="7">รายการ</th>
         <th rowspan="2">หมายเหตุ/คำแนะนำ</th>
       </tr>
       <tr>
         <th class="use-own-vertical">อายุ</th>
         <th class="use-own-vertical">น้ำหนัก</th>
         <th class="use-own-vertical">ส่วนสูง</th>
         <th class="use-own-vertical">ผม/ทรงผม</th>
         <th class="use-own-vertical">เล็บมือ</th>
         <th class="use-own-vertical">เสื้อผ้า</th>
         <th class="use-own-vertical">ช่องปาก/กลิ่นตัว</th>
       </tr>
     </thead>
     <tbody>
       ${R.map(r=>`<tr>
         <td class="center">${r.no}</td>
         <td class="center">${esc(r.id)}</td>
         <td class="left">${esc(r.name)}</td>
         <td class="center">${esc(healthValue(r.uid,"age"))}</td>
         <td class="center">${esc(healthValue(r.uid,"weight"))}</td>
         <td class="center">${esc(healthValue(r.uid,"height"))}</td>
         <td class="center">${esc(healthValue(r.uid,"hair"))}</td>
         <td class="center">${esc(healthValue(r.uid,"hygiene"))}</td>
         <td class="center">${esc(healthValue(r.uid,"clothes"))}</td>
         <td class="center">${esc(healthValue(r.uid,"mouth"))}</td>
         <td class="left">${esc(healthValue(r.uid,"note"))}</td>
       </tr>`).join("")}
     </tbody>
   </table>
   <div class="health-print-legend">เกณฑ์การประเมิน: 3 = ดีมาก &nbsp;&nbsp; 2 = ปานกลาง &nbsp;&nbsp; 1 = ปรับปรุง</div>
   ${signatures(ym)}
 </div>`;
}

function behaviorPrint(ym){
 const inf=mi(ym),d=store("behavior")[ym]||{};
 const ratings=["ดีมาก","ดี","พอใช้","ปรับปรุง"];
 return `<div class="month-page behavior-print-page">
   <div class="center behavior-print-title">แบบบันทึกพฤติกรรมนักเรียนที่มีปัญหา ปีการศึกษา ${esc(S.academicYear)}</div>
   <div class="behavior-print-meta">
     นักเรียนชั้น <span class="behavior-meta-line">${esc(cls())}</span>
     &nbsp;&nbsp; เดือน <span class="behavior-meta-line">${esc(inf.name)}</span>
     &nbsp;&nbsp; พ.ศ. <span class="behavior-meta-line">${esc(inf.be)}</span>
   </div>
   <table class="print-table behavior-print-table">
     <colgroup>
       <col class="bp-no">
       <col class="bp-id">
       <col class="bp-name">
       <col class="bp-rate"><col class="bp-rate"><col class="bp-rate"><col class="bp-rate">
       <col class="bp-advice">
     </colgroup>
     <thead>
       <tr>
         <th rowspan="2" class="no-vertical-header">ที่</th>
         <th rowspan="2" class="no-vertical-header">รหัส</th>
         <th rowspan="2" class="no-vertical-header">ชื่อ - สกุล</th>
         <th colspan="4">พฤติกรรมที่แสดงออก</th>
         <th rowspan="2">ข้อแนะนำ/แก้ไข</th>
       </tr>
       <tr>
         ${ratings.map(z=>`<th>${z}</th>`).join("")}
       </tr>
     </thead>
     <tbody>
       ${R.map(r=>{
         const x=d[r.uid]||{},rating=x.rating||"";
         return `<tr>
           <td class="no">${r.no}</td>
           <td class="sid">${esc(r.id)}</td>
           <td class="name">${esc(r.name)}</td>
           ${ratings.map(z=>`<td class="behavior-mark">${rating===z?"✓":""}</td>`).join("")}
           <td class="behavior-advice">${esc(x.advice||"")}</td>
         </tr>`;
       }).join("")||`<tr><td colspan="8" style="height:160mm"></td></tr>`}
     </tbody>
   </table>
   ${signatures(ym)}
 </div>`;
}



const TH_SHORT_MONTHS=["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function formatThaiShortDate(dateStr){
 if(!dateStr)return "";
 const d=parseDate(dateStr);
 if(!d)return dateStr;
 return `${d.getDate()} ${TH_SHORT_MONTHS[d.getMonth()]} ${String(d.getFullYear()+543).slice(-2)}`;
}

function scholarshipResolvedStudent(row){
 if(row.studentUid){
   const s=R.find(x=>x.uid===row.studentUid);
   if(s)return {id:s.id||row.studentId||"",name:s.name||row.student||""};
 }
 const oldId=String(row.studentId||"").trim(),oldName=String(row.student||row.studentName||"").trim();
 let s=null;
 if(oldId)s=R.find(x=>String(x.id||"").trim()===oldId);
 if(!s && oldName)s=R.find(x=>String(x.name||"").trim()===oldName);
 return s?{id:s.id||oldId,name:s.name||oldName}:{id:oldId,name:oldName};
}

function scholarship(ym){
 const inf=mi(ym);
 const rows=(store("scholarship").rows||[])
   .filter(x=>x.date&&x.date.slice(0,7)===ym)
   .sort((a,b)=>(a.date||"").localeCompare(b.date||""));
 return `<div class="month-page scholarship-print-page">
   <div class="center title">แบบบันทึกข้อมูลการรับทุนการศึกษาของนักเรียน</div>
   <div class="center scholarship-month-line">เดือน <span class="sch-dots">${esc(inf.name)}</span> พ.ศ. <span class="sch-dots">${esc(inf.be)}</span></div>
   ${noActivityNote("scholarship",ym)}<table class="print-table scholarship-print-table">
     <colgroup>
       <col class="sch-col-no">
       <col class="sch-col-id">
       <col class="sch-col-name">
       <col class="sch-col-fund">
       <col class="sch-col-type">
       <col class="sch-col-type">
       <col class="sch-col-amount">
       <col class="sch-col-date">
       <col class="sch-col-org">
     </colgroup>
     <thead>
       <tr>
         <th rowspan="2">เลขที่</th>
         <th rowspan="2">เลขประจำตัว</th>
         <th rowspan="2">ชื่อ - สกุล</th>
         <th rowspan="2">ชื่อทุนที่ได้รับ</th>
         <th colspan="2">ประเภทของที่ได้รับ</th>
         <th rowspan="2">จำนวน</th>
         <th rowspan="2">วันที่ได้รับ</th>
         <th rowspan="2" class="sch-org-head">หน่วยงาน / มูลนิธิ<br>ที่มอบทุน</th>
       </tr>
       <tr><th>ทุนการศึกษา</th><th>อุปกรณ์ต่าง ๆ</th></tr>
     </thead>
     <tbody>
       ${R.map(r=>{
         const recs=rows.filter(x=>{
           if(x.studentUid)return x.studentUid===r.uid;
           const s=scholarshipResolvedStudent(x);
           return (s.id && String(s.id)===String(r.id)) || (s.name && s.name===r.name);
         });
         const join=(fn)=>recs.map(fn).filter(Boolean).join("<br>");
         return `<tr>
           <td>${r.no}</td>
           <td>${esc(r.id||"")}</td>
           <td class="name sch-name-cell">${esc(r.name||"")}</td>
           <td>${join(x=>esc(x.fund||""))}</td>
           <td>${join(x=>x.type==="ทุนการศึกษา"?"✓":"")}</td>
           <td>${join(x=>x.type==="อุปกรณ์ต่าง ๆ"?"✓":"")}</td>
           <td>${join(x=>esc(x.amount||""))}</td>
           <td>${join(x=>esc(formatThaiShortDate(x.date)))}</td>
           <td>${join(x=>esc(x.org||""))}</td>
         </tr>`;
       }).join("")}
     </tbody>
   </table>
   ${signatures(ym)}
 </div>`;
}

function volunteerPrintStatus(v){
 return v==="ม"?"/":(v||"");
}

function volunteerData(ym){
 const st=store("volunteer");
 if(st.months?.[ym])return st.months[ym];
 if(!st.months && (st.headers||st.data) && ym===monthsInTerm()[0])return {headers:st.headers||Array(10).fill(""),data:st.data||{}};
 return {headers:Array(10).fill(""),data:{}};
}
function volunteer(ym){
 const inf=mi(ym),m=volunteerData(ym),heads=m.headers||Array(10).fill(""),data=m.data||{};
 return `<div class="month-page"><div class="center title">แบบบันทึกกิจกรรมจิตอาสาเพื่อสังคมและสาธารณประโยชน์</div><div class="center subtitle">ชั้น ${esc(cls())} &nbsp; เดือน ${inf.name} พ.ศ. ${inf.be} &nbsp; ภาคเรียนที่ ${esc(S.term)} ปีการศึกษา ${esc(S.academicYear)}</div><table class="print-table vol-table"><thead><tr><th class="no"><div class="vtext">เลขที่</div></th><th class="id"><div class="vtext">เลขประจำตัว</div></th><th class="name-head">ชื่อ - สกุล</th>${heads.map(h=>`<th class="act"><div class="vtext">${esc(h)}</div></th>`).join("")}</tr></thead><tbody>${R.map(r=>`<tr><td class="no">${r.no}</td><td class="sid">${esc(r.id)}</td><td class="name">${esc(r.name)}</td>${heads.map((h,i)=>`<td class="vol-status-print">${esc(volunteerPrintStatus((data[r.uid]||{})[i]||""))}</td>`).join("")}</tr>`).join("")}</tbody></table>${signatures(ym)}</div>`
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
 HOMEROOM_DAYS.forEach(day=>out[day]={
   start:saved[day]?.start||HOMEROOM_DEFAULT_TIMES[day].start,
   end:saved[day]?.end||HOMEROOM_DEFAULT_TIMES[day].end
 });
 return out;
}
function homeroomPrintTime(day){
 const t=homeroomTimeSettings()[day]||{start:"14:40",end:"15:30"};
 const fmt=v=>String(v||"").replace(":",".");
 return `เวลา ${fmt(t.start)} น. – ${fmt(t.end)} น.`;
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


function splitHomeroomOtherText(text){
 const s=String(text||"").trim();
 if(!s)return ["",""];
 // First line is shorter because it follows the "อื่น ๆ" label.
 const firstLimit=30, secondLimit=48;
 if(s.length<=firstLimit)return [s,""];
 let cut=firstLimit;
 // Prefer a nearby whitespace boundary, but Thai text may have no spaces.
 const before=s.slice(0,firstLimit+1);
 const lastSpace=before.lastIndexOf(" ");
 if(lastSpace>=Math.floor(firstLimit*0.6))cut=lastSpace;
 const first=s.slice(0,cut).trim();
 let rest=s.slice(cut).trim();
 if(rest.length>secondLimit)rest=rest.slice(0,secondLimit).trim()+"…";
 return [first,rest];
}
function homeroomMonthLabelFromRows(rows,fallbackYm){
 const monthNums=[];
 rows.forEach(r=>{
   if(!r.date)return;
   const d=parseDate(r.date);
   if(d && !monthNums.includes(d.getMonth()))monthNums.push(d.getMonth());
 });
 monthNums.sort((a,b)=>a-b);
 if(!monthNums.length){
   const inf=mi(fallbackYm);
   return inf.name;
 }
 return monthNums.map(m=>months[m]).join(" - ");
}
function homeroomYearLabelFromRows(rows,fallbackYm){
 const years=[];
 rows.forEach(r=>{
   if(!r.date)return;
   const d=parseDate(r.date);
   if(d){
     const y=d.getFullYear()+543;
     if(!years.includes(y))years.push(y);
   }
 });
 years.sort((a,b)=>a-b);
 if(!years.length)return mi(fallbackYm).be;
 return years.join(" - ");
}
function homeroomWeekLabelFromRows(rows,fallbackWeek){
 const ws=[...new Set(rows.map(r=>Number(r.week)).filter(Number.isFinite))].sort((a,b)=>a-b);
 if(!ws.length)return fallbackWeek||"........";
 return ws.length===1?String(ws[0]):`${ws[0]}-${ws[ws.length-1]}`;
}

function homeroomDateIso(d){
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function homeroomAddDays(dateStr,n){
 const d=parseDate(dateStr);
 if(!d)return "";
 d.setDate(d.getDate()+n);
 return homeroomDateIso(d);
}
function homeroomWeekKey(dateStr){
 const d=parseDate(dateStr);
 if(!d)return "";
 const wd=d.getDay(),shift=wd===0?-6:1-wd;
 d.setDate(d.getDate()+shift);
 return homeroomDateIso(d);
}
function homeroomPrintWeekNumber(mondayStr){
 const d=parseDate(mondayStr),open=parseDate(S.openDate);
 if(!d||!open)return "";
 const a=parseDate(homeroomWeekKey(S.openDate)),b=parseDate(homeroomWeekKey(mondayStr));
 if(!a||!b||b<a)return "";
 return Math.floor((b-a)/604800000)+1;
}
function homeroomWeekDates(mondayStr){
 return [0,1,2,3,4].map(n=>homeroomAddDays(mondayStr,n));
}
function homeroomWeekMonthLabel(mondayStr){
 const nums=[];
 homeroomWeekDates(mondayStr).forEach(ds=>{
   const d=parseDate(ds);
   if(d&&!nums.includes(d.getMonth()))nums.push(d.getMonth());
 });
 return nums.map(m=>months[m]).join(" - ");
}
function homeroomWeekYearLabel(mondayStr){
 const ys=[];
 homeroomWeekDates(mondayStr).forEach(ds=>{
   const d=parseDate(ds),y=d?d.getFullYear()+543:null;
   if(y&&!ys.includes(y))ys.push(y);
 });
 return ys.join(" - ");
}
function homeroomMonthActiveRange(ym){
 const inf=mi(ym);
 let start=`${ym}-01`,end=`${ym}-${String(inf.days).padStart(2,"0")}`;
 if(S.openDate&&start<S.openDate)start=S.openDate;
 if(S.closeDate&&end>S.closeDate)end=S.closeDate;
 if(start>end)return null;
 return {start,end};
}
function homeroomMonthWeekKeys(ym){
 const range=homeroomMonthActiveRange(ym);
 if(!range)return [];
 const first=homeroomWeekKey(range.start),last=homeroomWeekKey(range.end);
 const out=[];
 let d=parseDate(first),e=parseDate(last);
 while(d&&e&&d<=e){
   out.push(homeroomDateIso(d));
   d.setDate(d.getDate()+7);
 }
 return out;
}
function homeroomLastWeekKeyForMonth(ym){
 const range=homeroomMonthActiveRange(ym);
 return range?homeroomWeekKey(range.end):"";
}
function homeroomPage(ym,week,rows,showSignatures=false,weekMonday=""){
 const days=["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์"],selected={};
 days.forEach(d=>selected[d]=rows.find(x=>x.day===d)||{});
 const monday=weekMonday||homeroomWeekKey(rows[0]?.date||`${ym}-01`);
 const autoDates=homeroomWeekDates(monday);
 const formatDate=(dateStr)=>{
   if(!dateStr)return "........................";
   const d=parseDate(dateStr);
   if(!d)return esc(dateStr);
   return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()+543}`;
 };
 const topicCell=(x)=>{
   const t=homeroomTopicState(x),mark=v=>v?"☑":"☐";
   const [other1,other2]=splitHomeroomOtherText(t.otherText);
   return `<div class="home-options">
     <div>${mark(t.math)}&nbsp;&nbsp; ท่องแม่สูตรคูณ</div>
     <div>${mark(t.poem)}&nbsp;&nbsp; ท่องอาขยาน</div>
     <div class="home-other-block">
       <div class="home-other-row">
         <span>${mark(t.other||t.otherText)}&nbsp;&nbsp; อื่น ๆ</span>
         <span class="home-other-line">${other1?esc(other1):""}</span>
       </div>
       <div class="home-other-second-line">${other2?esc(other2):""}</div>
     </div>
   </div>`;
 };
 const weekLabel=homeroomPrintWeekNumber(monday)||week||"........";
 const monthLabel=homeroomWeekMonthLabel(monday)||mi(ym).name;
 const yearLabel=homeroomWeekYearLabel(monday)||mi(ym).be;
 return `<div class="month-page homeroom-page">
   <div class="center title">แบบบันทึกกิจกรรมโฮมรูม ( Home room )</div>
   <div class="center subtitle">${esc(S.school)} สังกัด${esc(S.office)}</div>
   <div class="center subtitle">ระดับชั้น${esc(cls())} จำนวนนักเรียน ${R.length||"................"} คน</div>
   <div class="center subtitle homeroom-week">สัปดาห์ที่ <span class="home-week-number">${esc(weekLabel)}</span> เดือน ${esc(monthLabel)} &nbsp;&nbsp; พ.ศ. ${esc(yearLabel)}</div>

   <table class="print-table home-table home-original-table">
     <colgroup>
       <col class="home-col-date">
       <col class="home-col-topic">
       <col class="home-col-absent">
       <col class="home-col-note">
     </colgroup>
     <thead>
       <tr>
         <th>วัน/เดือน/ปี</th>
         <th>รายการ/เนื้อหาสาระ</th>
         <th>รายชื่อนักเรียนที่ขาด</th>
         <th>หมายเหตุ</th>
       </tr>
     </thead>
     <tbody>
       ${days.map((day,i)=>{
         const x=selected[day]||{},dateStr=autoDates[i];
         return `<tr>
           <td class="home-date-cell">
             <div class="home-date-wrap">
               <div class="home-date-one-line">วัน${day}ที่ ${formatDate(dateStr)}</div>
               <div class="home-time-line">${homeroomPrintTime(day)}</div>
             </div>
           </td>
           <td class="home-topic-cell">${topicCell(x)}</td>
           <td class="home-absent-cell">${esc(x.absent||"")}</td>
           <td class="home-note-cell">${esc(x.note||"")}</td>
         </tr>`;
       }).join("")}
     </tbody>
   </table>
   ${showSignatures?signatures(ym):""}
 </div>`;
}
function homeroomPagesForPrint(monthList){
 const sourceRows=(store("homeroom").rows||[]).filter(x=>x.date);
 const weekKeys=[];
 monthList.forEach(ym=>{
   homeroomMonthWeekKeys(ym).forEach(key=>{
     if(!weekKeys.includes(key))weekKeys.push(key);
   });
 });
 weekKeys.sort();

 return weekKeys.map(key=>{
   const rows=sourceRows
     .filter(r=>homeroomWeekKey(r.weekMonday||r.date)===key)
     .sort((a,b)=>(a.date||"").localeCompare(b.date||""));
   const representedMonths=monthList.filter(ym=>homeroomMonthWeekKeys(ym).includes(key));
   const showSignatures=representedMonths.some(ym=>homeroomLastWeekKeyForMonth(ym)===key);
   const fallbackYm=representedMonths[0]||key.slice(0,7);
   return homeroomPage(fallbackYm,homeroomPrintWeekNumber(key),rows,showSignatures,key);
 });
}

function classroomBookCover(index,title,subtitle=""){
 return `<div class="classroom-book-cover">
   <div class="book-cover-inner">
     <div class="book-cover-number">ส่วนที่ ${index}</div>
     <div class="book-cover-title">${esc(title)}</div>
     ${subtitle?`<div class="book-cover-subtitle">${esc(subtitle)}</div>`:""}
     <div class="book-cover-rule"></div>
     <div class="book-cover-class">ชั้น ${esc(cls())}</div>
     <div class="book-cover-term">ภาคเรียนที่ ${esc(S.term)} ปีการศึกษา ${esc(S.academicYear)}</div>
     <div class="book-cover-school">${esc(S.school||"")}</div>
   </div>
 </div>`;
}
function classroomBookPages(){
 const pages=[];

 // 1) โฮมรูม
 pages.push(classroomBookCover(1,"แบบบันทึกกิจกรรมโฮมรูม","Home room"));
 pages.push(...homeroomPagesForPrint(printMonths));

 // 2) การมาโรงเรียน
 pages.push(classroomBookCover(2,"แบบบันทึกการมาโรงเรียน"));
 pages.push(...printMonths.map(m=>monthly("attendance","แบบบันทึกการมาโรงเรียน",m)));

 // 3) การออมทรัพย์
 pages.push(classroomBookCover(3,"แบบบันทึกการออมทรัพย์"));
 pages.push(...printMonths.map(m=>monthly("savings","แบบบันทึกการออมทรัพย์",m)));

 // 4) พฤติกรรม
 pages.push(classroomBookCover(4,"แบบบันทึกพฤติกรรมนักเรียนที่มีปัญหา"));
 pages.push(...printMonths.map(m=>behaviorPrint(m)));

 // 5) สุขภาพ
 pages.push(classroomBookCover(5,"แบบบันทึกการตรวจสุขภาพของนักเรียน"));
 pages.push(...printMonths.map(m=>healthPrint(m)));

 // 6) รับทุน
 pages.push(classroomBookCover(6,"แบบบันทึกข้อมูลการรับทุนการศึกษาของนักเรียน"));
 pages.push(...printMonths.map(m=>scholarship(m)));

 // 7) จิตอาสา
 pages.push(classroomBookCover(7,"แบบบันทึกกิจกรรมจิตอาสาเพื่อสังคมและสาธารณประโยชน์"));
 pages.push(...printMonths.map(m=>volunteer(m)));

 return pages;
}
function wrapPages(pages){return pages.map(x=>`<div class="page-break">${x}</div>`).join("")}
let html="";
if(mod==="book")html=wrapPages(classroomBookPages());
else if(mod==="attendance")html=wrapPages(printMonths.map(m=>monthly("attendance","แบบบันทึกการมาโรงเรียน",m)));
else if(mod==="savings")html=wrapPages(printMonths.map(m=>monthly("savings","แบบบันทึกการออมทรัพย์",m)));
else if(mod==="health")html=wrapPages(printMonths.map(m=>healthPrint(m)));
else if(mod==="behavior")html=wrapPages(printMonths.map(m=>behaviorPrint(m)));
else if(mod==="literacy")html=wrapPages(printMonths.map(m=>literacyPrint(m)));
else if(mod==="scholarship")html=wrapPages(printMonths.map(m=>scholarship(m)));
else if(mod==="volunteer")html=wrapPages(printMonths.map(m=>volunteer(m)));
else if(mod==="homeroom")html=wrapPages(homeroomPagesForPrint(printMonths));
const sheet=document.getElementById("sheet");if(all)sheet.classList.add("multi");if(mod==="book")sheet.classList.add("book-print");sheet.innerHTML=html;applyVerticalIdentityHeaders(sheet);

