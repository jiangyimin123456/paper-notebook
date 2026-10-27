// A small, serializable OCR document. Only text, emphasis and lists cross into notes.
const escapeHTML=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escapeMD=s=>s.replace(/([\\`*_{}\[\]()#+.!|>~<>$&-])/g,'\\$1');
const cjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
const median=a=>{const b=a.filter(Number.isFinite).sort((x,y)=>x-y);return b.length?b[Math.floor(b.length/2)]:0;};
const badge=/^(?:PDF|P[O0D]F|P[O0D]PF|R?P[O0D]F)(?:\s*\+\s*\d{1,3})?$/i;
const marker=/^\s*(?:(\d{1,3})[.．、)）](?!\d)\s*|([•●○◦▪▫·©@]|[oO]\s)\s*)/u;
function joiner(a,b){return !a||!b||/\s$/.test(a)||/^\s/.test(b)||cjk.test(a.at(-1))&&cjk.test(b[0])||/[，。；：、！？]$/.test(a)&&cjk.test(b[0])||/^[，。；：、！？,:;）)】》”’]/u.test(b)||/[（(【《“‘]$/.test(a)?'':' ';}
function append(runs,text,bold=false){if(!text)return;const last=runs.at(-1);if(last&&last.bold===bold)last.text+=text;else runs.push({text,bold});}
function tidy(runs){return runs.map(r=>({...r,text:r.text.replace(/([\p{Script=Han}]) +(?=[\p{Script=Han}，。；：、！？])/gu,'$1')}));}
function sliceRuns(runs,start,end=Infinity){let at=0;return runs.flatMap(r=>{const from=Math.max(0,start-at),to=Math.min(r.text.length,end-at);at+=r.text.length;return to>from?[{text:r.text.slice(from,to),bold:r.bold===true}]:[];});}
function trimRuns(runs){const text=runs.map(r=>r.text).join('');return sliceRuns(runs,text.length-text.trimStart().length,text.trimEnd().length);}
function stripBadge(runs){
 const text=runs.map(r=>r.text).join('');
 // A sentence-ending source chip; ordinary uses such as “导出 PDF” remain intact.
 const m=text.match(/([。！？；”’）】\]]\s*|[.!?;)]\s+)["”']?PDF\s*(?:\+\s*\d{1,3})?\s*$/i);
 return m?{runs:trimRuns(sliceRuns(runs,0,m.index+m[1].length)),removed:1}:{runs,removed:0};
}
function asBlock(runs){runs=trimRuns(tidy(runs));const text=runs.map(r=>r.text).join(''),m=text.match(marker);return {type:m?(m[1]?'ordered':'bullet'):'paragraph',...(m?.[1]?{number:Number(m[1])}:{}),runs:m?sliceRuns(runs,m[0].length):runs};}
export function normalizeOcrDocument(doc){
 if(!doc||!Array.isArray(doc.blocks)||doc.blocks.length>10000)throw Error('OCR 文档格式无效');
 let size=0;const blocks=doc.blocks.map(b=>{if(!Array.isArray(b.runs))throw Error('OCR 段落格式无效');const runs=b.runs.map(r=>{if(typeof r.text!=='string')throw Error('OCR 文字格式无效');size+=r.text.length;return {text:r.text,bold:r.bold===true};});return {type:['ordered','bullet'].includes(b.type)?b.type:'paragraph',...(b.type==='ordered'?{number:Math.max(1,Math.min(999,Number(b.number)||1))}:{}),runs:trimRuns(runs)};}).filter(b=>b.runs.some(r=>r.text.trim()));
 if(!size||size>100000)throw Error('OCR 文本为空或过长');return {version:1,blocks,removed:Number(doc.removed)||0};
}
export function documentText(doc){return doc.blocks.map(b=>(b.type==='ordered'?b.number+'. ':b.type==='bullet'?'• ':'')+b.runs.map(r=>r.text).join('')).join('\n\n');}
export function documentHTML(doc){
 doc=normalizeOcrDocument(doc);let out='',list='',number=0;
 for(const b of doc.blocks){const tag=b.type==='ordered'?'ol':b.type==='bullet'?'ul':'';if(tag!==list||tag==='ol'&&b.number!==number+1){if(list)out+='</'+list+'>';if(tag)out+='<'+tag+(tag==='ol'?' start="'+b.number+'"':'')+'>';list=tag;}const html=b.runs.map(r=>{const t=escapeHTML(r.text).replace(/\n/g,'<br>');return r.bold?'<strong>'+t+'</strong>':t;}).join('');out+=tag?'<li>'+html+'</li>':'<p>'+html+'</p>';number=b.number||0;}if(list)out+='</'+list+'>';return out;
}
export function documentMarkdown(doc){return normalizeOcrDocument(doc).blocks.map(b=>(b.type==='ordered'?b.number+'. ':b.type==='bullet'?'- ':'')+b.runs.map(r=>{if(!r.bold)return escapeMD(r.text);const m=r.text.match(/^(\s*)([\s\S]*?)(\s*)$/);return m[1]+(m[2]?'**'+escapeMD(m[2])+'**':'')+m[3];}).join('').replace(/\n/g,'  \n')).join('\n\n');}
export function documentFromEditor(root){
 const blocks=[];let runs=[];
 const flush=(type='paragraph',number)=>{if(runs.length)blocks.push({type,number,runs});runs=[];};
 const inline=(node,bold=false)=>{if(node.nodeType===3){append(runs,node.textContent,bold);return;}if(node.nodeType!==1||/^(SCRIPT|STYLE|SVG|IFRAME|OBJECT|TEMPLATE)$/.test(node.tagName))return;if(node.tagName==='BR'){append(runs,'\n',bold);return;}for(const child of node.childNodes)inline(child,bold||/^(B|STRONG)$/.test(node.tagName));};
 const walk=node=>{if(node.nodeType===1&&/^(OL|UL)$/.test(node.tagName)){flush();let n=Number(node.getAttribute('start'))||1;for(const li of node.children){inline(li);flush(node.tagName==='OL'?'ordered':'bullet',n++);}return;}if(node.nodeType===1&&/^(P|DIV|H[1-6]|BLOCKQUOTE|LI)$/.test(node.tagName)){flush();for(const child of node.childNodes)walk(child);flush();return;}inline(node);};
 for(const child of root.childNodes)walk(child);flush();return normalizeOcrDocument({blocks});
}
export function buildOcrDocument(result){
 if(result.document)return normalizeOcrDocument(result.document);
 const lines=[];let group=0,removed=0;
 for(const block of result.blocks||[])for(const p of block.paragraphs||[]){group++;for(const line of p.lines||[]){const runs=[];for(const [i,w]of (line.words||[]).entries()){if(w.sourceBadge){removed++;continue;}let text=String(w.text||'');if(i===0&&line.listNumber)text=line.listNumber+'. ';if(i===0&&line.listBullet)text='• ';if(runs.length)append(runs,joiner(runs.at(-1).text,text));append(runs,text,w.bold===true||/bold|semibold|demi/i.test(w.font_name||''));}if(runs.length)lines.push({runs,group,box:line.bbox,heading:line.heading});}}
 if(!lines.length){for(const [i,p]of String(result.text||'').replace(/\r/g,'').trim().split(/\n\s*\n/).entries())for(const line of p.split('\n'))lines.push({runs:[{text:line,bold:false}],group:i});}
 const heights=lines.map(l=>l.box?.y1-l.box?.y0),height=median(heights),blocks=[];let prev;
 for(const line of lines){const cleaned=stripBadge(line.runs);removed+=cleaned.removed;let runs=trimRuns(cleaned.runs);if(!runs.length)continue;const text=runs.map(r=>r.text).join('');
  // Standalone chips often form a separate OCR paragraph at the end of a sentence.
  if(/^PDF\s*(?:\+\s*\d{1,3})?$/i.test(text)&&/[。.!?！？；;”’）)]$/.test(prev?.runs.map(r=>r.text).join('')||'')){removed++;continue;}
  const b=asBlock(runs),gap=line.box&&prev?.box?line.box.y0-prev.box.y1:0;
  line.heading??=b.type==='ordered'&&/[:：]$/.test(text);
  const continuous=prev&&!prev.heading&&b.type==='paragraph'&&!line.heading&&((line.group===prev.group&&(!line.box||gap<height*.9))||(line.box&&prev.box&&gap>=0&&gap<height*.65));
  if(continuous){const last=blocks.at(-1);append(last.runs,joiner(last.runs.at(-1)?.text||'',b.runs[0]?.text||''));for(const r of b.runs)append(last.runs,r.text,r.bold);}else blocks.push(b);
  prev={...line,runs};
 }
 return blocks.length?normalizeOcrDocument({blocks,removed}):{version:1,blocks:[],removed};
}

// LSTM OCR omits font weight. Compare measured stroke widths within the same image.
// Keep this conservative: uniform fonts and uncertain crops receive no extra emphasis.
export async function analyzeOcrImage(result,data){
 if(!result.blocks?.length)return;
 const image=new Image();image.src=data;await image.decode();const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;if(c.width*c.height>20000000)return;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const {data:pixels}=ctx.getImageData(0,0,c.width,c.height),words=[];
 const luminance=(x,y)=>{const i=(y*c.width+x)*4,a=pixels[i+3]/255;return (pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722)*a+255*(1-a);};
 function metrics(box){const x0=Math.max(0,Math.floor(box.x0)),y0=Math.max(0,Math.floor(box.y0)),x1=Math.min(c.width,Math.ceil(box.x1)),y1=Math.min(c.height,Math.ceil(box.y1));if(x1<=x0||y1<=y0)return null;let mass=0,edge=0,dark=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const ink=Math.max(0,245-luminance(x,y))/245;mass+=ink;dark=Math.max(dark,ink);edge+=Math.abs(ink-(x>x0?Math.max(0,245-luminance(x-1,y))/245:0))+Math.abs(ink-(y>y0?Math.max(0,245-luminance(x,y-1))/245:0));}return {stroke:edge?mass/edge:0,dark,height:y1-y0};}
 for(const block of result.blocks)for(const p of block.paragraphs||[])for(const l of p.lines||[])for(const w of l.words||[]){if(!w.bbox)continue;w.visual=metrics(w.bbox);if(w.visual)words.push(w);}
 const heights=words.filter(w=>cjk.test(w.text)).map(w=>w.visual.height).sort((a,b)=>a-b),bodyHeight=heights[Math.floor(heights.length*.35)]||median(words.map(w=>w.visual.height));
 for(const w of words){const compact=w.text.replace(/[\s“”"'.,。]/g,'');if((badge.test(compact)||/^ror$/i.test(compact))&&w.visual.height<bodyHeight*.9&&w.visual.dark<.75)w.sourceBadge=true;}
 const baselines=new Map();for(const kind of [true,false]){const subset=words.filter(w=>!w.sourceBadge&&cjk.test(w.text)===kind&&/[\p{L}]/u.test(w.text)&&w.visual.dark>.75&&w.visual.height>=5);if(subset.length<8)continue;const sorted=subset.map(w=>w.visual.stroke).sort((a,b)=>a-b);baselines.set(kind,sorted[Math.floor(sorted.length*.35)]);}
 for(const block of result.blocks)for(const p of block.paragraphs||[])for(const l of p.lines||[]){const ws=l.words||[];let cluster=[];
  for(let n=1;n<=Math.min(4,ws.length);n++){const tail=ws.slice(-n),label=tail.map(w=>w.text).join('').replace(/[\s“”"'.,。]/g,'');if(badge.test(label)&&tail.every(w=>w.visual&&w.visual.height<bodyHeight*.9&&w.visual.dark<.75))for(const w of tail)w.sourceBadge=true;}
  const commit=()=>{const letters=cluster.filter(w=>/[\p{L}]/u.test(w.text)),strong=letters.filter(w=>w.visual.stroke>(baselines.get(cjk.test(w.text))||Infinity)*1.25);if(letters.map(w=>w.text).join('').length>=4&&strong.length>=2&&strong.length/letters.length>=.35)for(const w of cluster)w.bold=true;cluster=[];};
  for(const w of ws){const base=baselines.get(cjk.test(w.text));if(w.sourceBadge){commit();continue;}if(!/[\p{L}]/u.test(w.text)){if(cluster.length)cluster.push(w);continue;}if(base&&w.visual?.dark>.75&&w.visual.stroke>base*1.12)cluster.push(w);else commit();}commit();
  const content=ws.filter(w=>/[\p{L}]/u.test(w.text)),emphasis=content.filter(w=>w.bold).map(w=>w.text.length).reduce((a,b)=>a+b,0),length=content.map(w=>w.text.length).reduce((a,b)=>a+b,0);
  l.heading=length>3&&length<65&&/[:：]\s*$/.test(l.text||ws.map(w=>w.text).join(''))&&emphasis/length>.45;
  if(l.heading)for(const w of ws)if(!/^\d+[.．、]?$/.test(w.text))w.bold=true;
  const [first,next]=ws;if(first&&next&&/^\d{1,3}$/.test(first.text)&&next.bbox.x0-first.bbox.x1>bodyHeight*.7)l.listNumber=Number(first.text);
  if(first&&next&&/^[oO©@○•]$/.test(first.text)&&next.bbox.x0-first.bbox.x1>bodyHeight*.5)l.listBullet=true;
 }
 // Do not store pixel data or engine internals in the note cache.
}
