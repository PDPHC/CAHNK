const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
(async()=>{
 const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});await page.setContent('<html><body class="theme-dark"></body></html>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'assets/theme.css'),'utf8')});await page.addScriptTag({path:path.join(root,'assets/pp5-copy.js')});
  const values=await page.evaluate(()=>PP5Copy.snapshot((s,r)=>({'D!C8':'ตัวชี้วัดทดสอบ','D!O8':'3','D!P8':' ','D!T8':2,'D!C61':'ตัวชี้วัด 23','D!N24':10,'D!O24':5,'IN!E3':30,'IN!C4':'STUDENT','IN!E4':99,'CH!G7':'/'}[s+'!'+r]??''),{__pp5_indicator_count:8,__pp5_deleted_indicators:[9]}));
  assert.equal(values['D!O8'],3);assert.equal(values['D!P8'],'');assert.equal(values['D!C61'],'ตัวชี้วัด 23');assert.deepEqual(values.__pp5_deleted_indicators,[9]);assert.equal(values.__pp5_indicator_count,8);assert.equal(values['D!N24'],10);
  assert.ok(!('IN!C4' in values)&&!('IN!E4' in values)&&!('CH!G7' in values),'student data must not be included');
  await page.evaluate(async values=>{
   window.calls=[];const client={rpc:async(name,args)=>{calls.push({name,args});return name==='pp5_indicator_copy_targets'?{data:[{id:'target',title:'สังคมศึกษา 1',class_level:'มัธยมศึกษาปีที่ 1',room:'2',revision:7}]}:{data:{revision:8}}}};
   await PP5Copy.open({client,sourceId:'source',sourceRevision:4,values});
  },values);
  assert.equal(await page.locator('select option').count(),1);assert.match(await page.locator('select option').innerText(),/มัธยมศึกษาปีที่ 1\/2/);
  await page.locator('[data-copy-apply]').click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('คัดลอกสำเร็จ'));
  const calls=await page.evaluate(()=>calls);assert.equal(calls[1].name,'pp5_copy_indicators');assert.equal(calls[1].args.p_target_revision,7);assert.equal(calls[1].args.p_source_revision,4);assert.deepEqual(calls[1].args.p_values,values);
  assert.ok(await page.locator('[data-copy-apply]').isDisabled());await page.locator('[data-copy-close]').click();assert.equal(await page.locator('dialog').count(),0);
  await page.evaluate(async()=>{
   const client={rpc:async name=>name==='pp5_indicator_copy_targets'?{data:[{id:'target',title:'วิชา',class_level:'ม.1',room:'2',revision:7}]}:{error:{message:'ข้อมูลเล่มเปลี่ยนแล้ว'}}};
   await PP5Copy.open({client,sourceId:'source',sourceRevision:4,values:{}});
  });
  await page.locator('[data-copy-apply]').click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent==='ข้อมูลเล่มเปลี่ยนแล้ว');assert.ok(await page.locator('[data-copy-apply]').isEnabled());
  console.log(JSON.stringify({passed:true,snapshotPreservesStudentData:true,extraIndicatorsCopied:8,targetRevisionChecked:true,conflictDisplayed:true,mobileDialog:true}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
