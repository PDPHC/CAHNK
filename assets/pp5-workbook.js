/* Patch only entered cells; retain the original OOXML package and print layout. */
(() => {
 'use strict';
 const NS='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const parse=s=>{const d=new DOMParser().parseFromString(s,'application/xml');if(d.querySelector('parsererror'))throw Error('ไฟล์ XML ในแม่แบบไม่สมบูรณ์');return d};
 const nodes=(d,n)=>[...d.getElementsByTagNameNS('*',n)];
 const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const col=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
 const number=s=>[...s].reduce((v,c)=>v*26+c.charCodeAt(0)-64,0);
 const index=ref=>{const [,c,r]=ref.match(/^([A-Z]+)(\d+)$/);return Number(r)*16384+number(c)};
 const allowed=(sheet,ref)=>{
  const m=ref.match(/^([A-Z]+)(\d+)$/);if(!m)return false;const c=number(m[1]),r=+m[2];
  return sheet==='IN'&&((r>=4&&r<=63&&c>=3&&c<=11)||(r===3&&c>=5&&c<=10)||(c===17&&r>=4&&r<=23))
   ||sheet==='D'&&r>=8&&r<=47&&[3,15,16,17,18,19,20].includes(c)
   ||sheet==='W1'&&r===5&&c>=6&&c<=10
   ||sheet==='CH'&&r>=7&&r<=66&&c>=7&&c<=106;
 };
 class Book {
  static async open(bytes){
   if(bytes.byteLength>4*1024*1024)throw Error('เลือกไฟล์ .xlsx ขนาดไม่เกิน 4 MB');
   const zip=await JSZip.loadAsync(bytes);let total=0;
   for(const f of Object.values(zip.files)){total+=f._data?.uncompressedSize||0;if(total>40*1024*1024)throw Error('แม่แบบมีขนาดขยายใหญ่เกินกำหนด')}
   if(zip.file('xl/vbaProject.bin'))throw Error('รองรับเฉพาะ .xlsx ที่ไม่มีแมโคร');
   const book=new Book();book.bytes=bytes;book.zip=zip;book.sheets={};book.texts=[];
   const wb=zip.file('xl/workbook.xml'),rel=zip.file('xl/_rels/workbook.xml.rels');if(!wb||!rel)throw Error('ไม่ใช่สมุดงาน Excel ที่รองรับ');
   const ss=zip.file('xl/sharedStrings.xml');if(ss)book.texts=nodes(parse(await ss.async('string')),'si').map(s=>nodes(s,'t').map(t=>t.textContent).join(''));
   const relationships=Object.fromEntries(nodes(parse(await rel.async('string')),'Relationship').map(r=>[r.getAttribute('Id'),r.getAttribute('Target')]));
   for(const s of nodes(parse(await wb.async('string')),'sheet')){
    const target=relationships[s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')];
    if(!target)continue;const path=target.startsWith('/')?target.slice(1):'xl/'+target;
    const file=zip.file(path);if(!file)throw Error('ไม่พบชีตในแม่แบบ');
    book.sheets[s.getAttribute('name')]={path,raw:await file.async('string')};
   }
   for(const name of ['A','B','C','D','E','F','DT','IN','W1','CH','G'])if(!book.sheets[name])throw Error('แม่แบบไม่ตรงกับ ปพ.5 ที่รองรับ: ไม่พบชีต '+name);
   book.cells={};for(const name of ['IN','D','W1','CH']){
    book.cells[name]={};for(const c of nodes(parse(book.sheets[name].raw),'c')){
     const f=nodes(c,'f')[0],v=nodes(c,'v')[0]?.textContent??'',t=c.getAttribute('t');
     book.cells[name][c.getAttribute('r')]={formula:f?.textContent??null,value:t==='s'?book.texts[+v]??'':t==='inlineStr'?nodes(c,'t').map(t=>t.textContent).join(''):v===''?'':t==='str'||t==='e'?v:Number(v)};
    }
   }
   if(book.value('IN','P7')!=='รหัสวิชา'||book.value('IN','P8')!=='ชื่อวิชา'||!book.cells.IN.L4?.formula)throw Error('ตำแหน่งข้อมูลในแม่แบบไม่ตรงกับไฟล์ ปพ.5 ที่กำหนด');
   book.externalLinks=Object.keys(zip.files).some(p=>/^xl\/externalLinks\/externalLink\d+\.xml$/.test(p));return book;
  }
  value(sheet,ref,patches={}){const key=sheet+'!'+ref;return Object.hasOwn(patches,key)?patches[key]:this.cells[sheet]?.[ref]?.value??''}
  async export(patches={}){
   if(!Object.keys(patches).length)return new Uint8Array(this.bytes);
   const zip=await JSZip.loadAsync(this.bytes),groups={};
   for(const [key,value] of Object.entries(patches)){
    const [sheet,ref]=key.split('!');if(!allowed(sheet,ref)||!['string','number'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw Error('ตำแหน่งหรือข้อมูลที่แก้ไขไม่ถูกต้อง: '+key);
    if(this.cells[sheet]?.[ref]?.formula!==null&&this.cells[sheet]?.[ref]?.formula!==undefined)throw Error('ไม่อนุญาตให้ทับสูตร: '+key);
    (groups[sheet]??=[]).push([ref,value]);
   }
   for(const [sheet,entries] of Object.entries(groups)){
    let raw=this.sheets[sheet].raw;
    for(const [ref,value] of entries){
     const re=new RegExp('<c\\b[^>]*\\br="'+ref+'"[^>]*?(?:/>|>[\\s\\S]*?</c>)');const old=raw.match(re)?.[0];
     const attrs=old?old.match(/^<c\b([^>]*?)(?:\/?>)/)[1].replace(/\s+t="[^"]*"/g,'').replace(/\/$/,''):' r="'+ref+'"';
     const cell=value===''?'<c'+attrs+'/>':typeof value==='number'?'<c'+attrs+'><v>'+value+'</v></c>':'<c'+attrs+' t="inlineStr"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
     if(old)raw=raw.replace(re,()=>cell);else{
      const rowNo=ref.match(/\d+/)[0],rowRe=new RegExp('<row\\b[^>]*\\br="'+rowNo+'"[^>]*>[\\s\\S]*?</row>');const row=raw.match(rowRe)?.[0];
      if(!row)throw Error('ไม่พบแถวในแม่แบบ: '+ref);
      const following=[...row.matchAll(/<c\b[^>]*\br="([A-Z]+\d+)"/g)].find(m=>index(m[1])>index(ref));
      const changed=following?row.slice(0,following.index)+cell+row.slice(following.index):row.replace('</row>',cell+'</row>');raw=raw.replace(rowRe,()=>changed);
     }
    }
    zip.file(this.sheets[sheet].path,raw);
   }
   // Request Excel/native converter to refresh all dependent formulas on open.
   let raw=await zip.file('xl/workbook.xml').async('string');
   if(/<calcPr\b/.test(raw))raw=raw.replace(/<calcPr\b[^>]*\/?>(?:<\/calcPr>)?/,m=>m.replace(/\s+(fullCalcOnLoad|forceFullCalc|calcMode)="[^"]*"/g,'').replace(/\/?>(?:<\/calcPr>)?$/,' calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>'));
   else raw=raw.replace('</workbook>','<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
   zip.file('xl/workbook.xml',raw);
   return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  }
 }
 window.PP5Workbook={Book,col,allowed};
})();
