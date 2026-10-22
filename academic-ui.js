import * as paper from './store.js';
import * as progress from './progress/store.js';
import {rows} from './model.js';
import {academicState} from './academic-document.js';
import {showImage} from './image-viewer.js';
const isProgress=location.pathname.includes('/progress/'),moduleId=isProgress?'progress':'paper';
const api=(await import(isProgress?'./progress/progress.js':'./notebook.js')).studioAPI;
const $=s=>document.querySelector(s);
const editor=()=>$('#page-editor')||$('#note-rich');
let cache=null,loading=null,epoch=0;
async function notes(){if(cache)return cache;if(loading)return loading;const generation=epoch;loading=(async()=>{const all=[];for(const [module,st]of [['paper',paper],['progress',progress]]){const journal=await st.snapshot(),parents=new Map(rows(journal,'paper').map(p=>[p.id,p]));for(const n of rows(journal,'note')){const m=n.frontmatter||{};all.push({module,n,meta:m,parent:parents.get(n.paperId),title:m.title||n.title||n.text.trim().split('\n')[0].slice(0,100)||'截图笔记',refs:[...new Set([...(m.related||[]),...(n.academic?.links||[])])]});}}if(generation===epoch)cache=all;return all;})().finally(()=>loading=null);return loading;}
function invalidate(){epoch++;cache=null;void renderLinks();}window.addEventListener('notebook-local',invalidate);window.addEventListener('notebook-remote',invalidate);
export function resolveRef(ref,all){const sep=ref.indexOf(':'),mod=sep>0?ref.slice(0,sep):null,key=sep>0?ref.slice(sep+1):ref;return all.filter(x=>(!mod||mod===x.module)&&(x.n.id===key||x.meta.slug===key));}
async function open(target){await api.persist();if(target.module===moduleId)await api.open(target.n.id);else if(window.parent!==window&&window.parent.__workspaceNavigate)await window.parent.__workspaceNavigate(target.module,target.n.id);else location.assign(new URL((target.module==='paper'?'./':'progress/')+'?note='+encodeURIComponent(target.n.id),import.meta.url).href);}
const links=document.createElement('details');links.className='academic-links';links.open=true;links.innerHTML='<summary>关联笔记与反向链接</summary><div class="academic-link-content"></div>';
let linksGeneration=0;
async function renderLinks(){const g=++linksGeneration,current=api.current(),ed=editor();if(!ed)return;const s=academicState(ed);if(!s)return;const all=await notes();if(g!==linksGeneration||!ed.isConnected)return;const anchor=ed.closest('.composer')||ed;anchor.after(links);const area=links.lastElementChild;area.replaceChildren();const slug=s.meta.slug;
 const outgoing=[...new Set([...(s.meta.related||[]),...(s.record?.links||[])])];
 const heading=document.createElement('p');heading.textContent='从此页关联';area.append(heading);
 function entry(target,label){const b=document.createElement('button');b.type='button';b.textContent=(label||target.title)+' · '+(target.module==='paper'?'文献':'科研日志')+(target.n.archived||target.parent?.archived?'（归档）':'');b.onclick=()=>void open(target);area.append(b);}
 for(const ref of outgoing){const found=resolveRef(ref,all);if(found.length===1)entry(found[0]);else{const p=document.createElement('p');p.className='academic-unresolved';p.textContent=ref+(found.length?'：标识重复，请使用模块前缀或记录 ID':'：尚未找到，可能需要同步');area.append(p);}}
 if(!outgoing.length){const p=document.createElement('p');p.textContent='在科研元数据中填写 related，或在 Markdown 使用 [[slug]]。';area.append(p);}
 const h=document.createElement('p');h.textContent='引用此页';area.append(h);
 const backlinks=current?all.filter(x=>!(x.module===moduleId&&x.n.id===current)&&x.refs.some(ref=>{const found=resolveRef(ref,all);return found.length===1&&found[0].module===moduleId&&found[0].n.id===current;})):[];
 for(const ref of backlinks)entry(ref);if(!backlinks.length){const p=document.createElement('p');p.textContent=current?'暂无反向链接':'保存笔记后显示反向链接';area.append(p);}
 if(slug){const own=all.filter(x=>x.meta.slug===slug&&x.module===moduleId);if(own.length>1){const p=document.createElement('p');p.textContent='同模块存在重复 slug，请更改标识以消除歧义。';area.prepend(p);}}
}
document.addEventListener('click',e=>{const a=e.target.closest('[data-note-ref]');if(!a)return;e.preventDefault();void (async()=>{const targets=resolveRef(a.dataset.noteRef,await notes());if(targets.length===1)await open(targets[0]);else{a.title=targets.length?'标识重复，请使用模块前缀或记录 ID':'未找到关联笔记，请先同步';const t=$('#toast');t.textContent=a.title;t.style.display='block';setTimeout(()=>t.style.display='none',4000);}})();});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('[data-note-ref]')){e.preventDefault();e.target.click();}});
const toc=document.createElement('dialog');toc.id='academic-toc';toc.innerHTML='<div class="dialog-heading"><h2>本页目录</h2><button aria-label="关闭目录">×</button></div><nav aria-label="本页目录"></nav>';document.body.append(toc);toc.querySelector('button').onclick=()=>toc.close();
function headings(){return [...(editor()?.querySelectorAll('h1,h2,h3,h4,h5,h6')||[])];}
window.addEventListener('academic-toc',()=>{const nav=toc.querySelector('nav');nav.replaceChildren();for(const h of headings()){const b=document.createElement('button');b.type='button';b.style.paddingLeft=(Number(h.tagName[1])-1)*12+'px';b.textContent=h.textContent;b.onclick=()=>{toc.close();h.scrollIntoView({behavior:'smooth',block:'start'});};nav.append(b);}if(!nav.children.length)nav.textContent='正文中还没有标题。使用小标题或 Markdown 的 # 建立目录。';toc.showModal();});
let outlineTimer;function outline(){clearTimeout(outlineTimer);outlineTimer=setTimeout(()=>{const panel=$('.studio-outline');if(!panel||document.body.classList.contains('studio'))return;const hs=headings();if(!hs.length)return;panel.replaceChildren();for(const h of hs){const b=document.createElement('button');b.type='button';b.style.paddingLeft=(Number(h.tagName[1])-1)*10+'px';b.textContent=h.textContent;b.onclick=()=>h.scrollIntoView({behavior:'smooth',block:'center'});panel.append(b);}},150);}
const compare=document.createElement('aside');compare.id='academic-compare-pane';compare.hidden=true;compare.innerHTML='<header><strong>图文对照</strong><button type="button" aria-label="关闭图文对照">×</button></header><select aria-label="选择对照图片"></select><img class="academic-compare-image" draggable="false" alt="固定对照插图"><p>右侧滚动阅读，双击图片放大。</p>';$('#main').before(compare);compare.querySelector('button').onclick=()=>{compare.hidden=true;document.body.classList.remove('academic-comparing');};
function compareImages(){return [...(editor()?.querySelectorAll('img[data-image][src]')||[])];}
compare.querySelector('select').onchange=e=>{const original=compareImages()[Number(e.target.value)];if(original){compare.querySelector('img').src=original.src;compare.querySelector('img').alt=original.alt;}};
window.addEventListener('academic-compare',()=>{const imgs=compareImages();if(!imgs.length){$('#toast').textContent='先添加截图或同步本页图片，再开启图文对照。';$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4000);return;}compare.querySelector('select').replaceChildren(...imgs.map((img,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent='插图 '+(i+1)+' · '+img.alt;return opt;}));compare.querySelector('select').dispatchEvent(new Event('change'));compare.hidden=false;document.body.classList.add('academic-comparing');});
window.addEventListener('studio-note-open',()=>{compare.querySelector('button').click();void renderLinks();outline();});window.addEventListener('academic-change',()=>{void renderLinks();outline();});window.addEventListener('academic-rendered',outline);document.addEventListener('input',outline);void renderLinks();outline();
