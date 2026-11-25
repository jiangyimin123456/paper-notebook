import {empty,validate,merge,revision,heads} from './model.js';
let connection;
export function db(){return connection??=new Promise((resolve,reject)=>{const r=indexedDB.open('paper-daily-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('data');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function get(key){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('data').objectStore('data').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function set(key,value){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('data','readwrite');t.objectStore('data').put(value,key);t.oncomplete=resolve;t.onerror=t.onabort=()=>reject(t.error);});}
export const snapshot=async()=>await get('journal')||empty();
export async function save(value,expected,resolve=false){return navigator.locks.request('paper-daily-write',async()=>{
 const journal=await snapshot(),parents=heads(journal,value.id);
 if(revision(journal,value.id)!==expected||parents.length>1&&!resolve)throw Error('其他页面或备份有新版本。你的文字仍保留，请另存一份后核对。');
 const clean={id:value.id,title:value.title,text:value.text,date:value.date,category:value.category,pinned:value.pinned,deleted:value.deleted};
 journal.events.push({id:crypto.randomUUID(),key:value.id,at:Date.now(),parents:parents.map(e=>e.id),value:clean});validate(journal);
 const d=await db();await new Promise((ok,fail)=>{const t=d.transaction('data','readwrite'),s=t.objectStore('data');s.put(journal,'journal');s.delete('draft:'+value.id);t.oncomplete=ok;t.onerror=t.onabort=()=>fail(t.error);});
 announce();return revision(journal,value.id);
 });}
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('paper-daily-changes'):null;
function announce(){window.dispatchEvent(new Event('daily-local'));channel?.postMessage('changed');}
channel?.addEventListener('message',()=>window.dispatchEvent(new Event('daily-remote')));
export async function exportBackup(){return {format:'paper-daily-backup-v1',createdAt:new Date().toISOString(),journal:await snapshot(),drafts:await drafts()};}
export function validateBackup(input){if(input?.format!=='paper-daily-backup-v1'||!input.drafts||Array.isArray(input.drafts))throw Error('请选择日常记事备份文件');validate(input.journal);for(const [key,d]of Object.entries(input.drafts)){if(!key.startsWith('draft:')||!d?.value||key!=='draft:'+d.value.id||typeof d.base!=='string'||d.base.length>10000)throw Error('日常记事草稿无效');validate({schemaVersion:1,events:[{id:'draft-validation',key:d.value.id,parents:[],at:0,value:d.value}]});}return input;}
export async function drafts(){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('data'),s=t.objectStore('data'),keys=s.getAllKeys(),values=s.getAll();t.oncomplete=()=>resolve(Object.fromEntries(keys.result.map((k,i)=>[k,values.result[i]]).filter(([k,v])=>typeof k==='string'&&k.startsWith('draft:')&&v!=null)));t.onerror=()=>reject(t.error);});}
export async function importBackup(input){validateBackup(input);return navigator.locks.request('paper-daily-write',async()=>{
 const journal=merge(await snapshot(),input.journal),current=await drafts();
 for(const [key,draft]of Object.entries(input.drafts))if(!current[key])current[key]=draft;else if(JSON.stringify(current[key])!==JSON.stringify(draft)){
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([key,draft]))),id='recovered-'+[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(!current['draft:'+id]&&!journal.events.some(e=>e.key===id))current['draft:'+id]={base:'',value:{...draft.value,id,title:(draft.value.title||'未命名记事').slice(0,280)+' · 恢复的草稿'}};
 }
 const d=await db();await new Promise((ok,fail)=>{const t=d.transaction('data','readwrite'),s=t.objectStore('data');s.put(journal,'journal');for(const [k,v]of Object.entries(current))s.put(v,k);t.oncomplete=ok;t.onerror=t.onabort=()=>fail(t.error);});announce();
 });}
