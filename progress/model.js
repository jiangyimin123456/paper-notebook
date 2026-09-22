export const empty=()=>({schemaVersion:1,events:[]});
const isText=(v,n=100000)=>typeof v==='string'&&v.length<=n;
export function validate(d){
 if(!d||d.schemaVersion!==1||!Array.isArray(d.events)||d.events.length>100000)throw Error('不是有效的文献笔记备份');
 const map=new Map();
 for(const e of d.events){if(!e||!isText(e.id,100)||!e.id||!['paper','note'].includes(e.table)||!isText(e.key,100)||!e.key||!Array.isArray(e.parents)||e.parents.some(p=>!isText(p,100))||!Number.isFinite(e.at)||map.has(e.id))throw Error('笔记版本格式无效');
 const v=e.value;if(!v||v.id!==e.key||typeof v.archived!=='boolean')throw Error('笔记内容格式无效');
 if(e.table==='paper'){if(!isText(v.title,1000)||!v.title.trim()||!isText(v.authors,500)||!isText(v.year,20)||!isText(v.source,2000)||!isText(v.tags,300)||!['reading','unread','done'].includes(v.status))throw Error('文献信息格式无效');}
 else if(!isText(v.paperId,100)||!isText(v.text)||!isText(v.locator,2000)||!['note','quote','inspiration','question'].includes(v.kind)||!Array.isArray(v.images)||v.images.length>20||v.images.some(x=>typeof x!=='string'||!/^img-[a-f0-9]{64}$/.test(x)))throw Error('笔记或截图信息格式无效');
 if(e.table==='note'){
  if(!isText(v.result)||!isText(v.plan)||!isText(v.ref,2000)||!isText(v.date,10)||!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!['ongoing','blocked','done'].includes(v.state))throw Error('进展记录格式无效');
  if(v.source!==undefined&&!isText(v.source,3000))throw Error('笔记来源格式无效');
  if(v.tags!==undefined&&(!Array.isArray(v.tags)||v.tags.length>12||v.tags.some(t=>!isText(t,50))))throw Error('分类标签格式无效');
  if(v.ai!==undefined){const a=v.ai;if(!a||!Array.isArray(a.tags)||a.tags.length>4||a.tags.some(t=>!isText(t,50))||!Array.isArray(a.keywords)||a.keywords.length>20||a.keywords.some(t=>!isText(t,80))||!isText(a.ocr,18000)||!isText(a.fingerprint,64)||!Number.isFinite(a.confidence)||a.confidence<0||a.confidence>1)throw Error('AI 分类结果格式无效');}
 }
 map.set(e.id,e);}
 const indegree=new Map(),children=new Map();for(const e of d.events){indegree.set(e.id,e.parents.length);for(const p of e.parents){const parent=map.get(p);if(!parent||parent.key!==e.key||parent.table!==e.table)throw Error('缺少关联版本');if(!children.has(p))children.set(p,[]);children.get(p).push(e.id);}}
 const queue=d.events.filter(e=>!e.parents.length).map(e=>e.id);for(let i=0;i<queue.length;i++)for(const id of children.get(queue[i])||[]){indegree.set(id,indegree.get(id)-1);if(!indegree.get(id))queue.push(id);}if(queue.length!==d.events.length)throw Error('版本关联存在循环');
 const papers=new Set(d.events.filter(e=>e.table==='paper').map(e=>e.key));if(d.events.some(e=>e.table==='note'&&!papers.has(e.value.paperId)))throw Error('笔记缺少关联文献');return d;
}
export function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
export function merge(a,b){const map=new Map(a.events.map(e=>[e.id,e]));for(const e of b.events){if(map.has(e.id)&&canonical(map.get(e.id))!==canonical(e))throw Error('同一版本存在不同内容，已停止合并');map.set(e.id,e);}return validate({schemaVersion:1,events:[...map.values()].sort((a,b)=>a.id.localeCompare(b.id))});}
export function heads(d,table,key){const events=d.events.filter(e=>e.table===table&&e.key===key),parents=new Set(events.flatMap(e=>e.parents));return events.filter(e=>!parents.has(e.id)).sort((a,b)=>a.id.localeCompare(b.id));}
export function rows(d,table){return [...new Set(d.events.filter(e=>e.table===table).map(e=>e.key))].map(key=>{const h=heads(d,table,key);return {...h.at(-1).value,updatedAt:Math.max(...h.map(e=>e.at))};}).sort((a,b)=>b.updatedAt-a.updatedAt);}
export function conflicts(d){return [...new Set(d.events.map(e=>e.table+':'+e.key))].map(k=>{const i=k.indexOf(':'),table=k.slice(0,i),key=k.slice(i+1);return {table,key,versions:heads(d,table,key)};}).filter(c=>c.versions.length>1);}
export function append(d,table,value,resolve=false){const parents=heads(d,table,value.id);if(parents.length>1&&!resolve)throw Error('这条记录存在并行版本，请先到备份与同步中选择版本');const clean={...value};delete clean.updatedAt;d.events.push({id:crypto.randomUUID(),key:value.id,table,value:clean,parents:parents.map(e=>e.id),at:Date.now()});validate(d);}
