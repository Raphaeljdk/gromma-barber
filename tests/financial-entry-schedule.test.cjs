const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const file=path.join(root,"lib/financial-entry-schedule.ts");
const compiled=ts.transpileModule(fs.readFileSync(file,"utf8"),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function("module","exports",compiled)(mod,mod.exports);
const {financialDueDates,calculateFinancialAmount}=mod.exports;

test("recorrência mensal ancora o dia original sem deriva no fim do mês",()=>{
  assert.deepEqual(financialDueDates("2026-01-31",4,1,"MONTHS"),["2026-01-31","2026-02-28","2026-03-31","2026-04-30"]);
  assert.deepEqual(financialDueDates("2028-02-29",3,1,"YEARS"),["2028-02-29","2029-02-28","2030-02-28"]);
  assert.deepEqual(financialDueDates("2026-11-18",3,2,"WEEKS"),["2026-11-18","2026-12-02","2026-12-16"]);
});

test("limites de recorrência impedem criação ilimitada ou datas impossíveis",()=>{
  for(const args of [["2026-02-30",2,1,"MONTHS"],["2026-12-31",0,1,"MONTHS"],
    ["2026-12-31",61,1,"MONTHS"],["2026-12-31",2,0,"MONTHS"],["2026-12-31",2,150,"MONTHS"]]){
    assert.throws(()=>financialDueDates(...args));
  }
});

test("percentuais, juros e taxas calculados em centavos sem divergência",()=>{
  assert.deepEqual(calculateFinancialAmount(100,10,2,4.5),{
    principalCents:10000,discountCents:1000,interestCents:200,feeCents:450,totalCents:9650,
  });
  assert.throws(()=>calculateFinancialAmount(100,101,0,0));
  assert.throws(()=>calculateFinancialAmount(0,0,0,0));
  assert.throws(()=>calculateFinancialAmount(10,100,0,0));
});

test("ações registram recorrência, isolam a empresa e auditam baixa coletiva",()=>{
  const actions=fs.readFileSync(path.join(root,"app/erp/[tenant]/actions.ts"),"utf8");
  const workspace=fs.readFileSync(path.join(root,"lib/erp-workspace.ts"),"utf8");
  const subpages=fs.readFileSync(path.join(root,"components/financial-subpages.tsx"),"utf8");
  const account=fs.readFileSync(path.join(root,"components/financial-account-overview.tsx"),"utf8");
  const expenses=fs.readFileSync(path.join(root,"components/financial-expenses-overview.tsx"),"utf8");
  const form=fs.readFileSync(path.join(root,"components/financial-entry-create-form.tsx"),"utf8");
  for(const item of ["createFinancialEntry","recurrenceGroupId","paymentCondition","financialDueDates",
    "createFinancialEntry","markFinancialPaidBulk","FINANCIAL_BULK_PAYMENT_CONFIRMED","isolationLevel:\"Serializable\""]){
    assert.ok(actions.includes(item),item);
  }
  assert.match(actions,/barberShopId:shop\.id,id:\{in:ids\},type:"PAYABLE",status:"PENDING"/);
  for(const key of ["subcategory","discountPercent","interestPercent","feeAmount","recurrenceFrequency"])
    assert.ok(workspace.includes(key),key);
  assert.match(subpages,/<FinancialExpensesOverview /);
  assert.match(subpages,/<FinancialAccountOverview /);
  assert.match(subpages,/<FinancialEntryCreateForm /);
  for(const term of ["Vencido","A pagar","Pago","Total a pagar","Taxas","Total com taxas","Contas a pagar"])
    assert.ok(account.includes(term),term);
  for(const term of ["Total de despesas","Despesas pagas","Despesas pendentes","expInicio","expFim",
    "expBusca","expCategoria","expStatus","entryIds","markFinancialPaidBulk"])
    assert.ok(expenses.includes(term),term);
  for(const term of ["paymentCondition","ONCE","RECURRENT","recurrenceCount","recurrenceEvery","recurrenceFrequency",
    "subcategory","discountPercent","dueDate"])
    assert.ok(form.includes(term),term);
});
