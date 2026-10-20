import {createSearch} from './vendor/academic/search.js';
const engine=createSearch();
self.onmessage=({data:{id,type,records,query,options}})=>{try{const start=performance.now();if(type==='update')engine.update(records);const result=type==='query'?engine.query(query,options).map(record=>{const at=record.body.toLowerCase().indexOf(query.trim().toLowerCase()),start=Math.max(0,at-45);return {...record,body:(start?'…':'')+record.body.slice(start,start+300)};}):engine.size();self.postMessage({id,result,ms:performance.now()-start});}catch(e){self.postMessage({id,error:e.message});}};
