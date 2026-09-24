(async function(){
  "use strict";
  const message=document.getElementById("bookMessage"),sb=window.cloudClient;
  try{
    if(!sb)throw new Error("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่");
    const id=new URLSearchParams(location.search).get("submission");
    if(!id)throw new Error("ไม่พบรายการส่งตรวจ กรุณาเปิดเล่มจากรายการงานอีกครั้ง");
    const auth=await sb.auth.getSession();if(auth.error)throw auth.error;
    if(!auth.data.session)throw new Error("กรุณาเข้าสู่ระบบ แล้วเปิดเล่มจากหน้ารายการงานอีกครั้ง");
    const profile=await sb.from("profiles").select("role").eq("id",auth.data.session.user.id).single();
    if(profile.error)throw profile.error;
    document.getElementById("backLink").href=(window.cloudRoleDashboardPath(profile.data.role)||"classrooms.html");
    const result=await sb.from("classroom_submissions").select("*").eq("id",id).single();
    if(result.error)throw result.error;
    const sub=result.data,ym=String(sub.report_month).slice(0,7);
    let c,students,modules,approval=sub;
    if(sub.status==="approved"){
      const a=await sb.from("classroom_monthly_archives").select("snapshot").eq("submission_id",id).single();
      if(a.error)throw new Error("ไม่สามารถเปิดฉบับอนุมัติจากคลังได้ กรุณาลองใหม่");
      const snap=a.data.snapshot;c=snap.classroom;students=snap.students;modules=snap.modules;approval=snap.submission;
    }else{
      const results=await Promise.all([
        sb.from("classrooms").select("*").eq("id",sub.classroom_id).single(),
        sb.from("students").select("id,client_uid,student_code,full_name,sort_order,active").eq("classroom_id",sub.classroom_id).eq("active",true).order("sort_order"),
        sb.from("module_data").select("module_name,data").eq("classroom_id",sub.classroom_id)
      ]);
      results.forEach(r=>{if(r.error)throw r.error});
      c=results[0].data;students=results[1].data;modules=Object.fromEntries(results[2].data.map(x=>[x.module_name,x.data]));
    }
    if(!c||c.id!==sub.classroom_id||!/^\d{4}-(0[1-9]|1[0-2])$/.test(ym))throw new Error("ข้อมูลเล่มไม่ตรงกับรายการส่งตรวจ");
    const data={settings:{school:c.school_name,office:c.office_name,classLevel:c.class_level,room:c.room,academicYear:String(c.academic_year),term:String(c.term),teacher1:c.teacher1,teacher2:c.teacher2,academicHead:c.academic_head,deputy:c.deputy,openDate:c.open_date,closeDate:c.close_date,targetDays:c.target_days,targetWeeks:c.target_weeks,useThaiHolidays:c.use_thai_holidays!==false},holidays:c.holidays||[],students:(students||[]).filter(s=>s.active!==false).map(s=>({uid:s.client_uid||s.id,id:s.student_code||"",name:s.full_name||""})),workflow_approvals:{[ym]:approval},homeroom_time_settings:modules.homeroom_times||{}};
    ["homeroom","attendance","savings","behavior","health","scholarship","volunteer","literacy","report_checks"].forEach(k=>data["module_"+k]=modules[k]||{});
    window.__reviewBookData=data;
    const url=new URL(location.href);url.searchParams.set("module","book");url.searchParams.set("month",ym);url.searchParams.delete("all");history.replaceState(null,"",url);
    const month=new Date(ym+"-01T12:00:00").toLocaleDateString("th-TH",{month:"long",year:"numeric"});
    document.getElementById("bookTitle").textContent="เล่มธุรการ "+c.class_level+"/"+c.room+" • "+month+" • ภาคเรียน "+c.term+" ปีการศึกษา "+c.academic_year;
    document.title=document.getElementById("bookTitle").textContent;
    document.getElementById("bookStatus").textContent=sub.status==="approved"?"ฉบับอนุมัติจากคลังเอกสาร":"ข้อมูลปัจจุบันของห้องสำหรับตรวจงานเดือนที่ส่ง • อ่านอย่างเดียว";
    await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="print/print.js";script.onload=resolve;script.onerror=()=>reject(new Error("โหลดแบบพิมพ์ไม่สำเร็จ"));document.body.appendChild(script)});
    if(!document.getElementById("sheet").textContent.trim())throw new Error("สร้างเล่มไม่สำเร็จ กรุณาลองใหม่");
    message.hidden=true;document.getElementById("printBook").disabled=false;
  }catch(e){document.getElementById("sheet").textContent="";message.textContent=e.message||String(e);document.getElementById("bookTitle").textContent="เปิดเล่มไม่สำเร็จ";}
})();

