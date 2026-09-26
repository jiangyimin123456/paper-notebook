import * as paper from './store.js';
import * as paperModel from './model.js';
import * as progress from './progress/store.js';
import * as progressModel from './progress/model.js';
import * as english from './english-adapter.js';
// Add a store/model adapter here to include a future module in unified sync.
export const modules=[
 {id:'paper',name:'文献笔记',repo:'paper-notebook-data',file:'notebook-v1.json',lock:'paper-notebook-sync',store:paper,model:paperModel,empty:()=>paperModel.empty(),vault:'vault'},
 {id:'english',name:'英语学习',repo:'english-coach-data',file:'learning-v2.json',lock:'english-notebook-sync',store:english,model:english,empty:()=>({schemaVersion:2,events:[]}),vault:'sync-vault'},
 {id:'progress',name:'课题进展',repo:'paper-notebook-data',file:'progress-v1.json',lock:'paper-notebook-sync',store:progress,model:progressModel,empty:()=>progressModel.empty(),vault:'vault'}
];
