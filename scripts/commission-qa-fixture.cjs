const {PrismaClient}=require('@prisma/client'),fs=require('node:fs');
if(!process.env.DATABASE_URL?.includes('localhost:5432')||!process.env.DATABASE_URL.includes('/commission_qa'))throw Error('Only the isolated CI database is allowed');
const db=new PrismaClient();
(async()=>{
 for(const [id,code,document] of [['commission-qa-shop','COMMISSIONQA','QA-COMMISSIONS'],['commission-qa-other','COMMISSIONOTHER','QA-OTHER']])await db.barberShop.create({data:{id,tenantCode:code,tradeName:'GROMMA Validação',document,ownerName:'QA',email:'qa@example.invalid',phone:'1100000000',city:'Teste',state:'SP',status:'APPROVED',accessReleased:true,activePlan:'PRO'}});
 await db.shopUser.createMany({data:[{id:'commission-qa-owner',barberShopId:'commission-qa-shop',name:'Gestor QA',email:'owner@example.invalid',role:'OWNER'},{id:'commission-qa-barber',barberShopId:'commission-qa-shop',name:'Profissional QA',email:'barber@example.invalid',role:'BARBER'},{id:'commission-qa-foreign',barberShopId:'commission-qa-other',name:'Outro profissional',email:'other@example.invalid',role:'BARBER'}]});
 await db.service.create({data:{id:'commission-qa-service',barberShopId:'commission-qa-shop',name:'Corte QA',price:100,durationMinutes:30}});
 await db.commissionProfile.create({data:{barberShopId:'commission-qa-shop',userId:'commission-qa-barber',servicePercent:40,subscriptionPercent:15,productPercent:30}});
 for(const [kind,baseAmount,percent,amount] of [['SERVICE',100,40,40],['PRODUCT',50,30,15],['SUBSCRIPTION',100,15,15],['BONUS',0,0,10],['DEDUCTION',0,0,5]])await db.commissionLine.create({data:{id:'qa-'+kind,barberShopId:'commission-qa-shop',userId:'commission-qa-barber',sourceKey:'qa:'+kind,kind,description:kind+' QA',baseAmount,percent,amount,occurredAt:new Date('2026-10-27T15:00:00Z'),createdBy:'QA'}});
 fs.writeFileSync('/tmp/gromma-qa-config.json',JSON.stringify({baseUrl:'http://localhost:3000',secret:process.env.SESSION_SECRET}),{mode:0o600});
 console.log('Isolated QA fixture ready');await db.$disconnect();
})().catch(async e=>{console.error(e);await db.$disconnect();process.exit(1)});
