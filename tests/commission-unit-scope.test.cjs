const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const {Prisma}=require("@prisma/client");

const source=fs.readFileSync(path.resolve(__dirname,"../lib/commission-calculation.ts"),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText;
const loadedModule={exports:{}};
new Function("require","module","exports",js)(name=>{
 if(name==="@prisma/client")return {Prisma};
 if(name==="./professional-profile")return {subscriptionSalesEnabled:()=>false};
 if(name==="./product-commission-rules")return {resolveProductCommissionRate:(rule,sales,fallback)=>fallback};
 throw new Error("Unknown dependency "+name);
},loadedModule,loadedModule.exports);
const {calculateCommission}=loadedModule.exports;

const closedAt=new Date("2026-10-31T19:00:00.000Z");
const commands=["u1","u2"].map((unitId,i)=>({
 id:"c"+(i+1),unitId,closedAt,total:100,
 appointment:{barberId:"p1",serviceId:"s1",status:"COMPLETED"},
 items:[{id:"i"+(i+1),kind:"SERVICE",description:"Corte",quantity:1,total:100}],
}));
const workspace={
 commandPayments:commands.map(c=>({commandId:c.id,amounts:{PIX:10000},
  paidAt:closedAt.toISOString()})),
 serviceLines:commands.map(c=>({itemId:c.items[0].id,serviceId:"s1"})),
 productSellerAssignments:[],productLines:[],productCategoryAssignments:{},
 professionalProfiles:{},professionalExtraRates:{},subscriptionCommissionTiers:{},
 clubSales:[],clubCharges:[],clubRefunds:[],
};
function db(){
 const seen=[];
 const fake={serviceCommand:{findMany:async query=>{
   seen.push(query.where);
   assert.equal(query.where.barberShopId,"shop1");
   assert.equal(query.where.status,"CLOSED");
   return commands.filter(c=>!query.where.unitId||c.unitId===query.where.unitId);
 }}};
 return {fake,seen};
}
async function calculate(fake,unitId){
 return calculateCommission(fake,"shop1","p1",new Date("2026-10-01T03:00:00Z"),
  new Date("2026-11-01T03:00:00Z"),40,30,{},[],{
    workspace,...(unitId?{unitId}:{})
  });
}
test("comissão por filial usa a unidade da comanda, não a unidade principal do barbeiro",async()=>{
 const x=db();
 const left=await calculate(x.fake,"u1");
 const right=await calculate(x.fake,"u2");
 assert.equal(Number(left.net),30);
 assert.equal(Number(right.net),30);
 assert.equal(left.lines.length,1);
 assert.equal(left.lines[0].commandId,"c1");
 assert.equal(right.lines[0].commandId,"c2");
 assert.equal(x.seen[0].unitId,"u1");
 assert.equal(x.seen[1].unitId,"u2");
});
test("apuração global soma as duas filiais sem duplicar comandas",async()=>{
 const x=db();const result=await calculate(x.fake);
 assert.equal(Number(result.net),60);
 assert.equal(result.lines.length,2);
 assert.equal(x.seen[0].unitId,undefined);
});
test("página de comissões transmite explicitamente o filtro de filial ao cálculo",()=>{
 const page=fs.readFileSync(path.resolve(__dirname,"../app/erp/[tenant]/page.tsx"),"utf8");
 assert.ok(page.includes("{ workspace, unitId: comissoesUnidade || undefined }"));
});
