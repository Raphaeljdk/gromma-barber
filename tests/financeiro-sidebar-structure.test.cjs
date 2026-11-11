const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(base,file),"utf8");

test("Financeiro tem a estrutura exata solicitada com Cadastros e Contabilidade fora dele",()=>{
 const navigation=read("lib/erp-navigation.ts");
 const a=navigation.slice(navigation.indexOf('id: "financeiro", label: "Financeiro"'));
 const expected=[
  'Contas a pagar','Contas a receber','Criar receita','Criar despesas','Despesas',
  'Cadastros','Categorias financeiras','Contas bancárias','Formas de pagamento',
  'Comanda','Despesas','Contabilidade',
 ];
 let offset=0;
 for(const text of expected){
  const found=a.indexOf('label: "'+text+'"',offset);
  assert.ok(found>=0,"A ordem de navegação deve incluir "+text);
  offset=found+text.length;
 }
 assert.ok(a.lastIndexOf('label: "Contabilidade"')>a.indexOf('id: "financeiro-cadastros"'));
 assert.match(a,/id: "financeiro-formas-comanda"/);
 assert.match(a,/id: "financeiro-formas-despesas"/);
});

test("Gestão acima de Clube / Assinaturas e Operacional + Gestão sempre expandidos",()=>{
 const sidebar=read("components/erp-sidebar.tsx");
 assert.match(sidebar,/left\.id==="gestao"&&right\.id==="assinaturas"/);
 assert.match(sidebar,/const alwaysVisible = group\.id === "operacional" \|\| group\.id === "gestao"/);
 assert.match(sidebar,/alwaysVisible \|\| \(expandedGroups/);
 assert.match(sidebar,/renderNavItem\(item, 0, alwaysVisible\)/);
 assert.match(sidebar,/renderNavItem\(child, depth \+ 1, alwaysVisible\)/);
 const css=read("app/gromma-financial-navigation.css");
 assert.match(css,/data-sector="operacional"/);
 assert.match(css,/font-size:\.86rem!important/);
});

test("Novas rotas não levam a 404 e usam permissão de financeiro",()=>{
 const module=read("app/erp/[tenant]/[module]/page.tsx");
 const page=read("app/erp/[tenant]/page.tsx");
 const components=read("components/financial-subpages.tsx");
 const routes=[
  "financeiro-contas-pagar","financeiro-contas-receber","financeiro-criar-receita",
  "financeiro-criar-despesa","financeiro-despesas","financeiro-categorias",
  "financeiro-contas-bancarias","financeiro-formas-comanda",
  "financeiro-formas-despesas","financeiro-contabilidade",
 ];
 for(const route of routes){
  assert.ok(module.includes('"'+route+'"'),"Rota "+route);
  assert.ok(components.includes('"'+route+'"'),"Tela "+route);
 }
 assert.match(page,/financeSubmodule\) \? "VIEW_FINANCE"/);
 assert.match(page,/<FinancialSubpage tenantCode=\{tenantCode\}/);
 assert.match(page,/financialEntryMetadata\[entry\.id\]/);
});

test("Formulários financeiros persistem no tenant e mantém auditoria",()=>{
 const actions=read("app/erp/[tenant]/financial-setup-actions.ts");
 const workspace=read("lib/erp-workspace.ts");
 const page=read("components/financial-subpages.tsx");
 const originals=read("app/erp/[tenant]/actions.ts");
 for(const action of [
  "createFinancialCategory","createFinancialBankAccount","saveFinancialPaymentMethods"
 ])assert.match(actions,new RegExp('export async function '+action));
 assert.match(actions,/isolationLevel:"Serializable"/);
 assert.match(actions,/tx\.adminAuditLog\.create/);
 assert.match(actions,/FINANCIAL_PAYMENT_METHODS_UPDATED/);
 for(const key of ["financialCategories","financialBankAccounts","financialExpenseMethods","financialEntryMetadata"]){
  assert.match(workspace,new RegExp(key));
 }
 assert.match(originals,/ws\.financialEntryMetadata\[entry\.id\]/);
 assert.match(originals,/status:"PENDING"/);
 assert.match(page,/markFinancialPaid/);
 assert.match(page,/Não associar/);
});

test("Despesas, Contas e Contabilidade diferenciam tipos sem duplicar históricos",()=>{
 const page=read("app/erp/[tenant]/page.tsx");
 const view=read("components/financial-subpages.tsx");
 assert.match(page,/activeModule==="financeiro-contas-receber"/);
 assert.match(page,/type:"PAYABLE" as const/);
 assert.match(page,/prisma\.financialEntry\.findMany/);
 assert.match(view,/Contas a pagar/);
 assert.match(view,/Contas a receber/);
 assert.match(view,/Este controle não é balanço fiscal, DRE oficial/);
 assert.match(view,/Nenhuma cobrança|não efetua transferência|Não realiza pagamentos/);
});
