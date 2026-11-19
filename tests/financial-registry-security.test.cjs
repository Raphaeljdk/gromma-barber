const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const load=(file,requireStub)=>{
  const transpiled=ts.transpileModule(read(file),{fileName:file,compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }}).outputText;
  const result={exports:{}};
  new Function("module","exports","require",transpiled)(result,result.exports,requireStub);
  return result.exports;
};
const policy=load("lib/unit-operations-policy.ts",name=>{throw Error("Unexpected runtime import "+name)});
const security=load("lib/financial-registry-security.ts",name=>{
  if(name==="./unit-operations-policy")return policy;
  throw Error("Unexpected import "+name);
});
test("CNPJ do comprador e da filial devem ser válidos e da mesma raiz",()=>{
  const company="11222333000181"; // CNPJ de teste matematicamente válido
  assert.equal(policy.isValidCnpj(company),true);
  assert.equal(security.validatedOwnerCnpj(company,company,"Empresa de teste"),company);
  assert.throws(()=>security.validatedOwnerCnpj(company,company,""),/razão social/);
  assert.throws(()=>security.validatedOwnerCnpj("00000000000000",company,"Empresa"),/CNPJ/);
  assert.throws(()=>security.validatedOwnerCnpj(company,"00000000000000","Empresa"),/CNPJ/);
});
test("Validação de formato Pix não é verificação de titularidade",()=>{
  assert.equal(security.validPixKey("11.222.333/0001-81","CNPJ","11222333000181"),true);
  assert.equal(security.validPixKey("11.222.333/0001-81","CNPJ","11222333000100"),false);
  assert.equal(security.validPixKey("financeiro@empresa.com.br","EMAIL","11222333000181"),true);
  assert.equal(security.validPixKey("+5511999888777","PHONE","11222333000181"),true);
  assert.equal(security.validPixKey("usuario-invalido","EMAIL","11222333000181"),false);
});
test("Sem verificador autorizado, nenhuma conta consegue status de verificada",async()=>{
  const beforeUrl=process.env.BANK_ACCOUNT_VERIFIER_URL;
  const beforeToken=process.env.BANK_ACCOUNT_VERIFIER_TOKEN;
  try{
    delete process.env.BANK_ACCOUNT_VERIFIER_URL;
    delete process.env.BANK_ACCOUNT_VERIFIER_TOKEN;
    assert.equal(security.isBankVerifierConfigured(),false);
    const result=await security.verifyBankAccountOwnership({bankCode:"001",ispb:"00000000",
      agency:"0001",account:"12345-6",ownerCnpj:"11222333000181",
      pixKey:"11.222.333/0001-81",pixType:"CNPJ"});
    assert.equal(result,null);
  }finally{
    if(beforeUrl===undefined)delete process.env.BANK_ACCOUNT_VERIFIER_URL;
    else process.env.BANK_ACCOUNT_VERIFIER_URL=beforeUrl;
    if(beforeToken===undefined)delete process.env.BANK_ACCOUNT_VERIFIER_TOKEN;
    else process.env.BANK_ACCOUNT_VERIFIER_TOKEN=beforeToken;
  }
});
test("Proprietário autentica banco; somente verificação externa ativa; filiais escolhem conta comprovada",()=>{
  const actions=read("app/erp/[tenant]/financial-setup-actions.ts");
  const units=read("app/erp/[tenant]/unit-complete-actions.ts");
  const workspace=read("lib/erp-workspace.ts");
  const subpages=read("components/financial-subpages.tsx");
  const config=read("components/unit-operations-form.tsx");
  const form=read("components/financial-category-form.tsx");
  assert.match(actions,/if\(!ctx\.isTenantOwner\)fail\(url,"titularidade"\)/);
  assert.match(actions,/const proof=await verifyBankAccountOwnership/);
  assert.match(actions,/if\(proof\)\{/);
  assert.match(actions,/active:true/);
  assert.match(actions,/financialBankRequests\.push/);
  assert.match(actions,/FINANCIAL_BANK_ACCOUNT_REMOVED/);
  assert.match(units,/validatedOwnerCnpj/);
  assert.match(units,/verifiedBankAccountId/);
  assert.match(units,/selected\.ownerCnpj!==legal/);
  assert.match(workspace,/active:verified&&entry\.active!==false/);
  for(const field of ["name","subcategory","classification","type"])assert.ok(form.includes('name="'+field+'"'));
  assert.match(subpages,/Titularidade verificada/);
  assert.match(subpages,/Solicitar verificação/);
  assert.match(config,/customPaymentMethods\.filter/);
  assert.match(config,/feePercent_/);
  assert.match(actions,/FINANCIAL_CUSTOM_PAYMENT_METHOD_CREATED/);
  const entries=read("app/erp/[tenant]/actions.ts");
  assert.match(entries,/item\.unitId===\(unit\?\.id\?\?""\)/);
  assert.match(entries,/Boolean\(item\.verifiedAt\)/);
  const create=read("components/financial-entry-create-form.tsx");
  assert.match(create,/bank\.unitId===selectedUnit/);
});
