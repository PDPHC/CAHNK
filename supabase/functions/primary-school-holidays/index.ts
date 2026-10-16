import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const source='https://calendar.google.com/calendar/ical/th.th%23holiday%40group.v.calendar.google.com/public/basic.ics';
const allow=/ปีใหม่|จักรี|สงกรานต์|ฉัตรมงคล|พืชมงคล|วิสาข|มาฆ|อาสาฬ|เข้าพรรษา|เฉลิมพระชนม|วันแม่|วันพ่อ|นวมินทร|ปิยมหาราช|รัฐธรรมนูญ|สิ้นปี|หยุดพิเศษ|หยุดราชการ|สวรรคต|วันชาติ/;
const excluded=/แรงงาน|ธนาคาร/;
const fallbackSource='https://www.officeholidays.com/ics-all/thailand';
const translated:Record<string,string>={'international-new-years-day':'วันขึ้นปีใหม่','makha-bucha':'วันมาฆบูชา','chakri-day':'วันจักรี','songkran-festival':'วันสงกรานต์','thai-kings-coronation':'วันฉัตรมงคล','buddha-purnima':'วันวิสาขบูชา','royal-ploughing-ceremony':'วันพืชมงคล','hm-queens-birthday':'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี','asahna-bucha-day':'วันอาสาฬหบูชา','buddhist-lent':'วันเข้าพรรษา','hm-kings-birthday':'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว','hm-queen-mothers-birthday':'วันแม่แห่งชาติ','king-bhumibols-passing':'วันนวมินทรมหาราช','chulalongkorn-day':'วันปิยมหาราช','king-bhumibols-birthday':'วันพ่อแห่งชาติ','thailand-constitution-day':'วันรัฐธรรมนูญ','new-years-eve':'วันสิ้นปี'};
export function parseFallback(text:string,year:number){
 const result=new Map<string,{date:string,name:string}>();
 for(const block of text.replace(/\r?\n[ \t]/g,'').split('BEGIN:VEVENT').slice(1)){
  const start=block.match(/(?:^|\n)DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/),title=block.match(/(?:^|\n)SUMMARY[^:]*:([^\r\n]+)/)?.[1]||'',slug=block.match(/(?:^|\n)URL:https:\/\/www\.officeholidays\.com\/holidays\/thailand\/([^\r\n/]+)/)?.[1]||'';
  if(!start||Number(start[1])!==year||!translated[slug]||/Regional Holiday|Not a Public Holiday|Bank Holiday/i.test(title))continue;
  const date=start[1]+'-'+start[2]+'-'+start[3],name=(/in lieu|observed/i.test(title)?'วันหยุดชดเชย':'')+translated[slug];
  result.set(date,{date,name:result.has(date)?result.get(date)!.name+' / '+name:name});
 }
 const rows=[...result.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(rows.length<10||!rows.some(h=>/มาฆ/.test(h.name))||!rows.some(h=>/วิสาข/.test(h.name))||!rows.some(h=>/อาสาฬ/.test(h.name)))throw Error('แหล่งออนไลน์ยังไม่มีวันหยุดครบสำหรับปีนี้');
 return rows;
}
export function parseCalendar(text:string,year:number){
 const result=new Map<string,{date:string,name:string}>();
 for(const block of text.replace(/\r?\n[ \t]/g,'').split('BEGIN:VEVENT').slice(1)){
  const start=block.match(/(?:^|\n)DTSTART[^:]*:(\d{4})(\d{2})(\d{2})/),name=block.match(/(?:^|\n)SUMMARY[^:]*:([^\r\n]+)/)?.[1]?.replace(/\\,/g,',').replace(/\\n/g,' ').trim();
  if(!start||!name||Number(start[1])!==year||!allow.test(name)||excluded.test(name))continue;
  const date=start[1]+'-'+start[2]+'-'+start[3];result.set(date,{date,name});
 }
 // Buddhist Lent follows Asalha Bucha; some country feeds omit government-only days.
 for(const h of [...result.values()])if(/อาสาฬ/.test(h.name)&&!/ชดเชย/.test(h.name)){
  const day=new Date(h.date+'T00:00:00Z');day.setUTCDate(day.getUTCDate()+1);const date=day.toISOString().slice(0,10);
  if(!result.has(date))result.set(date,{date,name:'วันเข้าพรรษา'});
  if([0,6].includes(day.getUTCDay())){do{day.setUTCDate(day.getUTCDate()+1);}while([0,6].includes(day.getUTCDay())||result.has(day.toISOString().slice(0,10)));const sub=day.toISOString().slice(0,10);result.set(sub,{date:sub,name:'วันหยุดชดเชยวันเข้าพรรษา'});}
 }
 if(result.has(year+'-01-01'))result.set(year+'-01-01',{date:year+'-01-01',name:'วันขึ้นปีใหม่'});
 const rows=[...result.values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(rows.length<10||!rows.some(h=>/วิสาข/.test(h.name))||!rows.some(h=>/อาสาฬ/.test(h.name)))throw Error('แหล่งออนไลน์ยังไม่มีวันหยุดครบสำหรับปีนี้');
 return rows;
}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});try{
 const body=req.method==='POST'?await req.json():{},year=Number(body.year||new URL(req.url).searchParams.get('year'));
 if(!Number.isInteger(year)||year<2020||year>2100)return Response.json({error:'ปีไม่ถูกต้อง'},{status:400,headers:cors});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
 const cached=await db.from('pp5_school_holiday_cache').select('*').eq('year',year).maybeSingle();if(cached.error)throw cached.error;
 let row=cached.data;
 if(!row||Date.now()-Date.parse(row.updated_at)>86400000){
  let holidays,usedSource=source;
  try{const response=await fetch(source,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('เชื่อมปฏิทินวันหยุดออนไลน์ไม่ได้');holidays=parseCalendar(await response.text(),year);}
  catch{const response=await fetch(fallbackSource,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('เชื่อมปฏิทินวันหยุดออนไลน์ไม่ได้');holidays=parseFallback(await response.text(),year);usedSource=fallbackSource;}
  row={year,holidays,source:usedSource,updated_at:new Date().toISOString()};
  const saved=await db.from('pp5_school_holiday_cache').upsert(row);if(saved.error)throw saved.error;
 }
 return Response.json(row,{headers:cors});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'โหลดวันหยุดไม่สำเร็จ'},{status:502,headers:cors});}});
