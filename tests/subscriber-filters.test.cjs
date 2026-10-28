const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const source = fs.readFileSync('app/erp/[tenant]/page.tsx', 'utf8');
const block = source.slice(source.indexOf('  const normalizeSubscriberName ='), source.indexOf('  const messageContacts ='));
const js = ts.transpileModule(block, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const filter = new Function('clubMemberRows','assinaturasQ','assinaturasPlano','assinaturasStatus','assinaturasPage','pageSize','now',js + '\nreturn { filteredClubMemberRows, clubMemberPageRows, safeAssinaturasPage };');
const now = new Date('2026-10-28T12:00:00Z');
const members = [
 {id:'1',customer:{name:'João Silva'},planId:'a',status:'ACTIVE',nextBillingAt:'2026-11-01'},
 {id:'2',customer:{name:'João Souza'},planId:'b',status:'ACTIVE',nextBillingAt:'2026-10-01'},
 {id:'3',customer:{name:'Ana'},planId:'a',status:'PAUSED',nextBillingAt:'2026-10-01'},
 {id:'4',customer:{name:'José'},planId:'a',status:'CANCELED',nextBillingAt:'2026-10-01'},
];
const run=(q='',plan='',status='',page=1,size=10)=>filter(members,q,plan,status,page,size,now);
test('combines accent-insensitive name, plan and status filters',()=>{
 assert.deepEqual(run(' JOAO ','a','ACTIVE').filteredClubMemberRows.map(x=>x.id),['1']);
 assert.equal(run('joao','a','OVERDUE').filteredClubMemberRows.length,0);
});
test('distinguishes overdue, paused and canceled members',()=>{
 for (const [status,id] of [['ACTIVE','1'],['OVERDUE','2'],['PAUSED','3'],['CANCELED','4']])
  assert.deepEqual(run('','',status).filteredClubMemberRows.map(x=>x.id),[id]);
});
test('clamps stale pagination after filtering and handles empty results',()=>{
 assert.equal(run('','a','CANCELED',99,1).safeAssinaturasPage,1);
 assert.equal(run('','a','CANCELED',99,1).clubMemberPageRows[0].id,'4');
 assert.equal(run('missing','','',99).clubMemberPageRows.length,0);
 assert.equal(run().filteredClubMemberRows.length,4);
});
