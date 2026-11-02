const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");

function load(relative,resolve=()=>require){
  const source=fs.readFileSync(path.resolve(__dirname,"../",relative),"utf8");
  const js=ts.transpileModule(source,{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }}).outputText;
  const mod={exports:{}};
  new Function("require","module","exports",js)((name)=>resolve(name),mod,mod.exports);
  return mod.exports;
}
const permissions=load("lib/role-permissions.ts");
const workspace=load("lib/erp-workspace.ts",name=>{
  if(name==="./role-permissions")return permissions;
  return require(name);
});

test("barbearias existentes recebem marca padrão sem migração ou perda de dados",()=>{
  const original=workspace.readWorkspace(null);
  assert.equal(original.branding.logoUrl,"");
  assert.equal(original.branding.clubTitle,"Clube de assinaturas");
  assert.match(original.branding.accentColor,/^#[a-fA-F0-9]{6}$/);
});
test("marca fica na área operations de cada barbearia e preserva outras configurações",()=>{
  const ws=workspace.readWorkspace({operations:{branding:{
    logoUrl:"https://example.com/logo.webp",accentColor:"#123456",clubTitle:"Clube Elite",clubDescription:"Benefícios exclusivos",
  },unknownKey:"manter"}});
  assert.equal(ws.branding.clubTitle,"Clube Elite");
  const saved=workspace.writeWorkspace({externalSetting:"x"},ws);
  assert.equal(saved.externalSetting,"x");
  assert.equal(saved.operations.branding.logoUrl,"https://example.com/logo.webp");
});
test("logo inseguro e cores inválidas nunca são reaproveitados na página pública",()=>{
  const branding=workspace.readWorkspace({operations:{branding:{
    logoUrl:"javascript:alert(1)",accentColor:"expression(alert(1))",
    clubTitle:"Meu clube",
  }}}).branding;
  assert.equal(branding.logoUrl,"");
  assert.match(branding.accentColor,/^#[0-9a-fA-F]{6}$/);
});
const action=fs.readFileSync(path.resolve(__dirname,
  "../app/erp/[tenant]/branding-actions.ts"),"utf8");
test("salvar marca é restrito ao owner e mantém auditoria e consentimento para uploads",()=>{
  assert.match(action,/viewer\.role !== "OWNER"/);
  assert.match(action,/BRANDING_UPDATED/);
  assert.match(action,/logoConsent/);
  assert.match(action,/image\/webp/);
});
