const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const editorPath = path.join(root,"components/professional-service-batch-editor.tsx");
const profilePath = path.join(root,"app/erp/[tenant]/equipe/[userId]/page.tsx");
const actionPath = path.join(root,"app/erp/[tenant]/professional-actions.ts");
const editor=fs.readFileSync(editorPath,"utf8");
const profile=fs.readFileSync(profilePath,"utf8");
const action=fs.readFileSync(actionPath,"utf8");

test("editor de comissões em lote compila como TSX sem erro sintático",()=>{
  const source=ts.createSourceFile(editorPath,editor,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length,0,source.parseDiagnostics.map(e=>e.messageText).join("; "));
});

test("ficha profissional utiliza edição em lote e preserva gravação auditável",()=>{
  assert.match(profile,/ProfessionalServiceBatchEditor/);
  assert.match(editor,/saveProfessionalSection/);
  assert.match(editor,/name="section" value="service-batch"/);
  assert.match(action,/PROFESSIONAL_SERVICES_BATCH_UPDATED/);
  assert.match(action,/profile\.enabledServices=permitted/);
  assert.match(action,/profile\.services=\{\.\.\.previousRates,\.\.\.rates\}/);
});

test("busca abre lista e permite adicionar e remover serviços individualmente",()=>{
  assert.match(editor,/onFocus=\{\(\) => setShowSuggestions\(true\)\}/);
  assert.match(editor,/id="professional-service-options"/);
  assert.match(editor,/available\.map\(service/);
  assert.match(editor,/addService\(service\.id\)/);
  assert.match(editor,/removeService\(service\.id\)/);
  assert.doesNotMatch(editor,/Selecionar \{search/);
  assert.doesNotMatch(editor,/Desmarcar \{search/);
  assert.match(editor,/selected\.length>0 && <div className="table-wrap professional-service-table"/);
  assert.match(editor,/selected\.map\(service=><input type="hidden"/);
  assert.match(editor,/services\.map\(service=><input type="hidden"/);
  assert.match(editor,/name="enabledServiceIds"/);
  assert.match(editor,/name=\{"rate_"\+service\.id\}/);
  const css=fs.readFileSync(path.join(root,"app/gromma-professional-fast-ai.css"),"utf8");
  assert.match(css,/\.professional-service-editor \.professional-service-toolbar/);
  assert.match(css,/\.professional-service-options/);
  assert.match(css,/\.professional-service-editor \.professional-service-apply/);
  assert.match(editor,/Comissão em lote \(%\)/);
  assert.match(editor,/> Aplicar/);
});

test("validação financeira do formulário permanece no servidor",()=>{
  assert.match(action,/if\(raw===null\|\|String\(raw\)\.trim\(\)===\x22\x22\|\|!moneyPercent\(parsed\)\)/);
  assert.match(editor,/percent<0\|\|percent>100/);
  assert.match(editor,/Math\.round\(percent\*100\)\/100/);
});

test("URL duplicada da foto removida sem apagar imagem existente ao salvar identidade",()=>{
  assert.doesNotMatch(profile,/URL da foto do perfil \(HTTPS\)/);
  assert.match(profile,/type="hidden" name="photoUrl" value=\{profile\.photoUrl\?\?""\}/);
  assert.match(profile,/uploadProfessionalPhoto/);
});

test("salvamento retorna à seção da ficha em vez de deslocar a página ao topo",()=>{
  assert.match(action,/function professionalSectionAnchor\(section:string\)/);
  assert.match(action,/"schedule":"jornada-profissional"/);
  assert.match(action,/"service-batch":"servicos-profissional"/);
  assert.match(action,/"break-add":"folgas-profissional"/);
  assert.match(action,/anchor\?"#"\+anchor:""/);
});

const weekEditorPath=path.join(root,"components/professional-work-week-editor.tsx");
const weekEditor=fs.readFileSync(weekEditorPath,"utf8");
test("editor da jornada permite selecionar todos os dias e preserva a Server Action",()=>{
  const source=ts.createSourceFile(weekEditorPath,weekEditor,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length,0);
  assert.match(weekEditor,/Selecionar todos/);
  assert.match(weekEditor,/Segunda a sexta/);
  assert.match(weekEditor,/Desmarcar todos/);
  assert.match(weekEditor,/name="section" value="schedule"/);
  assert.match(profile,/ProfessionalWorkWeekEditor tenantCode/);
  assert.match(action,/PROFESSIONAL_SCHEDULE_UPDATED/);
  assert.match(action,/assertNoConflictingBookings/);
});
