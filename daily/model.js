export const empty=()=>({schemaVersion:1,events:[]});
export const categories=['生活','待办','灵感'];
const text=(v,n)=>typeof v==='string'&&v.length<=n;
export function validate(d){
 if(!d||d.schemaVersion!==1||!Array.isArray(d.events)||d.events.length>100000)throw Error('日常记事备份格式无效');
 const map=new Map();
 for(const e of d.events){const v=e?.value;if(!e||!text(e.id,100)||!e.id||!text(e.key,100)||!e.key||map.has(e.id)||!Number.isFinite(e.at)||!Array.isArray(e.parents)||new Set(e.parents).size!==e.parents.length||e.parents.some(p=>!text(p,100))||!v||v.id!==e.key||!text(v.title,300)||!text(v.text,200000)||typeof v.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!categories.includes(v.category)||typeof v.pinned!=='boolean'||typeof v.deleted!=='boolean')throw Error('日常记事内容或版本无效');map.set(e.id,e);}
 const degree=new Map(),children=new Map();
 for(const e of d.events){degree.set(e.id,e.parents.length);for(const p of e.parents){if(!map.has(p)||map.get(p).key!==e.key)throw Error('日常记事缺少关联版本');if(!children.has(p))children.set(p,[]);children.get(p).push(e.id);}}
 const queue=d.events.filter(e=>!e.parents.length).map(e=>e.id);for(let i=0;i<queue.length;i++)for(const id of children.get(queue[i])||[]){degree.set(id,degree.get(id)-1);if(!degree.get(id))queue.push(id);}if(queue.length!==d.events.length)throw Error('日常记事版本关联循环');return d;
}
export function heads(d,id){const events=d.events.filter(e=>e.key===id),used=new Set(events.flatMap(e=>e.parents));return events.filter(e=>!used.has(e.id)).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));}
export const revision=(d,id)=>heads(d,id).map(e=>e.id).sort().join(',');
export function rows(d){const groups=new Map(),used=new Set(d.events.flatMap(e=>e.parents));for(const e of d.events)if(!used.has(e.id)){if(!groups.has(e.key))groups.set(e.key,[]);groups.get(e.key).push(e);}return [...groups.values()].map(group=>{group.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));const e=group.at(-1);return {...e.value,updatedAt:e.at,conflicts:group.length>1};}).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));}
function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v);}
export function merge(a,b){validate(a);validate(b);const map=new Map(a.events.map(e=>[e.id,e]));for(const e of b.events){const old=map.get(e.id);if(old&&canonical(old)!==canonical(e))throw Error('同一日常记事版本内容不同');map.set(e.id,e);}return validate({schemaVersion:1,events:[...map.values()]});}
