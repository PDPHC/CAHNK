(()=>{'use strict';
 const groups=[{name:'ด้านการอ่าน',items:['อ่านจับใจความ','จัดลำดับเรื่อง','สรุปใจความสำคัญ','แสดงความคิดเห็น','รักการอ่าน','เลือกอ่านหนังสือ','มารยาทการอ่าน']},{name:'ด้านการคิดวิเคราะห์',items:['การคาดคะเน','การวางแผน','การแก้ปัญหา','การให้เหตุผล','การตัดสินใจ','ความคิดริเริ่มสร้างสรรค์','การสร้างองค์ความรู้']},{name:'ด้านการเขียน',items:['เขียนแสดงความรู้ความคิดเห็น','จดบันทึกความรู้','รักการเขียน','มารยาทในการเขียน']}];
 const labels=['ไม่ผ่าน','ผ่าน','ดี','ดีเยี่ยม'];
 function value(raw){if(raw===null||String(raw).trim()==='')return null;const n=Number(String(raw).trim().replace(/[๐๑๒๓]/g,c=>'๐๑๒๓'.indexOf(c)));if(!Number.isInteger(n)||n<0||n>3)throw Error('คะแนนต้องเป็นจำนวนเต็ม 0–3 หรือเว้นว่าง');return n;}
 function summarize(values,method='average'){if(values.some(v=>v===null))return null;const n=method==='minimum'?Math.min(...values):Math.floor(values.reduce((a,b)=>a+b,0)/values.length);return labels[n];}
 function result(values,method){let at=0;return{groups:groups.map(g=>{const part=values.slice(at,at+g.items.length);at+=g.items.length;return summarize(part,method)}),overall:summarize(values,method)};}
 function validate(data){if(!data||data.scale!=='0-3'||!['average','minimum'].includes(data.method)||!data.scores||typeof data.scores!=='object'||Array.isArray(data.scores))throw Error('รูปแบบข้อมูลไม่ถูกต้อง');for(const scores of Object.values(data.scores)){if(!Array.isArray(scores)||scores.length!==18)throw Error('ต้องมีคะแนน 18 ข้อ');scores.forEach(v=>{if(v!==null&&(typeof v!=='number'||value(v)!==v))throw Error('คะแนนไม่ถูกต้อง')})}}
 window.PrimaryReadingModel={groups,labels,value,result,validate,blank:()=>Array(18).fill(null),empty:()=>({scale:'0-3',method:'average',scores:{}})};
})();
