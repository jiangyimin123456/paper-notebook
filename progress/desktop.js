import {academicState} from '../academic-document.js';
// Desktop journal tools operate on the current editor and keep its normal save path.
export function setup(panel){
 const $=s=>document.querySelector(s),main=$('#main');
 let observedHeading;
 const headingSize=new ResizeObserver(entries=>{for(const entry of entries)if(entry.target===observedHeading)document.documentElement.style.setProperty('--log-heading-height',entry.target.getBoundingClientRect().height+'px');});
 const trackHeading=()=>{const heading=$('.log-entry-heading');if(heading===observedHeading)return;headingSize.disconnect();observedHeading=heading;if(heading)headingSize.observe(heading);else document.documentElement.style.removeProperty('--log-heading-height');};
 window.addEventListener('studio-note-open',trackHeading);trackHeading();
 const settings=document.createElement('dialog');settings.id='log-settings';
 settings.innerHTML='<div class="dialog-heading"><h2>日志阅读设置</h2><button type="button" aria-label="关闭阅读设置">×</button></div><p class="meta">这台浏览器会记住你的版式偏好。</p><label>正文宽度<select id="log-width"><option value="comfortable">舒适阅读</option><option value="wide">宽屏图文</option></select></label><label>正文字号<select id="log-font"><option value="15">15 px</option><option value="17">17 px</option><option value="19">19 px</option></select></label>';
 document.body.append(settings);settings.querySelector('button').onclick=()=>settings.close();
 let prefs={width:'comfortable',font:'17'};try{const stored=JSON.parse(localStorage.getItem('paper-log-layout')||'{}');if(['comfortable','wide'].includes(stored.width))prefs.width=stored.width;if(['15','17','19'].includes(stored.font))prefs.font=stored.font;}catch{}
 const apply=()=>{document.body.dataset.logWidth=prefs.width;document.body.style.setProperty('--log-font-size',prefs.font+'px');};apply();
 $('#log-width').value=prefs.width;$('#log-font').value=prefs.font;
 settings.onchange=()=>{prefs={width:$('#log-width').value,font:$('#log-font').value};apply();try{localStorage.setItem('paper-log-layout',JSON.stringify(prefs));}catch{}};
 const actions=document.createElement('div');actions.className='log-desktop-actions';
 actions.innerHTML='<button type="button" id="log-template-open">＋ 记录框架</button><button type="button" id="log-settings-open">阅读设置</button>';
 $('.studio-toolstrip').append(actions);$('#log-settings-open').onclick=()=>settings.showModal();
 const templates={
  experiment:{title:'实验记录',sections:['目标与假设','条件、样品与原始文件','观察与结果','判断与不确定性','下一步与对照']},
  computation:{title:'计算记录',sections:['科学问题与模型边界','结构、参数与输入文件','结果与收敛检查','解释与待验证假设','下一步验证']},
  review:{title:'阶段复盘',sections:['本阶段目标','证据与已完成工作','问题与不同解释','本次决策及依据','下一阶段任务']}
 };
 const dialog=document.createElement('dialog');dialog.id='log-template-dialog';
 dialog.innerHTML='<div class="dialog-heading"><h2>插入记录框架</h2><button type="button" aria-label="关闭记录框架">×</button></div><p class="meta">把空白小标题追加到正文末尾，按需填写。</p><label>记录类型<select id="log-template-kind"><option value="experiment">实验记录</option><option value="computation">计算记录</option><option value="review">阶段复盘</option></select></label><ol id="log-template-preview"></ol><p id="log-template-error" role="status"></p><button type="button" class="primary" id="log-template-apply">追加到正文末尾</button>';
 document.body.append(dialog);dialog.querySelector('.dialog-heading button').onclick=()=>dialog.close();
 const preview=()=>{const t=templates[$('#log-template-kind').value];$('#log-template-preview').replaceChildren(...t.sections.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));};preview();$('#log-template-kind').onchange=preview;
 const editable=()=>{const e=$('#page-editor');return e&&e.contentEditable==='true'&&!academicState(e)?.record&&!$('#save-entry')?.disabled;};let templateEditor;
 $('#log-template-open').onclick=()=>{if(!editable())return;templateEditor=$('#page-editor');$('#log-template-error').textContent='';dialog.showModal();};
 $('#log-template-apply').onclick=()=>{if(!editable()||templateEditor!==$('#page-editor')){$('#log-template-error').textContent='当前日志已切换或不可编辑，请关闭后重试。';return;}
  const editor=$('#page-editor'),t=templates[$('#log-template-kind').value];dialog.close();editor.focus();const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  const html=t.sections.map(h=>'<h2>'+h+'</h2><p><br></p>').join('');document.execCommand('insertHTML',false,html);editor.dispatchEvent(new Event('input',{bubbles:true}));
 };
 const meter=document.createElement('div');meter.className='log-reading-position';meter.innerHTML='<span>当前阅读位置</span><progress max="100" value="0" aria-label="日志阅读进度"></progress>';panel.querySelector('h3').after(meter);
 let frame=0;
 const update=()=>{frame=0;const editor=$('#page-editor'),buttons=[...panel.querySelectorAll('.studio-outline button')],headings=[...(editor?.querySelectorAll('h1,h2,h3,h4,h5,h6')||[])];
  $('#log-template-open').disabled=!editable();meter.hidden=!editor;
  const inset=parseFloat(getComputedStyle(main).scrollPaddingTop)||0,top=main.getBoundingClientRect().top+(main.clientHeight+inset)*.5+2;let active=0;for(let i=0;i<headings.length;i++)if(headings[i].getBoundingClientRect().top<=top)active=i;
  if(main.scrollHeight>main.clientHeight&&main.scrollTop+main.clientHeight>=main.scrollHeight-3)active=Math.max(0,headings.length-1);
  buttons.forEach((b,i)=>{b.style.setProperty('--outline-depth',headings[i]?Math.max(0,Number(headings[i].tagName.slice(1))-2):0);if(i===active)b.setAttribute('aria-current','location');else b.removeAttribute('aria-current');});
  const max=main.scrollHeight-main.clientHeight;meter.querySelector('progress').value=max>0?Math.min(100,Math.max(0,main.scrollTop/max*100)):100;
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 main.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
 new MutationObserver(schedule).observe(main,{childList:true,subtree:true,characterData:true});
 new MutationObserver(schedule).observe(panel.querySelector('.studio-outline'),{childList:true});
 document.addEventListener('input',schedule);for(const type of ['studio-note-open','academic-rendered','academic-change'])window.addEventListener(type,schedule);schedule();
}
