
(function(){
  "use strict";
  var sb=window.cloudClient;
  var ACTIVE_KEY="hnk_cloud_active_classroom";
  var ROLE_LABELS={director:"Director",deputy_director:"Deputy Director",academic:"Academic"};
  var STATUS_LABELS={
    draft:"ยังไม่ส่ง",
    submitted_to_academic:"รอ Academic ตรวจ",
    returned_by_academic:"Academic ส่งกลับครูแก้ไข",
    forwarded_to_deputy:"Academic อนุมัติแล้ว • รอ Deputy Director",
    returned_by_deputy:"Deputy Director ส่งกลับ Academic",
    approved:"Deputy Director อนุมัติแล้ว"
  };
  var ROLE_HOME={director:"director-dashboard.html",deputy_director:"deputy-dashboard.html",academic:"academic-dashboard.html"};
  var state={user:null,profile:null,rooms:[],submissions:[],comments:[],period:"",requiredRole:""};

  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]})}
  function showBody(){document.body.classList.remove("cloud-protected")}
  function fatal(msg){
    showBody();
    var el=document.getElementById("roleDashboardMain")||document.body;
    el.innerHTML='<div class="role-fatal"><b>โหลดแดชบอร์ดไม่สำเร็จ</b><br>'+esc(msg)+'</div>';
  }
  function percent(n,d){return d?Math.round(n*100/d):0}
  function periodKey(r){return String(r.academic_year)+"|"+String(r.term)}
  function periodLabel(k){var p=String(k).split("|");return "ภาคเรียนที่ "+p[1]+" ปีการศึกษา "+p[0]}
  function stagePercent(status){
    if(status==="approved")return 100;
    if(status==="forwarded_to_deputy"||status==="returned_by_deputy")return 75;
    if(status==="submitted_to_academic"||status==="returned_by_academic")return 50;
    return 0;
  }
  function statusLabel(s){return STATUS_LABELS[s]||"ยังไม่ส่ง"}
  function roomLabel(r){return String(r.class_level||"")+"/"+String(r.room||"")}
  function thaiDate(v){
    if(!v)return "-";
    var d=new Date(v);
    return Number.isNaN(d.getTime())?"-":d.toLocaleString("th-TH",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  }

  async function loadAll(){
    var sres=await sb.auth.getSession();
    if(sres.error)throw sres.error;
    state.user=sres.data.session?sres.data.session.user:null;
    if(!state.user){location.href="login.html";return false}

    var pres=await sb.from("profiles").select("id,email,display_name,role").eq("id",state.user.id).single();
    if(pres.error)throw pres.error;
    state.profile=pres.data;

    if(state.profile.role!==state.requiredRole){
      location.href=ROLE_HOME[state.profile.role]||"classrooms.html";
      return false;
    }

    var results=await Promise.all([
      sb.from("classrooms").select("id,class_level,room,academic_year,term,school_name,teacher1,teacher2").order("academic_year",{ascending:false}).order("term",{ascending:false}).order("class_level").order("room"),
      sb.from("classroom_submissions").select("*").order("updated_at",{ascending:false}),
      sb.from("submission_comments").select("id,submission_id,comment,created_at,author_id").order("created_at",{ascending:false})
    ]);
    if(results[0].error)throw results[0].error;
    if(results[1].error)throw results[1].error;
    if(results[2].error)throw results[2].error;
    state.rooms=results[0].data||[];
    state.submissions=results[1].data||[];
    state.comments=results[2].data||[];

    var seen={},periods=[];
    state.rooms.forEach(function(r){var k=periodKey(r);if(!seen[k]){seen[k]=true;periods.push(k)}});
    state.period=periods[0]||"";
    var sel=document.getElementById("periodSelect");
    sel.innerHTML=periods.map(function(k){return '<option value="'+esc(k)+'">'+esc(periodLabel(k))+'</option>'}).join("");
    sel.value=state.period;
    sel.onchange=function(){state.period=sel.value;render()};
    return true;
  }

  function latestComment(subId){
    for(var i=0;i<state.comments.length;i++)if(state.comments[i].submission_id===subId)return state.comments[i];
    return null;
  }

  function actionArea(room,sub){
    if(!sub)return "";
    var role=state.profile.role,id=esc(sub.id);
    if(role==="academic" && (sub.status==="submitted_to_academic"||sub.status==="returned_by_deputy")){
      return '<div class="role-action-box">'+
        '<textarea id="comment-'+id+'" rows="2" placeholder="ความคิดเห็นกรณีส่งกลับให้แก้ไข"></textarea>'+
        '<div class="role-action-buttons">'+
        '<button class="btn gray" onclick="roleReturnSubmission(\''+id+'\',\'academic\')">↩ ส่งกลับครูแก้ไข</button>'+
        '<button class="btn primary" onclick="roleApproveSubmission(\''+id+'\',\'academic\')">✓ อนุมัติและส่งต่อ Deputy Director</button>'+
        '</div></div>';
    }
    if(role==="deputy_director" && sub.status==="forwarded_to_deputy"){
      return '<div class="role-action-box">'+
        '<textarea id="comment-'+id+'" rows="2" placeholder="ความคิดเห็นกรณีส่งกลับ Academic"></textarea>'+
        '<div class="role-action-buttons">'+
        '<button class="btn gray" onclick="roleReturnSubmission(\''+id+'\',\'deputy\')">↩ ส่งกลับ Academic</button>'+
        '<button class="btn primary" onclick="roleApproveSubmission(\''+id+'\',\'deputy\')">✓ อนุมัติ</button>'+
        '</div></div>';
    }
    return "";
  }

  function roomCard(room,sub){
    var pct=stagePercent(sub?sub.status:null);
    var comment=sub?latestComment(sub.id):null;
    var teacher=[room.teacher1,room.teacher2].filter(Boolean).join(" / ")||"-";
    var html='<article class="role-room-card">'+
      '<div class="role-room-head"><div><h3>'+esc(roomLabel(room))+'</h3>'+
      '<div class="role-room-teacher">ครูประจำชั้น: '+esc(teacher)+'</div></div>'+
      '<span class="role-status status-'+esc(sub?sub.status:"draft")+'">'+esc(statusLabel(sub?sub.status:null))+'</span></div>'+
      '<div class="role-room-progress-line"><div class="role-progress-track"><div class="role-progress-fill" style="width:'+pct+'%"></div></div><strong>'+pct+'%</strong></div>'+
      '<div class="role-room-meta"><span>ส่งครั้งล่าสุด: '+esc(thaiDate(sub?sub.submitted_at:null))+'</span>';
    if(sub&&sub.academic_approved_at)html+='<span>Academic อนุมัติ: '+esc(thaiDate(sub.academic_approved_at))+'</span>';
    if(sub&&sub.approved_at)html+='<span>Deputy Director อนุมัติ: '+esc(thaiDate(sub.approved_at))+'</span>';
    html+='</div>';
    if(comment)html+='<div class="role-latest-comment"><b>ความคิดเห็นล่าสุด:</b> '+esc(comment.comment)+'</div>';
    html+='<div class="role-room-tools"><button class="btn gray" onclick="roleOpenRoom(\''+room.id+'\')">เปิดข้อมูลห้อง</button></div>';
    html+=actionArea(room,sub);
    html+='</article>';
    return html;
  }

  function render(){
    var rooms=state.rooms.filter(function(r){return periodKey(r)===state.period});
    var subMap={};
    state.submissions.forEach(function(s){subMap[s.classroom_id]=s});
    var rows=rooms.map(function(r){return {room:r,sub:subMap[r.id]||null}});
    var total=rows.length;
    var sent=rows.filter(function(x){return !!(x.sub&&x.sub.submitted_at)}).length;
    var notSent=rows.filter(function(x){return !(x.sub&&x.sub.submitted_at)});
    var waitAcademic=rows.filter(function(x){return x.sub&&(x.sub.status==="submitted_to_academic"||x.sub.status==="returned_by_deputy")}).length;
    var waitDeputy=rows.filter(function(x){return x.sub&&x.sub.status==="forwarded_to_deputy"}).length;
    var approved=rows.filter(function(x){return x.sub&&x.sub.status==="approved"}).length;
    var returned=rows.filter(function(x){return x.sub&&(x.sub.status==="returned_by_academic"||x.sub.status==="returned_by_deputy")}).length;

    document.getElementById("roleDashboardTitle").textContent=ROLE_LABELS[state.profile.role]+" Dashboard";
    document.getElementById("roleDashboardUser").textContent=state.profile.display_name||state.profile.email||"";
    document.getElementById("summaryCards").innerHTML=
      '<div class="role-summary-card"><strong>'+total+'</strong><span>ห้องทั้งหมด</span></div>'+
      '<div class="role-summary-card"><strong>'+percent(sent,total)+'%</strong><span>ส่งธุรการแล้ว '+sent+'/'+total+'</span></div>'+
      '<div class="role-summary-card"><strong>'+notSent.length+'</strong><span>ยังไม่ได้ส่ง</span></div>'+
      '<div class="role-summary-card"><strong>'+waitAcademic+'</strong><span>รอ Academic</span></div>'+
      '<div class="role-summary-card"><strong>'+waitDeputy+'</strong><span>รอ Deputy Director</span></div>'+
      '<div class="role-summary-card"><strong>'+percent(approved,total)+'%</strong><span>อนุมัติครบ '+approved+'/'+total+'</span></div>';

    var missing=document.getElementById("missingRooms");
    missing.innerHTML=notSent.length
      ?notSent.map(function(x){return '<span class="missing-room-chip">'+esc(roomLabel(x.room))+'</span>'}).join("")
      :'<span class="all-sent">✓ ทุกห้องส่งธุรการชั้นเรียนแล้ว</span>';

    document.getElementById("returnedCount").textContent=returned?("มีงานถูกส่งกลับ "+returned+" ห้อง"):"ไม่มีงานที่อยู่ในสถานะส่งกลับ";
    document.getElementById("roomProgressList").innerHTML=rows.length
      ?rows.map(function(x){return roomCard(x.room,x.sub)}).join("")
      :'<div class="empty-room-state">ยังไม่มีห้องเรียนในภาคเรียนนี้</div>';
  }

  async function addComment(submissionId,text){
    var comment=String(text||"").trim();
    if(!comment)return;
    var res=await sb.from("submission_comments").insert({submission_id:submissionId,author_id:state.user.id,comment:comment});
    if(res.error)throw res.error;
  }

  window.roleOpenRoom=function(cid){
    localStorage.setItem(ACTIVE_KEY,cid);
    location.href="index.html";
  };

  window.roleReturnSubmission=async function(submissionId,level){
    var el=document.getElementById("comment-"+submissionId);
    var comment=el?el.value.trim():"";
    if(!comment){alert("กรุณาเขียนความคิดเห็น/สิ่งที่ต้องแก้ไขก่อนส่งกลับ");return}
    var status=level==="academic"?"returned_by_academic":"returned_by_deputy";
    var target=level==="academic"?"ครูประจำชั้น":"Academic";
    if(!confirm("ยืนยันส่งกลับให้ "+target+" แก้ไข?"))return;
    try{
      await addComment(submissionId,comment);
      var res=await sb.from("classroom_submissions").update({status:status,updated_at:new Date().toISOString()}).eq("id",submissionId);
      if(res.error)throw res.error;
      await refresh();
    }catch(e){alert("ดำเนินการไม่สำเร็จ: "+(e&&e.message?e.message:String(e)))}
  };

  window.roleApproveSubmission=async function(submissionId,level){
    var academic=level==="academic";
    var status=academic?"forwarded_to_deputy":"approved";
    var msg=academic
      ?"ยืนยันอนุมัติรายการนี้และส่งต่อ Deputy Director? ระบบจะลงลายเซ็น Academic ในเล่มอัตโนมัติ"
      :"ยืนยันอนุมัติรายการนี้? ระบบจะลงลายเซ็น Deputy Director ในเล่มอัตโนมัติ";
    if(!confirm(msg))return;
    try{
      var res=await sb.from("classroom_submissions").update({status:status,updated_at:new Date().toISOString()}).eq("id",submissionId);
      if(res.error)throw res.error;
      await refresh();
    }catch(e){alert("อนุมัติไม่สำเร็จ: "+(e&&e.message?e.message:String(e)))}
  };

  async function refresh(){
    var results=await Promise.all([
      sb.from("classroom_submissions").select("*").order("updated_at",{ascending:false}),
      sb.from("submission_comments").select("id,submission_id,comment,created_at,author_id").order("created_at",{ascending:false})
    ]);
    if(results[0].error)throw results[0].error;
    if(results[1].error)throw results[1].error;
    state.submissions=results[0].data||[];
    state.comments=results[1].data||[];
    render();
  }

  window.startRoleDashboard=async function(requiredRole){
    state.requiredRole=requiredRole;
    try{
      if(!sb)throw new Error("Supabase client is not ready");
      var ok=await loadAll();
      if(!ok)return;
      document.getElementById("roomsLink").href="classrooms.html?rooms=1";
      if(state.profile.role==="director"){
        document.getElementById("roleHelp").textContent="มุมมองภาพรวมการส่งและการอนุมัติของทุกห้อง";
      }else if(state.profile.role==="academic"){
        document.getElementById("roleHelp").textContent="ตรวจงานทุกห้อง • ส่งกลับครูแก้ไข • อนุมัติและส่งต่อ Deputy Director";
      }else{
        document.getElementById("roleHelp").textContent="ตรวจงานที่ Academic อนุมัติแล้ว • ส่งกลับ Academic • อนุมัติขั้นสุดท้าย";
      }
      showBody();
      render();
    }catch(e){console.error(e);fatal(e&&e.message?e.message:String(e))}
  };
})();
