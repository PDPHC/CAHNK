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
  const patches={__pp5_indicator_count:8,'IN!Q7':'QA-CURRENT-COURSE','IN!Q8':'ข้อมูลปัจจุบันจากหน้ากรอก','IN!Q23':'ม.1/1'};for(let i=0;i<8;i++){const row=54+i;Object.assign(patches,{['D!C'+row]:'ตัวชี้วัดเพิ่มเติม '+(i+1),['D!O'+row]:1,['D!P'+row]:2,['D!Q'+row]:1,['D!R'+row]:1,['D!T'+row]:2})}
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'D',title:'QA',patches,holidays:[],signatures:{}});
  assert.equal(await page.locator('.paper').count(),1,'23 indicators should fit on one page');
  assert.equal(await page.locator('.indicator-appendix').count(),0,'no continuation page should be added');
  assert.equal(await page.locator('.print-page-number').innerText(),'หน้า : 1');
  for(let i=0;i<8;i++){
   const cell=page.locator(`[data-ref="D!C${54+i}"]`);
   assert.equal(await cell.innerText(),`ตัวชี้วัดเพิ่มเติม ${i+1}`);
   assert.ok(parseFloat(await cell.evaluate(el=>el.style.height))>0,'inline row should have height');
  }
  const positions=await page.evaluate(()=>{const top=ref=>document.querySelector(`[data-ref="D!${ref}"]`).getBoundingClientRect().top;const sheet=document.querySelector('.sheet'),font=parseFloat(document.querySelector('[data-ref="D!C54"]').style.fontSize),scale=Number(sheet.style.transform.match(/scale\(([^)]+)\)/)[1]);return{item15:top('C22'),item16:top('C54'),item23:top('C61'),totals:top('B24'),effectiveFont:font*scale,text:document.querySelector('.paper').innerText}});
  assert.ok(positions.item15<positions.item16&&positions.item16<positions.item23&&positions.item23<positions.totals,'items 16–23 must continue directly after 15, before the totals');
  assert.ok(positions.effectiveFont>=8.5,'indicator text should remain readable at print scale');
  assert.match(positions.text,/QA-CURRENT-COURSE/);assert.match(positions.text,/ข้อมูลปัจจุบันจากหน้ากรอก/);
  const printNo=page.locator('.print-page-number');assert.ok(parseFloat(await printNo.evaluate(el=>getComputedStyle(el).top))>0);assert.ok(parseFloat(await printNo.evaluate(el=>getComputedStyle(el).right))>0);
  await page.screenshot({path:path.join(__dirname,'pp5-print-layout-qa.png'),fullPage:true});
  const summaryPatches={};for(let i=0;i<22;i++)Object.assign(summaryPatches,{['IN!C'+(i+4)]:'TEST'+(i+1),['IN!D'+(i+4)]:'นักเรียนทดสอบ '+(i+1),['IN!L'+(i+4)]:11,['F!CS'+(i+7)]:[50,57,60][i]??70});
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'E',title:'Grade summary QA',patches:summaryPatches,holidays:[],signatures:{}});
  assert.equal(await page.locator('.paper').count(),1);
  assert.deepEqual(await page.locator('[data-ref="E!F9"],[data-ref="E!F10"],[data-ref="E!F11"]').evaluateAll(cells=>cells.map(cell=>cell.innerText)),['1','1.5','2'],'printed grades must match the score shown in the table');
  const summaryCell=page.locator('[data-ref="E!C9"]');assert.ok(parseFloat(await summaryCell.evaluate(el=>el.style.height))>14.4,'sparse roster row should have modest extra room');assert.ok(parseFloat(await summaryCell.evaluate(el=>el.style.height))<=21.6,'sparse roster rows must not stretch excessively');
  assert.equal(await summaryCell.evaluate(el=>el.style.fontSize),'13pt');assert.equal(await summaryCell.evaluate(el=>el.style.lineHeight),'1.15');
  const verticalGap=await summaryCell.evaluate(el=>{const cell=el.getBoundingClientRect(),text=el.firstChild.getBoundingClientRect();return Math.min(text.top-cell.top,cell.bottom-text.bottom)});assert.ok(verticalGap>=2,'Thai text should have space above and below inside the table row');
  await page.screenshot({path:path.join(os.tmpdir(),'pp5-sparse-layout-qa.png'),fullPage:true});
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'B',title:'Attendance QA',patches:{'IN!C4':'TEST1','IN!D4':'นักเรียนทดสอบ'},holidays:[],signatures:{}});
  assert.equal(await page.locator('.paper').count(),3);assert.deepEqual(await page.locator('.print-page-number').allInnerTexts(),['หน้า : 1','หน้า : 2','หน้า : 3']);
  const pdf=await page.pdf({path:path.join(os.tmpdir(),'pp5-print-layout-qa.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});assert.ok(pdf.byteLength>10000,'PDF should be generated');
  console.log(JSON.stringify({passed:'all',indicators:23,indicatorPages:1,indicatorOrder:'16–23 immediately after 15',indicatorFontPt:positions.effectiveFont,currentDataLinked:true,attendancePages:3,pageNumbers:'consistent top-right',printedGrades:'50→1, 57→1.5, 60→2',summaryFontPt:13,summaryRowGrowth:'capped at 1.5x',pdfBytes:pdf.byteLength}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
