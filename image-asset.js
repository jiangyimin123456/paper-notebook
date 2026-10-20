const LIMIT=800000;
const dataURL=blob=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
export async function prepareImage(file){
 if(!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type))throw Error('请选择 PNG、JPEG、WebP、GIF 或 SVG 图片');
 if(file.size>20*1024*1024)throw Error('单张图片请小于 20 MB');
 const vector=file.type==='image/svg+xml';let blob=file,temporary;
 if(vector){const {DOMPurify}=await import('./vendor/academic/compiler.js');const doc=new DOMParser().parseFromString(DOMPurify.sanitize(await file.text(),{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['style','script','foreignObject','image','use','a','animate','set'],FORBID_ATTR:['style','href','xlink:href']}),'image/svg+xml');const svg=doc.documentElement;if(svg.tagName.toLowerCase()!=='svg'||doc.querySelector('parsererror'))throw Error('SVG 格式无效');for(const n of svg.querySelectorAll('*'))for(const a of [...n.attributes])if(/url\s*\(/i.test(a.value)&&!/^url\(#[\w-]+\)$/.test(a.value))n.removeAttribute(a.name);const box=(svg.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number);if(!svg.getAttribute('width'))svg.setAttribute('width',String(box[2]||1600));if(!svg.getAttribute('height'))svg.setAttribute('height',String(box[3]||1000));blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'});}
 let bitmap;
 try{
  if(vector){temporary=URL.createObjectURL(blob);const img=new Image();img.src=temporary;await img.decode();bitmap=img;}else bitmap=await createImageBitmap(blob);
  const width=bitmap.width||bitmap.naturalWidth,height=bitmap.height||bitmap.naturalHeight;if(!width||!height||width*height>100000000)throw Error('图片尺寸过大或无法识别，请裁剪后导入');
  // Keep original raster bytes when they fit the existing sync/backup envelope.
  if(!vector&&file.type!=='image/gif'&&Math.max(width,height)<=12000&&file.size<590000){const original=await dataURL(file);if(original.length<=LIMIT)return original;}
  const ratio=Math.min(1,6000/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*ratio));canvas.height=Math.max(1,Math.round(height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  const png=canvas.toDataURL('image/png');if(png.length<=LIMIT)return png;
  for(const quality of [.98,.92,.85,.75]){const webp=canvas.toDataURL('image/webp',quality);if(webp.length<=LIMIT)return webp;}
  throw Error('高清图片超过同步容量，请裁剪或拆分后导入；不会静默缩成模糊小图');
 }finally{bitmap?.close?.();if(temporary)URL.revokeObjectURL(temporary);}
}
