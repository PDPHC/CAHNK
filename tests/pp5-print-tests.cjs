/* Run: node tests/pp5-print-tests.cjs. Uses only the bundled, sanitized template. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const JSZip=require('../assets/vendor/jszip-3.10.1.min.js'),{Calculator,parse}=require('../assets/pp5-calc.js');
(async()=>{
 const packed=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/pp5-print-template.json'),'utf8'));
 const zip=await JSZip.loadAsync(packed.base64,{base64:true}),data=JSON.parse(await zip.file('print.json').async('string'));
 let formulas=0,checks=0;const ok=(actual,expected)=>{assert.deepEqual(actual,expected);checks++};
 for(const s of Object.values(data.cells))for(const c of Object.values(s))if(c.f){parse(c.f);formulas++}
 const pupil={'IN!C4':'00001','IN!D4':'นักเรียนทดสอบ'};
 for(const [score,grade] of [[0,0],[49,0],[50,1],[54,1],[55,1.5],[59,1.5],[60,2],[64,2],[65,2.5],[69,2.5],[70,3],[74,3],[75,3.5],[79,3.5],[80,4],[100,4]]){
  const calc=new Calculator(data.cells,{...pupil,'IN!E4':score});ok(calc.get('IN','M4'),grade);
 }
 let calc=new Calculator(data.cells,{...pupil,'IN!E4':20,'IN!F4':5,'IN!G4':10,'IN!H4':20,'IN!I4':10,'IN!J4':20,'CH!G7':'/','CH!H7':'/','CH!I7':'ป','CH!J7':'ข','CH!K7':'-'});
 ok(calc.get('IN','L4'),80);ok(calc.get('IN','M4'),4);ok(calc.get('CH','DD7'),2);ok(calc.get('CH','DE7'),1);ok(calc.get('CH','DH7'),1);
 for(const special of ['ร','มส.'])ok(new Calculator(data.cells,{...pupil,'IN!K4':special}).get('IN','M4'),special);
 ok(new Calculator(data.cells,{}).get('IN','M4'),'');
 ok(calc.run(parse('IF(1=1,7,1/0)'),'IN'),7);
 ok(calc.run(parse('ROUND(-1.5,0)'),'IN'),-2);
 ok(calc.run(parse('"ครู "&"ก"'),'IN'),'ครู ก');
 assert.throws(()=>calc.run(parse('1/0'),'IN'));checks++;
 assert.throws(()=>calc.run(parse('globalThis.alert(1)'),'IN'));checks++;
 for(const p of data.pages){for(const [,,ref,style] of p.cells){assert.ok(data.styles[style],p.sheet+'!'+ref+' style');calc.get(p.sheet,ref)}checks++}
 const full={};for(let i=0;i<44;i++){full['IN!C'+(i+4)]='T'+(i+1);full['IN!D'+(i+4)]='นักเรียน '+(i+1);full['IN!E'+(i+4)]=20;full['IN!J'+(i+4)]=30}
 calc=new Calculator(data.cells,full);for(const p of data.pages)for(const [,,ref] of p.cells)calc.get(p.sheet,ref);
 ok(calc.get('E','C52'),'T44');ok(data.pages.length,10);
 console.log(JSON.stringify({passed:checks,formulasParsed:formulas,pagesRenderedWithoutFormulaErrors:10,rosterBoundary:44}));
})().catch(e=>{console.error(e);process.exitCode=1});
