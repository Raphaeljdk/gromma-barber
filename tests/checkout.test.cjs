const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '..');

function load(relative, mocks = {}, cache = new Map()) {
  const filename = path.join(root, relative);
  if (cache.has(filename)) return cache.get(filename);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  cache.set(filename, module.exports);
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const target = name.startsWith('@/') ? name.slice(2) : path.relative(root, path.resolve(path.dirname(filename), name));
      const extension = ['.ts', '.tsx', '.js'].find((ext) => fs.existsSync(path.join(root, target + ext)));
      return load(target + (extension ?? ''), mocks, cache);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports);
  cache.set(filename, module.exports);
  return module.exports;
}
const money = load('lib/checkout.ts');
const { readWorkspace } = load('lib/erp-workspace.ts');
const form = (values = {}) => { const f = new FormData(); for (const [key, value] of Object.entries({ tenantCode: 'GROMMA', commandId: 'c1', expectedTotal: '10000', sessionId: 's1', PIX: '100', ...values })) f.set(key, String(value)); return f; };
function environment(options = {}) {
  const state = { shop: { id: 'shop1', status: 'APPROVED', accessReleased: true, enabledFeatures: { operations: { cashSessions: [{ id: 's1', unitId: 'u1', unitName: 'Centro', openingCents: 2000, openedAt: '2026-10-13T10:00:00Z', openedBy: 'u' }], commandPayments: [], productLines: [{ itemId: 'i1', productId: 'p1' }] } } }, command: { id: 'c1', unitId: 'u1', barberShopId: 'shop1', customer: { name: 'Cliente' }, status: 'OPEN', total: 100, subtotal: 100, discount: 0, updatedAt: new Date(), items: [{ id: 'i1', kind: 'PRODUCT', total: 100, quantity: 2 }] }, entries: [], stock: [], ...options.state };
  const writes = [];
  const tx = {
    barberShop: { findUnique: async () => state.shop, findUniqueOrThrow: async () => state.shop, update: async q => { writes.push('workspace'); Object.assign(state.shop, q.data); } },
    barberShopUnit: { findFirst: async q => { assert.equal(q.where.barberShopId, 'shop1'); return { id: 'u1', name: 'Centro' }; } },
    serviceCommand: { findFirst: async q => { assert.equal(q.where.barberShopId, 'shop1'); return state.command?.status === 'OPEN' ? state.command : null; }, updateMany: async q => { writes.push('command'); Object.assign(state.command, q.data); return { count: 1 }; } },
    stockMovement: { groupBy: async q => { assert.equal(q.where.unitId, 'u1'); assert.equal(q.where.barberShopId, 'shop1'); return [{ type: 'IN', _sum: { quantity: options.stock ?? 3 } }]; }, create: async q => { writes.push('stock'); state.stock.push(q.data); } },
    financialEntry: { create: async q => { writes.push('finance'); state.entries.push(q.data); } },
  };
  const prisma = { $transaction: async (fn, config) => { assert.equal(config.isolationLevel, 'Serializable'); const snapshot = structuredClone(state); try { return await fn(tx); } catch (e) { Object.assign(state, snapshot); throw e; } } };
  const actions = load('app/erp/[tenant]/checkout-actions.ts', { '@/lib/prisma': { prisma }, '@/lib/tenant-auth': { requireTenantAccess: async () => options.viewer || { type: 'TENANT', barberShopId: 'shop1', role: 'OWNER', userId: 'operator1' } }, 'next/cache': { revalidatePath: () => {} }, 'next/navigation': { redirect: url => { throw Object.assign(new Error('redirect'), { redirect: url }); } } });
  return { state, writes, actions };
}
async function result(action, data) { try { await action(data); assert.fail('redirect expected'); } catch (e) { if (!e.redirect) throw e; return new URL(e.redirect, 'https://test.local'); } }

test('valores monetários usam centavos exatos e rejeitam entradas ambíguas', () => {
  assert.equal(money.cents('12,30'), 1230); assert.equal(money.cents('0.1'), 10);
  for (const v of ['-1', '1.999', 'NaN', '1e3', '1.000,00', '']) assert.throws(() => money.cents(v));
  assert.throws(() => money.validatePayments({ CASH: 0, DEBIT: 0, CREDIT: 0, PIX: 999 }, 1000));
});
test('checkout divide pagamentos, baixa estoque e registra recebimentos pagos uma única vez', async () => {
  const env = environment();
  const r = await result(env.actions.checkoutCommand, form({ PIX: '40', DEBIT: '60' }));
  assert.equal(r.searchParams.get('checkoutOk'), '1');
  assert.deepEqual(env.state.entries.map(e => [e.status, e.amount]), [['PAID', 60], ['PAID', 40]]);
  assert.equal(env.state.stock[0].quantity, 2);
  assert.equal(env.state.command.status, 'CLOSED');
  assert.equal(readWorkspace(env.state.shop.enabledFeatures).commandPayments.length, 1);
  const second = await result(env.actions.checkoutCommand, form());
  assert.match(second.searchParams.get('checkoutError'), /já foi fechada/);
  assert.equal(env.state.entries.length, 2); assert.equal(env.state.stock.length, 1);
});
test('soma incorreta, versão antiga e caixa diferente não geram lançamentos', async () => {
  for (const change of [{ PIX: '90' }, { expectedTotal: '9900' }, { sessionId: 'another' }]) {
    const env = environment(); const r = await result(env.actions.checkoutCommand, form(change));
    assert.ok(r.searchParams.get('checkoutError')); assert.equal(env.writes.length, 0);
  }
});
test('estoque insuficiente impede fechamento, pagamento e baixa', async () => {
  const env = environment({ stock: 1 });
  assert.match((await result(env.actions.checkoutCommand, form())).searchParams.get('checkoutError'), /Estoque insuficiente/);
  assert.equal(env.writes.length, 0); assert.equal(env.state.command.status, 'OPEN');
});
test('isolamento de tenant e perfil são verificados antes de gravar', async () => {
  for (const viewer of [{ type: 'TENANT', barberShopId: 'other', role: 'OWNER' }, { type: 'TENANT', barberShopId: 'shop1', role: 'VIEWER' }]) {
    const env = environment({ viewer }); const r = await result(env.actions.checkoutCommand, form());
    assert.ok(r.searchParams.get('checkoutError') || r.searchParams.get('erro')); assert.equal(env.writes.length, 0);
  }
});
test('não abre dois caixas na mesma unidade', async () => {
  const env = environment(); assert.match((await result(env.actions.openCash, form({ unitId: 'u1', opening: '20' }))).searchParams.get('checkoutError'), /já possui/);
  assert.equal(env.writes.length, 0);
});
test('abertura não entra como receita e fica ligada à unidade e operador', async () => {
  const env = environment(); env.state.shop.enabledFeatures.operations.cashSessions = [];
  assert.equal((await result(env.actions.openCash, form({ unitId: 'u1', opening: '20.50' }))).searchParams.get('checkoutOk'), '1');
  const session = readWorkspace(env.state.shop.enabledFeatures).cashSessions[0];
  assert.equal(session.openingCents, 2050); assert.equal(session.unitId, 'u1'); assert.equal(session.openedBy, 'operator1'); assert.equal(env.state.entries.length, 0);
});
test('fechamento exige nova conferência após checkout concorrente e motivo da diferença', async () => {
  const env = environment();
  assert.match((await result(env.actions.closeCash, form({ paymentCount: '1', PIX: 0, CASH: 20 }))).searchParams.get('checkoutError'), /novos pagamentos/);
  assert.match((await result(env.actions.closeCash, form({ paymentCount: '0', PIX: 0, CASH: 19 }))).searchParams.get('checkoutError'), /motivo da diferença/);
  assert.equal(env.writes.length, 0);
  assert.equal((await result(env.actions.closeCash, form({ paymentCount: '0', PIX: 0, CASH: 19, note: 'Diferença conferida' }))).searchParams.get('checkoutOk'), '1');
  assert.equal(readWorkspace(env.state.shop.enabledFeatures).cashSessions[0].counted.CASH, 1900);
});
test('conciliação separa dinheiro do fundo e meios eletrônicos', () => {
  const totals = money.sessionTotals({ id: 's1', openingCents: 2000 }, [{ sessionId: 's1', amounts: { CASH: 1000, DEBIT: 3000, CREDIT: 4000, PIX: 5000 } }, { sessionId: 'other', amounts: { CASH: 99999 } }]);
  assert.deepEqual(totals, { CASH: 3000, DEBIT: 3000, CREDIT: 4000, PIX: 5000 });
});
test('WhatsApp normaliza telefone e abre mensagem sem envio automático', () => {
  const url = new URL(money.whatsappWaitlist('(11) 99999-1234', 'João', 'Corte e barba'));
  assert.equal(url.hostname, 'wa.me'); assert.equal(url.pathname, '/5511999991234'); assert.match(url.searchParams.get('text'), /João/);
  assert.equal(money.whatsappWaitlist('123', 'João', 'Corte'), null);
});


test('interface da comanda oferece recebimento rápido e últimas compras', () => {
  const { CommandCheckout } = load('components/command-checkout.tsx', {
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/app/erp/[tenant]/checkout-actions': { addCommandItem() {}, removeCommandItem() {}, checkoutCommand() {} },
  });
  const html = renderToStaticMarkup(React.createElement(CommandCheckout, {
    tenantCode: 'GROMMA', canOperate: true, autoOpen: true,
    command: { id: 'c1', customerName: 'Cliente Teste', unitName: 'Matriz', status: 'OPEN',
      total: 100, subtotal: 100, discount: 0, notes: '', plan: '', visits: 3, lastVisit: null,
      items: [{ id: 'i1', description: 'Corte', kind: 'SERVICE', quantity: 1, total: 100 }],
      history: [{ id: 'old1', date: '2026-10-10T10:00:00Z', total: 35,
        items: [{ id: 'p1', kind: 'PRODUCT', description: 'Pomada', quantity: 1, total: 35 }] }],
    },
    catalog: [{ id: 'p1', name: 'Pomada', price: 35, kind: 'PRODUCT' }],
    session: { id: 's1', unitId: 'u1', unitName: 'Matriz', openedAt: '2026-10-13T10:00:00Z', openedBy: 'gerente', openingCents: 0 },
  }));
  for (const item of ['Últimos produtos comprados', 'Pomada', 'Receber tudo em', 'Confirmar pagamento e fechar', 'Adicionar novamente'])
    assert.match(html, new RegExp(item));
  assert.doesNotMatch(html, /Cliente com item para recompra/);
});
