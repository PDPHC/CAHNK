const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
(async()=>{
 const browser=await chromium.launch({headless:true,...(fs.existsSync(chrome)?{executablePath:chrome}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link data-theme-styles="true"></head><body class="modern-system pp5-workspace"><header class="editor-header"><a class="editor-brand">ปพ.5</a><a class="editor-back">กลับ</a></header><aside class="sidebar" style="display:none">เมนู</aside><section class="review-card" style="display:none">การ์ด</section><div class="app"><main class="content"><section class="pp5-form-panel"><div class="table-wrap"><table class="pp5-table"><tbody><tr><td>ข้อมูลทดสอบ</td></tr></tbody></table></div></section></main></div></body></html>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'assets/app.css'),'utf8')});
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'assets/pp5-editor.css'),'utf8')});
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'assets/theme.css'),'utf8')});
  await page.evaluate(()=>{const data=new Map();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value))}});localStorage.setItem('cahnk-color-theme','dark')});
  const source=fs.readFileSync(path.join(root,'assets/theme.js'),'utf8');await page.addScriptTag({content:source});await page.waitForSelector('#themeToggle');
  assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('theme-dark')),'dark mode should load from the saved preference');
  assert.equal(await page.locator('#themeToggle').getAttribute('aria-label'),'เปลี่ยนเป็นโหมดสว่าง');
  const darkSurfaces=await page.evaluate(()=>['.sidebar','.review-card'].map(selector=>getComputedStyle(document.querySelector(selector)).backgroundColor));
  assert.ok(darkSurfaces.every(color=>color!=='rgb(255, 255, 255)'),'dark mode should recolor the system menu and review cards');
  await page.screenshot({path:path.join(__dirname,'theme-mobile-dark-qa.png'),fullPage:true});
  await page.locator('#themeToggle').click();assert.ok(!(await page.locator('body').evaluate(el=>el.classList.contains('theme-dark'))),'toggle should switch back to light mode');
  await page.locator('#themeToggle').evaluate(el=>el.remove());await page.addScriptTag({content:source});await page.waitForSelector('#themeToggle');
  assert.equal(await page.locator('#themeToggle').getAttribute('aria-label'),'เปลี่ยนเป็นโหมดมืด','light preference should persist when the page is initialized again');
  const layout=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth,table:document.querySelector('.pp5-table').scrollWidth,wrapper:document.querySelector('.table-wrap').clientWidth}));
  assert.ok(layout.document<=layout.viewport,'mobile viewport should not gain page-level horizontal scrolling: '+JSON.stringify(layout));
  assert.ok(layout.table>layout.wrapper,'wide forms should remain available through the touch-scrolling table wrapper');
  await page.screenshot({path:path.join(__dirname,'theme-mobile-qa.png'),fullPage:true});
  console.log(JSON.stringify({passed:5,themePersistence:true,mobileViewport:layout.viewport,noPageOverflow:true,touchTableScroll:true}));
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
