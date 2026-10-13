const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
const fs=require('node:fs');
(async()=>{
 const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe',browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 try{
  const page=await browser.newPage();await page.setContent(`<!doctype html><meta charset="utf-8"><table id="raw"><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td><input></td><td><input></td></tr><tr><td><input></td><td><input></td></tr></tbody></table><table id="headed"><thead><tr><th>เลขที่</th><th>เลขประจำตัว</th><th>ชื่อ-สกุล</th><th>ก่อนกลางภาค</th><th>กลางภาค</th><th>แก้</th></tr></thead><tbody><tr><td>1</td><td><input value="old-id"></td><td>นักเรียน</td><td><input></td><td><input></td><td><input></td></tr></tbody></table><table id="controls"><thead><tr><th>เข้าร่วม</th><th>ผล</th></tr></thead><tbody><tr><td><input type="checkbox"></td><td><select><option value=""></option><option value="/">เข้าร่วม</option><option value="ข">ขาด</option></select></td></tr></tbody></table>`);
  await page.evaluate(()=>{Object.defineProperty(window,'localStorage',{value:{getItem(){return null},setItem(){}}});Object.defineProperty(window,'sessionStorage',{value:{getItem(){return null},setItem(){}}})});
  await page.addScriptTag({path:path.resolve(__dirname,'../assets/app.js')});
  const paste=async(selector,text)=>page.locator(selector).evaluate((el,value)=>{const data=new DataTransfer();data.setData('text/plain',value);el.focus();el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}))},text);
  await paste('#raw tbody tr:first-child td:first-child input','1\t2\r\n3\t4\r\n');
  assert.deepEqual(await page.locator('#raw input').evaluateAll(els=>els.map(el=>el.value)),['1','2','3','4']);
  await paste('#headed tbody td:nth-child(2) input','เลขประจำตัว\tก่อนกลางภาค\tกลางภาค\tแก้\r\n4118\t18\t20\t5\r\n');
  assert.deepEqual(await page.locator('#headed tbody input').evaluateAll(els=>els.map(el=>el.value)),['4118','18','20','5']);
  await paste('#controls tbody input[type=checkbox]','เข้าร่วม\tผล\r\nTRUE\tเข้าร่วม\r\n');
  assert.equal(await page.locator('#controls input[type=checkbox]').isChecked(),true);assert.equal(await page.locator('#controls select').inputValue(),'/');
  console.log(JSON.stringify({passed:4,rawGrid:'2x2',headerMatchedGrid:'ID and three score fields',checkboxAndSelect:'mapped'}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
