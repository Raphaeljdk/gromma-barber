const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

test("sininho discreto do proprietário mostra badge somente com alertas não lidos", () => {
  const bell = read("components/inventory-notification-bell.tsx");
  const page = read("app/erp/[tenant]/page.tsx");
  assert.match(bell, /unread > 0 && <span className="erp-notify-count"/);
  assert.match(bell, /aria-expanded=\{open\}/);
  assert.match(bell, /useEffect\(/);
  assert.match(bell, /router\.refresh\(\)/);
  assert.match(bell, /Ver todas as notificações/);
  assert.match(page, /isOwner && <InventoryNotificationBell/);
});

test("central apresenta categorias e fluxo de aprovação sem movimentar saldo", () => {
  const page = read("components/stock-notifications.tsx");
  const actions = read("app/erp/[tenant]/inventory-actions.ts");
  for (const type of ["compras", "estoque", "divergencias", "historico"]) {
    assert.match(page, new RegExp('id: "' + type + '"'));
  }
  assert.match(page, /Aprovar compra/);
  assert.match(page, /Marcar como lida/);
  assert.match(actions, /viewer\.role !== "OWNER"/);
  assert.match(actions, /"STOCK_PURCHASE_APPROVED"/);
  assert.match(actions, /"STOCK_PURCHASE_REJECTED"/);
  const section = actions.split("export async function decideStockPurchase")[1];
  assert.ok(section);
  assert.doesNotMatch(section, /stockMovement\.create|financialEntry\.create/);
  assert.match(section, /isolationLevel: "Serializable"/);
});

test("alertas usam dados reais por unidade, com conferência e estoque mínimo", () => {
  const source = read("lib/inventory-notifications.ts");
  assert.match(source, /STOCK_COUNT_RECORDED/);
  assert.match(source, /STOCK_PURCHASE_REQUESTED/);
  assert.match(source, /stockMin: \{ gt: 0 \}/);
  assert.match(source, /stockBalanceMilli\(rows\)/);
  assert.match(source, /unitId: \{ in: activeUnits\.map/);
  assert.match(source, /const id = "LOW:"/);
  assert.match(source, /STOCK_NOTIFICATION_READ/);
});

test("a central está disponível na rota e com estilos responsivos", () => {
  const routes = read("app/erp/[tenant]/[module]/page.tsx");
  const css = read("app/inventory-notifications.css");
  const layout = read("app/layout.tsx");
  assert.match(routes, /"notificacoes"/);
  assert.match(css, /@media \(max-width:700px\)/);
  assert.match(css, /html\[data-theme="light"\]/);
  assert.match(layout, /inventory-notifications\.css/);
});
