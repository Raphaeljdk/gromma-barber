const {PrismaClient}=require('@prisma/client'),assert=require('node:assert/strict');
if(!process.env.DATABASE_URL?.includes('localhost:5432')||!process.env.DATABASE_URL.includes('/commission_qa'))throw Error('Only isolated CI DB allowed');
const db=new PrismaClient();
(async()=>{
 const statements=await db.commissionSettlement.findMany({where:{barberShopId:'commission-qa-shop'},include:{lines:true}});assert.equal(statements.length,1);const s=statements[0];assert.equal(Number(s.gross),80);assert.equal(Number(s.net),75);assert.equal(s.lines.length,5);
 assert.equal(await db.financialEntry.count({where:{barberShopId:'commission-qa-shop',category:'Comissões',status:'PAID'}}),1);
 await assert.rejects(db.commissionSettlement.update({where:{id:s.id},data:{net:1}}));
 await assert.rejects(db.commissionLine.update({where:{id:s.lines[0].id},data:{amount:999}}));
 await assert.rejects(db.financialEntry.update({where:{id:s.financialEntryId},data:{amount:1}}));
 await assert.rejects(db.commissionProfile.create({data:{barberShopId:'commission-qa-shop',userId:'commission-qa-foreign',servicePercent:40}}));
 await assert.rejects(db.commissionLine.create({data:{barberShopId:'commission-qa-shop',userId:'commission-qa-barber',sourceKey:s.lines[0].sourceKey,kind:'BONUS',description:'duplicate',baseAmount:0,percent:0,amount:10,occurredAt:new Date(),createdBy:'QA'}}));
 await db.commissionProfile.update({where:{barberShopId_userId:{barberShopId:'commission-qa-shop',userId:'commission-qa-barber'}},data:{servicePercent:99}});
 const unchanged=await db.commissionSettlement.findUnique({where:{id:s.id}});assert.equal(Number(unchanged.net),75);
 console.log('PASS: real PostgreSQL payout, ledger uniqueness, financial posting, immutable history, tenant guard and rate changes');await db.$disconnect();
})().catch(async e=>{console.error(e);await db.$disconnect();process.exit(1)});
