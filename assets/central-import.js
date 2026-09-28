(()=>{'use strict';
function parse(text,start=1){
 const rows=[],errors=[],codes=new Set(),numbers=new Set();
 const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  if(!lines[i].trim())continue;
  const cols=lines[i].split('\t').map(s=>s.trim());
  if(!rows.length&&/^(เลขที่|รหัส|เลขประจำตัว)/.test(cols[0])&&cols.some(c=>/ชื่อ/.test(c)))continue;
  const numbered=cols.length>=3&&/^\d+$/.test(cols[0])&&/^\d+$/.test(cols[1]);
  const code=cols[numbered?1:0]||'',name=cols.slice(numbered?2:1).filter(Boolean).join(' '),order=numbered?Number(cols[0]):start+rows.length;
  if(!code||code.length>40||!name||name.length>160||!Number.isInteger(order)||order<1||order>999)errors.push('แถว '+(i+1)+': ต้องมีรหัสนักเรียนและชื่อ และเลขที่ 1–999');
  if(codes.has(code))errors.push('แถว '+(i+1)+': รหัสนักเรียนซ้ำ '+code);
  if(numbers.has(order))errors.push('แถว '+(i+1)+': เลขที่ซ้ำ '+order);
  codes.add(code);numbers.add(order);rows.push({student_code:code,full_name:name,sort_order:order});
 }
 if(!rows.length)errors.push('กรุณาวางรายชื่อนักเรียน');
 if(rows.length>200)errors.push('วางได้ครั้งละไม่เกิน 200 คน');
 return {rows,errors};
}
window.CentralImport={parse};})();

