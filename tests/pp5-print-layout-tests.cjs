const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
(async()=>{
 const packed=JSON.parse(fs.readFileSync(path.join(root,'assets/pp5-print-template.json'),'utf8'));
 const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 try{
  const page=await browser.newPage();await page.setContent('<!doctype html><html><head></head><body><header><button id="printButton" disabled></button></header><p id="printStatus"></p><main id="pages"></main></body></html>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'assets/pp5-print.css'),'utf8')});
  await page.addScriptTag({path:path.join(root,'assets/vendor/jszip-3.10.1.min.js')});
  await page.addScriptTag({path:path.join(root,'assets/pp5-calc.js')});
  await page.evaluate(data=>{window.fetch=async()=>({ok:true,json:async()=>data})},packed);
  let source=fs.readFileSync(path.join(root,'assets/pp5-print.js'),'utf8');source=source.replace("button.addEventListener('click',()=>window.print());","window.__renderPP5Print=render;button.addEventListener('click',()=>window.print());");
  await page.addScriptTag({content:source});
  const patches={__pp5_indicator_count:8};for(let i=0;i<8;i++){const row=54+i;Object.assign(patches,{['D!C'+row]:'ตัวชี้วัดเพิ่มเติม '+(i+1),['D!O'+row]:1,['D!P'+row]:2,['D!Q'+row]:1,['D!R'+row]:1,['D!T'+row]:2})}
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'D',title:'QA',patches,holidays:[],signatures:{}});
  assert.equal(await page.locator('.paper').count(),1,'23 indicators should fit on one page');
  assert.equal(await page.locator('.indicator-appendix').count(),0,'no continuation page should be added');
  assert.equal(await page.locator('.print-page-number').innerText(),'หน้า : 1');
  for(let row=43;row<51;row++){
   assert.equal(await page.locator(`[data-ref="D!C${row}"]`).innerText(),`ตัวชี้วัดเพิ่มเติม ${row-42}`);
   assert.ok(parseFloat(await page.locator(`[data-ref="D!C${row}"]`).evaluate(el=>el.style.height))>0,'inline row should have height');
  }
  const printNo=page.locator('.print-page-number');assert.ok(parseFloat(await printNo.evaluate(el=>getComputedStyle(el).top))>0);assert.ok(parseFloat(await printNo.evaluate(el=>getComputedStyle(el).right))>0);
  await page.screenshot({path:path.join(os.tmpdir(),'pp5-print-layout-qa.png'),fullPage:true});
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'E',title:'Sparse QA',patches:{'IN!C4':'TEST1','IN!D4':'นักเรียนทดสอบ','IN!L4':70},holidays:[],signatures:{}});
  assert.equal(await page.locator('.paper').count(),1);assert.ok(parseFloat(await page.locator('[data-ref="E!C9"]').evaluate(el=>el.style.height))>14.4,'sparse roster row should expand');
  await page.screenshot({path:path.join(os.tmpdir(),'pp5-sparse-layout-qa.png'),fullPage:true});
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'B',title:'Attendance QA',patches:{'IN!C4':'TEST1','IN!D4':'นักเรียนทดสอบ'},holidays:[],signatures:{}});
  assert.equal(await page.locator('.paper').count(),3);assert.deepEqual(await page.locator('.print-page-number').allInnerTexts(),['หน้า : 1','หน้า : 2','หน้า : 3']);
  const pdf=await page.pdf({path:path.join(os.tmpdir(),'pp5-print-layout-qa.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});assert.ok(pdf.byteLength>10000,'PDF should be generated');
  console.log(JSON.stringify({passed:27,indicators:23,indicatorPages:1,attendancePages:3,pageNumbers:'consistent top-right',sparseRoster:'expanded',pdfBytes:pdf.byteLength}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
