const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
(async()=>{
 const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),source=fs.readFileSync(path.join(root,'modules/pp5.html'),'utf8');
  const styles=[...source.matchAll(/<link[^>]*href="\.\.\/(assets\/[^"?]+)[^"]*"/g)].map(m=>m[1]);
  await page.setContent(source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,''));
  for(const file of [...styles,'assets/theme.css'])await page.addStyleTag({content:fs.readFileSync(path.join(root,file),'utf8')});
  await page.evaluate(()=>{
   document.body.classList.add('modern-system','theme-dark');
   document.body.classList.remove('cloud-protected');
   document.getElementById('emptyBook').hidden=true;document.getElementById('bookEditor').hidden=false;
   document.getElementById('pp5RoomLabel').textContent='มัธยมศึกษาปีที่ 1/1 • ปีการศึกษา 2569 • ภาคเรียน 1';
   document.getElementById('bookMeta').textContent='แม่แบบ ปพ.5 โรงเรียน.xlsx';
   document.getElementById('bookHeading').textContent='ส21101 · สังคมศึกษา 1';
   document.getElementById('saveState').textContent='บันทึกล่าสุด 14/10/2569';
   const bar=document.createElement('div');bar.id='cloudUserBar';bar.className='cloud-userbar';bar.innerHTML='<div><strong>preedapong</strong> <span class="cloud-role">Admin</span> <span class="cloud-room">ห้อง มัธยมศึกษาปีที่ 1/1</span> <span id="cloudSyncStatus" class="cloud-sync-status ok">เชื่อมต่อ Cloud แล้ว</span></div><div class="cloud-user-actions"><button class="btn gray">จัดการผู้ใช้/สิทธิ์</button><button class="btn danger">ออกจากระบบ</button></div>';
   document.querySelector('.content').prepend(bar);
   document.getElementById('pp5Panel').innerHTML='<div class="pp5-max"><label>เต็ม: ก่อนกลางภาค<input value="30" readonly></label></div><div class="table-wrap"><table class="pp5-table term-attendance"><thead><tr><th><button class="mark-date">มาทุกคน</button></th><th class="pp5-non-teaching">คาบ 2 ไม่มีวันสอน</th><th class="pp5-holiday">วันหยุด</th></tr></thead><tbody><tr><td><button data-delete-indicator="8">ลบ</button></td><td class="pp5-non-teaching">—</td><td class="pp5-holiday"><span class="holiday-label">วันหยุด</span></td></tr></tbody></table></div>';
  });
  const selectors=['#pp5RoomLabel','.cloud-room','#cloudSyncStatus','.pp5-eyebrow','.editor-brand small','.pp5-selector small','#bookMeta','#saveState','#exportBook','#exportPdf','#saveBook','.cloud-user-actions .btn.gray','.cloud-user-actions .btn.danger','.pp5-tabs button.active','.pp5-tabs button:not(.active)','.report-drawer summary','#pp5Panel .pp5-max label','[data-delete-indicator]','.mark-date','th.pp5-non-teaching','td.pp5-non-teaching','th.pp5-holiday','.holiday-label'];
  const check=async()=>page.evaluate(selectors=>{
   const parse=value=>value.match(/[\d.]+/g).map(Number),blend=(fg,bg)=>[0,1,2].map(i=>fg[i]*(fg[3]??1)+bg[i]*(1-(fg[3]??1)));
   const background=el=>{const layers=[];for(let p=el;p;p=p.parentElement)layers.unshift(parse(getComputedStyle(p).backgroundColor));return layers.reduce((bg,fg)=>blend(fg,bg),[255,255,255])};
   const lum=rgb=>rgb.map(n=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4}).reduce((n,c,i)=>n+c*[.2126,.7152,.0722][i],0);
   return selectors.map(selector=>{const el=document.querySelector(selector),style=getComputedStyle(el),bg=background(el),fg=blend(parse(style.color),bg),opacity=Number(style.opacity),actual=fg.map((n,i)=>n*opacity+bg[i]*(1-opacity)),a=lum(actual),b=lum(bg);return {selector,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),color:style.color,background:style.backgroundColor}});
  },selectors);
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
   await page.setViewportSize(viewport);
   for(const selector of selectors)assert.ok(await page.locator(selector).first().isVisible(),selector+' should be visible when measuring contrast');
   for(const item of await check())assert.ok(item.contrast>=4.5,`${viewport.width}px: ${item.selector} has contrast ${item.contrast.toFixed(2)} (${item.color} on ${item.background})`);
   await page.screenshot({path:path.join(__dirname,`theme-contrast-${viewport.width}-qa.png`),fullPage:true});
  }
  await page.evaluate(()=>{document.getElementById('exportBook').disabled=true;document.getElementById('exportPdf').disabled=true});
  for(const item of (await check()).filter(item=>['#exportBook','#exportPdf'].includes(item.selector)))assert.ok(item.contrast>=4.5,'disabled export buttons should remain readable');
  await page.evaluate(()=>document.body.classList.remove('theme-dark'));
  const light=await page.locator('#pp5RoomLabel').evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
  assert.equal(light.background,'rgb(238, 231, 247)','the dark overrides must not change the light room label');
  console.log(JSON.stringify({passed:true,contrastSamples:selectors.length*2+2,minimumRatio:4.5,desktopAndMobile:true,lightModePreserved:true}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
