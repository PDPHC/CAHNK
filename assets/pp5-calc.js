/* Restricted Excel formula interpreter for the bundled PP5 template; no eval. */
(()=>{'use strict';
const col=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
const pos=s=>{const m=s.replace(/\$/g,'').match(/^([A-Z]+)(\d+)$/i);if(!m)throw Error('อ้างอิงเซลล์ไม่ถูกต้อง: '+s);return [Array.from(m[1].toUpperCase()).reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),+m[2]]};
function parse(formula){
 const tokens=[];let i=0;
 while(i<formula.length){const s=formula.slice(i);let m;
  if((m=s.match(/^\s+/))){i+=m[0].length;continue}
  if((m=s.match(/^"(?:[^"]|"")*"/)))tokens.push(['v',m[0].slice(1,-1).replace(/""/g,'"')]);
  else if((m=s.match(/^(?:(?:'[^']+'|[A-Za-z_][A-Za-z_0-9]*)!)?\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/i)))tokens.push(['ref',m[0]]);
  else if((m=s.match(/^\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?/)))tokens.push(['v',Number(m[0])]);
  else if((m=s.match(/^(?:(?:'[^']+'|[A-Za-z_][A-Za-z_0-9]*)!)?#[A-Z0-9/]+[!?]?/)))tokens.push(['err',m[0]]);
  else if((m=s.match(/^[A-Za-z_][A-Za-z_0-9.]*/)))tokens.push(['fn',m[0].toUpperCase()]);
  else if((m=s.match(/^(?:<>|>=|<=|[+\-*/^&=<>(),%])/)))tokens.push([m[0],m[0]]);
  else throw Error('ไม่รองรับสูตร: '+s.slice(0,30));i+=m[0].length;
 }
 let p=0;const prec={'=':1,'<>':1,'>':1,'<':1,'>=':1,'<=':1,'&':2,'+':3,'-':3,'*':4,'/':4,'^':5};
 const expect=t=>{if(tokens[p++]?.[0]!==t)throw Error('สูตรไม่สมบูรณ์: '+formula)};
 function expr(min=0){let t=tokens[p++],n;if(!t)throw Error('สูตรไม่สมบูรณ์');
  if(t[0]==='('){n=expr();expect(')')}
  else if(t[0]==='-'||t[0]==='+')n=['un',t[0],expr(6)];
  else if(t[0]==='fn'){if(['TRUE','FALSE'].includes(t[1])&&tokens[p]?.[0]!=='(')n=['v',t[1]==='TRUE'];else{expect('(');const a=[];if(tokens[p]?.[0]!==')'){do{a.push(expr());if(tokens[p]?.[0]!==',')break;p++}while(true)}expect(')');n=['call',t[1],a]}}
  else n=t;
  while(p<tokens.length){const op=tokens[p][0];if(op==='%'){p++;n=['op','/',n,['v',100]];continue}if(prec[op]==null||prec[op]<min)break;p++;n=['op',op,n,expr(prec[op]+1)]}return n;
 }
 const ast=expr();if(p!==tokens.length)throw Error('สูตรมีส่วนที่ไม่รองรับ');return ast;
}
const num=v=>{if(v==null||v==='')return 0;const n=Number(v);if(!Number.isFinite(n))throw Error('#VALUE!');return n};
const str=v=>v==null?'':String(v);
const compare=(a,b)=>{if(a==null)a=typeof b==='string'?'':0;if(b==null)b=typeof a==='string'?'':0;if(typeof a!==typeof b){const rank=v=>typeof v==='boolean'?2:typeof v==='string'?1:0;return Math.sign(rank(a)-rank(b))}if(typeof a==='string'){a=a.toLowerCase();b=b.toLowerCase()}return a===b?0:a>b?1:-1};
class Calculator{
 constructor(cells,patches={}){this.cells=cells;this.patches=patches;this.cache=new Map();this.active=new Set();this.ast=new Map()}
 get(sheet,ref){ref=ref.replace(/\$/g,'').toUpperCase();const key=sheet+'!'+ref;if(Object.hasOwn(this.patches,key))return this.patches[key];if(this.cache.has(key))return this.cache.get(key);if(this.active.has(key))throw Error('สูตรวนซ้ำ '+key);const c=this.cells[sheet]?.[ref];if(!c)return null;
  this.active.add(key);try{let v=c.v??null;if(c.f){let ast=this.ast.get(c.f);if(!ast){ast=parse(c.f);this.ast.set(c.f,ast)}v=this.run(ast,sheet)}this.cache.set(key,v);return v}finally{this.active.delete(key)}
 }
 run(n,sheet){const kind=n[0];if(kind==='v')return n[1];if(kind==='err')throw Error(n[1]);if(kind==='un')return (n[1]==='-'?-1:1)*num(this.run(n[2],sheet));
  if(kind==='ref'){let ref=n[1];if(ref.includes('!')){const parts=ref.split('!');sheet=parts[0].replace(/^'|'$/g,'');ref=parts[1]}if(ref.includes(':')){const [a,b]=ref.split(':').map(pos),v=[];for(let y=a[1];y<=b[1];y++)for(let x=a[0];x<=b[0];x++)v.push(this.get(sheet,col(x)+y));return v}return this.get(sheet,ref)}
  if(kind==='op'){const a=this.run(n[2],sheet),b=this.run(n[3],sheet),op=n[1];if(op==='&')return str(a)+str(b);if(['=','<>','>','<','>=','<='].includes(op)){const c=compare(a,b);return {'=':c===0,'<>':c!==0,'>':c>0,'<':c<0,'>=':c>=0,'<=':c<=0}[op]}const x=num(a),y=num(b);if(op==='/'&&!y)throw Error('#DIV/0!');return {'+':()=>x+y,'-':()=>x-y,'*':()=>x*y,'/':()=>x/y,'^':()=>x**y}[op]()}
  const name=n[1],args=n[2],run=i=>this.run(args[i],sheet);
  if(name==='IF')return this.run(args[run(0)?1:2]||['v',false],sheet);
  if(name==='ISERROR'){try{run(0);return false}catch{return true}}
  const a=args.map((_,i)=>run(i)),flat=a.flat();
  switch(name){
   case 'LEN':return str(a[0]).length;
   case 'LEFT':return str(a[0]).slice(0,a.length>1?num(a[1]):1);
   case 'RIGHT':{const k=a.length>1?num(a[1]):1;return k?str(a[0]).slice(-k):''}
   case 'TRIM':return str(a[0]).trim().replace(/ +/g,' ');
   case 'ROUND':{const f=10**num(a[1]),v=num(a[0]);return Math.sign(v)*Math.round(Math.abs(v)*f+Number.EPSILON)/f}
   case 'MOD':{const x=num(a[0]),y=num(a[1]);if(!y)throw Error('#DIV/0!');return x-y*Math.floor(x/y)}
   case 'SUM':return flat.reduce((s,v)=>s+(typeof v==='number'?v:0),0);
   case 'MAX':return Math.max(0,...flat.filter(v=>typeof v==='number'));
   case 'AND':return flat.every(Boolean);
   case 'OR':return flat.some(Boolean);
   case 'NOT':return !a[0];
   case 'SEARCH':{const k=str(a[1]).toLowerCase().indexOf(str(a[0]).toLowerCase(),a[2]?num(a[2])-1:0);if(k<0)throw Error('#VALUE!');return k+1}
   case 'COUNTIF':return (Array.isArray(a[0])?a[0]:[a[0]]).filter(v=>v!=null&&str(v).toLowerCase()===str(a[1]).toLowerCase()).length;
   case 'NOW':return Date.now()/86400000+25569;
   default:throw Error('ไม่รองรับฟังก์ชัน '+name);
  }
 }
}
globalThis.PP5Calc={Calculator,parse};if(typeof module!=='undefined')module.exports=globalThis.PP5Calc;
})();
