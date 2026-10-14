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
  await page.addScriptTag({path:path.join(root,'assets/pp5-assessment.js')});
  await page.evaluate(data=>{window.fetch=async()=>({ok:true,json:async()=>data})},packed);
  let source=fs.readFileSync(path.join(root,'assets/pp5-print.js'),'utf8');source=source.replace("button.addEventListener('click',()=>window.print());","window.__renderPP5Print=render;button.addEventListener('click',()=>window.print());");
  await page.addScriptTag({content:source});
  const patches={__pp5_indicator_count:8,'IN!Q7':'QA-CURRENT-COURSE','IN!Q8':'ข้อมูลปัจจุบันจากหน้ากรอก','IN!Q23':'ม.1/1'};for(let i=0;i<8;i++){const row=54+i;Object.assign(patches,{['D!C'+row]:'ตัวชี้วัดเพิ่มเติม '+(i+1),['D!O'+row]:1,['D!P'+row]:2,['D!Q'+row]:1,['D!R'+row]:1,['D!T'+row]:2})}
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'D',title:'QA',patches,holidays:[],signatures:{}});
  assert.equal(await page.locator('.paper').count(),1,'23 indicators should fit on one page');
  assert.equal(await page.locator('.indicator-appendix').count(),0,'no continuation page should be added');
  assert.equal(await page.locator('.print-page-number').count(),0,'the first printed page must hide its number');
  for(let i=0;i<8;i++){
   const cell=page.locator(`[data-ref="D!C${54+i}"]`);
   assert.equal(await cell.innerText(),`ตัวชี้วัดเพิ่มเติม ${i+1}`);
   assert.ok(parseFloat(await cell.evaluate(el=>el.style.height))>0,'inline row should have height');
  }
  const positions=await page.evaluate(()=>{const top=ref=>document.querySelector(`[data-ref="D!${ref}"]`).getBoundingClientRect().top;const sheet=document.querySelector('.sheet'),font=parseFloat(document.querySelector('[data-ref="D!C54"]').style.fontSize),scale=Number(sheet.style.transform.match(/scale\(([^)]+)\)/)[1]);return{item15:top('C22'),item16:top('C54'),item23:top('C61'),totals:top('B24'),effectiveFont:font*scale,text:document.querySelector('.paper').innerText}});
  assert.ok(positions.item15<positions.item16&&positions.item16<positions.item23&&positions.item23<positions.totals,'items 16–23 must continue directly after 15, before the totals');
  assert.ok(positions.effectiveFont>=8.5,'indicator text should remain readable at print scale');
  assert.match(positions.text,/QA-CURRENT-COURSE/);assert.match(positions.text,/ข้อมูลปัจจุบันจากหน้ากรอก/);
  await page.screenshot({path:path.join(__dirname,'pp5-print-layout-qa.png'),fullPage:true});
  const summaryPatches={};for(let i=0;i<22;i++)Object.assign(summaryPatches,{['IN!C'+(i+4)]:'TEST'+(i+1),['IN!D'+(i+4)]:'นักเรียนทดสอบ '+(i+1),['IN!L'+(i+4)]:11,['F!CS'+(i+7)]:[50,57,60][i]??70});
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'E',title:'Grade summary QA',patches:summaryPatches,holidays:[],signatures:{}});
  assert.equal(await page.locator('.paper').count(),1);
  assert.deepEqual(await page.locator('[data-ref="E!F9"],[data-ref="E!F10"],[data-ref="E!F11"]').evaluateAll(cells=>cells.map(cell=>cell.innerText)),['1','1.5','2'],'printed grades must match the score shown in the table');
  const summaryCell=page.locator('[data-ref="E!C9"]');assert.ok(parseFloat(await summaryCell.evaluate(el=>el.style.height))>14.4,'sparse roster row should have modest extra room');assert.ok(parseFloat(await summaryCell.evaluate(el=>el.style.height))<=21.6,'sparse roster rows must not stretch excessively');
  assert.equal(await summaryCell.evaluate(el=>el.style.fontSize),'13pt');assert.equal(await summaryCell.evaluate(el=>el.style.lineHeight),'1.15');
  const verticalGap=await summaryCell.evaluate(el=>{const cell=el.getBoundingClientRect(),text=el.firstChild.getBoundingClientRect();return Math.min(text.top-cell.top,cell.bottom-text.bottom)});assert.ok(verticalGap>=2,'Thai text should have space above and below inside the table row');
  await page.screenshot({path:path.join(os.tmpdir(),'pp5-sparse-layout-qa.png'),fullPage:true});
  const coverPatches={};for(let i=0;i<22;i++)Object.assign(coverPatches,{['IN!C'+(i+4)]:'TEST'+(i+1),['IN!D'+(i+4)]:'นักเรียนทดสอบ '+(i+1),['IN!L'+(i+4)]:i<19?70:40,['F!CS'+(i+7)]:i<19?70:40});
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'A',title:'Cover summary QA',patches:coverPatches,holidays:[],signatures:{}});
  assert.deepEqual(await page.locator('[data-ref="A!I25"],[data-ref="A!M25"],[data-ref="A!I26"],[data-ref="A!M26"]').allInnerTexts(),['19','3','86.36','13.64']);
  for(const column of ['I','M']){
   const offset=await page.evaluate(c=>{const center=r=>{const b=document.querySelector(`[data-ref="A!${c}${r}"]`).firstChild.getBoundingClientRect();return (b.left+b.right)/2};return Math.abs(center(25)-center(26))},column);
   assert.ok(offset<1,'percentages must align directly under the corresponding pupil counts');
  }
  assert.equal(await page.locator('.print-page-number').count(),0);
  for(const ref of ['I25','M25','I26','M26']){
   const font=await page.locator(`[data-ref="A!${ref}"]`).evaluate(el=>{const scale=Number(el.closest('.sheet').style.transform.match(/scale\(([^)]+)\)/)[1]);return parseFloat(el.firstChild.style.fontSize||el.style.fontSize)*scale});
   assert.ok(font>=12,'pass/fail summary figures must remain readable at print scale');
  }
  const gpaOffset=await page.locator('[data-ref="A!O20"]').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.firstChild.getBoundingClientRect();return {x:Math.abs((a.left+a.right-b.left-b.right)/2),y:Math.abs((a.top+a.bottom-b.top-b.bottom)/2)}});
  assert.ok(gpaOffset.x<1&&gpaOffset.y<1,'GPA heading must be centered horizontally and vertically');
  await page.locator('.paper').screenshot({path:path.join(__dirname,'pp5-cover-summary-qa.png')});
  const attendancePatches={'W1!F5':46000,'W1!G5':0,'W1!H5':0,'W1!I5':0,'W1!J5':0};
  for(let i=0;i<3;i++)Object.assign(attendancePatches,{['IN!C'+(i+4)]:'TEST'+(i+1),['IN!D'+(i+4)]:'นักเรียนทดสอบ '+(i+1)});
  const column=n=>{let out='';for(;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out};
  for(let week=0;week<20;week++){const c=column(7+week*5);attendancePatches['CH!'+c+'7']=week<16?'/':'';attendancePatches['CH!'+c+'8']=week<15?'/':'';attendancePatches['CH!'+c+'9']='-'}
  await page.evaluate(data=>window.__renderPP5Print(data),{report:'B',title:'Attendance QA',patches:attendancePatches,holidays:[],signatures:{}});
  assert.deepEqual(await page.locator('[data-ref="B!DO11"],[data-ref="B!DO12"],[data-ref="B!DO13"]').allInnerTexts(),['','มส.',''],'80% and exempt attendance stay blank; below 80% prints มส.');
  assert.equal(await page.locator('.paper').count(),3);assert.deepEqual(await page.locator('.print-page-number').allInnerTexts(),['หน้า : 2','หน้า : 3']);
  assert.equal(await page.locator('.paper').first().locator('.print-page-number').count(),0);
  const printNo=page.locator('.print-page-number').first();assert.ok(parseFloat(await printNo.evaluate(el=>getComputedStyle(el).top))>0);assert.ok(parseFloat(await printNo.evaluate(el=>getComputedStyle(el).right))>0);
  const remark=page.locator('[data-ref="B!DO6"]');assert.equal(await remark.innerText(),'หมายเหตุ');
  assert.match(await remark.evaluate(el=>el.firstChild.style.transform),/rotate\(-90deg\)/);
  const remarkBounds=await remark.evaluate(el=>{const cell=el.getBoundingClientRect(),text=el.firstChild.getBoundingClientRect();return {inside:text.left>=cell.left&&text.right<=cell.right&&text.top>=cell.top&&text.bottom<=cell.bottom,vertical:text.height>text.width}});assert.ok(remarkBounds.inside&&remarkBounds.vertical,'the vertical remarks heading must fit inside its cell');
  await page.locator('.paper').nth(2).screenshot({path:path.join(__dirname,'pp5-attendance-remark-qa.png')});
  const pdf=await page.pdf({path:path.join(os.tmpdir(),'pp5-print-layout-qa.pdf'),format:'A4',printBackground:true,preferCSSPageSize:true});assert.ok(pdf.byteLength>10000,'PDF should be generated');
  console.log(JSON.stringify({passed:'all',indicators:23,indicatorPages:1,indicatorOrder:'16–23 immediately after 15',indicatorFontPt:positions.effectiveFont,currentDataLinked:true,attendancePages:3,pageNumbers:'consistent top-right',printedGrades:'50→1, 57→1.5, 60→2',summaryFontPt:13,summaryRowGrowth:'capped at 1.5x',pdfBytes:pdf.byteLength}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
