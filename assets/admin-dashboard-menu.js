(async function(){
  "use strict";
  try{
    const sb=window.cloudClient;if(!sb)return;
    const session=await sb.auth.getSession();if(session.error||!session.data.session)return;
    const res=await sb.from("profiles").select("role").eq("id",session.data.session.user.id).single();
    if(res.error||res.data.role!=="admin")return;
    const choices=[['admin.html','จัดการระบบ Admin'],['classrooms.html?rooms=1','แดชบอร์ดครู — เลือกห้อง'],['academic-dashboard.html','แดชบอร์ดวิชาการ'],['deputy-dashboard.html','แดชบอร์ดรองวิชาการ'],['director-dashboard.html','แดชบอร์ดผู้อำนวยการ']];
    const current=location.pathname.split('/').pop();
    const nav=document.createElement('nav');nav.setAttribute('aria-label','เลือกแดชบอร์ดสำหรับ Admin');
    nav.className='admin-dashboard-nav';
    const label=document.createElement('label');label.textContent='Admin • เลือกเข้าชมแดชบอร์ด ';label.htmlFor='adminDashboardView';
    const select=document.createElement('select');select.id='adminDashboardView';select.style.cssText='font:inherit;padding:8px;max-width:100%';
    choices.forEach(([url,name])=>{const o=document.createElement('option');o.value=url;o.textContent=name;select.appendChild(o)});
    const match=choices.find(([url])=>url.split('?')[0]===current);select.value=match?match[0]:'classrooms.html?rooms=1';
    select.onchange=()=>{location.href=select.value};
    const note=document.createElement('span');note.textContent='สิทธิ์จริงยังเป็น Admin • หน้ารองวิชาการอนุมัติหรือส่งกลับได้ โดยใช้ชื่อและลายเซ็นของ Admin ผู้ดำเนินการ';
    nav.append(label,select,note);document.body.prepend(nav);
  }catch(e){console.error('โหลดเมนูแดชบอร์ด Admin ไม่สำเร็จ',e)}
})();

