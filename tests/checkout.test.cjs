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
  const state = { shop: { id: 'shop1', status: 'APPROVED', accessReleased: true, enabledFeatures: { operations: { cashSessions: [{ id: 's1', unitId: 'u1', unitName: 'Centro', openingCents: 2000, openedAt: '2026-10-13T10:00:00Z', openedBy: 'u' }], commandPayments: [], productLines: [{ itemId: 'i1', productId: 'p1' }] } } }, command: { id: 'c1', unitId: 'u1', barberShopId: 'shop1', customer: { name: 'Cliente' }, status: 'OPEN', total: 100, subtotal: 100, discount: 0, updatedAt: new Date(), items: [{ id: 'i1', kind: 'PRODUCT', total: 100, quantity: 2 }] }, entries: [], stock: [], auditLogs: [], ...options.state };
  const writes = [];
  const tx = {
    barberShop: { findUnique: async () => state.shop, findUniqueOrThrow: async () => state.shop, update: async q => { writes.push('workspace'); Object.assign(state.shop, q.data); } },
    barberShopUnit: { findFirst: async q => { assert.equal(q.where.barberShopId, 'shop1'); return { id: 'u1', name: 'Centro' }; } },
    serviceCommand: { findFirst: async q => { assert.equal(q.where.barberShopId, 'shop1'); return state.command?.status === q.where.status ? state.command : null; }, updateMany: async q => { writes.push('command'); Object.assign(state.command, q.data); return { count: 1 }; },
      update: async q => { writes.push('command'); Object.assign(state.command, q.data); return state.command; } },
    commandItem: {
      create: async q => { const item = { id: 'added' + (state.command.items.length + 1), ...q.data }; state.command.items.push(item); writes.push('item'); return item; },
      delete: async q => { state.command.items = state.command.items.filter(item => item.id !== q.where.id); writes.push('removeItem'); },
    },
    appointment: {
      findFirst: async q => q.where?.id?.not ? (options.conflict ? { id: 'competing' } : null) : state.appointment,
      updateMany: async q => { if (!state.appointment) return { count: 0 }; Object.assign(state.appointment, q.data); writes.push('appointment'); return { count: 1 }; },
    },
    service: {
      findFirst: async q => (state.services ?? []).find(service => service.id === q.where.id && service.active !== false) ?? null,
      findMany: async () => state.services ?? [],
    },
    product: { findFirst: async q => (state.products ?? []).find(product => product.id === q.where.id) ?? null },

    stockMovement: { groupBy: async q => { assert.equal(q.where.unitId, 'u1'); assert.equal(q.where.barberShopId, 'shop1'); return [{ type: 'IN', _sum: { quantity: options.stock ?? 3 } }]; }, create: async q => { writes.push('stock'); state.stock.push(q.data); }, findFirst: async q => state.stock.find(x => x.type === q.where.type && x.reason === q.where.reason && x.unitId === q.where.unitId && x.productId === q.where.productId && Number(x.quantity) === Number(q.where.quantity)) ?? null },
    financialEntry: {
      create: async q => { writes.push('finance'); state.entries.push({ id: 'fin-' + (state.entries.length + 1), ...q.data }); },
      findMany: async q => state.entries.filter(e =>
        e.barberShopId === q.where.barberShopId && e.unitId === q.where.unitId &&
        e.type === q.where.type && e.status === q.where.status &&
        e.category === q.where.category &&
        new Date(e.paidAt).getTime() === new Date(q.where.paidAt).getTime() &&
        q.where.description.in.includes(e.description)),
      deleteMany: async q => {
        const old = state.entries.length;
        state.entries = state.entries.filter(e => !q.where.id.in.includes(e.id));
        writes.push('reverse-finance');
        return { count: old - state.entries.length };
      },
    },
    adminAuditLog: { create: async q => { state.auditLogs.push(q.data); writes.push('audit'); } },
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
  assert.deepEqual(totals, { CASH: 3000, DEBIT: 3000, CREDIT: 4000, PIX: 5000, TRANSFER: 0 });
});
test('WhatsApp normaliza telefone e abre mensagem sem envio automático', () => {
  const url = new URL(money.whatsappWaitlist('(11) 99999-1234', 'João', 'Corte e barba'));
  assert.equal(url.hostname, 'wa.me'); assert.equal(url.pathname, '/5511999991234'); assert.match(url.searchParams.get('text'), /João/);
  assert.equal(money.whatsappWaitlist('123', 'João', 'Corte'), null);
});


test('interface da comanda oferece recebimento rápido e últimas compras', () => {
  const { CommandCheckout } = load('components/command-checkout.tsx', {
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/app/erp/[tenant]/checkout-actions': { addCommandItem() {}, removeCommandItem() {}, checkoutCommand() {}, reopenCommand() {} },
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
  for (const item of ['Adicionar item', 'Receber e fechar', 'Dividir pagamento', 'Dinheiro', 'Débito', 'Crédito', 'Pix'])
    assert.match(html, new RegExp(item));
  assert.doesNotMatch(html, /Opções/); // Resumo completo sem seletor de visibilidade.
  assert.doesNotMatch(html, /Adicionar novamente/); // Compras anteriores ficam ocultas por padrão.
  assert.match(html, /Descontos e cupons/);
  assert.match(html, /Emitir Nota Fiscal/);
  assert.doesNotMatch(html, /Nota fiscal enviada com sucesso/);
  assert.doesNotMatch(html, /Histórico de atendimento/);
  assert.doesNotMatch(html, /Últimas compras/);
  assert.match(html, /disabled=""/); // Não encerra sem escolha consciente de pagamento.
  assert.doesNotMatch(html, /Cliente com item para recompra/);
});


test('Caixa apresenta atalho de conferência e exige conferência antes de fechar', () => {
  const { CashRegister } = load('components/cash-register.tsx', {
    '@/app/erp/[tenant]/checkout-actions': { openCash() {}, closeCash() {} },
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  });
  const html = renderToStaticMarkup(React.createElement(CashRegister, {
    tenantCode: 'GROMMA',
    units: [{ id: 'u1', name: 'Matriz' }],
    sessions: [{ id: 's1', unitId: 'u1', unitName: 'Matriz', openedAt: '2026-10-13T10:00:00Z', openedBy: 'Gerente', openingCents: 2000 }],
    payments: [],
    canOperate: true,
  }));
  assert.match(html, /Preencher valores previstos para conferir/);
  assert.match(html, /Conferi o dinheiro, a maquininha e os recebimentos/);
  assert.match(html, /Confirmar conferência e fechar caixa/);
});

test('Comandas fica subordinada a Caixa no menu, sem aparecer em Operação', () => {
  const { ErpSidebar } = load('components/erp-sidebar.tsx', {
    'next/navigation': { useRouter: () => ({ back() {}, push() {} }), usePathname: () => '/erp/GROMMA/caixa' },
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
  });
  const html = renderToStaticMarkup(React.createElement(ErpSidebar, {
    business: 'Barbearia Teste', tenantCode: 'GROMMA', city: 'São Paulo', state: 'SP',
    units: 1, users: 3, planKey: 'PRO', planName: 'Pro', planPrice: '100,00', email: 'demo@example.com',
    viewerType: 'TENANT', supportHref: 'https://example.com',
  }));
  const iCaixa = html.indexOf('>Caixa</span>');
  const iComandas = html.indexOf('>Comandas</span>');
  assert.ok(iCaixa >= 0 && iComandas > iCaixa);
  assert.match(html, /aria-controls="erp-nav-children-caixa"/);
  assert.match(html, /aria-expanded="true"/);
  assert.equal((html.match(/>Comandas<\/span>/g) || []).length, 1);
});

test('retorno da comanda preserva ficha e filtros da agenda inclusive quando a operação falha', async () => {
  for (const expectedTotal of ['10000', '9999']) {
    const env = environment();
    const r = await result(env.actions.checkoutCommand, form({
      expectedTotal, agendaReturn: '1', appointmentId: 'a1', agendaDate: '2026-10-14',
      agendaView: 'week', agendaUnit: 'u1', agendaProfessional: 'p1', agendaClient: 'on-site',
    }));
    assert.equal(r.pathname, '/erp/GROMMA/agenda');
    for (const [key, value] of Object.entries({ appointmentId: 'a1', agendaDate: '2026-10-14', agendaView: 'week', agendaUnit: 'u1', agendaProfessional: 'p1', agendaClient: 'on-site' })) {
      assert.equal(r.searchParams.get(key), value);
    }
    assert.equal(r.searchParams.has(expectedTotal === '10000' ? 'checkoutOk' : 'checkoutError'), true);
  }
});


test('desconto percentual no total e cupom promocional produzem valor consistente', async () => {
  const env = environment();
  env.state.shop.enabledFeatures.operations.coupons = [{ id: 'cp1', code: 'INFLU', kind: 'FIXED', value: 5, expiresAt: null, active: true }];
  const q = money.calculateCheckoutPricing(
    [{ id: 'i1', total: 100 }], 0,
    { kind: 'PERCENT', scope: 'ORDER', itemId: '', value: '10', couponCode: 'influ' },
    env.state.shop.enabledFeatures.operations.coupons,
  );
  assert.deepEqual([q.manualCents, q.couponCents, q.discountCents, q.totalCents], [1000, 500, 1500, 8500]);
  const url = await result(env.actions.checkoutCommand, form({
    PIX: '85', expectedTotal: '8500', discountKind: 'PERCENT',
    discountScope: 'ORDER', discountValue: '10', couponCode: 'INFLU',
  }));
  assert.equal(url.searchParams.get('checkoutOk'), '1');
  assert.equal(env.state.command.status, 'CLOSED');
  assert.equal(env.state.command.total, 85);
  assert.equal(env.state.command.discount, 15);
  assert.equal(env.state.entries[0].amount, 85);
  const payment = readWorkspace(env.state.shop.enabledFeatures).commandPayments[0];
  assert.equal(payment.couponCode, 'INFLU');
  assert.equal(payment.discountCents, 1500);
});
test('desconto por item não pode ultrapassar preço do item nem usar id inválido', () => {
  const lineItems = [{ id: 'a', total: 40 }, { id: 'b', total: 60 }];
  const q = money.calculateCheckoutPricing(lineItems, 0, {
    kind: 'FIXED', scope: 'ITEM', itemId: 'a', value: '10.00', couponCode: '',
  }, []);
  assert.equal(q.totalCents, 9000);
  assert.throws(() => money.calculateCheckoutPricing(lineItems, 0, {
    kind: 'FIXED', scope: 'ITEM', itemId: 'a', value: '45', couponCode: '',
  }, []), /supera/);
  assert.throws(() => money.calculateCheckoutPricing(lineItems, 0, {
    kind: 'PERCENT', scope: 'ITEM', itemId: 'fake', value: '10', couponCode: '',
  }, []), /Selecione um item/);
});
test('cupom inativo, expirado e valor adulterado não fecham comanda', async () => {
  const coupons = [{ id: 'c1', code: 'EXPIRADO', kind: 'FIXED', value: 10, active: true, expiresAt: '2025-01-01' }];
  const env = environment();
  env.state.shop.enabledFeatures.operations.coupons = coupons;
  for (const data of [
    { couponCode: 'EXPIRADO', expectedTotal: '9000', PIX: '90' },
    { discountKind: 'FIXED', discountScope: 'ORDER', discountValue: '5', expectedTotal: '10000', PIX: '100' },
  ]) {
    const url = await result(env.actions.checkoutCommand, form(data));
    assert.ok(url.searchParams.get('checkoutError'));
  }
  assert.equal(env.state.command.status, 'OPEN');
  assert.equal(env.state.entries.length, 0);
});

test('emissão fiscal futura não simula envio nem PDF válido', () => {
  const code = fs.readFileSync(path.join(root,'components/command-checkout.tsx'), 'utf8');
  assert.match(code, /Enviar nota fiscal por e-mail/);
  assert.match(code, /Baixar PDF para imprimir/);
  assert.match(code, /Emissão fiscal ainda não configurada/);
  assert.match(code, /className="btn secondary" disabled/);
});


test('serviços lançados na comanda são expandidos na duração; produtos não contam', () => {
  const catalog = [
    { id: 's1', name: 'Barba Premium', price: 60, durationMinutes: 35 },
    { id: 's2', name: 'Corte Premium', price: 80, durationMinutes: 45 },
  ];
  const services = money.servicesFromCommandLines([
    { id: 'old', kind: 'SERVICE', description: 'Barba Premium', unitPrice: 60, quantity: 1 },
    { id: 'new', kind: 'SERVICE', description: 'Corte Premium', unitPrice: 80, quantity: 2 },
    { id: 'prod', kind: 'PRODUCT', description: 'Pomada', unitPrice: 40, quantity: 2 },
  ], catalog, [{ itemId: 'new', serviceId: 's2' }], [{ id: 's1', name: 'Barba Premium', price: 60, durationMinutes: 35 }]);
  assert.equal(services.reduce((sum, s) => sum + s.durationMinutes, 0), 125);
  assert.deepEqual(services.map(s => s.name), ['Barba Premium','Corte Premium','Corte Premium']);
  assert.throws(() => money.servicesFromCommandLines([
    { id: 'unknown', kind: 'SERVICE', description: 'Serviço antigo', unitPrice: 5, quantity: 1 },
  ], catalog, [], []), /duração/);
});

test('comanda oferece categoria antes de filtrar o item, não lista única', () => {
  const code = fs.readFileSync(path.join(root,'components/command-checkout.tsx'), 'utf8');
  const section = code.slice(code.indexOf('className="checkout-add checkout-add-focused"'),code.indexOf('className="checkout-split-toggle"'));
  assert.ok(section.indexOf('>Categoria</span>') >= 0);
  assert.ok(section.indexOf('>Item da categoria</span>') > section.indexOf('>Categoria</span>'));
  assert.match(section, /catalog\.filter\(item => item\.kind === itemCategory\)/);
  assert.ok(section.includes('setSelectedCatalogItem("")'));
});


test('incluir serviço no checkout aumenta endsAt, serviço exibido e tempo reservado', async () => {
  const start = new Date('2026-10-15T12:00:00Z');
  const service = [
    { id: 's1', name: 'Barba Premium', price: 60, durationMinutes: 35 },
    { id: 's2', name: 'Corte Premium', price: 80, durationMinutes: 45 },
  ];
  const env = environment({ state: {
    services: service,
    appointment: { id: 'a1', status: 'CONFIRMED', startsAt: start,
      endsAt: new Date(start.getTime() + 35 * 60000), barberId: 'b1', serviceId: 's1' },
    command: { id: 'c1', unitId: 'u1', barberShopId: 'shop1', appointmentId: 'a1', status: 'OPEN',
      subtotal: 60, total: 60, discount: 0, items: [
        { id: 'original', kind: 'SERVICE', description: 'Barba Premium', quantity: 1, unitPrice: 60, total: 60 },
      ] },
    shop: { id: 'shop1', status: 'APPROVED', accessReleased: true, enabledFeatures: { operations: {
      settings: { openHour: 8, closeHour: 20 },
      bookedServices: [{ appointmentId: 'a1', services: [{ id: 's1', name: 'Barba Premium', price: 60, durationMinutes: 35 }] }],
    } } },
  } });
  const response = await result(env.actions.addCommandItem, form({ catalogItem: 'SERVICE:s2', quantity: '1' }));
  assert.equal(response.searchParams.get('checkoutOk'), '1');
  assert.equal(env.state.appointment.endsAt.toISOString(), new Date(start.getTime() + 80 * 60000).toISOString());
  assert.equal(env.state.command.total, 140);
  const booked = readWorkspace(env.state.shop.enabledFeatures).bookedServices.find(entry => entry.appointmentId === 'a1');
  assert.equal(booked.services.reduce((sum, service) => sum + service.durationMinutes, 0), 80);
  assert.deepEqual(booked.services.map(item => item.name), ['Barba Premium', 'Corte Premium']);
  const removed = await result(env.actions.removeCommandItem, form({ itemId: 'added2' }));
  assert.equal(removed.searchParams.get('checkoutOk'), '1');
  assert.equal(env.state.appointment.endsAt.toISOString(), new Date(start.getTime() + 35 * 60000).toISOString());
  assert.deepEqual(readWorkspace(env.state.shop.enabledFeatures).bookedServices[0].services.map(s => s.name), ['Barba Premium']);
});

test('horário ocupado impede acrescentar serviço e deixa a reserva anterior intacta', async () => {
  const start = new Date('2026-10-15T12:00:00Z');
  const env = environment({ conflict: true, state: {
    services: [
      { id: 's1', name: 'Barba', price: 40, durationMinutes: 30 },
      { id: 's2', name: 'Corte', price: 55, durationMinutes: 45 },
    ],
    appointment: { id: 'a1', status: 'CONFIRMED', startsAt: start,
      endsAt: new Date(start.getTime() + 30 * 60000), barberId: 'b1', serviceId: 's1' },
    command: { id: 'c1', unitId: 'u1', barberShopId: 'shop1', appointmentId: 'a1', status: 'OPEN',
      subtotal: 40, total: 40, discount: 0, items: [{ id: 'orig', kind: 'SERVICE', description: 'Barba', quantity: 1, unitPrice: 40, total: 40 }] },
    shop: { id: 'shop1', status: 'APPROVED', accessReleased: true, enabledFeatures: { operations: {
      settings: { openHour: 8, closeHour: 20 },
      bookedServices: [{ appointmentId: 'a1', services: [{ id: 's1', name: 'Barba', price: 40, durationMinutes: 30 }] }],
    } } },
  } });
  const response = await result(env.actions.addCommandItem, form({ catalogItem: 'SERVICE:s2', quantity: '1' }));
  assert.match(response.searchParams.get('checkoutError'), /conflita com outro agendamento/);
  assert.equal(env.state.command.items.length, 1);
  assert.equal(env.state.command.total, 40);
  assert.equal(env.state.appointment.endsAt.toISOString(), new Date(start.getTime() + 30 * 60000).toISOString());
});


test('homologação: atendimento de 45 minutos soma serviço de 30 minutos e produto não ocupa agenda', async () => {
  const start = new Date('2026-10-15T13:00:00Z'); // 10h em São Paulo
  const originalEnd = new Date(start.getTime() + 45 * 60_000);
  const expectedEnd = new Date(start.getTime() + 75 * 60_000);
  const env = environment({ state: {
    services: [
      { id: 's1', name: 'Corte', price: 60, durationMinutes: 45 },
      { id: 's2', name: 'Barba', price: 40, durationMinutes: 30 },
    ],
    products: [{ id: 'p1', name: 'Pomada', salePrice: 20 }],
    appointment: { id: 'a1', status: 'CONFIRMED', startsAt: start,
      endsAt: originalEnd, barberId: 'b1', serviceId: 's1' },
    command: { id: 'c1', unitId: 'u1', barberShopId: 'shop1', appointmentId: 'a1',
      status: 'OPEN', subtotal: 60, total: 60, discount: 0,
      items: [{ id: 'original', kind: 'SERVICE', description: 'Corte',
        quantity: 1, unitPrice: 60, total: 60 }] },
    shop: { id: 'shop1', status: 'APPROVED', accessReleased: true, enabledFeatures: { operations: {
      settings: { openHour: 8, closeHour: 20 },
      bookedServices: [{ appointmentId: 'a1', services: [
        { id: 's1', name: 'Corte', price: 60, durationMinutes: 45 },
      ] }],
    } } },
  } });
  const addService = await result(env.actions.addCommandItem,
    form({ catalogItem: 'SERVICE:s2', quantity: '1' }));
  assert.equal(addService.searchParams.get('checkoutOk'), '1');
  assert.equal(env.state.appointment.endsAt.toISOString(), expectedEnd.toISOString());
  assert.equal(env.state.command.total, 100);

  const addProduct = await result(env.actions.addCommandItem,
    form({ catalogItem: 'PRODUCT:p1', quantity: '1' }));
  assert.equal(addProduct.searchParams.get('checkoutOk'), '1');
  assert.equal(env.state.appointment.endsAt.toISOString(), expectedEnd.toISOString(),
    'Produto não acrescenta minutos à agenda');
  assert.equal(env.state.command.total, 120);
  const booked = readWorkspace(env.state.shop.enabledFeatures)
    .bookedServices.find(item => item.appointmentId === 'a1');
  assert.deepEqual(booked.services.map(item => item.durationMinutes), [45, 30]);

  const removeService = await result(env.actions.removeCommandItem,
    form({ itemId: 'added2' }));
  assert.equal(removeService.searchParams.get('checkoutOk'), '1');
  assert.equal(env.state.appointment.endsAt.toISOString(), originalEnd.toISOString());
  assert.equal(env.state.command.total, 80);
  assert.equal(readWorkspace(env.state.shop.enabledFeatures)
    .bookedServices.find(item => item.appointmentId === 'a1')
    .services.reduce((total, item) => total + item.durationMinutes, 0), 45);
});

test('homologação mobile: seleção de categoria é independente e controles cabem em telas estreitas', () => {
  const ui = fs.readFileSync(path.join(root, 'components/command-checkout.tsx'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');
  assert.match(ui, /name="catalogCategory"/);
  assert.match(ui, /name="catalogItem"/);
  assert.match(ui, /setSelectedCatalogItem\(""\)/);
  assert.match(ui, /catalog\.filter\(item => item\.kind === itemCategory\)/);
  assert.match(css, /@media\(max-width:480px\)[\s\S]*?\.agenda-dialog-checkout \.checkout-add-focused/);
  assert.match(css, /\.agenda-dialog-checkout \.checkout-add-focused > \.checkout-item-select\s*\{grid-column:1\/-1;\}/);
  assert.match(css, /\.agenda-dialog #agenda-detail-settings\[popover\][\s\S]*?max-width:calc\(100vw - 24px\)/);
  assert.match(css, /\.agenda-dialog #agenda-detail-settings\[popover\][\s\S]*?overscroll-behavior:contain/);
});


test('comanda paga pode ser reaberta e recebida em outro meio sem duplicar financeiro e estoque', async () => {
  const env = environment();
  const first = await result(env.actions.checkoutCommand, form({ PIX: '0', DEBIT: '100' }));
  assert.equal(first.searchParams.get('checkoutOk'), '1');
  assert.equal(env.state.entries.length, 1);
  const closedPayment = readWorkspace(env.state.shop.enabledFeatures).commandPayments[0];
  assert.deepEqual(closedPayment.amounts, { CASH: 0, DEBIT: 10000, CREDIT: 0, PIX: 0, TRANSFER: 0 });

  const reopened = await result(env.actions.reopenCommand, form());
  assert.equal(reopened.searchParams.get('checkoutOk'), '1');
  assert.equal(reopened.searchParams.get('commandId'), 'c1');
  assert.equal(env.state.command.status, 'OPEN');
  assert.equal(env.state.command.closedAt, null);
  assert.equal(env.state.entries.length, 0);
  assert.equal(readWorkspace(env.state.shop.enabledFeatures).commandPayments.length, 0);
  assert.equal(env.state.stock.filter(item => item.type === 'OUT').length, 1);
  assert.equal(env.state.stock.filter(item => item.type === 'IN').length, 1);
  assert.equal(env.state.stock[1].reason.includes(closedPayment.id), true);
  assert.equal(env.state.auditLogs.length, 1);
  assert.equal(env.state.auditLogs[0].action, 'COMMAND_REOPENED');
  assert.equal(env.state.auditLogs[0].details.commandId, 'c1');

  const second = await result(env.actions.checkoutCommand, form({ PIX: '0', CREDIT: '100' }));
  assert.equal(second.searchParams.get('checkoutOk'), '1');
  assert.deepEqual(env.state.entries.map(e => [e.description, e.amount]), [['Comanda C1 · Crédito', 100]]);
  assert.equal(env.state.command.status, 'CLOSED');
  assert.equal(env.state.stock.filter(item => item.type === 'OUT').length, 2);
  assert.equal(env.state.stock.filter(item => item.type === 'IN').length, 1);
  assert.equal(readWorkspace(env.state.shop.enabledFeatures).commandPayments.length, 1);
});

test('caixa original fechado impede reabrir até quando há novo caixa aberto na mesma unidade', async () => {
  for (const withNewCash of [false, true]) {
    const env = environment();
    assert.equal((await result(env.actions.checkoutCommand, form())).searchParams.get('checkoutOk'), '1');
    env.state.shop.enabledFeatures.operations.cashSessions[0].closedAt = new Date().toISOString();
    if (withNewCash) env.state.shop.enabledFeatures.operations.cashSessions.push({
      id: 's2', unitId: 'u1', openedAt: new Date().toISOString(), openedBy: 'u', openingCents: 0,
    });
    const r = await result(env.actions.reopenCommand, form());
    assert.match(r.searchParams.get('checkoutError'), /caixa original/);
    assert.equal(env.state.command.status, 'CLOSED');
    assert.equal(env.state.entries.length, 1);
    assert.equal(env.state.stock.length, 1);
    assert.equal(env.state.auditLogs.length, 0);
  }
});

test('reabertura só para gestão e nunca quando lançamento financeiro foi modificado', async () => {
  const env = environment({ viewer: { type: 'TENANT', barberShopId: 'shop1', role: 'BARBER', userId: 'barber1' } });
  assert.equal((await result(env.actions.checkoutCommand, form())).searchParams.get('checkoutOk'), '1');
  const denied = await result(env.actions.reopenCommand, form());
  assert.match(denied.searchParams.get('checkoutError'), /Somente a gestão/);
  assert.equal(env.state.command.status, 'CLOSED');

  const manager = environment();
  assert.equal((await result(manager.actions.checkoutCommand, form())).searchParams.get('checkoutOk'), '1');
  manager.state.entries[0].amount = 99;
  const blocked = await result(manager.actions.reopenCommand, form());
  assert.match(blocked.searchParams.get('checkoutError'), /lançamento financeiro foi alterado/);
  assert.equal(manager.state.command.status, 'CLOSED');
  assert.equal(manager.state.stock.length, 1);
  assert.equal(readWorkspace(manager.state.shop.enabledFeatures).commandPayments.length, 1);
});

test('comanda fechada tem Reabrir em destaque e sem Opções, indisponível após fechar caixa', () => {
  const { CommandCheckout } = load('components/command-checkout.tsx', {
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/app/erp/[tenant]/checkout-actions': {
      addCommandItem() {}, removeCommandItem() {}, checkoutCommand() {}, reopenCommand() {},
    },
  });
  const command = {
    id: 'c1', customerName: 'Cliente', unitName: 'Centro', status: 'CLOSED', total: 100,
    subtotal: 100, discount: 0, notes: 'Observação da comanda', plan: '',
    visits: 1, lastVisit: null,
    items: [{ id: 'i1', description: 'Corte', kind: 'SERVICE', quantity: 1, total: 100 }],
    history: [],
  };
  const payment = { id: 'p1', sessionId: 's1', amounts: { CASH: 0, DEBIT: 10000, CREDIT: 0, PIX: 0 } };
  const session = { id: 's1', unitId: 'u1', openedAt: '2026-10-19T12:00:00Z', openedBy: 'teste', openingCents: 0 };
  const props = { command, payment, tenantCode: 'GROMMA', canOperate: true, allowReopen: true, autoOpen: true };
  const html = renderToStaticMarkup(React.createElement(CommandCheckout, { ...props, session }));
  assert.match(html, /Reabrir comanda/);
  assert.match(html, /Observação da comanda/);
  assert.match(html, /Subtotal:/);
  assert.doesNotMatch(html, />Opções</);
  const blocked = renderToStaticMarkup(React.createElement(CommandCheckout, { ...props }));
  assert.match(blocked, /Reabertura indisponível/);
  assert.match(blocked, /disabled=""/);
  const inAgenda = renderToStaticMarkup(React.createElement(CommandCheckout, { ...props, session, allowReopen: false }));
  assert.doesNotMatch(inAgenda, /Reabrir comanda/);
});

test('Transferência fica separada de Pix e é conciliada em caixas novos sem perder registros antigos', async () => {
  const env = environment();
  const url = await result(env.actions.checkoutCommand, form({ PIX: '0', TRANSFER: '100' }));
  assert.equal(url.searchParams.get('checkoutOk'), '1');
  assert.equal(env.state.entries.length, 1);
  assert.match(env.state.entries[0].description, /Transferência/);
  const ws = readWorkspace(env.state.shop.enabledFeatures);
  assert.equal(ws.commandPayments[0].amounts.TRANSFER, 10000);
  assert.equal(ws.commandPayments[0].amounts.PIX, 0);
  const totals = money.sessionRevenueTotals('s1', ws.commandPayments);
  assert.equal(totals.TRANSFER, 10000);
  assert.equal(totals.PIX, 0);
  const historic = [{ sessionId:'s1', amounts:{ CASH:0, DEBIT:1000, CREDIT:0, PIX:2000 } }];
  assert.deepEqual(money.sessionRevenueTotals('s1',historic), { CASH:0, DEBIT:1000, CREDIT:0, PIX:2000, TRANSFER:0 });
  assert.equal(money.sessionTotals({ id:'s1',openingCents:1500 },historic).CASH,1500);
});

test('histórico exibe caixas encerrados e cada comanda do recibo correspondente', async () => {
  const { CashHistory } = load('components/cash-history.tsx', {
    '@/lib/prisma': { prisma: { serviceCommand: { findMany: async q => {
      assert.equal(q.where.barberShopId, 'shop1');
      assert.deepEqual(q.where.id.in, ['c1']);
      return [{ id:'c1', status:'CLOSED', openedAt:new Date('2026-10-18T10:00:00Z'),
        closedAt:new Date('2026-10-18T15:00:00Z'), total:50,
        items:[{ id:'item1', description:'Corte premium',quantity:1,total:50,kind:'SERVICE' }] }];
    } } } },
    'next/link': { __esModule: true, default: ({ children, ...props }) => React.createElement('a',props,children) },
  });
  const sessions = [
    { id:'closed1',unitId:'u1',unitName:'Matriz',openedAt:'2026-10-18T11:00:00Z',
      closedAt:'2026-10-18T21:00:00Z',openedBy:'Operador',closedBy:'Gerente',openingCents:2000 },
    { id:'closed2',unitId:'u1',unitName:'Matriz',openedAt:'2026-10-17T11:00:00Z',
      closedAt:'2026-10-17T21:00:00Z',openedBy:'Operador',closedBy:'Gerente',openingCents:0 },
    { id:'open1',unitId:'u1',unitName:'Matriz',openedAt:'2026-10-19T11:00:00Z',
      openedBy:'Operador',openingCents:0 },
  ];
  const payments = [{ id:'payment1', commandId:'c1',sessionId:'closed1',
    customerName:'Cliente A',paidAt:'2026-10-18T15:00:00Z',
    amounts:{ CASH:0,DEBIT:0,CREDIT:0,PIX:4000,TRANSFER:1000 } }];
  const base = {shopId:'shop1',tenantCode:'GROMMA',sessions,payments,units:[{id:'u1',name:'Matriz'}]};
  const listing = await CashHistory({ ...base, query:{} });
  const listHtml = renderToStaticMarkup(listing);
  assert.match(listHtml, /Histórico de caixas/);
  assert.match(listHtml, /Ver caixa/);
  assert.match(listHtml, /<strong>2<\/strong> caixas fechados encontrados/);
  assert.doesNotMatch(listHtml, /open1/);
  const filtered = renderToStaticMarkup(await CashHistory({ ...base, query:{cashStart:'2026-10-18',cashEnd:'2026-10-18'} }));
  assert.match(filtered, /<strong>1<\/strong> caixas fechados encontrados/);
  const detail = renderToStaticMarkup(await CashHistory({ ...base, query:{cashId:'closed1'} }));
  for (const t of ['Total recebido no caixa','Pix','Débito','Crédito','Transferência','Corte premium','Cliente A','Ver comanda','Fechado']) assert.match(detail,new RegExp(t));
  assert.match(detail, /50,00/);
  assert.doesNotMatch(detail, /Reabrir comanda/);
});
