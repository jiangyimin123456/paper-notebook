import * as store from './store.js';
import {rows,heads,revision} from './model.js';
const $=s=>document.querySelector(s),esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let journal,draftCache={},active=null,base='',dirty=false,timer,view='all',category='',query='',sequence=Promise.resolve(),generation=0;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
$('#today').textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
function error(e){$('#error').hidden=false;$('#error').textContent=e.message;$('#save-state').textContent='尚未保存 · 请保留页面';$('#save-copy').hidden=!active;}
function run(fn){const task=sequence.then(fn);sequence=task.catch(error);return task;}
function clearError(){$('#error').hidden=true;$('#save-copy').hidden=true;}
function value(){return {...active,title:$('#note-title').value,text:$('#note-text').value,date:$('#note-date').value||today(),category:$('#note-category').value};}
function count(){$('#word-count').textContent=$('#note-text').value.replace(/\s/g,'').length+' 字';}
async function refreshData(){journal=await store.snapshot();draftCache=await store.drafts();}
function allNotes(){const map=new Map(rows(journal).map(n=>[n.id,n]));for(const d of Object.values(draftCache))map.set(d.value.id,{...map.get(d.value.id),...d.value,updatedAt:d.at||0});return [...map.values()].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt-a.updatedAt);}
function renderList(){
 const list=allNotes();$('#note-count').textContent=list.filter(n=>!n.deleted).length;
 const notes=list.filter(n=>(view==='trash'?n.deleted:!n.deleted)&&(view!=='pinned'||n.pinned)&&(!category||n.category===category)&&(!query||(n.title+'\n'+n.text).toLocaleLowerCase().includes(query)));
 $('#note-list').innerHTML=notes.map(n=>`<button class="note-card" data-note="${esc(n.id)}" aria-current="${active?.id===n.id}"><span class="card-top"><span>${esc(n.date)}${n.pinned?' · 置顶':''}${n.conflicts?' · 多版本':''}</span><span class="card-category">${esc(n.category)}</span></span><h2>${esc(n.title||n.text.trim().split('\n')[0].slice(0,32)||'无标题记事')}</h2><p>${esc(n.text.trim().replace(/\s+/g,' ').slice(0,100)||'还没写下内容')}</p></button>`).join('')||`<p class="list-empty">${view==='trash'?'回收站是空的':query?'没有找到匹配的记事':view==='pinned'?'把常用记事置顶，方便下次找到':'这里还没有记事<br>点击「新建记事」开始'}</p>`;
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',b.dataset.view===view);
 for(const b of document.querySelectorAll('[data-category]'))b.setAttribute('aria-pressed',b.dataset.category===category);
}
function renderEditor(){
 $('#welcome').hidden=!!active;$('#editor').hidden=!active;$('#focus').disabled=!active;
 if(!active)return;
 $('#note-title').value=active.title;$('#note-text').value=active.text;$('#note-date').value=active.date;$('#note-category').value=active.category;
 $('#pin').setAttribute('aria-pressed',active.pinned);$('#pin').textContent=active.pinned?'取消置顶':'置顶';
 for(const id of ['#note-title','#note-text','#note-date','#note-category','#pin','#insert-list','#insert-date'])$(id).disabled=active.deleted;
 $('#delete').hidden=active.deleted;$('#restore').hidden=!active.deleted;
 const versions=heads(journal,active.id);$('#version-bar').hidden=versions.length<2;
 $('#version').innerHTML=versions.map((v,i)=>`<option value="${esc(v.id)}">版本 ${i+1} · ${esc(new Date(v.at).toLocaleString('zh-CN'))}</option>`).join('');
 $('#version').value=versions.find(v=>v.value.title===active.title&&v.value.text===active.text)?.id||versions.at(-1)?.id||'';
 count();const last=versions.at(-1);$('#edited-at').textContent=last?'更新于 '+new Date(last.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'';
}
async function commit(resolve=false){
 clearTimeout(timer);if(!dirty||!active)return;
 const pending=value(),token=generation,next=await store.save(pending,base,resolve);active=pending;base=next;dirty=token!==generation;
 await refreshData();clearError();$('#save-state').textContent=dirty?'保存中…':'已自动保存到本机';renderList();
}
async function open(id){await commit();await refreshData();const draft=draftCache['draft:'+id],note=rows(journal).find(n=>n.id===id);if(!draft&&!note)return;active=draft?.value||note;base=draft?.base??revision(journal,id);dirty=!!draft;clearError();renderList();renderEditor();await store.set('last-note',id);$('#save-state').textContent=draft?'已恢复未完成的文字':'已保存在本机';if(draft)timer=setTimeout(()=>void run(()=>commit()).catch(()=>{}),600);}
async function create(){await commit();active={id:crypto.randomUUID(),title:'',text:'',date:today(),category:category||'生活',pinned:false,deleted:false};base='';dirty=true;view='all';query='';$('#query').value='';renderEditor();await commit();await store.set('last-note',active.id);$('#note-title').focus();}
function changed(){
 if(!active)return;dirty=true;clearTimeout(timer);$('#save-state').textContent='保存中…';count();
 const draft={base,value:value(),at:Date.now()},token=++generation;
 void run(async()=>{if(active?.id===draft.value.id)draft.base=base;await store.set('draft:'+draft.value.id,draft);draftCache['draft:'+draft.value.id]=draft;if(token===generation)timer=setTimeout(()=>void run(()=>commit()).catch(()=>{}),450);}).catch(()=>{});
}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function insert(text){const area=$('#note-text');area.setRangeText(text,area.selectionStart,area.selectionEnd,'end');area.focus();changed();}
$('#new-note').onclick=$('#first-note').onclick=()=>void run(create).catch(()=>{});
$('#note-list').onclick=e=>{const b=e.target.closest('[data-note]');if(b)void run(()=>open(b.dataset.note)).catch(()=>{});};
for(const el of [$('#note-title'),$('#note-text'),$('#note-date'),$('#note-category')])el.addEventListener('input',changed);
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;renderList();};
for(const b of document.querySelectorAll('[data-category]'))b.onclick=()=>{category=b.dataset.category;renderList();};
$('#query').oninput=()=>{query=$('#query').value.trim().toLocaleLowerCase();renderList();};
$('#pin').onclick=()=>void run(async()=>{await commit();active.pinned=!active.pinned;dirty=true;await commit();renderEditor();}).catch(()=>{});
$('#delete').onclick=()=>void run(async()=>{await commit();active.deleted=true;dirty=true;await commit();active=null;renderEditor();renderList();await store.set('last-note',null);$('#save-state').textContent='已移入回收站，可随时恢复';}).catch(()=>{});
$('#restore').onclick=()=>void run(async()=>{active.deleted=false;dirty=true;await commit();view='all';renderEditor();renderList();}).catch(()=>{});
$('#insert-list').onclick=()=>insert(($('#note-text').selectionStart?'\n':'')+'☐ ');
$('#insert-date').onclick=()=>insert(new Date().toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})+' ');
$('#focus').onclick=()=>{const on=document.body.classList.toggle('focused');$('#focus').setAttribute('aria-pressed',on);$('#focus').textContent=on?'退出专注':'专注书写';};
$('#export-text').onclick=()=>void run(async()=>{await commit();const n=value();download((n.title||'无标题记事')+'\n'+n.date+' · '+n.category+'\n\n'+n.text,(n.title||'日常记事').replace(/[\\/:*?"<>|]/g,'_').slice(0,80)+'.txt','text/plain;charset=utf-8');}).catch(()=>{});
$('#backup').onclick=()=>void run(async()=>{await commit();download(JSON.stringify(await store.exportBackup()),'纸间日常记事-'+today()+'.json','application/json');}).catch(()=>{});
$('#import').onclick=()=>$('#import-file').click();
$('#import-file').onchange=e=>{const f=e.target.files[0];if(!f)return;void run(async()=>{await commit();if(f.size>50000000)throw Error('日常记事备份超过 50 MB');await store.importBackup(JSON.parse(await f.text()));await refreshData();renderList();if(active)await open(active.id);else{const first=Object.values(draftCache)[0]?.value.id||rows(journal).find(n=>!n.deleted)?.id;if(first)await open(first);}$('#save-state').textContent='备份已合并，原有记事保留';}).catch(()=>{}).finally(()=>{e.target.value='';});};
$('#save-copy').onclick=()=>void run(async()=>{const copy=value(),oldId=active.id;active={...copy,id:crypto.randomUUID(),title:(copy.title||'无标题记事').slice(0,290)+' · 副本',deleted:false};base='';dirty=true;renderEditor();await commit();await store.set('draft:'+oldId,null);await refreshData();renderEditor();renderList();await store.set('last-note',active.id);}).catch(()=>{});
$('#version').onchange=()=>{const selected=$('#version').value;void run(async()=>{await commit();const event=heads(journal,active.id).find(v=>v.id===selected);if(event){active={...event.value};renderEditor();}}).catch(()=>{});};
$('#resolve').onclick=()=>void run(async()=>{dirty=true;await commit(true);renderEditor();}).catch(()=>{});
window.workspaceFlush=()=>run(()=>commit());window.workspaceOpen=id=>run(()=>open(id));
document.addEventListener('visibilitychange',()=>{if(document.hidden)void window.workspaceFlush().catch(()=>{});});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void window.workspaceFlush().catch(()=>{});}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();void run(create).catch(()=>{});}
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#query').focus();$('#query').select();}
 if(e.key==='Escape'&&document.body.classList.contains('focused'))$('#focus').click();
});
window.addEventListener('daily-remote',()=>void run(async()=>{await refreshData();renderList();if(active&&!dirty)await open(active.id);}).catch(()=>{}));
async function init(){await refreshData();const last=await store.get('last-note'),first=new URL(location.href).searchParams.get('note')||Object.values(draftCache)[0]?.value.id||last||rows(journal).find(n=>!n.deleted)?.id;renderList();renderEditor();if(first)await open(first);}
await run(init).catch(()=>{});
