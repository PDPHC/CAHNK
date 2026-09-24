(function(){
  "use strict";
  var sb=window.cloudClient;
  var ACTIVE_KEY="hnk_cloud_active_classroom";
  var ROLE_LABELS={director:"Director",deputy_director:"Deputy Director",academic:"Academic"};
  var STATUS_LABELS={
    draft:"ยังไม่ส่ง",
    submitted_to_academic:"รอวิชาการตรวจ",
    returned_by_academic:"ส่งกลับครูแก้ไข",
    forwarded_to_deputy:"ส่งต่อแล้ว • รอรองวิชาการ",
    returned_by_deputy:"รองวิชาการส่งกลับให้ตรวจ",
    approved:"Deputy Director อนุมัติแล้ว"
  };
  var ROLE_HOME={director:"director-dashboard.html",deputy_director:"deputy-dashboard.html",academic:"academic-dashboard.html"};
  var MONTHS=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  var state={user:null,profile:null,rooms:[],submissions:[],comments:[],archives:[],period:"",reportMonth:"",requiredRole:"",signatureReady:false,filter:"all",search:"",busy:false};

  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]})}
  function showBody(){document.body.classList.remove("cloud-protected")}
  function fatal(msg){showBody();var el=document.getElementById("roleDashboardMain")||document.body;el.innerHTML='<div class="role-fatal"><b>โหลดแดชบอร์ดไม่สำเร็จ</b><br>'+esc(msg)+'</div>'}
  function percent(n,d){return d?Math.round(n*100/d):0}
  function periodKey(r){return String(r.academic_year)+"|"+String(r.term)}
  function periodLabel(k){var p=String(k).split("|");return "ภาคเรียนที่ "+p[1]+" ปีการศึกษา "+p[0]}
  function monthKey(v){return String(v||"").slice(0,7)}
  function monthLabel(ym){var p=String(ym||"").split("-");return p.length===2?(MONTHS[Number(p[1])-1]+" "+(Number(p[0])+543)):ym}
  function dueDate(ym){var p=String(ym||"").split("-");if(p.length!==2)return "";var d=new Date(Number(p[0]),Number(p[1]),5);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
  function thaiDate(v){if(!v)return "-";var d=new Date(v);return Number.isNaN(d.getTime())?"-":d.toLocaleString("th-TH",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
  function roomLabel(r){return String(r.class_level||"")+"/"+String(r.room||"")}
  function statusLabel(s){return STATUS_LABELS[s]||"ยังไม่ส่ง"}
  function stagePercent(status){if(status==="approved")return 100;if(status==="forwarded_to_deputy"||status==="returned_by_deputy")return 75;if(status==="submitted_to_academic"||status==="returned_by_academic")return 50;return 0}
  function monthsForRoom(r){
    if(!r.open_date||!r.close_date)return [];
    var a=new Date(r.open_date+"T00:00:00"),b=new Date(r.close_date+"T00:00:00"),d=new Date(a.getFullYear(),a.getMonth(),1),out=[];
    while(d<=b){out.push(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"));d.setMonth(d.getMonth()+1)}
    return out;
  }
  function monthsForRooms(rooms){
    var seen={},out=[];
    rooms.forEach(function(r){monthsForRoom(r).forEach(function(m){if(!seen[m]){seen[m]=true;out.push(m)}})});
    return out.sort();
  }
  function monthReady(ym,rooms){
    var today=new Date();
    var ends=rooms.filter(function(r){return monthsForRoom(r).indexOf(ym)>=0}).map(function(r){
      var p=ym.split("-"),last=new Date(Number(p[0]),Number(p[1]),0,23,59,59),close=new Date(r.close_date+"T23:59:59");
      return close<last?close:last;
    });
    return ends.length?today>=new Date(Math.max.apply(null,ends.map(function(d){return d.getTime()}))):false;
  }
  function submissionFor(classroomId,ym){
    for(var i=0;i<state.submissions.length;i++){
      var s=state.submissions[i];
      if(s.classroom_id===classroomId&&monthKey(s.report_month)===ym)return s;
    }
    return null;
  }
  function latestComment(subId){for(var i=0;i<state.comments.length;i++)if(state.comments[i].submission_id===subId)return state.comments[i];return null}
  function archivedFor(classroomId,ym){return state.archives.some(function(a){return a.classroom_id===classroomId&&monthKey(a.report_month)===ym})}
  function deliveryText(sub,ym,room){
    var due=dueDate(ym),deadline=new Date(due+"T23:59:59");
    if(sub&&sub.submitted_at)return new Date(sub.submitted_at)<=deadline?"ส่งตรงเวลา":"ส่งล่าช้า";
    if(room&&!monthReady(ym,[room]))return "ยังไม่ถึงรอบส่ง";
    return new Date()>deadline?"เกินกำหนด":"ยังไม่ส่ง";
  }

  async function loadAll(){
    var sres=await sb.auth.getSession();if(sres.error)throw sres.error;
    state.user=sres.data.session?sres.data.session.user:null;if(!state.user){location.href="login.html";return false}
    var pres=await sb.from("profiles").select("id,email,display_name,role").eq("id",state.user.id).single();if(pres.error)throw pres.error;state.profile=pres.data;
    if(state.profile.role!==state.requiredRole&&state.profile.role!=="admin"){location.href=ROLE_HOME[state.profile.role]||"classrooms.html";return false}
    var results=await Promise.all([
      sb.from("classrooms").select("id,class_level,room,academic_year,term,school_name,teacher1,teacher2,open_date,close_date").order("academic_year",{ascending:false}).order("term",{ascending:false}).order("class_level").order("room"),
      sb.from("classroom_submissions").select("*").order("report_month",{ascending:false}).order("updated_at",{ascending:false}),
      sb.from("submission_comments").select("id,submission_id,comment,created_at,author_id").order("created_at",{ascending:false}),
      sb.from("classroom_monthly_archives").select("id,classroom_id,academic_year,term,report_month,approved_at").order("report_month",{ascending:false}),
      sb.from("user_signatures").select("user_id").eq("user_id",state.user.id).maybeSingle()
    ]);
    for(var i=0;i<4;i++)if(results[i].error)throw results[i].error;
    state.rooms=results[0].data||[];state.submissions=results[1].data||[];state.comments=results[2].data||[];state.archives=results[3].data||[];
    state.signatureReady=!!results[4].data;

    var seen={},periods=[];state.rooms.forEach(function(r){var k=periodKey(r);if(!seen[k]){seen[k]=true;periods.push(k)}});
    state.period=periods[0]||"";
    var periodSel=document.getElementById("periodSelect");
    periodSel.innerHTML=periods.map(function(k){return '<option value="'+esc(k)+'">'+esc(periodLabel(k))+'</option>'}).join("");
    periodSel.value=state.period;
    periodSel.onchange=function(){state.period=periodSel.value;setupMonthSelector();render()};
    setupMonthSelector();
    return true;
  }

  function setupMonthSelector(){
    var rooms=state.rooms.filter(function(r){return periodKey(r)===state.period});
    var months=monthsForRooms(rooms),ready=months.filter(function(m){return monthReady(m,rooms)});
    if(state.reportMonth===""||months.indexOf(state.reportMonth)<0)state.reportMonth=ready.length?ready[ready.length-1]:(months[0]||"");
    var sel=document.getElementById("reportMonthSelect");
    sel.innerHTML=months.map(function(m){return '<option value="'+m+'">'+esc(monthLabel(m))+(monthReady(m,rooms)?"":" • ยังไม่ถึงรอบส่ง")+'</option>'}).join("");
    sel.value=state.reportMonth;
    sel.onchange=function(){state.reportMonth=sel.value;render()};
  }

  function actionArea(room,sub){
    if(!sub)return "";
    var role=state.profile.role==="admin"&&state.requiredRole==="deputy_director"?"deputy_director":state.profile.role,id=esc(sub.id);
    if(role==="academic"&&sub.status==="forwarded_to_deputy"){
      return '<div class="role-action-box"><p>ส่งต่อรองวิชาการแล้ว สามารถดึงกลับได้ก่อนรองฯ อนุมัติ</p><button class="btn gray" onclick="roleRecallSubmission(\''+id+'\')">↩ ยกเลิกการส่งต่อรองวิชาการ</button></div>';
    }
    if(role==="academic"&&(sub.status==="submitted_to_academic"||sub.status==="returned_by_deputy")){
      return '<div class="role-action-box"><textarea id="comment-'+id+'" rows="2" placeholder="ความคิดเห็นกรณีส่งกลับให้แก้ไข"></textarea><div class="role-action-buttons">'+
        '<button class="btn gray" onclick="roleReturnSubmission(\''+id+'\',\'academic\')">↩ ส่งกลับครูแก้ไข</button>'+
        '<button class="btn primary" onclick="roleApproveSubmission(\''+id+'\',\'academic\')">✓ อนุมัติและส่งต่อรองวิชาการ</button></div></div>';
    }
    if(role==="deputy_director"&&sub.status==="forwarded_to_deputy"){
      return '<div class="role-action-box"><textarea id="comment-'+id+'" rows="2" placeholder="ความคิดเห็นกรณีส่งกลับ Academic"></textarea><div class="role-action-buttons">'+
        '<button class="btn gray" onclick="roleReturnSubmission(\''+id+'\',\'deputy\')">↩ ส่งกลับ Academic</button>'+
        '<button class="btn primary" onclick="roleApproveSubmission(\''+id+'\',\'deputy\')">✓ อนุมัติและจัดเก็บเข้าคลัง</button></div></div>';
    }
    return "";
  }

  function roomCard(room,sub){
    var pct=stagePercent(sub?sub.status:null),comment=sub?latestComment(sub.id):null,teacher=[room.teacher1,room.teacher2].filter(Boolean).join(" / ")||"-";
    var delivery=deliveryText(sub,state.reportMonth,room),archived=archivedFor(room.id,state.reportMonth);
    var html='<article class="role-room-card"><div class="role-room-head"><div><h3>'+esc(roomLabel(room))+'</h3><div class="role-room-teacher">ครูประจำชั้น: '+esc(teacher)+'</div></div>'+
      '<span class="role-status status-'+esc(sub?sub.status:"draft")+'">'+esc(statusLabel(sub?sub.status:null))+'</span></div>'+
      '<div class="role-room-progress-line"><div class="role-progress-track"><div class="role-progress-fill" style="width:'+pct+'%"></div></div><strong>'+pct+'%</strong></div>'+
      '<div class="role-room-meta"><span>กำหนดส่ง: 5 '+esc(monthLabel(monthKey(dueDate(state.reportMonth))))+'</span><span class="'+((delivery==="ส่งล่าช้า"||delivery==="เกินกำหนด")?"late-text":"")+'">'+esc(delivery)+'</span>';
    if(sub&&sub.submitted_at)html+='<span>ส่ง: '+esc(thaiDate(sub.submitted_at))+'</span>';
    if(sub&&sub.academic_approved_at)html+='<span>Academic: '+esc(thaiDate(sub.academic_approved_at))+'</span>';
    if(sub&&sub.approved_at)html+='<span>Deputy: '+esc(thaiDate(sub.approved_at))+'</span>';
    if(archived)html+='<span class="archive-badge">✓ เก็บเข้าคลังแล้ว</span>';
    html+='</div>';
    if(comment)html+='<div class="role-latest-comment"><b>ความคิดเห็นล่าสุด:</b> '+esc(comment.comment)+'</div>';
    if(sub)html+='<div class="role-room-tools"><a class="btn primary" href="review-book.html?submission='+encodeURIComponent(sub.id)+'" target="_blank" rel="noopener">📖 ดูเล่มธุรการเดือนนี้</a></div>';
    html+='<div class="role-room-tools"><button class="btn gray" onclick="roleOpenRoom(\''+room.id+'\')">เปิดข้อมูลห้อง</button></div>'+actionArea(room,sub)+'</article>';
    return html;
  }

  function renderDirectorCharts(rooms,rows){
    var host=document.getElementById("directorCharts");if(!host)return;
    var categories=[{key:"draft",label:"ยังไม่ส่ง",color:"#d9cce5"},{key:"submitted_to_academic",label:"รอวิชาการตรวจ",color:"#b68bd5"},{key:"returned_by_academic",label:"ครูแก้ไข",color:"#d79851"},{key:"forwarded_to_deputy",label:"รอรองวิชาการ",color:"#8650b5"},{key:"returned_by_deputy",label:"วิชาการแก้ไข",color:"#b66696"},{key:"approved",label:"อนุมัติแล้ว",color:"#4d2671"}];
    var total=rows.length,offset=0,segments=[];
    categories.forEach(function(x){x.count=rows.filter(function(r){return (r.sub?r.sub.status:"draft")===x.key}).length;var end=offset+(total?100*x.count/total:0);if(x.count)segments.push(x.color+" "+offset+"% "+end+"%");offset=end});
    var months=monthsForRooms(rooms);
    var bars=months.map(function(m){
      var applicable=rooms.filter(function(r){return monthsForRoom(r).includes(m)}),n=applicable.length;
      var sent=applicable.filter(function(r){var s=submissionFor(r.id,m);return s&&s.submitted_at}).length;
      var approved=applicable.filter(function(r){var s=submissionFor(r.id,m);return s&&s.status==="approved"}).length;
      return '<div class="director-bar-row"><div class="director-bar-label">'+esc(monthLabel(m))+'</div><div class="director-bar-pair"><div class="director-bar-track"><div class="director-bar sent" style="width:'+percent(sent,n)+'%"></div></div><div class="director-bar-track"><div class="director-bar approved" style="width:'+percent(approved,n)+'%"></div></div></div><div class="director-bar-count">ส่ง '+sent+'/'+n+'<br>อนุมัติ '+approved+'/'+n+'</div></div>';
    }).join("");
    host.innerHTML='<section class="director-chart-card"><h2>สถานะงานประจำเดือน</h2><p class="sub">'+esc(monthLabel(state.reportMonth))+'</p><div class="director-status-chart"><div class="director-donut" role="img" aria-label="สถานะงาน '+total+' ห้อง ดูรายละเอียดในรายการข้างกราฟ" style="background:'+(segments.length?'conic-gradient('+segments.join(',')+')':'#eee6f5')+'"><div><strong>'+total+'</strong><span>ห้องเรียน</span></div></div><ul class="director-chart-legend">'+categories.map(function(x){return '<li><i style="background:'+x.color+'"></i><span>'+x.label+'</span><b>'+x.count+'</b></li>'}).join("")+'</ul></div>'+(total?'':'<p class="sub">ยังไม่มีห้องเรียนในภาคเรียนนี้</p>')+'</section><section class="director-chart-card"><h2>การส่งและอนุมัติรายเดือน</h2><p class="sub">'+esc(periodLabel(state.period))+' • สัดส่วนเทียบจำนวนห้องของแต่ละเดือน</p><div class="director-chart-key"><span><i class="sent"></i>ส่งแล้ว</span><span><i class="approved"></i>อนุมัติแล้ว</span></div>'+(bars||'<p class="sub">ยังไม่มีข้อมูลเดือนสำหรับแสดงกราฟ</p>')+'</section>';
  }

  function render(){
    var rooms=state.rooms.filter(function(r){return periodKey(r)===state.period});
    var rows=rooms.map(function(r){return {room:r,sub:submissionFor(r.id,state.reportMonth)}});
    var total=rows.length,sent=rows.filter(function(x){return !!(x.sub&&x.sub.submitted_at)}).length;
    renderDirectorCharts(rooms,rows);
    var notSent=rows.filter(function(x){return !(x.sub&&x.sub.submitted_at)});
    var waitAcademic=rows.filter(function(x){return x.sub&&(x.sub.status==="submitted_to_academic"||x.sub.status==="returned_by_deputy")}).length;
    var waitDeputy=rows.filter(function(x){return x.sub&&x.sub.status==="forwarded_to_deputy"}).length;
    var approved=rows.filter(function(x){return x.sub&&x.sub.status==="approved"}).length;
    var onTime=rows.filter(function(x){return x.sub&&deliveryText(x.sub,state.reportMonth,x.room)==="ส่งตรงเวลา"}).length;
    var overdue=rows.filter(function(x){var t=deliveryText(x.sub,state.reportMonth,x.room);return t==="เกินกำหนด"||t==="ส่งล่าช้า"}).length;

    document.getElementById("roleDashboardTitle").textContent=state.requiredRole==="academic"?"งานตรวจธุรการชั้นเรียน":ROLE_LABELS[state.requiredRole]+" Dashboard";
    document.getElementById("roleDashboardUser").textContent=state.profile.display_name||state.profile.email||"";
    document.getElementById("selectedMonthText").textContent=monthLabel(state.reportMonth);
    document.getElementById("deadlineText").textContent="กำหนดส่งภายในวันที่ 5 ของเดือนถัดไป";
    document.getElementById("summaryCards").innerHTML=
      '<div class="role-summary-card"><strong>'+total+'</strong><span>ห้องทั้งหมด</span></div>'+
      '<div class="role-summary-card"><strong>'+percent(sent,total)+'%</strong><span>ส่งแล้ว '+sent+'/'+total+'</span></div>'+
      '<div class="role-summary-card"><strong>'+notSent.length+'</strong><span>ยังไม่ส่ง</span></div>'+
      '<div class="role-summary-card"><strong>'+waitAcademic+'</strong><span>รอ Academic</span></div>'+
      '<div class="role-summary-card"><strong>'+waitDeputy+'</strong><span>รอ Deputy Director</span></div>'+
      '<div class="role-summary-card"><strong>'+percent(approved,total)+'%</strong><span>อนุมัติครบ '+approved+'/'+total+'</span></div>'+
      '<div class="role-summary-card"><strong>'+percent(onTime,total)+'%</strong><span>ส่งตรงเวลา</span></div>'+
      '<div class="role-summary-card"><strong>'+overdue+'</strong><span>เกินกำหนด/ส่งล่าช้า</span></div>';

    var missing=document.getElementById("missingRooms");
    missing.innerHTML=notSent.length?notSent.map(function(x){return '<span class="missing-room-chip">'+esc(roomLabel(x.room))+'</span>'}).join(""):'<span class="all-sent">✓ ทุกห้องส่งธุรการเดือนนี้แล้ว</span>';
    var priorities={submitted_to_academic:0,returned_by_deputy:0,forwarded_to_deputy:1,returned_by_academic:2,approved:3,draft:4};
    rows=rows.filter(function(x){
      var status=x.sub?x.sub.status:"draft",needle=state.search.toLowerCase();
      var matches=!needle||(roomLabel(x.room)+" "+x.room.teacher1+" "+x.room.teacher2).toLowerCase().includes(needle);
      return matches&&(state.filter==="all"||(state.filter==="pending"&&["submitted_to_academic","returned_by_deputy"].includes(status))||(state.filter==="missing"&&!x.sub)||status===state.filter);
    });
    if(state.requiredRole==="academic")rows.sort(function(a,b){return (priorities[a.sub?a.sub.status:"draft"]??4)-(priorities[b.sub?b.sub.status:"draft"]??4)});
    document.getElementById("roomProgressList").innerHTML=rows.length?rows.map(function(x){return roomCard(x.room,x.sub)}).join(""):'<div class="empty-room-state">ไม่พบห้องเรียนตามตัวกรองที่เลือก</div>';

    var sig=document.getElementById("signatureNotice");
    if(sig){
      if((state.profile.role==="academic"||state.profile.role==="deputy_director"||(state.profile.role==="admin"&&state.requiredRole==="deputy_director"))&&!state.signatureReady){
        sig.style.display="";sig.innerHTML='⚠ ยังไม่มีลายเซ็นในระบบ — <a href="signature.html">อัปโหลดลายเซ็นก่อนอนุมัติ</a>';
      }else sig.style.display="none";
    }
  }

  async function addComment(submissionId,text){
    var comment=String(text||"").trim();if(!comment)return;
    var res=await sb.from("submission_comments").insert({submission_id:submissionId,author_id:state.user.id,comment:comment});if(res.error)throw res.error;
  }

  window.roleRecallSubmission=async function(id){
    if(state.busy)return;
    var sub=state.submissions.find(function(s){return s.id===id});
    if(state.profile.role!=="academic"||!sub||sub.status!=="forwarded_to_deputy")return;
    if(!confirm("ยกเลิกการส่งต่อรองวิชาการและดึงงานกลับมาตรวจ? ลายเซ็นอนุมัติของวิชาการในรอบนี้จะถูกยกเลิก และต้องอนุมัติส่งต่อใหม่"))return;
    state.busy=true;
    try{
      var res=await sb.from("classroom_submissions").update({status:"submitted_to_academic"}).eq("id",id).eq("status","forwarded_to_deputy").select("id");
      if(res.error)throw res.error;
      if(!res.data||!res.data.length)throw new Error("สถานะงานเปลี่ยนไปแล้ว กรุณารีเฟรชรายการ");
      await refresh();alert("ยกเลิกการส่งต่อแล้ว งานกลับมาอยู่ในรายการรอวิชาการตรวจ");
    }catch(e){alert("ยกเลิกไม่สำเร็จ: "+e.message);await refresh().catch(function(){})}
    finally{state.busy=false}
  };

  window.roleOpenRoom=function(cid){localStorage.setItem(ACTIVE_KEY,cid);sessionStorage.setItem("hnk_report_month",state.reportMonth);location.href="index.html"};

  window.roleReturnSubmission=async function(submissionId,level){
    var el=document.getElementById("comment-"+submissionId),comment=el?el.value.trim():"";
    if(!comment){alert("กรุณาเขียนความคิดเห็น/สิ่งที่ต้องแก้ไขก่อนส่งกลับ");return}
    var status=level==="academic"?"returned_by_academic":"returned_by_deputy",target=level==="academic"?"ครูประจำชั้น":"Academic";
    if(!confirm("ยืนยันส่งกลับให้ "+target+" แก้ไข?"))return;
    try{await addComment(submissionId,comment);var res=await sb.from("classroom_submissions").update({status:status,updated_at:new Date().toISOString()}).eq("id",submissionId);if(res.error)throw res.error;await refresh()}
    catch(e){alert("ดำเนินการไม่สำเร็จ: "+(e&&e.message?e.message:String(e)))}
  };

  window.roleApproveSubmission=async function(submissionId,level){
    if(!state.signatureReady){alert("กรุณาอัปโหลดลายเซ็นก่อนอนุมัติ");location.href="signature.html";return}
    var academic=level==="academic",status=academic?"forwarded_to_deputy":"approved";
    var msg=academic?"ยืนยันอนุมัติเดือนนี้และส่งต่อ Deputy Director? ระบบจะลงลายเซ็นของคุณในเล่มอัตโนมัติ":"ยืนยันอนุมัติขั้นสุดท้าย? ระบบจะลงลายเซ็นและบันทึกข้อมูลเดือนนี้เข้าคลังฐานข้อมูลของปีการศึกษาโดยอัตโนมัติ";
    if(!confirm(msg))return;
    try{var res=await sb.from("classroom_submissions").update({status:status,updated_at:new Date().toISOString()}).eq("id",submissionId);if(res.error)throw res.error;await refresh()}
    catch(e){alert("อนุมัติไม่สำเร็จ: "+(e&&e.message?e.message:String(e)))}
  };

  async function refresh(){
    var results=await Promise.all([
      sb.from("classroom_submissions").select("*").order("report_month",{ascending:false}).order("updated_at",{ascending:false}),
      sb.from("submission_comments").select("id,submission_id,comment,created_at,author_id").order("created_at",{ascending:false}),
      sb.from("classroom_monthly_archives").select("id,classroom_id,academic_year,term,report_month,approved_at").order("report_month",{ascending:false}),
      sb.from("user_signatures").select("user_id").eq("user_id",state.user.id).maybeSingle()
    ]);
    for(var i=0;i<3;i++)if(results[i].error)throw results[i].error;
    state.submissions=results[0].data||[];state.comments=results[1].data||[];state.archives=results[2].data||[];state.signatureReady=!!results[3].data;render();
  }

  window.startRoleDashboard=async function(requiredRole){
    state.requiredRole=requiredRole;
    try{
      if(!sb)throw new Error("Supabase client is not ready");
      var ok=await loadAll();if(!ok)return;
      document.getElementById("roomsLink").href="classrooms.html?rooms=1";
      if(state.requiredRole==="director")document.getElementById("roleHelp").textContent="ภาพรวมการส่งธุรการรายเดือนและสถานะการอนุมัติของทุกห้อง";
      else if(state.requiredRole==="academic")document.getElementById("roleHelp").textContent="ตรวจรายเดือน • ส่งกลับครู • อนุมัติและส่งต่อรองวิชาการ";
      else document.getElementById("roleHelp").textContent="ตรวจรายเดือน • ส่งกลับ Academic • อนุมัติขั้นสุดท้ายและจัดเก็บเข้าคลัง";
      var filters=document.getElementById("academicFilters");
      if(filters){
        document.getElementById("statusFilter").onchange=function(e){state.filter=e.target.value;render()};
        document.getElementById("roomSearch").oninput=function(e){state.search=e.target.value;render()};
        document.getElementById("refreshJobs").onclick=async function(){try{await refresh()}catch(e){alert("โหลดรายการไม่สำเร็จ: "+e.message)}};
      }
      showBody();render();
    }catch(e){console.error(e);fatal(e&&e.message?e.message:String(e))}
  };
})();

