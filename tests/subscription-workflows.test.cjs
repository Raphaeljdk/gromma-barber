const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.join(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? name.slice(2) : path.relative(root, path.resolve(path.dirname(filename), name));
      const extension = ['.ts', '.tsx', '.js'].find((ext) => fs.existsSync(path.join(root, target + ext)));
      return load(target + (extension ?? ''), mocks, cache);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  cache.set(filename, module.exports);
  return module.exports;
}
const { readWorkspace } = load('lib/erp-workspace.ts');
const reports = load('lib/subscription-reports.ts');
const invites = load('lib/club-invite.ts');
const operations = load('lib/club-operations.ts');
const form = values => {const f=new FormData(); for(const [k,v] of Object.entries({tenantCode:'GROMMA',...values}))f.set(k,v);return f;};
const redirect = url=>{throw Object.assign(new Error('redirect'),{url});};
async function redirected(fn,f){try{await fn(f);assert.fail('redirect expected');}catch(e){if(!e.url)throw e;return new URL(e.url,'https://example.test');}}
function environment(role='OWNER') {
 const state={shop:{id:'shop1',tenantCode:'GROMMA',status:'APPROVED',accessReleased:true,enabledFeatures:{other:true,operations:{clubPlans:[{id:'p1',name:'Corte',monthlyAmount:80,active:true},{id:'p2',name:'Completo',monthlyAmount:120,active:true}],clubMembers:[]}}},entries:[],audit:[]};
 const tx={barberShop:{findUnique:async()=>state.shop,update:async q=>{Object.assign(state.shop,q.data);return state.shop;}},
  customer:{findFirst:async q=>{assert.equal(q.where.barberShopId,'shop1');return q.where.id==='c1'?{id:'c1',name:'João'}:null;},findMany:async()=>[{id:'c1',name:'João'}]},
  shopUser:{findFirst:async q=>{assert.equal(q.where.barberShopId,'shop1');return q.where.id==='s1'?{id:'s1',name:'Bruno'}:null;}},
  financialEntry:{create:async q=>{const e={id:'f'+(state.entries.length+1),createdAt:new Date(),...q.data};state.entries.push(e);return e;},findFirst:async q=>{assert.equal(q.where.barberShopId,'shop1');return state.entries.find(e=>(typeof q.where.id==='string'?e.id===q.where.id:q.where.id.in.includes(e.id))&&(typeof q.where.status==='string'?e.status===q.where.status:q.where.status.in.includes(e.status)))??null;}},
  adminAuditLog:{create:async q=>state.audit.push(q.data)},
 };
 const prisma={...tx,$transaction:async(fn,config)=>{assert.equal(config.isolationLevel,'Serializable');const snapshot=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,snapshot);throw e;}}};
 const mocks={'@/lib/prisma':{prisma},'@/lib/tenant-auth':{requireTenantAccess:async()=>({type:'TENANT',barberShopId:'shop1',role,email:'staff@example.test'})},'next/navigation':{redirect},'next/cache':{revalidatePath:()=>{}}};
 return {state,tx,prisma,mocks,workspace:()=>readWorkspace(state.shop.enabledFeatures),actions:load('app/erp/[tenant]/module-actions.ts',mocks),refunds:load('app/erp/[tenant]/subscription-actions.ts',mocks)};
}
test('period filters include the entire final day in Sao Paulo and reject invalid dates',()=>{
 assert.equal(reports.dateInPeriod('2026-10-29T02:59:59Z','2026-10-28','2026-10-28'),true);
 assert.equal(reports.dateInPeriod('2026-10-29T03:00:00Z','2026-10-28','2026-10-28'),false);
 assert.equal(reports.validPeriod('2026-10-29','2026-10-28'),false);
 assert.equal(reports.validPeriod('2026-02-30',''),false);
 assert.equal(reports.dateInPeriod(null,'2026-01-01',''),false);
});
test('member onboarding snapshots seller, value and linked invoice without claiming payment',async()=>{
 const e=environment();
 const result=await redirected(e.actions.addClubMember,form({customerId:'c1',planId:'p1',sellerId:'s1',chargeNow:'on'}));
 assert.equal(result.searchParams.get('ok'),'assinante');
 const w=e.workspace();assert.equal(w.clubSales[0].sellerName,'Bruno');assert.equal(w.clubSales[0].amount,80);assert.equal(w.clubCharges[0].entryId,'f1');assert.equal(e.state.entries[0].status,'PENDING');assert.equal(e.state.shop.enabledFeatures.other,true);
 await redirected(e.actions.addClubMember,form({customerId:'c1',planId:'p1',sellerId:'s1',chargeNow:'on'}));
 assert.equal(e.workspace().clubMembers.length,1);assert.equal(e.state.entries.length,1);
});
test('rejects cross-tenant or invalid seller and customer and preserves data',async()=>{
 for(const changes of [{sellerId:'foreign'},{customerId:'foreign'}]){const e=environment();await assert.rejects(()=>operations.registerClubMember(e.tx,'shop1',changes.customerId??'c1','p1',changes.sellerId??'s1',true,'STAFF'));assert.equal(e.state.entries.length,0);assert.equal(e.workspace().clubMembers.length,0);}
});
test('plan changes preserve previous amounts, classify upgrades/downgrades and cancellation dates',async()=>{
 const e=environment();await operations.registerClubMember(e.tx,'shop1','c1','p1','s1',true,'STAFF');const id=e.workspace().clubMembers[0].id;
 await redirected(e.actions.changeClubMemberPlan,form({memberId:id,planId:'p2'}));
 let w=e.workspace();assert.equal(w.clubEvents[0].movement,'UPGRADE');assert.equal(w.clubEvents[0].previousPlanName,'Corte');assert.equal(w.clubEvents[0].previousAmount,80);assert.equal(e.state.entries[0].amount,80);
 await redirected(e.actions.changeClubMemberPlan,form({memberId:id,planId:'p1'}));
 await redirected(e.actions.updateClubMemberStatus,form({memberId:id,action:'cancel'}));
 await redirected(e.actions.updateClubMemberStatus,form({memberId:id,action:'cancel'}));
 w=e.workspace();assert.equal(w.clubEvents[1].movement,'DOWNGRADE');assert.equal(w.clubEvents.filter(x=>x.kind==='CANCEL').length,1);assert.ok(w.clubMembers[0].canceledAt);assert.equal(w.clubSales[0].planName,'Corte');
});
test('manual billing cannot duplicate an existing cycle',async()=>{
 const e=environment();await operations.registerClubMember(e.tx,'shop1','c1','p1','s1',true,'STAFF');
 const result=await redirected(e.actions.generateClubCharge,form({memberId:e.workspace().clubMembers[0].id}));assert.equal(result.searchParams.get('erro'),'cobranca');assert.equal(e.state.entries.length,1);
});
test('refund request does not move money; confirmed refund compensates once and retains original',async()=>{
 const e=environment();await operations.registerClubMember(e.tx,'shop1','c1','p1','s1',true,'STAFF');e.state.entries[0].status='PAID';e.state.entries[0].paidAt=new Date();
 await redirected(e.refunds.requestClubRefund,form({entryId:'f1',reason:'Cobrança indevida'}));
 await redirected(e.refunds.requestClubRefund,form({entryId:'f1',reason:'Cobrança indevida'}));
 assert.equal(e.state.entries.length,1);assert.equal(e.workspace().clubRefunds.length,1);
 const id=e.workspace().clubRefunds[0].id;
 await redirected(e.refunds.confirmClubRefund,form({refundId:id,reference:'Comprovante 123'}));assert.equal(e.state.entries.length,1);
 await redirected(e.refunds.confirmClubRefund,form({refundId:id,reference:'Comprovante 123',confirmed:'on'}));
 await redirected(e.refunds.confirmClubRefund,form({refundId:id,reference:'Comprovante 123',confirmed:'on'}));
 assert.equal(e.state.entries.length,2);assert.equal(e.state.entries[0].status,'PAID');assert.equal(e.state.entries[1].type,'PAYABLE');assert.equal(e.state.entries[1].amount,80);assert.equal(e.workspace().clubRefunds[0].status,'COMPLETED');assert.equal(e.state.audit.length,2);
});
test('read-only employee cannot request a refund',async()=>{
 const e=environment('BARBER');await assert.rejects(()=>e.refunds.requestClubRefund(form({entryId:'f1',reason:'Cobrança indevida'})),/Acesso negado/);assert.equal(e.state.audit.length,0);
});
test('public invite is scoped, expiring and single-use; seller survives purchase',async()=>{
 const e=environment();const token='a'.repeat(64),hash=invites.inviteHash(token);const w=e.workspace();w.clubInvites=[{hash,customerId:'c1',expiresAt:new Date(Date.now()+86400000).toISOString()}];e.state.shop.enabledFeatures.operations=w;
 assert.equal(invites.findValidInvite(w.clubInvites,'b'.repeat(64)),undefined);
 const buy=load('app/clube/[tenant]/[token]/actions.ts',e.mocks).purchaseClubPlan.bind(null,'GROMMA',token);
 await redirected(buy,form({planId:'p1',sellerId:'s1',accept:'on'}));
 assert.equal(e.workspace().clubSales[0].source,'CUSTOMER');assert.equal(e.workspace().clubSales[0].sellerName,'Bruno');assert.equal(invites.findValidInvite(e.workspace().clubInvites,token),undefined);
 await redirected(buy,form({planId:'p2',sellerId:'s1',accept:'on'}));assert.equal(e.workspace().clubMembers.length,1);
 assert.equal(invites.findValidInvite([{hash,customerId:'c1',expiresAt:'2000-01-01'}],token),undefined);
});
test('legacy sales keep missing amount and origin unknown; overdue uses linked pending dues',()=>{
 const w=readWorkspace({operations:{clubPlans:[{id:'p',name:'Corte',monthlyAmount:999}],clubMembers:[{id:'m',customerId:'c',planId:'p',startedAt:'2026-01-01',nextBillingAt:'2026-12-01',status:'ACTIVE'}]}});
 assert.equal(reports.salesRows(w)[0].amount,null);assert.equal(reports.salesRows(w)[0].sellerName,'Origem não registrada');
 w.clubCharges=[{memberId:'m',entryId:'f'}];const now=new Date('2026-10-28T12:00:00Z');
 assert.equal(reports.memberStatus(w.clubMembers[0],w,[{id:'f',status:'PENDING',dueDate:new Date('2026-10-27T12:00:00Z')}],now),'OVERDUE');
 assert.equal(reports.memberStatus(w.clubMembers[0],w,[{id:'f',status:'PENDING',dueDate:now}],now),'ACTIVE');
 assert.equal(reports.memberStatus(w.clubMembers[0],w,[{id:'f',status:'PAID',dueDate:new Date('2026-10-27T12:00:00Z')}],now),'ACTIVE');
});
async function renderReport(report,qs={}) {
 const workspace=readWorkspace({operations:{clubPlans:[{id:'p1',name:'Corte',monthlyAmount:80,active:true}],
  clubMembers:[{id:'m1',customerId:'c1',planId:'p1',status:'ACTIVE',startedAt:'2026-10-01T12:00:00Z',nextBillingAt:'2099-01-01'}, {id:'m2',customerId:'c2',planId:'p1',status:'CANCELED',startedAt:'2026-09-01'}],
  clubSales:[{id:'s1',memberId:'m1',customerId:'c1',planId:'p1',planName:'Corte',amount:80,at:'2026-10-01T12:00:00Z',sellerId:'b1',sellerName:'Bruno',source:'CUSTOMER'}],
  clubEvents:[{id:'e1',memberId:'m1',customerId:'c1',kind:'CHANGE',previousPlanId:'p0',previousPlanName:'Básico',newPlanId:'p1',newPlanName:'Corte',at:'2026-10-03T12:00:00Z',movement:'UPGRADE'}],
  clubCharges:[{entryId:'f1',memberId:'m1',customerId:'c1',planId:'p1',planName:'Corte',startedAt:'2026-10-01T12:00:00Z',periodEnd:'2026-11-01T12:00:00Z'}]}});
 const c=load('components/subscription-reports.tsx',{'@/lib/prisma':{prisma:{customer:{findMany:async q=>{assert.equal(q.where.barberShopId,'shop1');return [{id:'c1',name:'João'},{id:'c2',name:'Maria'}];}},financialEntry:{findMany:async q=>{assert.equal(q.where.barberShopId,'shop1');return [{id:'f1',status:'PAID',createdAt:new Date('2026-10-01'),paidAt:new Date('2026-10-02T12:00:00Z'),amount:80,description:'Corte · João'}];}}}},'@/app/erp/[tenant]/subscription-actions':{requestClubRefund:()=>{},confirmClubRefund:()=>{}}}).SubscriptionReports;
 return renderToStaticMarkup(await c({report,tenantCode:'GROMMA',shopId:'shop1',workspace,canFinance:true,searchParams:qs}));
}
test('quantity report renders required dates, metrics and combined filters',async()=>{
 const html=await renderReport('assinantes',{assinaturasQ:'joao',assinaturasPlano:'p1',assinaturasStatus:'ACTIVE'});
 for(const label of ['Data de contratação','Data de vencimento','Quantidade de clientes','Total de assinaturas','Valor bruto mensal','Clientes adimplentes','Clientes inadimplentes','João'])assert.ok(html.includes(label),label);
 assert.ok(!html.includes('Maria'));assert.ok(html.includes('1 registro(s)'));
});
test('sales and origin render per-seller totals and honor period, plan and seller filters',async()=>{
 const qs={de:'2026-10-01',ate:'2026-10-31',assinaturasPlano:'p1',vendedor:'b1'};
 const html=await renderReport('assinaturas-origem',qs);assert.ok(html.includes('Bruno'));assert.ok(html.includes('Planos vendidos'));assert.ok(html.includes('1 registro(s)'));
 assert.ok((await renderReport('assinaturas-vendas',{de:'2026-11-01'})).includes('0 registro(s)'));
});
test('cancellations never invent a date and transaction history includes refund controls and dates',async()=>{
 assert.ok((await renderReport('assinaturas-cancelados')).includes('Maria'));
 assert.ok(!(await renderReport('assinaturas-cancelados',{de:'2026-10-01'})).includes('Maria'));
 const html=await renderReport('assinaturas-transacoes',{de:'2026-10-02',ate:'2026-10-02',assinaturasQ:'joao'});
 for(const label of ['João','Início do plano','Data da captura / baixa','Estornar','Solicitar estorno']) assert.ok(html.includes(label),label);
 assert.ok((await renderReport('assinaturas-transacoes',{de:'2026-10-03'})).includes('0 registro(s)'));
});
test('plan change report preserves each event and includes subscribers without changes',async()=>{
 const html=await renderReport('assinaturas-trocas');for(const label of ['Básico','Corte','Upgrade','Maria','Sem troca registrada'])assert.ok(html.includes(label),label);
 const filtered = await renderReport('assinaturas-trocas',{de:'2026-10-04'});
 assert.ok(filtered.includes('0 registro(s)'));
 assert.ok(!filtered.match(/<tbody>[\s\S]*?<td>Básico<\/td>[\s\S]*?<\/tbody>/));
});
test('recurrence links the next cycle once and preserves the earlier payment',async()=>{
 const e=environment();await operations.registerClubMember(e.tx,'shop1','c1','p1','s1',true,'STAFF');
 const w=e.workspace();const old='2026-01-01T12:00:00Z';w.clubMembers[0].nextBillingAt=old;e.state.shop.enabledFeatures.operations=w;
 e.state.entries[0].status='PAID';
 await redirected(e.actions.processClubBilling,form({}));
 assert.equal(e.workspace().clubCharges.length,2);assert.equal(new Date(e.workspace().clubCharges[1].periodStart).getTime(),new Date(old).getTime());assert.equal(e.state.entries[0].status,'PAID');
 await redirected(e.actions.processClubBilling,form({}));assert.equal(e.state.entries.length,2);
});
test('failed public purchase does not consume invitation or leave partial financial records',async()=>{
 const e=environment();const token='c'.repeat(64),hash=invites.inviteHash(token);const w=e.workspace();w.clubInvites=[{hash,customerId:'c1',expiresAt:new Date(Date.now()+86400000).toISOString()}];e.state.shop.enabledFeatures.operations=w;
 const buy=load('app/clube/[tenant]/[token]/actions.ts',e.mocks).purchaseClubPlan.bind(null,'GROMMA',token);
 await redirected(buy,form({planId:'p1',sellerId:'foreign',accept:'on'}));
 assert.equal(e.state.entries.length,0);assert.equal(e.workspace().clubMembers.length,0);assert.equal(e.workspace().clubInvites[0].usedAt,undefined);
});
