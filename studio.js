
const $=s=>document.querySelector(s);
document.body.classList.add('studio');
const focus=document.createElement('button');focus.type='button';focus.dataset.studioFocus='';focus.textContent='专注写作';focus.setAttribute('aria-pressed','false');focus.title='隐藏目录和大纲，Esc 退出';$('.top-actions').prepend(focus);
focus.onclick=()=>{const active=document.body.classList.toggle('focus-mode');focus.setAttribute('aria-pressed',String(active));focus.textContent=active?'显示目录':'专注写作';};
const saveTop=document.createElement('button');saveTop.type='button';saveTop.className='primary';saveTop.textContent='保存笔记';saveTop.title='保存当前笔记（Ctrl / ⌘ S）';saveTop.onclick=()=>($('#save-entry')||$('#save-note'))?.click();focus.before(saveTop);
const panel=document.createElement('aside');panel.className='studio-inspector';panel.setAttribute('aria-label','当前笔记概览');panel.innerHTML='<h3>当前笔记 · 大纲</h3><div class="studio-outline"></div><div class="studio-stats"></div><div class="studio-shortcuts"><kbd>Ctrl / ⌘ S</kbd> 保存笔记<br><kbd>Esc</kbd> 退出专注模式</div><p>草稿保存在当前浏览器。<br>保存笔记后，解锁全部同步即可跨电脑使用。</p>';$('.workspace').append(panel);
function update(){const save=$('#save-entry')||$('#save-note');saveTop.disabled=!save||save.matches(':disabled');const main=$('#main'),meta=$('#paper-meta-form');if(meta&&!meta.parentElement.classList.contains('studio-properties')){const details=document.createElement('details');details.className='studio-properties';details.open=!$('#paper-picker')?.value;const summary=document.createElement('summary');summary.textContent=$('#paper-title-input')?.value?'文献信息 · '+$('#paper-title-input').value:'填写文献题目与 DOI';meta.before(details);details.append(summary,meta);}
const editor=$('#page-editor')||$('#note-rich')||$('#note-text'),outline=panel.querySelector('.studio-outline');const headings=[...(editor?.querySelectorAll('h2,h3')||[])];outline.replaceChildren();if(headings.length){for(const h of headings){const b=document.createElement('button');b.type='button';b.textContent=h.textContent||'未命名小标题';b.onclick=()=>h.scrollIntoView({behavior:'smooth',block:'center'});outline.append(b);}}else{const p=document.createElement('p');p.textContent=editor?.id==='page-editor'?'使用工具栏「小标题」为长笔记建立目录。':'自由记录摘录、理解和启发；文献出处收在正文上方。';outline.append(p);}
const text=editor?.value??editor?.innerText??'';panel.querySelector('.studio-stats').textContent=text.replace(/\s/g,'').length+' 字 · '+(editor?.querySelectorAll('img').length||$('#draft-images')?.querySelectorAll('img').length||0)+' 张图片';
}
let timer;const schedule=()=>{clearTimeout(timer);timer=setTimeout(update,90);};new MutationObserver(schedule).observe($('#main'),{childList:true,subtree:true});document.addEventListener('input',schedule);update();
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('focus-mode')&&!document.querySelector('dialog[open]'))focus.click();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&!document.querySelector('dialog[open]')){const save=$('#save-entry')||$('#save-note');if(save&&!save.disabled){e.preventDefault();save.click();}}});

import './workspace-tools.js';

import './capture-assistant.js';
