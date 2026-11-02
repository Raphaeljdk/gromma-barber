const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const action = fs.readFileSync(path.resolve(__dirname,
  "../app/erp/[tenant]/commission-payment-actions.ts"), "utf8");
const component = fs.readFileSync(path.resolve(__dirname,
  "../components/commission-payment-button.tsx"), "utf8");
const list = fs.readFileSync(path.resolve(__dirname,
  "../components/commission-selection-table.tsx"), "utf8");
const professional = fs.readFileSync(path.resolve(__dirname,
  "../app/erp/[tenant]/professional-actions.ts"), "utf8");
const editor = fs.readFileSync(path.resolve(__dirname,
  "../components/professional-product-commission-editor.tsx"), "utf8");
const page = fs.readFileSync(path.resolve(__dirname,
  "../app/erp/[tenant]/page.tsx"), "utf8");

test("baixa só é exposta quando feature flag está ligada e o usuário é proprietário", () => {
  assert.match(action, /COMMISSION_PAYMENTS_ENABLED/);
  assert.match(action, /viewer\.role !== "OWNER"/);
  assert.match(page, /canPayCommission = process\.env\.COMMISSION_PAYMENTS_ENABLED/);
  assert.match(page, /!comissoesUnidade/);
});

test("baixa manual exige declaração de pagamento efetivo, valor atual e período encerrado", () => {
  assert.match(action, /confirmPaid/);
  assert.match(action, /calculatedCents !== declaredCents/);
  assert.match(action, /endText >= localToday/);
  assert.match(component, /Nenhuma transferência bancária ou Pix será enviado/);
  assert.match(component, /name="confirmPaid"/);
});

test("liquidação recusa períodos sobrepostos e registra financeiro, histórico e auditoria atomicamente", () => {
  assert.match(action, /tx\.commissionPayment\.findFirst/);
  assert.match(action, /periodStart: \{ lte:/);
  assert.match(action, /periodEnd: \{ gte:/);
  assert.match(action, /await prisma\.\$transaction/);
  assert.match(action, /isolationLevel: "Serializable"/);
  assert.match(action, /await tx\.commissionPayment\.create/);
  assert.match(action, /await tx\.financialEntry\.create/);
  assert.match(action, /await tx\.adminAuditLog\.create/);
});

test("apuração compacta não permite selecionar profissionais já quitados", () => {
  assert.match(list, /paidIds\.includes\(row\.id\)/);
  assert.match(list, /Registrar quitação/);
  assert.match(list, /Buscar profissional/);
  assert.match(list, /Filtrar pela unidade principal/);
});

test("edição de regras de produtos permite restauração explícita com auditoria", () => {
  assert.match(professional, /product-category-reset/);
  assert.match(professional, /PROFESSIONAL_PRODUCT_CATEGORY_COMMISSION_RESET/);
  assert.match(editor, /Restaurar comissão padrão/);
  assert.match(editor, /resolveProductCommissionRate/);
});
