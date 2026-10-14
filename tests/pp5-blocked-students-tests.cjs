const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage();
  await page.setContent('<body><section id="pp5Panel"></section></body>');
  for(const file of ['pp5-entry.css','theme.css'])await page.addStyleTag({path:path.join(root,'assets',file)});
  for(const file of ['student-status.js','pp5-entry.js'])await page.addScriptTag({path:path.join(root,'assets',file)});
  const paste=fs.readFileSync(path.join(root,'assets/app.js'),'utf8').split('function parsePastedGrid')[1].split('const get=')[0];
  await page.addScriptTag({content:'function parsePastedGrid'+paste});
  for(const sheet of ['IN','F']){
   await page.evaluate(sheet=>{
    const statuses=['normal','transferred','not_present','special'];window.changes=[];
    const panel=document.getElementById('pp5Panel');
    panel.innerHTML='<table class="pp5-table"><tbody>'+statuses.map((status,i)=>'<tr><td class="pp5-student-name">Student '+i+'</td><td><input value="'+(10+i)+'" data-sheet="'+sheet+'" data-ref="'+(sheet==='IN'?'E'+(4+i):'H'+(7+i))+'"></td><td data-auto-score="CV'+(7+i)+'"></td></tr>').join('')+'</tbody></table>';
    PP5Entry.lockStudentRows(panel,(s,ref)=>StudentStatus.blocked({record_status:statuses[Number(ref.match(/\d+$/)[0])-(s==='IN'?4:7)]}));
    panel.addEventListener('input',e=>changes.push(e.target.dataset.ref),{once:false});
   },sheet);
   assert.deepEqual(await page.locator('input').evaluateAll(els=>els.map(el=>el.disabled)),[false,true,true,false]);
   assert.equal(await page.locator('.pp5-blocked-row').count(),2);
   await page.locator('input').first().evaluate(el=>{const e=new Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(e,'clipboardData',{value:{getData:()=> '20\n21\n22\n23'}});el.dispatchEvent(e)});
   assert.deepEqual(await page.locator('input').evaluateAll(els=>els.map(el=>el.value)),['20','11','12','23']);
   for(const dark of [false,true]){
    await page.evaluate(dark=>document.body.classList.toggle('theme-dark',dark),dark);
    const colors=await page.locator('.pp5-blocked-row').first().evaluate(row=>({cell:getComputedStyle(row.cells[0]).backgroundColor,input:getComputedStyle(row.querySelector('input')).backgroundColor,text:getComputedStyle(row.querySelector('input')).color}));
    assert.equal(colors.cell,dark?'rgb(69, 69, 75)':'rgb(226, 226, 226)');assert.equal(colors.input,colors.cell);
    assert.equal(colors.text,dark?'rgb(238, 238, 238)':'rgb(85, 85, 85)');
   }
   await page.evaluate(()=>document.body.classList.remove('theme-dark'));
  }
  console.log('PASS: transferred and not-present rows locked; normal and special editable; Excel paste skips locked rows; grey rows in light and dark themes; total and detail scores');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
