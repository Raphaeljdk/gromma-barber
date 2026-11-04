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

test("seleção total, busca e alteração de porcentagem não excluem itens ocultos",()=>{
  assert.match(editor,/Selecionar \{search\?"resultados":"todos"\}/);
  assert.match(editor,/Desmarcar \{search\?"resultados":"todos"\}/);
  assert.match(editor,/Aplicar aos \{count\} selecionados/);
  assert.match(editor,/name="enabledServiceIds"/);
  assert.match(editor,/name=\{"rate_"\+s\.id\}/);
  assert.match(editor,/services\.filter\(s=>!shown\.some/);
});

test("validação financeira do formulário permanece no servidor",()=>{
  assert.match(action,/if\(raw===null\|\|String\(raw\)\.trim\(\)===\x22\x22\|\|!moneyPercent\(parsed\)\)/);
  assert.match(editor,/percent<0\|\|percent>100/);
  assert.match(editor,/Math\.round\(percent\*100\)\/100/);
});
