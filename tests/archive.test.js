import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import definition from '../module.js';import {WorkStore} from '../core/store.js';
const save=(s,collection,data,id)=>{const n=s.transact({operation:'save',collection,data,id,revision:s.read().revision});return id||n.data[collection].at(-1).id;};
const audit=s=>s.db.prepare('SELECT * FROM audit ORDER BY rowid').all();
function rejected(s,action){const before=s.read(),events=audit(s);assert.throws(action,/архив/i);assert.deepEqual(s.read(),before);assert.deepEqual(audit(s),events);}
function fixture(s){const p1=save(s,'profiles',{name:'SYNTHETIC live resume',resume:'JavaScript'}),p2=save(s,'profiles',{name:'SYNTHETIC history resume',resume:'JavaScript'}),v1=save(s,'vacancies',{title:'SYNTHETIC live vacancy',company:'SYNTHETIC company',url:'https://example.org/live',requirements:'JavaScript\nPython'}),v2=save(s,'vacancies',{title:'SYNTHETIC history vacancy',company:'SYNTHETIC company',url:'https://example.org/history',requirements:'JavaScript\nPython'}),history=save(s,'comparisons',{profile:p2,vacancy:v2,note:'SYNTHETIC original note'}),active=save(s,'comparisons',{profile:p1,vacancy:v1,note:'SYNTHETIC live note'}),computed=s.read().computed;for(const [collection,id] of [['profiles',p2],['vacancies',v2]])s.transact({operation:'archive',collection,id,revision:s.read().revision});assert.deepEqual(s.read().computed,computed);return {p1,p2,v1,v2,history,active};}

test('new comparisons and changed links reject archived sources, while existing links and active retargets remain available',()=>{
 const s=new WorkStore(definition);try{const f=fixture(s);
 for(const [profile,vacancy] of [[f.p2,f.v1],[f.p1,f.v2],[f.p2,f.v2]])rejected(s,()=>save(s,'comparisons',{profile,vacancy,note:'SYNTHETIC new archived analysis'}));
 for(const [profile,vacancy] of [[f.p2,f.v1],[f.p1,f.v2],[f.p2,f.v2]])rejected(s,()=>save(s,'comparisons',{profile,vacancy,note:'SYNTHETIC archive retarget'},f.active));
 const computed=s.read().computed;save(s,'comparisons',{profile:f.p2,vacancy:f.v2,note:'SYNTHETIC revised historical note'},f.history);assert.deepEqual(s.read().computed,computed);
 save(s,'comparisons',{profile:f.p1,vacancy:f.v2,note:'SYNTHETIC explicit active resume retarget'},f.history);
 save(s,'comparisons',{profile:f.p1,vacancy:f.v1,note:'SYNTHETIC explicit active vacancy retarget'},f.history);
 save(s,'comparisons',{profile:f.p1,vacancy:f.v1,note:'SYNTHETIC valid new comparison'});
 }finally{s.close();}
});

test('file restart and empty restore preserve later-archived and legacy comparisons without silently changing text analyses',()=>{
 const dir=mkdtempSync(join(tmpdir(),'applylens-archive-')),path=join(dir,'workspace.sqlite');let s=new WorkStore(definition,path);const restored=new WorkStore(definition);
 try{const f=fixture(s),before=s.read(),events=audit(s),copy=s.export();s.close();s=new WorkStore(definition,path);assert.deepEqual(s.read(),before);assert.deepEqual(audit(s),events);restored.restore(copy);assert.deepEqual(restored.read().data,before.data);assert.deepEqual(restored.read().computed,before.computed);
 save(restored,'comparisons',{profile:f.p2,vacancy:f.v2,note:'SYNTHETIC note after restore'},f.history);
 assert.deepEqual(restored.read().computed,before.computed);
 rejected(restored,()=>save(restored,'comparisons',{profile:f.p2,vacancy:f.v2,note:'SYNTHETIC new archived comparison'}));
 restored.transact({operation:'archive',collection:'comparisons',id:f.history,revision:restored.read().revision});assert.equal(restored.read().data.comparisons[0].profile,f.p2);assert.equal(restored.read().data.comparisons[0].vacancy,f.v2);
 save(restored,'profiles',{name:'SYNTHETIC unrelated resume',resume:'SYNTHETIC independent text'});
 }finally{s.close();restored.close();rmSync(dir,{recursive:true,force:true});}
});
