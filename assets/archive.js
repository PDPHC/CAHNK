(function(){
  "use strict";
  var sb=window.cloudClient,ACTIVE_KEY="hnk_cloud_active_classroom";
  var MONTHS=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  var allowed=["director","deputy_director","admin","academic"],state={user:null,profile:null,rows:[]};
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]})}
  function monthKey(v){return String(v||"").slice(0,7)}
  function monthLabel(v){var p=monthKey(v).split("-");return p.length===2?MONTHS[Number(p[1])-1]+" "+(Number(p[0])+543):v}
  function thaiDate(v){if(!v)return "-";var d=new Date(v);return d.toLocaleString("th-TH",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
  function roomLabel(r){return (r&&r.class_level?r.class_level:"")+"/"+(r&&r.room?r.room:"")}
  function show(){document.body.classList.remove("cloud-protected")}
  function renderFilters(){
    var years=[...new Set(state.rows.map(function(x){return String(x.academic_year)}))].sort().reverse();
    var terms=[...new Set(state.rows.map(function(x){return String(x.term)}))].sort();
    var months=[...new Set(state.rows.map(function(x){return monthKey(x.report_month)}))].sort().reverse();
    document.getElementById("archiveYear").innerHTML='<option value="">ทุกปีการศึกษา</option>'+years.map(function(x){return '<option>'+esc(x)+'</option>'}).join("");
    document.getElementById("archiveTerm").innerHTML='<option value="">ทุกภาคเรียน</option>'+terms.map(function(x){return '<option>'+esc(x)+'</option>'}).join("");
    document.getElementById("archiveMonth").innerHTML='<option value="">ทุกเดือน</option>'+months.map(function(x){return '<option value="'+x+'">'+esc(monthLabel(x))+'</option>'}).join("");
  }
  function render(){
    var y=document.getElementById("archiveYear").value,t=document.getElementById("archiveTerm").value,m=document.getElementById("archiveMonth").value;
    var rows=state.rows.filter(function(x){return (!y||String(x.academic_year)===y)&&(!t||String(x.term)===t)&&(!m||monthKey(x.report_month)===m)});
    document.getElementById("archiveCount").textContent=rows.length+" รายการ";
    document.getElementById("archiveList").innerHTML=rows.length?rows.map(function(x){
      var r=x.classrooms||{},late=x.submitted_at&&x.due_date?(new Date(x.submitted_at)>new Date(x.due_date+"T23:59:59")):false;
      return '<article class="archive-card"><div><h3>'+esc(roomLabel(r))+' • '+esc(monthLabel(x.report_month))+'</h3>'+
      '<div class="sub">ภาคเรียนที่ '+esc(x.term)+' ปีการศึกษา '+esc(x.academic_year)+'</div>'+
      '<div class="archive-meta"><span>ส่ง: '+esc(thaiDate(x.submitted_at))+(late?' • ล่าช้า':'')+'</span><span>Academic: '+esc(x.academic_approved_name||"-")+'</span><span>Deputy: '+esc(x.approved_name||"-")+'</span><span>อนุมัติ: '+esc(thaiDate(x.approved_at))+'</span></div></div>'+
      '<div class="actions"><button class="btn gray" onclick="archiveOpenRoom(\''+x.classroom_id+'\')">เปิดห้องปัจจุบัน</button><button class="btn gray" onclick="archiveDownload(\''+x.id+'\')">ดาวน์โหลดข้อมูลที่อนุมัติ</button></div></article>';
    }).join(""):'<div class="empty-room-state">ไม่พบข้อมูลที่อนุมัติในตัวกรองนี้</div>';
  }
  window.archiveOpenRoom=function(cid){localStorage.setItem(ACTIVE_KEY,cid);location.href="index.html"};
  window.archiveDownload=function(id){
    var x=state.rows.find(function(r){return r.id===id});if(!x)return;
    var blob=new Blob([JSON.stringify(x.snapshot,null,2)],{type:"application/json;charset=utf-8"});
    var a=document.createElement("a"),url=URL.createObjectURL(blob);
    a.href=url;a.download="classroom-archive-"+monthKey(x.report_month)+"-"+String((x.classrooms||{}).class_level||"room")+"-"+String((x.classrooms||{}).room||"")+".json";
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  };
  window.archiveRender=render;
  window.startArchivePage=async function(){
    try{
      var s=await sb.auth.getSession();if(s.error)throw s.error;state.user=s.data.session?s.data.session.user:null;if(!state.user){location.href="login.html";return}
      var p=await sb.from("profiles").select("id,email,display_name,role").eq("id",state.user.id).single();if(p.error)throw p.error;state.profile=p.data;
      if(allowed.indexOf(state.profile.role)<0){location.href="classrooms.html";return}
      var q=await sb.from("classroom_monthly_archives")
        .select("id,submission_id,classroom_id,academic_year,term,report_month,due_date,submitted_at,academic_approved_name,academic_approved_at,approved_name,approved_at,snapshot,classrooms(id,class_level,room,school_name)")
        .order("academic_year",{ascending:false}).order("term",{ascending:false}).order("report_month",{ascending:false});
      if(q.error)throw q.error;state.rows=q.data||[];
      document.getElementById("archiveUser").textContent=state.profile.display_name||state.profile.email||"";
      var back={director:"director-dashboard.html",deputy_director:"deputy-dashboard.html",academic:"academic-dashboard.html"}[state.profile.role]||"classrooms.html?rooms=1";
      document.getElementById("archiveBack").href=back;
      renderFilters();show();render();
    }catch(e){show();document.getElementById("archiveList").innerHTML='<div class="role-fatal">'+esc(e.message||String(e))+'</div>'}
  };
})();