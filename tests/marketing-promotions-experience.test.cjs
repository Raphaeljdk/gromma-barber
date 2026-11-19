const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const js=ts.transpileModule(read("lib/birthday-offers.ts"),{
  fileName:"birthday-offers.ts",
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const unit={exports:{}};
new Function("module","exports",js)(unit,unit.exports);
const {birthdayWeek,isBirthdayInCurrentWeek}=unit.exports;

test("Aniversários de semana passam corretamente na virada de ano",()=>{
  const now=new Date("2026-12-31T15:00:00Z");
  assert.deepEqual([birthdayWeek(now).start,birthdayWeek(now).end],["2026-12-28","2027-01-03"]);
  assert.equal(isBirthdayInCurrentWeek(new Date("2001-01-01T00:00:00Z"),now),true);
  assert.equal(isBirthdayInCurrentWeek(new Date("2001-12-27T00:00:00Z"),now),false);
  assert.equal(isBirthdayInCurrentWeek(null,now),false);
});

test("Promoções exibem apenas itens cadastrados no próprio tenant",()=>{
  const form=read("components/marketing-promotion-form.tsx");
  const actions=read("app/erp/[tenant]/module-actions.ts");
  const page=read("app/erp/[tenant]/page.tsx");
  for(const marker of ["targetIds","targetType","discountKind","discountValue","name=\"message\"","type=\"search\""])
    assert.ok(form.includes(marker),marker);
  assert.match(actions,/barberShopId:shop\.id,active:true,id:\{in:targetIds\}/);
  assert.match(actions,/found !== targetIds\.length/);
  assert.match(page,/birthdayWeekCustomers\.length/);
  assert.match(page,/stockCategoryOverrides\[item\.id\]/);
});

test("Mensagens e FUP centralizados em Gromma IA, relatórios preservados",()=>{
  const nav=read("lib/erp-navigation.ts");
  const sidebar=read("components/erp-sidebar.tsx");
  const page=read("app/erp/[tenant]/page.tsx");
  const route=read("app/erp/[tenant]/[module]/page.tsx");
  assert.match(nav,/label: "Clientes novos", route: "relatorios-clientes-novos"/);
  assert.doesNotMatch(nav,/id: "marketing-clientes-(ausentes|sem-preferencia|novos)"/);
  assert.doesNotMatch(nav,/id: "marketing-agendamento-cliente"/);
  assert.doesNotMatch(sidebar,/marketing: \["mensagens"\]/);
  assert.match(page,/id="gromma-ia"/);
  assert.match(route,/module === "mensagens"/);
});

test("Avaliação no link individual exige convite e atendimento concluído, sem duplicação",()=>{
  const actions=read("app/clube/[tenant]/[token]/actions.ts");
  const invite=read("app/clube/[tenant]/[token]/page.tsx");
  const dashboard=read("app/erp/[tenant]/page.tsx");
  assert.match(actions,/findValidInvite\(workspace\.clubInvites,token\)/);
  assert.match(actions,/status:"COMPLETED"/);
  assert.match(actions,/workspace\.reviews\.some\(item=>item\.appointmentId===visit\.id\)/);
  assert.match(actions,/source:"CUSTOMER_LINK",verifiedAt:at/);
  assert.match(invite,/birthdayEligible\?/);
  assert.match(dashboard,/Registro manual/);
});
