(()=>{'use strict';const labels={normal:'ปกติ',transferred:'ย้ายออก',not_present:'ไม่มีตัวตน',special:'นักเรียนพิเศษ'};const blocked=s=>['transferred','not_present'].includes(s?.record_status);const name=s=>(s?.name??s?.full_name??'')+(s?.record_status==='special'?' ★ (นักเรียนพิเศษ)':blocked(s)?' ('+labels[s.record_status]+')':'');window.StudentStatus={labels,blocked,name};})();

