const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const src=name=>fs.readFileSync(path.join(root,name),"utf8");

test("Cadastro de filiais keeps one save action for all editable unit data",()=>{
 const view=src("components/unit-operations-form.tsx");
 assert.match(view,/action=\{saveCompleteUnit\}/);
 assert.match(view,/>Salvar geral<\/button>/);
 assert.equal((view.match(/type="submit"/g)||[]).length,1);
 for(const field of ["name","city","state","address","postalCode","complement","legalDocument",
   "bankAgency","bankAccount","pixType","pixKey","paymentEmail","welcomeText"])
   assert.match(view,new RegExp('name="'+field+'"'));
 assert.doesNotMatch(view,/Percentual do pote desta unidade/);
 assert.doesNotMatch(view,/Antecedência para cancelamento online/);
 assert.doesNotMatch(view,/Imagem de capa \(URL HTTPS\)/);
});

test("Searchable bank directory includes code/ISPB and international SWIFT",()=>{
 const banks=src("lib/bank-directory.ts");
 const fields=src("components/unit-bank-fields.tsx");
 const action=src("app/erp/[tenant]/unit-complete-actions.ts");
 assert.match(banks,/brasilapi.com.br\/api\/banks\/v1/);
 assert.match(banks,/ispb/);
 assert.match(fields,/<datalist id="gromma-brazil-banks">/);
 assert.match(fields,/Internacional — SWIFT\/BIC/);
 assert.match(action,/bankSwift/);
 assert.match(action,/isValidPixKey\(pixKey,pixType,legalDocument\)/);
 assert.match(action,/old.legalDocument && legalDocument!==old.legalDocument/);
});

test("Archive unit keeps financial history and checks active cash, people, bookings",()=>{
 const action=src("app/erp/[tenant]/unit-complete-actions.ts");
 const component=src("components/archive-unit-button.tsx");
 assert.match(action,/export async function archiveBusinessUnit/);
 assert.match(action,/if\(countActive<=1\)/);
 assert.match(action,/ws.cashSessions.some/);
 assert.match(action,/tx.appointment.count/);
 assert.match(action,/tx.shopUser.count/);
 assert.match(action,/data:\{active:false\}/);
 assert.doesNotMatch(action,/\.delete\(/);
 assert.match(component,/Confirmar exclusão/);
});

test("Names and payment switch layout are consistent",()=>{
 const page=src("app/erp/[tenant]/page.tsx");
 const form=src("components/unit-operations-form.tsx");
 assert.match(page,/Cadastro de filiais/);
 assert.match(page,/ArchiveUnitButton/);
 assert.match(page,/getBrazilBankDirectory/);
 assert.match(form,/role="switch"/);
 assert.match(form,/Baixa automática/);
 assert.match(form,/Prazo \(dias\)/);
 assert.match(src("app/layout.tsx"),/gromma-cadastro-filiais.css/);
});

test("New server/client TSX parses",()=>{
 for(const filename of ["components/unit-operations-form.tsx","components/unit-bank-fields.tsx",
  "components/archive-unit-button.tsx","app/erp/[tenant]/page.tsx"]){
   const ast=ts.createSourceFile(filename,src(filename),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   assert.equal(ast.parseDiagnostics.length,0,
     filename+": "+ast.parseDiagnostics.map(e=>e.messageText).join("; "));
 }
});
