// DeftAI Cloudflare D1 bridge. Bind your D1 database as DB.
// Add Worker secret DEFTAI_D1_SECRET and set the same value as Render's D1_API_SECRET.
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
export default {async fetch(request,env){
 if(request.method!=='POST')return reply({error:'Method not allowed'},405);
 if(!env.DB||!env.DEFTAI_D1_SECRET)return reply({error:'Missing DB binding or DEFTAI_D1_SECRET.'},503);
 if(request.headers.get('X-DeftAI-Secret')!==env.DEFTAI_D1_SECRET)return reply({error:'Unauthorized'},401);
 const action=new URL(request.url).pathname.split('/').filter(Boolean).pop();
 let body;try{body=await request.json()}catch{return reply({error:'Invalid JSON'},400)}
 try{
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS deftai_kv (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL)').run();
  if(action==='get'){
   if(typeof body.key!=='string'||body.key.length>240)return reply({error:'Invalid key'},400);
   const row=await env.DB.prepare('SELECT value FROM deftai_kv WHERE key=?').bind(body.key).first();
   return reply({ok:true,found:!!row,value:row?JSON.parse(row.value):null});
  }
  if(action==='set'){
   if(typeof body.key!=='string'||body.key.length>240||!Object.hasOwn(body,'value'))return reply({error:'Invalid key or value'},400);
   await env.DB.prepare('INSERT INTO deftai_kv (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(body.key,JSON.stringify(body.value),Date.now()).run();
   return reply({ok:true});
  }
  if(action==='delete'){
   if(typeof body.key!=='string'||body.key.length>240)return reply({error:'Invalid key'},400);
   await env.DB.prepare('DELETE FROM deftai_kv WHERE key=?').bind(body.key).run();return reply({ok:true});
  }
  if(action==='import'){
   if(!Array.isArray(body.entries)||body.entries.length>25)return reply({error:'Import batch must contain at most 25 entries'},400);
   const stmts=body.entries.filter(x=>x&&typeof x.key==='string'&&x.key.length<=240).map(x=>env.DB.prepare('INSERT INTO deftai_kv (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO NOTHING').bind(x.key,JSON.stringify(x.value),Date.now()));
   if(stmts.length)await env.DB.batch(stmts);return reply({ok:true,imported:stmts.length});
  }
  if(action==='all'){
   const result=await env.DB.prepare('SELECT key,value FROM deftai_kv').all(),entries={};
   for(const row of result.results||[])entries[row.key]=JSON.parse(row.value);
   return reply({ok:true,entries});
  }
  return reply({error:'Unknown endpoint'},404);
 }catch(error){console.error('D1 operation failed:',error);return reply({error:'D1 operation failed'},500)}
}};
