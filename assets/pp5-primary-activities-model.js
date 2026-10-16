(()=>{'use strict';
 const items=['แนะแนว','ลูกเสือ เนตรนารี','ชุมนุม','กิจกรรมเพื่อสังคมและสาธารณประโยชน์'];
 const labels={pass:'ผ่าน',fail:'ไม่ผ่าน'};
 function value(raw){const s=String(raw??'').trim().toLowerCase();if(!s)return null;if(['ผ่าน','ผ','1','pass'].includes(s))return 'pass';if(['ไม่ผ่าน','มผ','มผ.','0','fail'].includes(s))return 'fail';throw Error('กรอกเฉพาะ ผ่าน / ไม่ผ่าน หรือเว้นว่าง');}
 function result(values){if(values.includes('fail'))return 'ไม่ผ่าน';return values.length===4&&values.every(v=>v==='pass')?'ผ่าน':null;}
 function validate(data){if(!data||data.version!==1||!data.scores||typeof data.scores!=='object'||Array.isArray(data.scores))throw Error('รูปแบบข้อมูลกิจกรรมไม่ถูกต้อง');for(const values of Object.values(data.scores)){if(!Array.isArray(values)||values.length!==4||values.some(v=>v!==null&&!Object.hasOwn(labels,v)))throw Error('ต้องมีผลกิจกรรม 4 รายการ เป็น ผ่าน / ไม่ผ่าน หรือเว้นว่าง');}}
 window.PrimaryActivitiesModel={items,labels,value,result,validate,blank:()=>Array(4).fill(null),empty:()=>({version:1,scores:{}})};
})();
