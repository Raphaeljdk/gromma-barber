const test=require('node:test');
const assert=require('node:assert/strict');
const load=require('./helpers/load.cjs');
const {Prisma}=require('@prisma/client');
const {PDFDocument}=require('pdf-lib');
const {commissionCents,rateHundredths,commissionTotals,commissionPeriod,professionalAvailable}=load('lib/commission-math.ts');
const {snapshotCommand,commissionFingerprint}=load('lib/commissions.ts');
test('percentuais e centavos exatos, incluindo zero e arredondamento',()=>{
 assert.equal(commissionCents(10001,3333),3333);assert.equal(commissionCents(1,5000),1);assert.equal(commissionCents(9999999999,10000),9999999999);assert.equal(rateHundredths('30,25'),3025);
 for(const n of ['NaN','-1','101','1.001','1e2',''])assert.throws(()=>rateHundredths(n));
});
test('bruto e líquido separam serviços, assinatura, produto, bônus e dedução',()=>{
 const t=commissionTotals([{kind:'SERVICE',amount:40},{kind:'SUBSCRIPTION',amount:15},{kind:'PRODUCT',amount:15},{kind:'BONUS',amount:10},{kind:'DEDUCTION',amount:5}]);assert.equal(t.gross,8000);assert.equal(t.net,7500);assert.equal(t.DEDUCTION,500);
 assert.equal(commissionTotals([{kind:'DEDUCTION',amount:10}]).net,-1000);
});
test('período inclui último dia no fuso brasileiro e valida datas e ordem',()=>{
 const p=commissionPeriod('2026-10-01','2026-10-31');assert.equal(p.from.toISOString(),'2026-10-01T03:00:00.000Z');assert.equal(p.to.toISOString(),'2026-11-01T03:00:00.000Z');
 for(const pair of [['2026-02-30','2026-03-01'],['2026-10-31','2026-10-01'],['2024-01-01','2026-01-01']])assert.throws(()=>commissionPeriod(...pair));
});
test('disponibilidade respeita dias, intervalos, serviços e término',()=>{
 const a={days:[2],start:'08:00',end:'18:00',breaks:[{start:'12:00',end:'13:00'}],serviceIds:['s1']};
 const d=t=>new Date('2026-10-27T'+t+':00-03:00');
 assert.equal(professionalAvailable(a,d('10:00'),d('10:30'),['s1']),true);
 assert.equal(professionalAvailable(a,d('11:45'),d('12:15'),['s1']),false);
 assert.equal(professionalAvailable(a,d('13:00'),d('13:30'),['s2']),false);
 assert.equal(professionalAvailable(a,d('17:45'),d('18:15'),['s1']),false);
});
function snapshotEnv(custom=null,linked=true){const lines=[];const command={id:'c',closedAt:new Date(),subtotal:new Prisma.Decimal(150),total:new Prisma.Decimal(135),appointmentId:'a',appointment:{barberId:'u',serviceId:'s'},items:[{id:'1',kind:'SERVICE',description:'Corte',total:100,unitPrice:100},{id:'2',kind:'PRODUCT',description:'Pomada',total:50,unitPrice:50}]};
 const tx={serviceCommand:{findFirst:async q=>{assert.equal(q.where.barberShopId,'shop');return command}},barberShop:{findUniqueOrThrow:async()=>({enabledFeatures:{operations:{productLines:[{itemId:'2',productId:'p',...(linked?{sellerId:'u'}:{})}]}}})},commissionProfile:{findMany:async()=>[{userId:'u',servicePercent:40,productPercent:30}]},serviceCommissionRule:{findMany:async()=>custom===null?[]:[{serviceId:'s',percent:new Prisma.Decimal(custom)}]},shopUser:{findMany:async()=>[{id:'u'}]},commissionLine:{createMany:async q=>{assert.equal(q.skipDuplicates,true);for(const l of q.data)if(!lines.some(x=>x.sourceKey===l.sourceKey))lines.push(l)}}};return {tx,lines,command};}
test('serviço personalizado substitui padrão sem somar e aplica desconto proporcional',async()=>{const e=snapshotEnv(50);await snapshotCommand(e.tx,'shop','c','qa');assert.equal(Number(e.lines[0].baseAmount),90);assert.equal(Number(e.lines[0].amount),45);assert.equal(Number(e.lines[1].amount),13.5);assert.equal(e.lines[0].percent,50);});
test('padrão do profissional, percentual zero e vendedor não presumido',async()=>{const e=snapshotEnv(null,false);await snapshotCommand(e.tx,'shop','c','qa');assert.equal(e.lines.length,1);assert.equal(Number(e.lines[0].amount),36);const z=snapshotEnv(0);await snapshotCommand(z.tx,'shop','c','qa');assert.equal(Number(z.lines[0].amount),0);});
test('snapshot existente não é recalculado ou duplicado',async()=>{const e=snapshotEnv(25);await snapshotCommand(e.tx,'shop','c','qa');e.tx.serviceCommissionRule.findMany=async()=>[{serviceId:'s',percent:99}];await snapshotCommand(e.tx,'shop','c','qa');assert.equal(e.lines.length,2);assert.equal(Number(e.lines[0].amount),22.5);assert.equal(commissionFingerprint([{id:'a',amount:1},{id:'b',amount:2}]),commissionFingerprint([{id:'b',amount:2},{id:'a',amount:1}]));});
test('PDF legível multipágina com histórico preservado',async()=>{const {commissionPdf}=load('lib/commission-pdf.ts');const bytes=await commissionPdf({id:'test-statement',shopName:'GROMMA',shopDocument:'QA',professionalName:'João José',periodStart:new Date('2026-10-01'),periodEnd:new Date('2026-11-01'),status:'PAID',paidAt:new Date(),paymentMethod:'PIX',gross:2000,deductions:50,net:1950,lines:Array.from({length:60},(_,i)=>({kind:'SERVICE',description:'Corte e barba '+i,baseAmount:100,percent:40,amount:40,occurredAt:new Date()}))});const doc=await PDFDocument.load(bytes);assert.ok(doc.getPageCount()>2);assert.equal(doc.getPage(0).getWidth(),595.28);});
