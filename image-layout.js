// Image layout is stored as a small, sanitizable schema; controls live outside the document.
const editors=new WeakSet();
let active=null,gesture=null,proposal=null;
const tools=document.createElement('div');
tools.className='image-layout-tools';tools.hidden=true;tools.contentEditable='false';
tools.setAttribute('role','group');tools.setAttribute('aria-label','图片排版');
tools.innerHTML='<button type="button" data-image-action="move" title="拖动调整位置；拖到另一张图片中部左右侧可并排" aria-label="拖动图片">⠿ 移动</button><button type="button" data-image-action="left" title="左对齐">左</button><button type="button" data-image-action="center" title="居中">中</button><button type="button" data-image-action="right" title="右对齐">右</button><span class="image-layout-size" role="status"></span><button type="button" data-image-action="replace" title="替换当前图片" aria-label="替换图片">替换</button><button type="button" data-image-action="delete" title="从当前笔记移除图片" aria-label="删除图片">删除</button><button type="button" data-image-action="resize" title="拖动调整大小" aria-label="拖动缩放图片">↘</button>';
const indicator=document.createElement('div');indicator.className='image-drop-indicator';indicator.hidden=true;
const hint=document.createElement('div');hint.className='image-drag-hint';hint.hidden=true;
document.body.append(tools,indicator,hint);
const selectionSize=new ResizeObserver(()=>position());
const editable=editor=>editor?.isConnected&&editor.isContentEditable&&!editor.classList.contains('academic-reading');
const selectable=editor=>editable(editor)||editor?.isConnected&&editor.classList.contains('academic-reading');
const rowOf=img=>img.closest('[data-image-row]');
const figureOf=img=>img.closest('figure');
export function imageWidth(img){return Number(rowOf(img)?figureOf(img)?.dataset.imageWidth:img.dataset.width)||100;}
export const selectedLayoutImage=editor=>active?.editor===editor?active.img:null;
export function setImageWidth(img,value){
 const width=Math.max(10,Math.min(100,Math.round(Number(value)||100))),figure=figureOf(img);
 if(rowOf(img)&&figure){figure.dataset.imageWidth=String(width);figure.style.setProperty('--image-width',String(width));img.dataset.width='100';img.style.width='100%';}
 else{img.dataset.width=String(width);img.style.width=width+'%';}
 if(active?.img===img)position();
}
function changed(editor){editor.dispatchEvent(new Event('input',{bubbles:true}));}
function syncControls(){if(!active)return;for(const el of document.querySelectorAll('#paper-image-width,#paper-image-percent,#image-size-slider,#image-size-number')){el.disabled=false;el.value=imageWidth(active.img);}}
function position(){
 if(!active||!selectable(active.editor)||!active.editor.contains(active.img)){tools.hidden=true;active=null;selectionSize.disconnect();return;}
 const r=active.img.getBoundingClientRect(),clip=active.editor.closest('#main')?.getBoundingClientRect()||{top:0,bottom:innerHeight,left:0,right:innerWidth};
 tools.hidden=r.bottom<clip.top+30||r.top>Math.min(innerHeight,clip.bottom)||r.right<0;
 if(tools.hidden)return;
 tools.style.left=Math.max(4,Math.min(r.left,innerWidth-tools.offsetWidth-4))+'px';
 tools.style.top=Math.max(4,Math.min(r.top-34,Math.min(innerHeight,clip.bottom)-34))+'px';
 const resize=tools.querySelector('[data-image-action=resize]');resize.style.left=Math.max(4,Math.min(r.right-24,innerWidth-28))+'px';resize.style.top=Math.max(4,Math.min(r.bottom-24,Math.min(innerHeight,clip.bottom)-28))+'px';
 tools.querySelector('.image-layout-size').textContent=imageWidth(active.img)+'%';
}
function select(editor,img){
 selectionSize.disconnect();selectionSize.observe(img);active?.img.classList.remove('image-selected');active={editor,img};img.classList.add('image-selected');position();syncControls();
 for(const action of ['move','left','center','right','resize'])tools.querySelector('[data-image-action="'+action+'"]').hidden=!editable(editor);
}
function figure(img){
 let f=figureOf(img);if(f&&f.querySelectorAll('img').length===1)return f;
 f=document.createElement('figure');img.before(f);f.append(img);return f;
}
function normalizeRow(row){
 if(!row?.isConnected)return;
 const figures=[...row.children].filter(n=>n.matches('figure'));
 if(figures.length>1)return;
 if(!figures.length){row.remove();return;}
 const f=figures[0];
 delete f.dataset.imageWidth;f.style.removeProperty('--image-width');row.replaceWith(f);
}
function blockAt(editor,node){let block=node;while(block?.parentElement&&block.parentElement!==editor)block=block.parentElement;return block?.parentElement===editor?block:null;}
function targetAt(x,y){
 const {editor,img}=active;
 const hit=document.elementFromPoint(x,y);if(!hit||!editor.contains(hit))return null;
 const other=hit.closest('img[data-image],figure')?.closest('figure')?.querySelector('img[data-image]')||hit.closest('img[data-image]');
 if(other===img)return null;
 if(other){const r=figureOf(other)?.getBoundingClientRect()||other.getBoundingClientRect(),imageRect=other.getBoundingClientRect(),fraction=(y-r.top)/r.height;
  if(fraction>.22&&fraction<.78)return {kind:x<imageRect.left+imageRect.width/2?'left':'right',other,box:imageRect};
 }
 if(hit===editor){const blocks=[...editor.children].filter(n=>!n.contains(img));const block=blocks.find(n=>y<n.getBoundingClientRect().bottom)||blocks.at(-1);if(!block)return null;const r=block.getBoundingClientRect();return {kind:y<r.top+r.height/2?'before':'after',block,box:r};}
 const block=blockAt(editor,hit);if(!block||block.contains(img))return null;
 const r=block.getBoundingClientRect();return {kind:y<r.top+r.height/2?'before':'after',block,box:r};
}
function showTarget(next){
 proposal=next;indicator.hidden=!next;if(!next){hint.textContent='拖到正文段落前后，或其他图片的中部左右侧';return;}
 const r=next.box,side=['left','right'].includes(next.kind);
 Object.assign(indicator.style,{left:(side?(next.kind==='left'?r.left:r.right)-3:r.left)+'px',top:(side?r.top:(next.kind==='before'?r.top:r.bottom)-2)+'px',width:(side?6:r.width)+'px',height:(side?r.height:4)+'px'});
 hint.textContent=side?'松开鼠标：并排放置图片':'松开鼠标：移动到此处';
}
function moveTo(target){
 const {img,editor}=active,oldRow=rowOf(img),f=figure(img);
 if(target.other){
  const other=target.other,otherFigure=figure(other);let row=rowOf(other);
  if(!row){row=document.createElement('div');row.dataset.imageRow='';otherFigure.before(row);row.append(otherFigure);}
  if(target.kind==='left')otherFigure.before(f);else otherFigure.after(f);
  for(const child of row.children){const image=child.querySelector('img[data-image]');if(image)setImageWidth(image,Math.floor(100/row.children.length));}
 }else{
  const width=imageWidth(img);delete f.dataset.imageWidth;f.style.removeProperty('--image-width');
  if(target.kind==='before')target.block.before(f);else target.block.after(f);setImageWidth(img,width);
 }
 normalizeRow(oldRow);changed(editor);syncControls();position();
}
function finish(cancel=false){
 if(!gesture)return;const g=gesture;gesture=null;
 if(cancel&&g.mode==='resize'&&active){setImageWidth(active.img,g.startWidth);syncControls();}
 if(!cancel&&active){if(g.mode==='move'&&g.started&&proposal)moveTo(proposal);else if(g.mode==='resize'&&g.started){changed(active.editor);syncControls();}}
 document.body.classList.remove('image-layout-dragging');indicator.hidden=true;hint.hidden=true;proposal=null;position();
}
function start(e,mode){
 if(e.button!==0||!active||!editable(active.editor))return;
 e.preventDefault();e.stopPropagation();
 const img=active.img,r=img.getBoundingClientRect();gesture={mode,x:e.clientX,y:e.clientY,startWidth:imageWidth(img),pixels:r.width,started:false};
 tools.hidden=true;
}
tools.addEventListener('pointerdown',e=>{const action=e.target.closest('[data-image-action]')?.dataset.imageAction;if(['move','resize'].includes(action))start(e,action);else e.preventDefault();});
tools.addEventListener('click',e=>{
 const action=e.target.closest('[data-image-action]')?.dataset.imageAction;if(!active||!selectable(active.editor))return;
 if(action==='replace'){active.editor.dispatchEvent(new CustomEvent('notebook-image-replace',{bubbles:true,detail:{image:active.img}}));return;}
 if(action==='delete'){
  if(active.editor.classList.contains('academic-reading')){active.editor.dispatchEvent(new CustomEvent('notebook-image-delete',{bubbles:true,detail:{image:active.img}}));active=null;tools.hidden=true;selectionSize.disconnect();return;}
  const {img,editor}=active,row=rowOf(img),figure=figureOf(img);if(figure&&figure.querySelectorAll('img').length===1)figure.remove();else img.remove();normalizeRow(row);changed(editor);active=null;tools.hidden=true;selectionSize.disconnect();return;
 }
 if(!editable(active.editor))return;
 if(!['left','center','right'].includes(action))return;
 figure(active.img).dataset.imageAlign=action;changed(active.editor);position();
});
document.addEventListener('pointermove',e=>{
 if(!gesture||!active)return;
 if(!editable(active.editor)){finish(true);return;}
 const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
 if(!gesture.started&&Math.hypot(dx,dy)<5)return;
 gesture.started=true;e.preventDefault();document.body.classList.add('image-layout-dragging');
 if(gesture.mode==='resize'){setImageWidth(active.img,gesture.startWidth*(gesture.pixels+dx)/gesture.pixels);syncControls();}
 else{
  hint.hidden=false;hint.style.left=Math.min(e.clientX+16,innerWidth-300)+'px';hint.style.top=Math.min(e.clientY+16,innerHeight-45)+'px';
  const main=active.editor.closest('#main'),r=main?.getBoundingClientRect();if(r){if(e.clientY>r.bottom-55)main.scrollTop+=18;else if(e.clientY<r.top+65)main.scrollTop-=18;}
  showTarget(targetAt(e.clientX,e.clientY));
 }
},{passive:false});
document.addEventListener('pointerup',()=>finish());document.addEventListener('pointercancel',()=>finish(true));
window.addEventListener('blur',()=>finish(true));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){finish(true);active?.img.classList.remove('image-selected');active=null;selectionSize.disconnect();tools.hidden=true;}});
document.addEventListener('pointerdown',e=>{if(active&&!tools.contains(e.target)&&!e.target.closest('img[data-image],.resize-tools')){active.img.classList.remove('image-selected');active=null;tools.hidden=true;}},true);
document.addEventListener('scroll',position,true);window.addEventListener('resize',position);window.addEventListener('academic-rendered',position);
export function mountImageLayout(editor){
 if(editors.has(editor))return;editors.add(editor);
 editor.addEventListener('click',e=>{const img=e.target.closest('img[data-image]');if(img&&selectable(editor))select(editor,img);});
 editor.addEventListener('pointerdown',e=>{const img=e.target.closest('img[data-image]');if(img&&editable(editor)){select(editor,img);start(e,'move');}});
 editor.addEventListener('dragstart',e=>{if(e.target.matches('img[data-image]'))e.preventDefault();});
 editor.addEventListener('load',()=>{if(active?.editor===editor)position();},true);

}
