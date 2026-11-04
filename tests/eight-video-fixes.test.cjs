const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

function makeRoute({viewer,shop,user,contracts,blob}={}){
  let requests=0;
  const mocks={
    "@vercel/blob":{get:async()=>{requests++;return blob??null;}},
    "@/lib/prisma":{prisma:{
      barberShop:{findUnique:async()=>shop??null},
      shopUser:{findFirst:async()=>user??null},
    }},
    "@/lib/tenant-auth":{requireTenantAccess:async()=>viewer??{type:"TENANT",role:"OWNER",barberShopId:"shopA"}},
    "@/lib/erp-workspace":{readWorkspace:()=>({professionalProfiles:{u1:{contracts:contracts??[]}}})},
  };
  const file=read("app/erp/[tenant]/equipe/[userId]/contratos/[contractId]/route.ts");
  const js=ts.transpileModule(file,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }}).outputText;
  const mod={exports:{}};
  new Function("require","module","exports",js)(id=>{
    if(!(id in mocks))throw Error("Unsupported dependency "+id);
    return mocks[id];
  },mod,mod.exports);
  return {
    route:mod.exports.GET,
    downloads:()=>requests,
  };
}
const params={params:Promise.resolve({tenant:"TENANT_A",userId:"u1",contractId:"contract1"})};
const shop={id:"shopA",status:"APPROVED",accessReleased:true,enabledFeatures:{}};
const user={id:"u1"};
const contracts=[{id:"contract1",url:"private:professional-contracts/shopA/u1/private_abc.pdf",label:"Contrato"}];
const validBlob={statusCode:200,stream:new ReadableStream({start(controller){
  controller.enqueue(new TextEncoder().encode("%PDF-1.7"));controller.close();
}})};

test("a rota de PDF privado bloqueia barbeiros e usuários sem perfil de dono",async()=>{
  const env=process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN;
  process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN="test-token";
  try{
    const instance=makeRoute({viewer:{type:"TENANT",barberShopId:"shopA",role:"BARBER"},shop,user,contracts,blob:validBlob});
    const response=await instance.route(new Request("https://example.com"),params);
    assert.equal(response.status,403);
    assert.equal(instance.downloads(),0);
  }finally{
    if(env===undefined)delete process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN;
    else process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN=env;
  }
});

test("a rota recusa outros colaboradores e chaves privadas de outra empresa",async()=>{
  const env=process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN;
  process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN="test-token";
  try{
    const wrongEmployee=makeRoute({shop,user:null,contracts,blob:validBlob});
    assert.equal((await wrongEmployee.route(new Request("https://example.com"),params)).status,404);
    const otherShop=makeRoute({shop,user,contracts:[{id:"contract1",
      url:"private:professional-contracts/shopB/u1/private_abc.pdf"}],blob:validBlob});
    assert.equal((await otherShop.route(new Request("https://example.com"),params)).status,404);
    assert.equal(wrongEmployee.downloads(),0);
    assert.equal(otherShop.downloads(),0);
  }finally{
    if(env===undefined)delete process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN;
    else process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN=env;
  }
});

test("proprietário pode baixar seu PDF com cabeçalhos confidenciais",async()=>{
  const env=process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN;
  process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN="test-token";
  try{
    const instance=makeRoute({shop,user,contracts,blob:validBlob});
    const response=await instance.route(new Request("https://example.com"),params);
    assert.equal(response.status,200);
    assert.match(response.headers.get("Content-Disposition"),/attachment/);
    assert.equal(response.headers.get("Cache-Control"),"private, no-store");
    assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff");
    assert.equal(instance.downloads(),1);
  }finally{
    if(env===undefined)delete process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN;
    else process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN=env;
  }
});

test("foto preexistente não é apagada ao salvar identificação",()=>{
  const action=read("app/erp/[tenant]/professional-actions.ts");
  const page=read("app/erp/[tenant]/equipe/[userId]/page.tsx");
  assert.match(action,/form\.has\("photoUrl"\)\?\{photoUrl\}:\{\}/);
  assert.doesNotMatch(page,/name="photoUrl"/);
  assert.match(action,/access:"private"/);
  assert.match(action,/file\.slice\(0,5\)/);
});

test("cadastrar profissional permite contato e endereço e mantém acesso sem senha",()=>{
  const action=read("app/erp/[tenant]/professional-actions.ts");
  const page=read("app/erp/[tenant]/equipe/novo/page.tsx");
  assert.match(page,/name="nickname"/);
  assert.match(page,/name="street"/);
  assert.match(page,/name="cpf"/);
  assert.match(action,/workspace\.professionalProfiles\[user\.id\]/);
  assert.match(action,/passwordHash:null/);
});

test("seleção em lote usa o mesmo formato de campos da ação do servidor",()=>{
  const component=read("components/professional-services-batch.tsx");
  const action=read("app/erp/[tenant]/professional-actions.ts");
  assert.match(component,/Selecionar todos/);
  assert.match(component,/Desmarcar todos/);
  assert.match(component,/name="enabledServiceIds"/);
  assert.match(component,/name=\{"rate_"\+service\.id\}/);
  assert.match(action,/form\.getAll\("enabledServiceIds"\)/);
});

test("permissões por grupo têm página protegida e gravação auditada",()=>{
  const page=read("app/erp/[tenant]/equipe/permissoes/page.tsx");
  const action=read("app/erp/[tenant]/module-actions.ts");
  assert.match(page,/viewer\.role!=="OWNER"/);
  assert.match(page,/action=\{saveRolePermissions\}/);
  assert.match(action,/ROLE_PERMISSIONS_UPDATED/);
});
