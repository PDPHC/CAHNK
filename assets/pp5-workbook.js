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
  return sheet==='D'&&ref==='N24'||sheet==='A'&&ref==='C41'||sheet==='IN'&&((r>=4&&r<=63&&c>=3&&c<=11)||(r===3&&c>=5&&c<=10)||(c===17&&r>=4&&r<=23))
   ||sheet==='D'&&((r>=8&&r<=47)||(r>=54&&r<=153))&&[3,15,16,17,18,19,20].includes(c)
   ||sheet==='W1'&&r===5&&c>=6&&c<=10
   ||sheet==='F'&&r>=7&&r<=66&&['H','I','J','K','L','M','N','O','P','Q','Z','AB','AD','AF','AH','AJ','AL','AN','AP','AR','BB','BD','BE','BF','BG','BH','BI','BJ','BK','BL','BM','BW','BX','CD','CE','CF','CG','CH','CI','CJ','CK','CL','CM','CV','CW','CX','CY','DC','DD','DE','DF','DG','DH','DI','DJ'].includes(m[1])
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
   book.cells={};for(const name of ['IN','D','W1','CH','F']){
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
    if(key==='__pp5_indicator_count'){if(!Number.isInteger(value)||value<0||value>100)throw Error('จำนวนตัวชี้วัดเพิ่มเติมไม่ถูกต้อง');continue}
    if(/^__pp5_head_[0-7]$/.test(key)){if(typeof value!=='string'||value.length>160)throw Error('ชื่อหัวหน้ากลุ่มสาระไม่ถูกต้อง');continue}
    const [sheet,ref]=key.split('!');if(!allowed(sheet,ref)||!['string','number'].includes(typeof value)||typeof value==='number'&&!Number.isFinite(value))throw Error('ตำแหน่งหรือข้อมูลที่แก้ไขไม่ถูกต้อง: '+key);
    if(sheet!=='F'&&this.cells[sheet]?.[ref]?.formula!==null&&this.cells[sheet]?.[ref]?.formula!==undefined)throw Error('ไม่อนุญาตให้ทับสูตร: '+key);
    (groups[sheet]??=[]).push([ref,value]);
   }
   if(patches.__pp5_indicator_count)groups.D??=[];
   for(const [sheet,entries] of Object.entries(groups)){
    let raw=this.sheets[sheet].raw;
    if(sheet==='D'&&patches.__pp5_indicator_count){
     const count=patches.__pp5_indicator_count;let rows='';for(let i=0;i<count;i++){const row=54+i;rows+='<row r="'+row+'" ht="36" customHeight="1">'+['B','C','O','P','Q','R','S','T'].map(c=>{const source=raw.match(new RegExp('<c\\b[^>]*\\br="'+c+'8"[^>]*>'))?.[0],style=source?.match(/\bs="(\d+)"/)?.[1]||0;return '<c r="'+c+row+'" s="'+style+'">'+(c==='B'?'<v>'+(i+16)+'</v>':c==='S'?'<f>SUM(O'+row+':R'+row+')</f>':'')+'</c>'}).join('')+'</row>'}raw=raw.replace('</sheetData>',rows+'</sheetData>');
     raw=raw.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/,(_,body)=>{for(let i=0;i<count;i++)body+='<mergeCell ref="C'+(54+i)+':N'+(54+i)+'"/>';return '<mergeCells count="'+(body.match(/<mergeCell\b/g)||[]).length+'">'+body+'</mergeCells>'});
     for(const c of ['O','P','Q','R','T'])raw=raw.replace(new RegExp('(<c\\b[^>]*\\br="'+c+'25"[^>]*>[\\s\\S]*?<f[^>]*>)([\\s\\S]*?)(</f>)'),(_,a,f,b)=>a+f+'+SUM('+c+'54:'+c+(53+count)+')'+b);
    }
    if(sheet==='F'){
     // Expand shared formulas before removing any master for a manual score.
     const response=await fetch('../assets/pp5-print-template.json?v=2');if(!response.ok)throw Error('โหลดสูตรคะแนนย่อยไม่สำเร็จ');const packed=await response.json(),formZip=await JSZip.loadAsync(packed.base64,{base64:true}),data=JSON.parse(await formZip.file('print.json').async('string'));
     raw=raw.replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,c=>{const ref=c.match(/\br="([A-Z]+\d+)"/)?.[1],f=data.cells.F[ref]?.f;if(!/<f\b/.test(c))return c;if(!f)throw Error('ไม่พบสูตร '+ref);return c.replace(/<f\b[^>]*?(?:\/>|>[\s\S]*?<\/f>)/,'<f>'+xml(f)+'</f>')});
    }
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
   // Hide only unused trailing roster rows; retain formulas and original row IDs.
   let last=0;for(let r=4;r<=63;r++)if(this.value('IN','C'+r,patches)||this.value('IN','D'+r,patches))last=r-3;
   const rosterRanges={B:[11,55],C:[9,52],E:[9,52],F:[7,66],CH:[7,66]};
   const stylesRaw=await zip.file('xl/styles.xml').async('string'),stylesDoc=parse(stylesRaw),xfs=nodes(stylesDoc,'cellXfs')[0],variants=new Map();
   const fitStyle=id=>{if(variants.has(id))return variants.get(id);const xf=xfs.children[id].cloneNode(true);let a=nodes(xf,'alignment')[0];if(!a){a=stylesDoc.createElementNS(NS,'alignment');xf.append(a)}a.setAttribute('wrapText','0');a.setAttribute('shrinkToFit','1');xf.setAttribute('applyAlignment','1');const next=xfs.children.length;xfs.append(xf);variants.set(id,next);return next};
   for(const [name,[start,end]] of Object.entries(rosterRanges)){
    const path=this.sheets[name].path;let sheet=await zip.file(path).async('string');
    sheet=sheet.replace(/<row\b[^>]*>/g,tag=>{const row=Number(tag.match(/\br="(\d+)"/)?.[1]);if(row<start||row>end)return tag;tag=tag.replace(/\s+hidden="[^"]*"/g,'');return row>=start+last?tag.replace(/(\/?>)$/,' hidden="1"$1'):tag});
    sheet=sheet.replace(/<c\b[^>]*>/g,tag=>{const row=Number(tag.match(/\br="D(\d+)"/)?.[1]);if(!(row>=start&&row<=end))return tag;const id=Number(tag.match(/\bs="(\d+)"/)?.[1]||0),style=fitStyle(id);return /\bs="/.test(tag)?tag.replace(/\bs="\d+"/,'s="'+style+'"'):tag.replace(/(\/?>)$/,' s="'+style+'"$1')});
    if(name==='B')sheet=sheet.replace(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,cell=>{const index=cell.match(/<v>(\d+)<\/v>/)?.[1];if(!/\bt="s"/.test(cell)||!['มา','ป่วย','ลา','สาย','ขาด','รวม'].includes(this.texts[index]))return cell;return cell.replace(/^<c\b[^>]*>/,tag=>{const id=Number(tag.match(/\bs="(\d+)"/)?.[1]||0),style=fitStyle(id);return /\bs="/.test(tag)?tag.replace(/\bs="\d+"/,'s="'+style+'"'):tag.replace('>',' s="'+style+'">')})});
    const footer='&amp;C&amp;10† ย้ายออก   ‡ ไม่มีตัวตน   ★ นักเรียนพิเศษ';
    if(/<headerFooter\b/.test(sheet))sheet=sheet.replace(/<headerFooter\b[^>]*\/>/,'<headerFooter><oddFooter>'+footer+'</oddFooter><evenFooter>'+footer+'</evenFooter><firstFooter>'+footer+'</firstFooter></headerFooter>').replace(/<headerFooter\b[^>]*>[\s\S]*?<\/headerFooter>/,block=>{for(const name of ['oddFooter','evenFooter','firstFooter']){const re=new RegExp('<'+name+'(?:\\s[^>]*)?>[\\s\\S]*?<\\/'+name+'>');block=re.test(block)?block.replace(re,'<'+name+'>'+footer+'</'+name+'>'):block.replace('</headerFooter>','<'+name+'>'+footer+'</'+name+'></headerFooter>')}return block});
    else sheet=sheet.replace(/(<pageSetup\b[^>]*\/>)/,'$1<headerFooter><oddFooter>'+footer+'</oddFooter></headerFooter>');
    zip.file(path,sheet);
   }
   // Keep indicator prose inside its printed cells, including added conditions.
   const dPath=this.sheets.D.path;let dSheet=await zip.file(dPath).async('string');const wrapStyles=new Map();
   const wrapStyle=id=>{if(wrapStyles.has(id))return wrapStyles.get(id);const xf=xfs.children[id].cloneNode(true);let a=nodes(xf,'alignment')[0];if(!a){a=stylesDoc.createElementNS(NS,'alignment');xf.append(a)}a.setAttribute('wrapText','1');a.setAttribute('shrinkToFit','0');a.setAttribute('vertical','center');xf.setAttribute('applyAlignment','1');const next=xfs.children.length;xfs.append(xf);wrapStyles.set(id,next);return next};
   const textRows=[...Array.from({length:15},(_,i)=>i+8),28,29,30,...Array.from({length:patches.__pp5_indicator_count||0},(_,i)=>i+54)];
   dSheet=dSheet.replace(/<c\b[^>]*>/g,tag=>{const ref=tag.match(/\br="([A-Z]+\d+)"/)?.[1];if(ref!=='B26'&&!textRows.some(r=>ref==='C'+r))return tag;const id=Number(tag.match(/\bs="(\d+)"/)?.[1]||0),style=wrapStyle(id);return /\bs="/.test(tag)?tag.replace(/\bs="\d+"/,'s="'+style+'"'):tag.replace(/(\/?>)$/,' s="'+style+'"$1')});
   dSheet=dSheet.replace(/<row\b[^>]*>/g,tag=>{const row=Number(tag.match(/\br="(\d+)"/)?.[1]);if(row!==26&&!textRows.includes(row))return tag;const value=String(this.value('D','C'+row,patches)||''),height=row===26?38:Math.max(Number(tag.match(/\bht="([^"]+)"/)?.[1]||15),value.split('\n').reduce((n,s)=>n+Math.max(1,Math.ceil(s.length/(row<24?65:85))),0)*17+5);return tag.replace(/\s+(ht|customHeight)="[^"]*"/g,'').replace(/(\/?>)$/,' ht="'+height+'" customHeight="1"$1')});
   dSheet=dSheet.replace(/<mergeCells\b[^>]*>([\s\S]*?)<\/mergeCells>/,(_,body)=>{for(const ref of ['B26:T26','C28:T28','C29:T29','C30:T30'])if(!body.includes('ref="'+ref+'"'))body+='<mergeCell ref="'+ref+'"/>';return '<mergeCells count="'+(body.match(/<mergeCell\b/g)||[]).length+'">'+body+'</mergeCells>'});zip.file(dPath,dSheet);
   for(const b of nodes(stylesDoc,'border'))for(const edge of [...b.children])if(edge.getAttribute('style')){edge.setAttribute('style','thin');let color=nodes(edge,'color')[0];if(!color){color=stylesDoc.createElementNS(NS,'color');edge.append(color)}for(const a of [...color.attributes])color.removeAttribute(a.name);color.setAttribute('rgb','FF222222')}
   xfs.setAttribute('count',String(xfs.children.length));zip.file('xl/styles.xml',new XMLSerializer().serializeToString(stylesDoc));
   // Request Excel/native converter to refresh all dependent formulas on open.
   let raw=await zip.file('xl/workbook.xml').async('string');
   if(patches.__pp5_indicator_count)raw=raw.replace(/((?:'D'|D)!\$B\$3:\$T\$)52/g,(_,prefix)=>prefix+(53+patches.__pp5_indicator_count));
   if(/<calcPr\b/.test(raw))raw=raw.replace(/<calcPr\b[^>]*\/?>(?:<\/calcPr>)?/,m=>m.replace(/\s+(fullCalcOnLoad|forceFullCalc|calcMode)="[^"]*"/g,'').replace(/\/?>(?:<\/calcPr>)?$/,' calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>'));
   else raw=raw.replace('</workbook>','<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>');
   zip.file('xl/workbook.xml',raw);
   return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  }
 }
 window.PP5Workbook={Book,col,allowed};
})();
