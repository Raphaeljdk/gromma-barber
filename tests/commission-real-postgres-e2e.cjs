const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const {PrismaClient}=require("@prisma/client");

const url=process.env.DATABASE_URL||"";
if(process.env.GROMMA_TEST_ONLY_DATABASE!=="yes"||!/^(postgresql|postgres):\/\//.test(url)||
  !["127.0.0.1","localhost"].includes(new URL(url).hostname))
  throw new Error("Este teste somente funciona em PostgreSQL LOCAL efêmero de homologação.");

const prisma=new PrismaClient();
let viewer=null;
const cache=new Map();
const mocked={
  "@/lib/prisma":{prisma},
  "@/lib/tenant-auth":{requireTenantAccess:async()=>viewer},
  "next/cache":{revalidatePath:()=>{}},
  "next/navigation":{redirect:url=>{throw Object.assign(new Error("redirect"),{destination:url});}},
};
function load(relative){
  const filepath=path.join(__dirname,"..",relative);
  if(cache.has(filepath))return cache.get(filepath);
  const compiled=ts.transpileModule(fs.readFileSync(filepath,"utf8"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
      esModuleInterop:true},fileName:filepath}).outputText;
  const result={exports:{}};cache.set(filepath,result.exports);
  const req=(name)=>{
    if(Object.hasOwn(mocked,name))return mocked[name];
    if(name.startsWith("@/")||name.startsWith(".")){
      const target=name.startsWith("@/")?path.join(__dirname,"..",name.slice(2)):
        path.resolve(path.dirname(filepath),name);
      for(const ext of [".ts",".tsx",".js"]){
        const candidate=target.endsWith(ext)?target:target+ext;
        if(fs.existsSync(candidate))return load(path.relative(path.join(__dirname,".."),candidate));
      }
    }
    return require(name);
  };
  new Function("require","module","exports",compiled)(req,result,result.exports);
  cache.set(filepath,result.exports);return result.exports;
}
const {readWorkspace,writeWorkspace}=load("lib/erp-workspace.ts");
const {recordCommissionPayments}=load("app/erp/[tenant]/commission-payment-actions.ts");
const p=new URLSearchParams();
function form(values){
 const f=new FormData();for(const [k,v] of Object.entries({
    tenantCode:p.get("tenant"),start:"2024-01-01",end:"2024-01-31",
    paidDate:"2024-02-01",paymentMethod:"PIX",confirmPaid:"sim",
    expectedTotalCents:"3000",userIds:p.get("barber"),...values,
  }))f.set(k,String(v));return f;
}
async function submit(values={}){
  try{await recordCommissionPayments(form(values));assert.fail("redirect expected");}
  catch(error){if(!error.destination)throw error;
    return new URL(error.destination,"https://qa.local");
  }
}
test("a ação REAL persiste comissão, financeiro e auditoria no Postgres, impede duplicidade e isolamento",async()=>{
  process.env.COMMISSION_PAYMENTS_ENABLED="true";
  const marker=(Date.now().toString(36)+"-"+process.pid);
  const tenant="QA"+marker.replace(/[^A-Za-z0-9]/g,"").slice(-15).toUpperCase();
  const shop=await prisma.barberShop.create({data:{
    tenantCode:tenant,tradeName:"QA pagamento",document:"QA-COMMISSION-"+marker,
    ownerName:"QA",email:"qa-"+marker+"@example.invalid",phone:"000",
    city:"Teste",state:"SP",status:"APPROVED",accessReleased:true,
  }});
  const foreign=await prisma.barberShop.create({data:{
    tenantCode:"FOREIGN"+tenant,tradeName:"QA outro tenant",document:"QA-FOREIGN-"+marker,
    ownerName:"QA",email:"foreign-"+marker+"@example.invalid",phone:"000",
    city:"Teste",state:"SP",status:"APPROVED",accessReleased:true,
  }});
  try{
    const unit=await prisma.barberShopUnit.create({data:{
      barberShopId:shop.id,code:"QA",name:"Teste",city:"Teste",state:"SP",
    }});
    const owner=await prisma.shopUser.create({data:{
      barberShopId:shop.id,name:"Proprietário",email:"owner-"+marker+"@example.invalid",
      role:"OWNER",active:true,
    }});
    const barber=await prisma.shopUser.create({data:{
      barberShopId:shop.id,unitId:unit.id,name:"Profissional QA",
      email:"barber-"+marker+"@example.invalid",role:"BARBER",active:true,
    }});
    const foreignUser=await prisma.shopUser.create({data:{
      barberShopId:foreign.id,name:"Outro profissional",
      email:"foreign-worker-"+marker+"@example.invalid",role:"BARBER",active:true,
    }});
    const service=await prisma.service.create({data:{
      barberShopId:shop.id,name:"Serviço QA",price:100,durationMinutes:30,
    }});
    const at=new Date("2024-01-15T15:00:00.000Z");
    const paidAt=new Date("2024-01-15T16:00:00.000Z");
    const appointment=await prisma.appointment.create({data:{
      barberShopId:shop.id,unitId:unit.id,barberId:barber.id,serviceId:service.id,
      startsAt:at,endsAt:new Date(at.getTime()+30*60000),status:"COMPLETED",
    }});
    const command=await prisma.serviceCommand.create({data:{
      barberShopId:shop.id,unitId:unit.id,appointmentId:appointment.id,
      status:"CLOSED",closedAt:paidAt,total:100,subtotal:100,
      items:{create:[{kind:"SERVICE",description:"Serviço QA",quantity:1,unitPrice:100,total:100}]},
    }});
    const ws=readWorkspace(null);ws.settings.defaultCommissionPercent=30;
    ws.commandPayments.push({id:"qa-payment-"+marker,commandId:command.id,
      sessionId:"qa-cash",customerName:"Cliente QA",paidAt:paidAt.toISOString(),
      amounts:{CASH:0,DEBIT:0,CREDIT:0,PIX:10000,TRANSFER:0}});
    await prisma.barberShop.update({where:{id:shop.id},
      data:{enabledFeatures:writeWorkspace(null,ws)}});
    viewer={type:"TENANT",barberShopId:shop.id,role:"OWNER",
      email:owner.email,userId:owner.id};
    p.set("tenant",tenant);p.set("barber",barber.id);
    const [one,two]=await Promise.all([submit(),submit()]);
    const results=[one,two];assert.equal(results.filter(x=>x.searchParams.get("comissaoPagamentoOk")==="1").length,1);
    assert.equal(results.filter(x=>x.searchParams.has("comissaoPagamentoErro")).length,1);
    const receipts=await prisma.commissionPayment.findMany({where:{barberShopId:shop.id}});
    assert.equal(receipts.length,1);
    assert.equal(Number(receipts[0].gross),30);
    assert.equal(Number(receipts[0].net),30);
    assert.equal(receipts[0].userId,barber.id);
    const expenses=await prisma.financialEntry.findMany({where:{barberShopId:shop.id,category:"Comissões"}});
    assert.equal(expenses.length,1);assert.equal(Number(expenses[0].amount),30);
    assert.equal(expenses[0].status,"PAID");
    const logs=await prisma.adminAuditLog.findMany({where:{barberShopId:shop.id,
      action:"COMMISSION_PAYMENT_RECORDED"}});
    assert.equal(logs.length,1);
    assert.equal(logs[0].details.receiptId,receipts[0].id);
    assert.equal(logs[0].details.financialEntryId,expenses[0].id);
    const overlap=await submit({start:"2024-01-14",end:"2024-02-10"});
    assert.match(overlap.searchParams.get("comissaoPagamentoErro"),/sobreposto/);
    const notOurs=await submit({userIds:foreignUser.id});
    assert.match(notOurs.searchParams.get("comissaoPagamentoErro"),/outra empresa/);
    assert.equal(await prisma.financialEntry.count({where:{barberShopId:shop.id,category:"Comissões"}}),1);
  }finally{
    await prisma.commissionPayment.deleteMany({where:{barberShopId:shop.id}});
    await prisma.barberShop.delete({where:{id:shop.id}});
    await prisma.barberShop.delete({where:{id:foreign.id}});
    await prisma.$disconnect();
    delete process.env.COMMISSION_PAYMENTS_ENABLED;
  }
});
