
(() => {
  "use strict";

  const cfg = window.SUPABASE_CONFIG || {};
  if (!window.supabase || !cfg.url || !cfg.publishableKey) {
    console.error("Supabase client/config is missing");
    return;
  }

  const sb = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.cloudClient = sb;

  const ACTIVE_KEY = "hnk_cloud_active_classroom";
  const MODULES = ["homeroom","attendance","savings","behavior","health","scholarship","volunteer","literacy"];
  const state = {user:null,profile:null,classroom:null,permission:null,bootstrapped:false,pending:new Map()};
  window.cloudState = state;

  const MANAGEMENT_ROLES = ["director","deputy_director","admin"];
  const ROLE_LABELS = {
    director:"Director",
    deputy_director:"Deputy Director",
    admin:"Admin",
    academic:"Academic",
    teacher:"Teacher"
  };
  const STATUS_LABELS = {
    draft:"แบบร่าง",
    submitted_to_academic:"ส่งถึงวิชาการแล้ว",
    returned_by_academic:"วิชาการส่งกลับให้แก้ไข",
    forwarded_to_deputy:"วิชาการส่งต่อรองผู้อำนวยการแล้ว",
    returned_by_deputy:"รองผู้อำนวยการส่งกลับ",
    approved:"อนุมัติแล้ว"
  };
  const isManagementRole=role=>MANAGEMENT_ROLES.includes(role);
  const roleLabel=role=>ROLE_LABELS[role]||role||"-";
  const statusLabel=status=>STATUS_LABELS[status]||status||"-";
  function roleDashboardPath(role){
    return ({
      director:"director-dashboard.html",
      deputy_director:"deputy-dashboard.html",
      academic:"academic-dashboard.html"
    })[role]||"";
  }
  window.cloudRoleDashboardPath=roleDashboardPath;

  const esc = s => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
  const hget = (k,d=null) => window.hnkGet ? window.hnkGet(k,d) : d;
  const hset = (k,v) => { if (window.hnkSet) window.hnkSet(k,v); };

  function rootPath(){
    return (location.pathname.includes("/modules/") || location.pathname.includes("/print/")) ? "../" : "./";
  }
  function go(path){ location.href = rootPath()+path; }
  function showBody(){ document.body?.classList.remove("cloud-protected"); }
  function fatal(msg){
    showBody();
    const n=document.createElement("div");n.className="cloud-fatal";
    n.innerHTML=`<b>เชื่อมต่อระบบไม่สำเร็จ</b><br>${esc(msg)}`;
    document.body.prepend(n);
  }

  async function getSessionUser(){
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    state.user=data.session?.user||null;
    return state.user;
  }
  async function loadProfile(){
    const {data,error}=await sb.from("profiles").select("id,email,display_name,role").eq("id",state.user.id).single();
    if(error)throw error;
    state.profile=data;return data;
  }
  async function listClassrooms(){
    const {data,error}=await sb.from("classrooms").select("*")
      .order("academic_year",{ascending:false}).order("term",{ascending:false})
      .order("class_level").order("room");
    if(error)throw error;
    return data||[];
  }
  async function permissionFor(cid){
    if(isManagementRole(state.profile?.role))return "owner";
    if(state.profile?.role==="academic")return "viewer";
    const {data,error}=await sb.from("classroom_teachers").select("permission")
      .eq("classroom_id",cid).eq("teacher_id",state.user.id).maybeSingle();
    if(error)throw error;
    return data?.permission||null;
  }
  async function syncWorkflowApproval(cid){
    const {data,error}=await sb.from("classroom_submissions")
      .select("status,academic_approved_name,academic_approved_at,approved_name,approved_at")
      .eq("classroom_id",cid).maybeSingle();
    if(error)throw error;
    hset("workflow_approval",data||{});
  }

  function classroomSettings(c){
    return {
      school:c.school_name||"",office:c.office_name||"",classLevel:c.class_level||"",room:c.room||"",
      academicYear:String(c.academic_year||""),term:String(c.term||"1"),
      teacher1:c.teacher1||"",teacher2:c.teacher2||"",academicHead:c.academic_head||"",deputy:c.deputy||"",
      openDate:c.open_date||"",closeDate:c.close_date||"",targetDays:String(c.target_days||100),
      targetWeeks:String(c.target_weeks||20),useThaiHolidays:c.use_thai_holidays!==false
    };
  }
  async function loadClassroom(cid){
    const [cr,sr,mr]=await Promise.all([
      sb.from("classrooms").select("*").eq("id",cid).single(),
      sb.from("students").select("id,client_uid,student_code,full_name,sort_order,active")
        .eq("classroom_id",cid).eq("active",true).order("sort_order"),
      sb.from("module_data").select("module_name,data").eq("classroom_id",cid)
    ]);
    if(cr.error)throw cr.error;if(sr.error)throw sr.error;if(mr.error)throw mr.error;
    state.classroom=cr.data;state.permission=await permissionFor(cid);
    await syncWorkflowApproval(cid);

    hset("settings",classroomSettings(cr.data));
    hset("holidays",Array.isArray(cr.data.holidays)?cr.data.holidays:[]);
    hset("students",(sr.data||[]).map((s,i)=>({
      uid:s.client_uid||s.id,id:s.student_code||"",name:s.full_name||"",_dbId:s.id,_sort:s.sort_order??i
    })));
    MODULES.forEach(k=>hset("module_"+k,{}));
    hset("homeroom_time_settings",{});
    (mr.data||[]).forEach(r=>{
      if(r.module_name==="homeroom_times")hset("homeroom_time_settings",r.data||{});
      else if(MODULES.includes(r.module_name))hset("module_"+r.module_name,r.data||{});
    });
    localStorage.setItem(ACTIVE_KEY,cid);
    state.bootstrapped=true;
  }

  function syncStatus(text,kind=""){
    const el=document.getElementById("cloudSyncStatus");if(!el)return;
    el.textContent=text;el.className="cloud-sync-status "+kind;
  }
  async function saveModuleNow(name,data){
    if(!state.bootstrapped||!state.classroom?.id||!state.user)return;
    syncStatus("กำลังบันทึก...","saving");
    const {error}=await sb.from("module_data").upsert({
      classroom_id:state.classroom.id,module_name:name,data:data||{},updated_by:state.user.id,updated_at:new Date().toISOString()
    },{onConflict:"classroom_id,module_name"});
    if(error){syncStatus("บันทึกไม่สำเร็จ","error");throw error}
    syncStatus("บันทึกบน Cloud แล้ว","ok");
  }
  window.cloudQueueModuleSave=(name,data)=>{
    if(!state.bootstrapped||!state.classroom?.id)return;
    const old=state.pending.get(name);if(old?.timer)clearTimeout(old.timer);
    const item={data,timer:null};
    item.timer=setTimeout(async()=>{
      state.pending.delete(name);
      try{await saveModuleNow(name,item.data)}catch(e){console.error(e)}
    },300);
    state.pending.set(name,item);
  };
  window.cloudFlushPending=async()=>{
    if(!state.pending.size)return;
    const jobs=[];
    for(const [name,item] of state.pending.entries()){
      if(item.timer)clearTimeout(item.timer);
      jobs.push(saveModuleNow(name,item.data));
    }
    state.pending.clear();
    await Promise.allSettled(jobs);
  };
  window.cloudSaveHomeroomTimes=data=>window.cloudQueueModuleSave?.("homeroom_times",data||{});

  window.cloudSaveSettings=async()=>{
    if(!state.bootstrapped||!state.classroom?.id||typeof window.settings!=="function")return;
    const s=window.settings(),hs=typeof window.holidays==="function"?window.holidays():[];
    syncStatus("กำลังบันทึก...","saving");
    const payload={
      school_name:s.school||"",office_name:s.office||"",class_level:s.classLevel||"",room:s.room||"",
      academic_year:Number(s.academicYear||0),term:Number(s.term||1),teacher1:s.teacher1||"",teacher2:s.teacher2||"",
      academic_head:s.academicHead||"",deputy:s.deputy||"",open_date:s.openDate||null,close_date:s.closeDate||null,
      target_days:Number(s.targetDays||100),target_weeks:Number(s.targetWeeks||20),
      use_thai_holidays:s.useThaiHolidays!==false&&s.useThaiHolidays!=="false",holidays:hs||[],updated_at:new Date().toISOString()
    };
    const {data,error}=await sb.from("classrooms").update(payload).eq("id",state.classroom.id).select().single();
    if(error){syncStatus("บันทึกไม่สำเร็จ","error");alert("บันทึกบน Cloud ไม่สำเร็จ: "+error.message);return}
    state.classroom=data;syncStatus("บันทึกบน Cloud แล้ว","ok");
  };

  window.cloudSaveStudents=async()=>{
    if(!state.bootstrapped||!state.classroom?.id||typeof window.students!=="function")return;
    const cid=state.classroom.id,rows=window.students();
    syncStatus("กำลังบันทึกรายชื่อ...","saving");
    const {data:existing,error:fe}=await sb.from("students").select("id,client_uid").eq("classroom_id",cid);
    if(fe){syncStatus("บันทึกไม่สำเร็จ","error");console.error(fe);return}
    if(rows.length){
      const payload=rows.map((s,i)=>({classroom_id:cid,client_uid:String(s.uid),student_code:String(s.id||""),
        full_name:String(s.name||""),sort_order:i+1,active:true}));
      const {error}=await sb.from("students").upsert(payload,{onConflict:"classroom_id,client_uid"});
      if(error){syncStatus("บันทึกไม่สำเร็จ","error");console.error(error);return}
    }
    const keep=new Set(rows.map(s=>String(s.uid)));
    for(const old of existing||[]){
      if(!keep.has(String(old.client_uid))){
        const {error}=await sb.from("students").delete().eq("id",old.id);
        if(error)console.error(error);
      }
    }
    syncStatus("บันทึกบน Cloud แล้ว","ok");
  };

  function renderUserBar(){
    const content=document.querySelector(".content");if(!content||document.getElementById("cloudUserBar"))return;
    const c=state.classroom,p=state.profile,bar=document.createElement("div");
    bar.id="cloudUserBar";bar.className="cloud-userbar";
    bar.innerHTML=`<div><b>${esc(p?.display_name||p?.email||"")}</b>
      <span class="cloud-role">${esc(roleLabel(p?.role))}</span>
      <span class="cloud-room">ห้อง ${esc(c?.class_level||"")}/${esc(c?.room||"")}</span>
      <span id="cloudSyncStatus" class="cloud-sync-status ok">เชื่อมต่อ Cloud แล้ว</span></div>
      <div class="cloud-user-actions">
      ${isManagementRole(p?.role)?`<a class="btn gray" href="${rootPath()}admin.html">จัดการผู้ใช้/สิทธิ์</a>`:""}
      ${roleDashboardPath(p?.role)?`<a class="btn gray" href="${rootPath()}${roleDashboardPath(p?.role)}">แดชบอร์ดภาพรวม</a>`:""}
      <a class="btn gray" href="${rootPath()}classrooms.html">เปลี่ยนห้อง</a>
      <button class="btn danger cloud-allow" type="button" onclick="cloudLogout()">ออกจากระบบ</button></div>`;
    content.insertBefore(bar,content.firstChild);
  }
  function viewerMode(){
    if(state.permission!=="viewer")return;
    document.querySelectorAll("input,select,textarea").forEach(x=>x.disabled=true);
    document.querySelectorAll("button").forEach(btn=>{
      const code=btn.getAttribute("onclick")||"";
      if(/openPrint|openClassroomBook|cloudLogout/.test(code))return;
      btn.disabled=true;
    });
    const content=document.querySelector(".content");
    if(content){
      const n=document.createElement("div");n.className="notice cloud-viewer-notice";
      n.textContent='สิทธิ์ของคุณเป็น “ดูอย่างเดียว” สามารถดูและพิมพ์ได้ แต่ไม่สามารถแก้ไขข้อมูลห้องนี้';
      content.insertBefore(n,content.children[1]||null);
    }
  }
  function installFlushNavigation(){
    document.addEventListener("click",async e=>{
      const a=e.target.closest("a[href]");if(!a||!state.pending.size)return;
      const href=a.getAttribute("href");
      if(!href||href.startsWith("#")||href.startsWith("http")||a.target==="_blank")return;
      e.preventDefault();
      try{await window.cloudFlushPending()}finally{location.href=href}
    });
  }

  window.startProtectedPage=async initFn=>{
    try{
      const user=await getSessionUser();if(!user){go("login.html");return}
      await loadProfile();
      const rooms=await listClassrooms(),active=localStorage.getItem(ACTIVE_KEY);
      if(!active||!rooms.some(r=>r.id===active)){go("classrooms.html");return}
      await loadClassroom(active);renderUserBar();showBody();
      if(typeof initFn==="function")await initFn();
      await renderCurrentSubmission().catch(console.error);
      viewerMode();installFlushNavigation();
    }catch(e){console.error(e);fatal(e.message||String(e))}
  };


  window.cloudGoogleLogin=async()=>{
    const msg=document.getElementById("loginMessage");
    const btn=document.getElementById("googleLoginBtn");
    if(btn)btn.disabled=true;
    if(msg){
      msg.className="login-message";
      msg.textContent="กำลังเปิด Google...";
    }
    try{
      const redirectTo=new URL("classrooms.html",location.href).href;
      const {data,error}=await sb.auth.signInWithOAuth({
        provider:"google",
        options:{
          redirectTo,
          queryParams:{
            access_type:"offline",
            prompt:"select_account"
          }
        }
      });
      if(error)throw error;
      if(data?.url)location.href=data.url;
    }catch(e){
      console.error(e);
      if(btn)btn.disabled=false;
      if(msg){
        msg.className="login-message";
        msg.textContent="เข้าสู่ระบบด้วย Google ไม่สำเร็จ: "+(e?.message||String(e));
      }
    }
  };

  window.cloudLogin=async()=>{
    const email=document.getElementById("loginEmail")?.value.trim(),password=document.getElementById("loginPassword")?.value||"";
    const msg=document.getElementById("loginMessage");
    if(!email||!password){msg.textContent="กรอกอีเมลและรหัสผ่าน";return}
    msg.textContent="กำลังเข้าสู่ระบบ...";
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error){msg.textContent="เข้าสู่ระบบไม่สำเร็จ: "+error.message;return}
    location.href="classrooms.html";
  };

  window.cloudForgotPassword=async()=>{
    const email=document.getElementById("loginEmail")?.value.trim();
    const msg=document.getElementById("loginMessage");
    if(!email){
      msg.textContent="กรอกอีเมลก่อน แล้วกด “ลืมรหัสผ่าน”";
      document.getElementById("loginEmail")?.focus();
      return;
    }
    const btn=document.getElementById("forgotPasswordBtn");
    if(btn)btn.disabled=true;
    msg.className="login-message";
    msg.textContent="กำลังส่งอีเมลสำหรับตั้งรหัสผ่านใหม่...";
    try{
      const redirectTo=new URL("reset-password.html",location.href).href;
      const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
      if(error)throw error;
      msg.className="login-message success";
      msg.innerHTML=`ส่งอีเมลสำหรับตั้งรหัสผ่านใหม่แล้ว<br><span class="login-message-note">ตรวจสอบกล่องจดหมายของ ${esc(email)} รวมถึงโฟลเดอร์ Spam/Junk</span>`;
    }catch(e){
      console.error(e);
      let detail=e?.message||String(e);
      if(/redirect|not allowed|url/i.test(detail)){
        detail='Redirect URL ยังไม่ได้รับอนุญาตใน Supabase กรุณาเพิ่ม http://localhost:*/reset-password.html ใน Authentication → URL Configuration';
      }
      msg.className="login-message";
      msg.textContent="ส่งอีเมลไม่สำเร็จ: "+detail;
    }finally{
      if(btn)btn.disabled=false;
    }
  };

  window.startResetPasswordPage=async()=>{
    const msg=document.getElementById("resetMessage");
    const form=document.getElementById("resetPasswordForm");

    const showReady=()=>{
      form.style.display="";
      msg.className="login-message success";
      msg.textContent="ยืนยันลิงก์แล้ว กรุณาตั้งรหัสผ่านใหม่";
      document.getElementById("newPassword")?.focus();
    };

    sb.auth.onAuthStateChange((event,session)=>{
      if(event==="PASSWORD_RECOVERY" || (event==="SIGNED_IN" && session)){
        showReady();
      }
    });

    const {data,error}=await sb.auth.getSession();
    if(error){
      msg.className="login-message";
      msg.textContent="ตรวจสอบลิงก์ไม่สำเร็จ: "+error.message;
      return;
    }
    if(data.session){
      showReady();
    }else{
      form.style.display="none";
      msg.className="login-message";
      msg.innerHTML='ลิงก์นี้ยังไม่พร้อมใช้งานหรือหมดอายุแล้ว<br><span class="login-message-note">กลับหน้าเข้าสู่ระบบ แล้วกด “ลืมรหัสผ่าน” เพื่อขอลิงก์ใหม่</span>';
    }

    document.getElementById("newPasswordConfirm")?.addEventListener("keydown",e=>{
      if(e.key==="Enter")window.cloudUpdatePassword();
    });
  };

  window.cloudUpdatePassword=async()=>{
    const p1=document.getElementById("newPassword")?.value||"";
    const p2=document.getElementById("newPasswordConfirm")?.value||"";
    const msg=document.getElementById("resetMessage");
    const btn=document.getElementById("resetSubmitBtn");

    if(p1.length<12 || !/[a-z]/.test(p1) || !/[A-Z]/.test(p1) || !/[0-9]/.test(p1) || !/[^A-Za-z0-9]/.test(p1)){
      msg.className="login-message";
      msg.textContent="รหัสผ่านต้องมีอย่างน้อย 12 ตัว และมีตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข และสัญลักษณ์";
      return;
    }
    if(p1!==p2){
      msg.className="login-message";
      msg.textContent="รหัสผ่านทั้งสองช่องไม่ตรงกัน";
      return;
    }

    btn.disabled=true;
    msg.className="login-message";
    msg.textContent="กำลังบันทึกรหัสผ่านใหม่...";

    const {error}=await sb.auth.updateUser({password:p1});
    if(error){
      btn.disabled=false;
      msg.textContent="เปลี่ยนรหัสผ่านไม่สำเร็จ: "+error.message;
      return;
    }

    msg.className="login-message success";
    msg.textContent="เปลี่ยนรหัสผ่านเรียบร้อย กำลังกลับหน้าเข้าสู่ระบบ...";
    await sb.auth.signOut();
    setTimeout(()=>location.href="login.html",1200);
  };

  window.startLoginPage=async()=>{
    const user=await getSessionUser();if(user){location.href="classrooms.html";return}
    const oauthError=sessionStorage.getItem("hnk_oauth_error");
    if(oauthError){
      sessionStorage.removeItem("hnk_oauth_error");
      const msg=document.getElementById("loginMessage");
      if(msg)msg.textContent="เข้าสู่ระบบด้วย Google ไม่สำเร็จ: "+oauthError;
    }
    document.getElementById("loginPassword")?.addEventListener("keydown",e=>{if(e.key==="Enter")window.cloudLogin()});
  };
  window.cloudLogout=async()=>{
    try{await window.cloudFlushPending?.()}catch{}
    await sb.auth.signOut();localStorage.removeItem(ACTIVE_KEY);
    Object.keys(localStorage).forEach(k=>{if(k.startsWith("hnk_admin_v3_")||k.startsWith("hnk_admin_v2_"))localStorage.removeItem(k)});
    go("login.html");
  };
  window.cloudChooseClassroom=id=>{localStorage.setItem(ACTIVE_KEY,id);location.href="index.html"};

  function roomCard(r){
    const active=localStorage.getItem(ACTIVE_KEY)===r.id;
    return `<button type="button" class="classroom-choice ${active?"active":""}" onclick="cloudChooseClassroom('${r.id}')">
      <div class="classroom-choice-main">${esc(r.class_level)}/${esc(r.room)}</div>
      <div>ภาคเรียนที่ ${esc(r.term)} ปีการศึกษา ${esc(r.academic_year)}</div>
      <small>${esc(r.school_name||"")}</small>${active?'<span class="badge">ห้องที่ใช้อยู่</span>':""}</button>`;
  }
  function fillRoomDefaults(){
    const f=document.getElementById("createClassroomForm");if(!f||typeof window.settings!=="function")return;
    const s=window.settings(),map={school_name:s.school,office_name:s.office,class_level:s.classLevel,room:s.room,
      academic_year:s.academicYear,term:s.term,teacher1:s.teacher1,teacher2:s.teacher2,academic_head:s.academicHead,
      deputy:s.deputy,open_date:s.openDate,close_date:s.closeDate,target_days:s.targetDays,target_weeks:s.targetWeeks};
    Object.entries(map).forEach(([k,v])=>{if(f.elements[k])f.elements[k].value=v||""});
  }
  async function uploadLocal(cid){
    const rows=typeof window.students==="function"?window.students():[];
    if(rows.length){
      const payload=rows.map((s,i)=>({classroom_id:cid,client_uid:String(s.uid),student_code:String(s.id||""),
        full_name:String(s.name||""),sort_order:i+1,active:true}));
      const {error}=await sb.from("students").upsert(payload,{onConflict:"classroom_id,client_uid"});if(error)throw error;
    }
    const payloads=MODULES.map(name=>({classroom_id:cid,module_name:name,
      data:typeof window.moduleStore==="function"?window.moduleStore(name):{},updated_by:state.user.id}));
    payloads.push({classroom_id:cid,module_name:"homeroom_times",data:hget("homeroom_time_settings",{})||{},updated_by:state.user.id});
    const {error}=await sb.from("module_data").upsert(payloads,{onConflict:"classroom_id,module_name"});if(error)throw error;
  }
  window.cloudCreateClassroom=async()=>{
    if(!isManagementRole(state.profile?.role))return alert("เฉพาะ Director, Deputy Director หรือ Admin เท่านั้น");
    const f=document.getElementById("createClassroomForm"),msg=document.getElementById("createClassroomMessage");
    const v=Object.fromEntries(new FormData(f).entries());
    if(!v.class_level||!v.room||!v.academic_year){msg.textContent="กรอกระดับชั้น ห้อง และปีการศึกษา";return}
    msg.textContent="กำลังสร้างห้องเรียน...";
    const payload={school_name:v.school_name||"",office_name:v.office_name||"",class_level:v.class_level,room:v.room,
      academic_year:Number(v.academic_year),term:Number(v.term||1),teacher1:v.teacher1||"",teacher2:v.teacher2||"",
      academic_head:v.academic_head||"",deputy:v.deputy||"",open_date:v.open_date||null,close_date:v.close_date||null,
      target_days:Number(v.target_days||100),target_weeks:Number(v.target_weeks||20),use_thai_holidays:true,
      holidays:typeof window.holidays==="function"?window.holidays():[],created_by:state.user.id};
    const {data:room,error}=await sb.from("classrooms").insert(payload).select().single();
    if(error){msg.textContent="สร้างห้องไม่สำเร็จ: "+error.message;return}
    const {error:ae}=await sb.from("classroom_teachers").insert({classroom_id:room.id,teacher_id:state.user.id,permission:"owner"});
    if(ae){msg.textContent="สร้างห้องแล้ว แต่กำหนดสิทธิ์ไม่สำเร็จ: "+ae.message;return}
    if(f.elements.migrate_local?.checked){
      try{await uploadLocal(room.id)}catch(e){console.error(e);alert("สร้างห้องแล้ว แต่ย้ายข้อมูลเดิมบางส่วนไม่สำเร็จ: "+e.message)}
    }
    localStorage.setItem(ACTIVE_KEY,room.id);location.href="index.html";
  };
  window.startClassroomsPage=async()=>{
    try{
      const qs=new URLSearchParams(location.search);
      const hash=new URLSearchParams(location.hash.replace(/^#/,""));
      const oauthError=qs.get("error_description")||hash.get("error_description")||qs.get("error")||hash.get("error");
      if(oauthError){
        sessionStorage.setItem("hnk_oauth_error",oauthError);
        history.replaceState({},document.title,location.pathname);
        location.href="login.html";
        return;
      }
      const user=await getSessionUser();if(!user){location.href="login.html";return}
      await loadProfile();
      const roleDash=roleDashboardPath(state.profile.role);
      if(roleDash && qs.get("rooms")!=="1"){location.href=roleDash;return}
      showBody();
      document.getElementById("classroomUserName").textContent=state.profile.display_name||state.profile.email||"";
      document.getElementById("classroomUserRole").textContent=roleLabel(state.profile.role);
      if(isManagementRole(state.profile.role)){
        document.getElementById("adminCreateRoomPanel").style.display="";
        document.getElementById("adminPermissionLink").style.display="";
        fillRoomDefaults();
      }
      const reviewLink=document.getElementById("reviewWorkLink");
      if(reviewLink && roleDashboardPath(state.profile.role)){
        reviewLink.href=roleDashboardPath(state.profile.role);
        reviewLink.textContent="📊 แดชบอร์ดภาพรวม";
        reviewLink.style.display="";
      }
      const rooms=await listClassrooms(),box=document.getElementById("classroomList");
      box.innerHTML=rooms.length?rooms.map(roomCard).join(""):`<div class="empty-room-state">ยังไม่มีห้องเรียนที่คุณได้รับสิทธิ์${isManagementRole(state.profile.role)?"<br>สร้างห้องเรียนแรกได้จากแบบฟอร์มด้านล่าง":""}</div>`;
    }catch(e){console.error(e);fatal(e.message||String(e))}
  };

  async function adminReload(){
    const [pr,cr,ar]=await Promise.all([
      sb.from("profiles").select("id,email,display_name,role").order("display_name"),
      sb.from("classrooms").select("id,class_level,room,academic_year,term,school_name").order("academic_year",{ascending:false}),
      sb.from("classroom_teachers").select("classroom_id,teacher_id,permission")
    ]);
    if(pr.error)throw pr.error;if(cr.error)throw cr.error;if(ar.error)throw ar.error;
    const profiles=pr.data||[],rooms=cr.data||[],assignments=ar.data||[],pm=new Map(profiles.map(x=>[x.id,x])),cm=new Map(rooms.map(x=>[x.id,x]));
    document.getElementById("assignTeacher").innerHTML=profiles.filter(p=>p.role==="teacher").map(p=>`<option value="${p.id}">${esc(p.display_name||p.email)} — ${esc(p.email||"")}</option>`).join("");
    document.getElementById("assignClassroom").innerHTML=rooms.map(r=>`<option value="${r.id}">${esc(r.class_level)}/${esc(r.room)} • ${esc(r.academic_year)}/${esc(r.term)}</option>`).join("");
    document.getElementById("teacherTableBody").innerHTML=profiles.map(p=>`<tr><td>${esc(p.display_name||"")}</td><td>${esc(p.email||"")}</td>
      <td><select class="role-select" onchange="cloudChangeRole('${p.id}',this.value)">
        <option value="director" ${p.role==="director"?"selected":""}>Director</option>
        <option value="deputy_director" ${p.role==="deputy_director"?"selected":""}>Deputy Director</option>
        <option value="admin" ${p.role==="admin"?"selected":""}>Admin</option>
        <option value="academic" ${p.role==="academic"?"selected":""}>Academic</option>
        <option value="teacher" ${p.role==="teacher"?"selected":""}>Teacher</option>
      </select></td><td><button class="btn gray" type="button" onclick="cloudRenameProfile('${p.id}','${esc(p.display_name||"")}')">แก้ชื่อ</button></td></tr>`).join("");
    document.getElementById("assignmentTableBody").innerHTML=assignments.length?assignments.map(a=>{
      const p=pm.get(a.teacher_id),r=cm.get(a.classroom_id);
      return `<tr><td>${esc(p?.display_name||p?.email||a.teacher_id)}</td><td>${esc(r?`${r.class_level}/${r.room} • ${r.academic_year}/${r.term}`:a.classroom_id)}</td>
        <td>Teacher — กรอกข้อมูลห้องที่ได้รับมอบหมาย</td><td><button class="btn danger" onclick="cloudRemoveAssignment('${a.classroom_id}','${a.teacher_id}')">ถอนสิทธิ์</button></td></tr>`;
    }).join(""):'<tr><td colspan="4" style="text-align:center;padding:20px">ยังไม่มีการกำหนดสิทธิ์</td></tr>';
  }
  window.startAdminPage=async()=>{
    try{
      const user=await getSessionUser();if(!user){location.href="login.html";return}
      await loadProfile();if(!isManagementRole(state.profile.role)){location.href="classrooms.html";return}
      showBody();await adminReload();
    }catch(e){console.error(e);fatal(e.message||String(e))}
  };
  window.cloudAssignTeacher=async()=>{
    const teacher_id=document.getElementById("assignTeacher").value,classroom_id=document.getElementById("assignClassroom").value,
      permission="editor";
    if(!teacher_id||!classroom_id)return alert("ต้องมีบัญชี Teacher และห้องเรียนก่อน");
    const {error}=await sb.from("classroom_teachers").upsert({classroom_id,teacher_id,permission},{onConflict:"classroom_id,teacher_id"});
    if(error)return alert("กำหนดสิทธิ์ไม่สำเร็จ: "+error.message);await adminReload();
  };
  window.cloudRemoveAssignment=async(cid,tid)=>{
    if(!confirm("ยืนยันการถอนสิทธิ์ครูออกจากห้องนี้?"))return;
    const {error}=await sb.from("classroom_teachers").delete().eq("classroom_id",cid).eq("teacher_id",tid);
    if(error)return alert("ถอนสิทธิ์ไม่สำเร็จ: "+error.message);await adminReload();
  };
  window.cloudRenameProfile=async(uid,oldName)=>{
    const name=prompt("ชื่อที่แสดงของครู",oldName||"");if(name===null)return;
    const {error}=await sb.from("profiles").update({display_name:name.trim()}).eq("id",uid);
    if(error)return alert("แก้ชื่อไม่สำเร็จ: "+error.message);await adminReload();
  };

  window.cloudChangeRole=async(userId,role)=>{
    if(!isManagementRole(state.profile?.role))return alert("ไม่มีสิทธิ์เปลี่ยนบทบาทผู้ใช้");
    if(!["director","deputy_director","admin","academic","teacher"].includes(role))return;
    const {error}=await sb.from("profiles").update({role}).eq("id",userId);
    if(error)return alert("เปลี่ยนสิทธิ์ไม่สำเร็จ: "+error.message);
    await adminReload();
  };

  window.cloudAdminInviteUser=async()=>{
    if(!isManagementRole(state.profile?.role))return alert("ไม่มีสิทธิ์เชิญผู้ใช้");
    const form=document.getElementById("inviteUserForm"),msg=document.getElementById("inviteUserMessage");
    if(!form||!msg)return;
    const v=Object.fromEntries(new FormData(form).entries());
    if(!v.email){msg.textContent="กรอกอีเมลก่อน";return}
    msg.textContent="กำลังส่งคำเชิญ...";
    const {data,error}=await sb.functions.invoke("admin-invite-user",{body:{
      email:v.email,display_name:v.display_name||"",role:v.role||"teacher"
    }});
    if(error){msg.textContent="ส่งคำเชิญไม่สำเร็จ: "+error.message;return}
    if(data?.error){msg.textContent="ส่งคำเชิญไม่สำเร็จ: "+data.error;return}
    msg.textContent="ส่งคำเชิญเรียบร้อย";
    form.reset();
    await adminReload();
  };

  async function getCurrentSubmission(){
    if(!state.classroom?.id)return null;
    const {data,error}=await sb.from("classroom_submissions").select("*").eq("classroom_id",state.classroom.id).maybeSingle();
    if(error)throw error;
    return data||null;
  }

  async function renderCurrentSubmission(){
    const box=document.getElementById("submissionWorkflowBox");
    if(!box||!state.classroom?.id)return;
    const sub=await getCurrentSubmission();
    const role=state.profile?.role;
    const teacherCanSubmit=role==="teacher" && state.permission && state.permission!=="viewer";
    let comments=[];
    if(sub){
      const {data}=await sb.from("submission_comments").select("id,comment,created_at,author_id").eq("submission_id",sub.id).order("created_at",{ascending:false});
      comments=data||[];
    }
    box.innerHTML=`
      <div class="workflow-head">
        <div><h2>ส่งธุรการชั้นเรียน</h2><div class="sub">สถานะ: <b>${esc(statusLabel(sub?.status||"draft"))}</b></div></div>
        ${teacherCanSubmit?`<button class="btn primary" onclick="cloudSubmitClassroomBook()">📤 ส่งให้วิชาการตรวจ</button>`:""}
      </div>
      ${comments.length?`<div class="workflow-comments"><b>ความคิดเห็นล่าสุด</b>${comments.slice(0,5).map(x=>`<div class="workflow-comment"><span>${esc(x.comment)}</span><small>${new Date(x.created_at).toLocaleString("th-TH")}</small></div>`).join("")}</div>`:"<div class='sub'>ยังไม่มีความคิดเห็นจากผู้ตรวจ</div>"}
    `;
  }

  window.cloudSubmitClassroomBook=async()=>{
    if(state.profile?.role!=="teacher")return alert("ปุ่มนี้สำหรับ Teacher");
    if(!state.classroom?.id)return;
    if(!confirm("ยืนยันส่งธุรการชั้นเรียนห้องนี้ให้ฝ่ายวิชาการตรวจ?"))return;
    await window.cloudFlushPending?.();
    const now=new Date().toISOString();
    const payload={
      classroom_id:state.classroom.id,
      status:"submitted_to_academic",
      submitted_by:state.user.id,
      submitted_at:now,
      forwarded_by:null,forwarded_at:null,
      academic_approved_by:null,academic_approved_at:null,academic_approved_name:null,
      approved_by:null,approved_at:null,approved_name:null,updated_at:now
    };
    const {error}=await sb.from("classroom_submissions").upsert(payload,{onConflict:"classroom_id"});
    if(error)return alert("ส่งไม่สำเร็จ: "+error.message);
    alert("ส่งให้ฝ่ายวิชาการเรียบร้อย");
    await renderCurrentSubmission();
  };

  window.cloudOpenReviewRoom=cid=>{
    localStorage.setItem(ACTIVE_KEY,cid);
    location.href="index.html";
  };

  async function loadReviewComments(submissionId){
    const {data,error}=await sb.from("submission_comments").select("id,comment,created_at,author_id").eq("submission_id",submissionId).order("created_at");
    if(error)throw error;
    return data||[];
  }

  window.cloudAddSubmissionComment=async(submissionId)=>{
    const el=document.getElementById("comment-"+submissionId);
    const comment=el?.value.trim()||"";
    if(!comment)return alert("กรอกความคิดเห็นก่อน");
    const {error}=await sb.from("submission_comments").insert({submission_id:submissionId,author_id:state.user.id,comment});
    if(error)return alert("บันทึกความคิดเห็นไม่สำเร็จ: "+error.message);
    el.value="";
    await renderReviewList();
  };

  window.cloudReviewSetStatus=async(submissionId,status)=>{
    const role=state.profile?.role;
    const allowedAcademic=["returned_by_academic","forwarded_to_deputy"];
    const allowedDeputy=["returned_by_deputy","approved"];
    if(role==="academic"&&!allowedAcademic.includes(status))return alert("Academic ไม่มีสิทธิ์ดำเนินการนี้");
    if(role==="teacher")return alert("Teacher ไม่มีสิทธิ์ดำเนินการนี้");
    if(role==="deputy_director"&&!allowedDeputy.includes(status))return alert("Deputy Director ไม่มีสิทธิ์ดำเนินการนี้");
    if(!confirm("ยืนยันเปลี่ยนสถานะเป็น “"+statusLabel(status)+"” ?"))return;
    const now=new Date().toISOString(),patch={status,updated_at:now};
    if(status==="forwarded_to_deputy"){patch.forwarded_by=state.user.id;patch.forwarded_at=now}
    if(status==="approved"){patch.approved_by=state.user.id;patch.approved_at=now}
    const {error}=await sb.from("classroom_submissions").update(patch).eq("id",submissionId);
    if(error)return alert("เปลี่ยนสถานะไม่สำเร็จ: "+error.message);
    await renderReviewList();
  };

  function reviewActions(sub){
    const role=state.profile?.role;
    if(role==="academic"){
      return `<button class="btn gray" onclick="cloudReviewSetStatus('${sub.id}','returned_by_academic')">↩ ส่งกลับครูแก้ไข</button>
              <button class="btn primary" onclick="cloudReviewSetStatus('${sub.id}','forwarded_to_deputy')">✓ อนุมัติและส่งต่อ Deputy Director →</button>`;
    }
    if(role==="deputy_director"){
      return `<button class="btn gray" onclick="cloudReviewSetStatus('${sub.id}','returned_by_deputy')">↩ ส่งกลับวิชาการ</button>
              <button class="btn primary" onclick="cloudReviewSetStatus('${sub.id}','approved')">✓ อนุมัติ</button>`;
    }
    if(role==="director"||role==="admin"){
      return `<button class="btn gray" onclick="cloudReviewSetStatus('${sub.id}','returned_by_academic')">ส่งกลับครู</button>
              <button class="btn gray" onclick="cloudReviewSetStatus('${sub.id}','forwarded_to_deputy')">ส่งต่อ Deputy</button>
              <button class="btn primary" onclick="cloudReviewSetStatus('${sub.id}','approved')">✓ อนุมัติ</button>`;
    }
    return "";
  }

  async function renderReviewList(){
    const box=document.getElementById("reviewList");if(!box)return;
    const {data,error}=await sb.from("classroom_submissions")
      .select("*,classrooms(id,class_level,room,academic_year,term,school_name)")
      .order("updated_at",{ascending:false});
    if(error){box.innerHTML=`<div class="notice">${esc(error.message)}</div>`;return}
    let rows=data||[];
    if(state.profile?.role==="deputy_director"){
      rows=rows.filter(x=>["forwarded_to_deputy","returned_by_deputy","approved"].includes(x.status));
    }
    if(!rows.length){box.innerHTML='<div class="empty-room-state">ยังไม่มีงานธุรการชั้นเรียนที่ส่งเข้ามา</div>';return}
    const cards=[];
    for(const sub of rows){
      const cm=await loadReviewComments(sub.id);
      const r=sub.classrooms||{};
      cards.push(`<section class="panel review-card">
        <div class="review-card-head">
          <div><h2>${esc(r.class_level||"")}/${esc(r.room||"")}</h2>
          <div class="sub">ภาคเรียนที่ ${esc(r.term||"")} ปีการศึกษา ${esc(r.academic_year||"")} • <b>${esc(statusLabel(sub.status))}</b></div></div>
          <button class="btn gray" onclick="cloudOpenReviewRoom('${sub.classroom_id}')">เปิดข้อมูลห้อง</button>
        </div>
        <div class="review-comments">${cm.length?cm.map(x=>`<div class="workflow-comment"><span>${esc(x.comment)}</span><small>${new Date(x.created_at).toLocaleString("th-TH")}</small></div>`).join(""):"<div class='sub'>ยังไม่มีความคิดเห็น</div>"}</div>
        <div class="review-comment-form"><textarea id="comment-${sub.id}" rows="2" placeholder="เขียนความคิดเห็น/ข้อเสนอแนะสำหรับครู"></textarea>
        <button class="btn gray" onclick="cloudAddSubmissionComment('${sub.id}')">บันทึกความคิดเห็น</button></div>
        <div class="actions review-actions">${reviewActions(sub)}</div>
      </section>`);
    }
    box.innerHTML=cards.join("");
  }
  window.renderReviewList=renderReviewList;

  window.startReviewPage=async()=>{
    try{
      const user=await getSessionUser();if(!user){location.href="login.html";return}
      await loadProfile();
      if(!(isManagementRole(state.profile.role)||state.profile.role==="academic")){location.href="classrooms.html";return}
      showBody();
      document.getElementById("reviewRole").textContent=roleLabel(state.profile.role);
      await renderReviewList();
    }catch(e){console.error(e);fatal(e.message||String(e))}
  };

})();
