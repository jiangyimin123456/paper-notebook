// Optional extension: old journals retain their original events and schema version.
export function validateAcademic(v){
 if(v.frontmatter!==undefined){const m=v.frontmatter;if(!m||typeof m!=='object'||Array.isArray(m)||JSON.stringify(m).length>40000)throw Error('科研元数据格式无效');for(const k of ['tags','related','keywords'])if(m[k]!==undefined&&(!Array.isArray(m[k])||m[k].length>50||m[k].some(t=>typeof t!=='string'||t.length>200)))throw Error('科研标签或关联格式无效');for(const [k,x]of Object.entries(m))if(!['tags','related','keywords'].includes(k)&&(typeof x!=='string'||x.length>20000))throw Error('科研元数据字段无效');}
 if(v.academic!==undefined){const a=v.academic;if(!a||a.version!==1||typeof a.source!=='string'||a.source.length>150000||typeof a.html!=='string'||a.html.length>1500000||!Array.isArray(a.links)||a.links.length>300||a.links.some(x=>typeof x!=='string'||x.length>200))throw Error('Markdown 或预编译公式格式无效');if(a.pending)throw Error('Markdown 尚未编译，请检查 YAML 或公式后重新保存');}
}
