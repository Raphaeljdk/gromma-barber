const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");

const root=path.resolve(__dirname,"..");
const load=(name)=>{
  const file=path.join(root,name);
  const text=fs.readFileSync(file,"utf8");
  const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const loaded={exports:{}};
  new Function("require","module","exports",js)(require,loaded,loaded.exports);
  return loaded.exports;
};
const policy=load("lib/unit-operations-policy.ts");
const source=name=>fs.readFileSync(path.join(root,name),"utf8");

test("CNPJ valida dígitos e não permite chave divergente da filial",()=>{
  assert.equal(policy.isValidCnpj("11.222.333/0001-81"),true);
  assert.equal(policy.isValidCnpj("11.222.333/0001-80"),false);
  assert.equal(policy.isValidCnpj("11.111.111/1111-11"),false);
  assert.equal(policy.isValidPixKey("11222333000181","CNPJ","11222333000181"),true);
  assert.equal(policy.isValidPixKey("11222333000181","CNPJ","11222333000262"),false);
  assert.equal(policy.isValidPixKey("contato@empresa.com.br","EMAIL",""),true);
  assert.equal(policy.isValidPixKey("+5511999999999","PHONE",""),true);
  assert.equal(policy.isValidPixKey("abc","EVP",""),false);
});
test("pote mantém a taxa geral em filiais antigas sem política",()=>{
  const ws={subscriptionPot:{percent:30,shares:{}},unitPolicies:{}};
  assert.equal(policy.potPercentForUnit(ws,"unit-old"),30);
  ws.unitPolicies["unit-new"]={potPercent:48};
  assert.equal(policy.potPercentForUnit(ws,"unit-new"),48);
  ws.unitPolicies["unit-new"].potPercent=0;
  assert.equal(policy.potPercentForUnit(ws,"unit-new"),0);
});
test("bloqueio por falta e antecedência de cancelamento não têm efeito com regra zero",()=>{
  const now=new Date("2026-11-04T12:00:00Z");
  assert.equal(policy.noShowUntil(now,0),null);
  assert.equal(policy.noShowUntil(now,12).toISOString(),"2026-11-05T00:00:00.000Z");
  assert.equal(policy.canCancelOnline(new Date("2026-11-04T13:00:00Z"),now,60),true);
  assert.equal(policy.canCancelOnline(new Date("2026-11-04T12:59:00Z"),now,60),false);
});
test("bloqueio consultado antes e dentro da transação de criação da reserva",()=>{
  const code=source("app/erp/[tenant]/actions.ts");
  assert.match(code,/agenda-penalidade/);
  assert.match(code,/tx\.appointment\.findFirst\(\{where:\{/);
  assert.match(code,/unitPolicy\(latest,unitId\)\.noShowBlockHours/);
});
test("PDF é armazenado apenas em Blob privado e baixado após autorização",()=>{
  const upload=source("app/erp/[tenant]/professional-actions.ts");
  const route=source("app/erp/[tenant]/equipe/[userId]/contrato/[contractId]/route.ts");
  assert.match(upload,/GROMMA_PRIVATE_BLOB_TOKEN/);
  assert.match(upload,/access:"private"/);
  assert.match(upload,/signature\)!=="%PDF-"/);
  assert.match(route,/requireTenantAccess/);
  assert.match(route,/get\(url,\{access:"private",token\}\)/);
  assert.match(route,/private, no-store/);
  assert.match(route,/Content-Disposition/);
});
test("apresentação pública só usa nomes e fotos de profissionais ativos",()=>{
  const page=source("app/barbearia/[tenant]/page.tsx");
  assert.match(page,/status:"APPROVED",accessReleased:true/);
  assert.match(page,/users:\{where:\{active:true/);
  assert.match(page,/featuredProfessionalIds/);
  assert.doesNotMatch(page,/user\.email|user\.phone|user\.cpf/);
});
