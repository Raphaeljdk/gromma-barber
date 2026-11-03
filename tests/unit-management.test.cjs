const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");

const code=fs.readFileSync(path.resolve(__dirname,"../app/erp/[tenant]/unit-actions.ts"),"utf8");
const js=ts.transpileModule(code,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,
}}).outputText;
function environment(options={}){
  const state={shop:{id:"shop1",status:"APPROVED",accessReleased:true,activePlan:"ESSENTIAL",
    requestedPlan:"ESSENTIAL",enabledFeatures:null},
    units:[{id:"u1",barberShopId:"shop1",code:"CENTRO",name:"Centro",city:"São Paulo",state:"SP",address:null,active:true},
      {id:"u2",barberShopId:"shop1",code:"SUL",name:"Sul",city:"São Paulo",state:"SP",address:null,active:true}],
    cashSessions:[],future:0,staff:0,audit:[],...options.state};
  let sequence=3; const tx={
    barberShop:{findUniqueOrThrow:async()=>state.shop},
    barberShopUnit:{
      findFirst:async q=>state.units.find(u=>u.barberShopId===q.where.barberShopId&&
        (q.where.id?u.id===q.where.id:u.code===q.where.code))??null,
      count:async q=>state.units.filter(u=>u.barberShopId===q.where.barberShopId&&
        (q.where.active===undefined||u.active===q.where.active)).length,
      create:async q=>{const unit={id:"u"+sequence++,...q.data};state.units.push(unit);return {id:unit.id};},
      update:async q=>{const u=state.units.find(u=>u.id===q.where.id);Object.assign(u,q.data);return {id:u.id};},
    },
    appointment:{count:async()=>state.future},
    shopUser:{count:async()=>state.staff},
    adminAuditLog:{create:async q=>state.audit.push(q.data)},
  };
  const prisma={barberShop:{findUnique:async()=>state.shop},$transaction:async(fn,config)=>{
    assert.equal(config.isolationLevel,"Serializable");
    const backup=structuredClone(state);try{return await fn(tx);}catch(e){Object.assign(state,backup);throw e;}
  }};
  const auth=options.viewer??{type:"TENANT",barberShopId:"shop1",role:"OWNER",email:"owner@example.test"};
  const mocks={
    "@/lib/prisma":{prisma},
    "@/lib/tenant-auth":{requireTenantAccess:async()=>auth},
    "@/lib/erp-workspace":{readWorkspace:()=>({cashSessions:state.cashSessions})},
    "@/lib/plans":{PLAN_CONFIG:{ESSENTIAL:{maxUnits:2},PRO:{maxUnits:null}}},
    "next/cache":{revalidatePath:()=>{}},
    "next/navigation":{redirect:url=>{throw Object.assign(new Error("redirect"),{url});}},
  };
  const module={exports:{}};new Function("require","module","exports",js)((x)=>{
    if(!(x in mocks))throw Error("Unsupported mock "+x);return mocks[x];
  },module,module.exports);
  return {state,action:module.exports.saveBarbershopUnit};
}
const form=(obj={})=>{const f=new FormData();for(const [k,v] of Object.entries({
  tenantCode:"GROMMA",code:"OESTE",name:"Unidade Oeste",city:"Cotia",state:"SP",address:"Rua 1",active:"on",...obj,
}))if(v!==null)f.set(k,String(v));return f;};
async function call(e,f){try{await e.action(f);throw new Error("Redirect esperado");}catch(err){
  if(!err.url)throw err;return new URL(err.url,"https://example.test");
}}
test("só o proprietário autorizado pode cadastrar ou alterar filiais",async()=>{
 const x=environment({viewer:{type:"TENANT",barberShopId:"other",role:"OWNER"}});
 const r=await call(x,form());assert.match(r.searchParams.get("unidadeErro"),/Somente o proprietário/);
 assert.equal(x.state.units.length,2);assert.equal(x.state.audit.length,0);
});
test("filial de outra empresa é bloqueada, mesmo que o ID seja conhecido",async()=>{
 const x=environment();const r=await call(x,form({unitId:"foreign"}));
 assert.match(r.searchParams.get("unidadeErro"),/não pertence/);
 assert.equal(x.state.audit.length,0);
});
test("plano Essencial impede ativar terceira unidade",async()=>{
 const x=environment();const r=await call(x,form());
 assert.match(r.searchParams.get("unidadeErro"),/limite/);assert.equal(x.state.units.length,2);
});
test("cadastro Pro salva filial independente e registra auditoria",async()=>{
 const x=environment({state:{shop:{id:"shop1",status:"APPROVED",accessReleased:true,
   activePlan:"PRO",requestedPlan:"PRO",enabledFeatures:null}}});
 const r=await call(x,form());
 assert.equal(r.searchParams.get("unidadeOk"),"cadastrada");
 assert.equal(x.state.units.length,3);
 assert.equal(x.state.units[2].barberShopId,"shop1");
 assert.equal(x.state.audit[0].action,"BARBERSHOP_UNIT_CREATED");
});
test("edita a própria filial, sem alterar o código e mantendo auditoria",async()=>{
 const x=environment();const r=await call(x,form({unitId:"u1",code:"FALSIFICADO",name:"Centro Novo"}));
 assert.equal(r.searchParams.get("unidadeOk"),"atualizada");
 assert.equal(x.state.units[0].name,"Centro Novo");
 assert.equal(x.state.units[0].code,"CENTRO");
 assert.equal(x.state.audit[0].action,"BARBERSHOP_UNIT_UPDATED");
});
test("filial com caixa aberto, agendamentos futuros ou equipe ativa não pode ser desativada",async()=>{
 for(const state of [{cashSessions:[{id:"c",unitId:"u1"}]},{future:1},{staff:1}]){
   const x=environment({state});const r=await call(x,form({unitId:"u1",active:null}));
   assert.ok(r.searchParams.has("unidadeErro"));
   assert.equal(x.state.units[0].active,true);
   assert.equal(x.state.audit.length,0);
 }
});
test("nunca desativa a última filial em operação",async()=>{
 const x=environment({state:{units:[{id:"u1",barberShopId:"shop1",code:"CENTRO",name:"Centro",city:"SP",state:"SP",address:null,active:true}]}});
 const r=await call(x,form({unitId:"u1",active:null}));
 assert.match(r.searchParams.get("unidadeErro"),/pelo menos uma/);
});
