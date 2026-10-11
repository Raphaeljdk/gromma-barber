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
const agenda = load('lib/agenda.ts');
const workspace = load('lib/erp-workspace.ts');
const form = (values) => { const result = new FormData(); for (const [key, value] of Object.entries(values)) result.set(key, value); return result; };
const context = { tenantCode: 'GROMMA', agendaDate: '2026-10-11', agendaView: 'day', agendaUnit: 'u1', agendaProfessional: 'p1', agendaClient: '' };
const at = (time, day = '2026-10-11') => `${day}T${time}:00-03:00`;

function environment(overrides = {}) {
  const saved = [];
  const queries = [];
  const shop = { id: 'shop1', status: 'APPROVED', accessReleased: true, enabledFeatures: { otherFeature: true, operations: { waitlist: [{ id: 'old', customerName: 'Existente', notes: 'Manter dados anteriores' }] } } };
  const scoped = (model) => async (query) => { queries.push({ model, query }); return { id: query.where.id, durationMinutes: 30 }; };
  const prisma = {
    barberShop: { findUnique: async () => shop, update: async (query) => { saved.push(query); return shop; } },
    barberShopUnit: { findFirst: scoped('unit') }, service: { findFirst: scoped('service') },
    customer: { findFirst: scoped('customer') }, shopUser: { findFirst: scoped('professional') },
    appointment: { findFirst: async () => null, create: async (query) => { saved.push(query); return { id: 'new' }; }, updateMany: async (query) => { saved.push(query); return { count: 1 }; } },
  };
  Object.assign(prisma, overrides.prisma);
  const mocks = {
    '@/lib/prisma': { prisma }, '@/lib/tenant-auth': { requireTenantAccess: async () => overrides.viewer ?? { type: 'TENANT', role: 'OWNER', barberShopId: 'shop1' } },
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': { redirect: (url) => { throw Object.assign(new Error('Redirect'), { redirect: url }); } },
    'next/headers': { headers: async () => new Headers({ 'user-agent': overrides.agent ?? 'Mozilla/5.0 (iPhone; Mobile)' }) },
  };
  return { saved, queries, actions: load('app/erp/[tenant]/actions.ts', mocks), modules: load('app/erp/[tenant]/module-actions.ts', mocks) };
}
async function redirectOf(action, data) {
  try { await action(data); assert.fail('Expected redirect'); }
  catch (error) { if (!error.redirect) throw error; return new URL(error.redirect, 'https://gromma.example'); }
}

test('datas usam São Paulo, incluindo virada de dia e meia-noite', () => {
  assert.equal(agenda.agendaDateKey('2026-10-12T01:30:00Z'), '2026-10-11');
  assert.equal(agenda.agendaTime('2026-10-12T03:00:00Z'), '00:00');
  assert.equal(agenda.isAgendaDate('2026-02-31'), false);
  assert.equal(agenda.isAgendaDate('2024-02-29'), true);
  assert.equal(agenda.addAgendaDays('2026-12-31', 1), '2027-01-01');
});

test('mês mostra as 6 semanas completas, inclusive datas vizinhas', () => {
  const days = agenda.agendaMonthDays('2026-10-11');
  assert.equal(days.length, 42);
  assert.equal(days[0], '2026-09-28');
  assert.equal(days[41], '2026-11-08');
});

test('navegação mantém unidade, profissional, data e filtro sem permitir destino externo', () => {
  const url = new URL(agenda.agendaReturnHref('GROMMA', form({ ...context, agendaClient: 'with-plan', returnTo: 'https://evil.example' }), { ok: 'agenda' }), 'https://gromma.example');
  assert.equal(url.pathname, '/erp/GROMMA/agenda');
  for (const key of ['agendaUnit', 'agendaProfessional', 'agendaDate']) assert.equal(url.searchParams.get(key), context[key]);
  assert.equal(url.searchParams.get('agendaClient'), 'with-plan');
  assert.equal(url.searchParams.has('returnTo'), false);
});

test('recompra é explícita e preserva observações sem expor o marcador', () => {
  const value = agenda.encodeAppointmentNotes('Pomada matte', true);
  assert.deepEqual(agenda.appointmentNotes(value), { text: 'Pomada matte', repurchase: true });
  assert.equal(agenda.encodeAppointmentNotes(value, false), 'Pomada matte');
  assert.deepEqual(agenda.appointmentNotes('Cliente perguntou sobre recompra'), { text: 'Cliente perguntou sobre recompra', repurchase: false });
});

test('origem legada não é inventada como celular ou computador', () => {
  assert.equal(agenda.appointmentSource('ERP').icon, 'calendar');
  assert.equal(agenda.appointmentSource('ERP_ROTATION_MOBILE').icon, 'mobile');
  assert.equal(agenda.appointmentSource('ERP_DESKTOP').icon, 'desktop');
  assert.equal(agenda.appointmentSource('WHATSAPP').icon, 'message');
});

test('filtros de plano e presença correspondem aos estados reais', () => {
  assert.equal(agenda.matchesAgendaClient({ hasPlan: true, status: 'SCHEDULED' }, 'with-plan'), true);
  assert.equal(agenda.matchesAgendaClient({ hasPlan: true, status: 'SCHEDULED' }, 'without-plan'), false);
  assert.equal(agenda.matchesAgendaClient({ hasPlan: false, status: 'CHECKED_IN' }, 'on-site'), true);
  assert.equal(agenda.matchesAgendaClient({ hasPlan: true, status: 'COMPLETED' }, 'on-site'), false);
});

test('cartões simultâneos se dividem em faixas; horários não alinhados mantêm precisão', () => {
  const items = [
    { id: 'a', startsAt: at('09:10'), endsAt: at('10:00') },
    { id: 'b', startsAt: at('09:30'), endsAt: at('10:30') },
    { id: 'c', startsAt: at('10:30'), endsAt: at('11:00') },
  ];
  const layout = agenda.layoutAgendaAppointments(items, '2026-10-11', 480, 1200, 30);
  assert.equal(layout[0].start, 550);
  assert.equal(layout[0].tracks, 2);
  assert.notEqual(layout[0].track, layout[1].track);
  assert.equal(layout[2].tracks, 1);
});

test('cartão que passa da meia-noite é recortado no fim do dia', () => {
  const [item] = agenda.layoutAgendaAppointments([{ id: 'a', startsAt: at('23:30'), endsAt: at('00:30', '2026-10-12') }], '2026-10-11', 480, 1440, 30);
  assert.equal(item.start, 1410);
  assert.equal(item.end, 1440);
});

test('agendamento salva origem, recompra e fuso e retorna à unidade selecionada', async () => {
  const env = environment();
  const url = await redirectOf(env.actions.createAppointment, form({ ...context, unitId: 'u1', barberId: 'p1', customerId: 'c1', serviceId: 's1', startsAt: '2026-10-11T09:30', notes: 'Pomada', repurchase: '1' }));
  const data = env.saved[0].data;
  assert.equal(data.source, 'ERP_MOBILE');
  assert.equal(data.startsAt.toISOString(), '2026-10-11T12:30:00.000Z');
  assert.equal(agenda.appointmentNotes(data.notes).repurchase, true);
  assert.equal(url.searchParams.get('agendaUnit'), 'u1');
  assert.equal(url.searchParams.get('ok'), 'agenda');
  for (const entry of env.queries) assert.equal(entry.query.where.barberShopId, 'shop1');
  const professional = env.queries.find((item) => item.model === 'professional');
  assert.equal(professional.query.where.active, true);
  assert.deepEqual(professional.query.where.OR, [{ unitId: null }, { unitId: 'u1' }]);
});

test('conflitos impedem gravação e preservam contexto para nova tentativa', async () => {
  const env = environment({ prisma: { appointment: { findFirst: async () => ({ id: 'busy' }), create: async () => assert.fail('Não pode salvar') } } });
  const url = await redirectOf(env.actions.createAppointment, form({ ...context, unitId: 'u1', barberId: 'p1', serviceId: 's1', startsAt: '2026-10-11T09:30' }));
  assert.equal(url.searchParams.get('erro'), 'agenda-conflito');
  assert.equal(url.searchParams.get('agendaUnit'), 'u1');
});

test('fila salva profissional e unidade no formato existente sem apagar dados legados', async () => {
  const env = environment();
  const url = await redirectOf(env.modules.addWaitlist, form({ ...context, customerName: 'Cliente teste', requestedDate: '2026-10-12', unitId: 'u1', barberId: 'p1', serviceId: 's1' }));
  const features = env.saved[0].data.enabledFeatures;
  assert.equal(features.otherFeature, true);
  assert.equal(features.operations.waitlist[0].barberId, 'p1');
  assert.equal(features.operations.waitlist[0].unitId, 'u1');
  assert.equal(features.operations.waitlist[1].id, 'old');
  assert.equal(url.searchParams.get('ok'), 'fila');
});

test('fila aceita sem preferência e rejeita datas inexistentes', async () => {
  const env = environment();
  await redirectOf(env.modules.addWaitlist, form({ ...context, customerName: 'Sem preferência', requestedDate: '2026-10-12', unitId: 'u1' }));
  assert.equal(env.saved[0].data.enabledFeatures.operations.waitlist[0].barberId, null);
  const invalid = await redirectOf(env.modules.addWaitlist, form({ ...context, customerName: 'Inválido', requestedDate: '2026-02-31', unitId: 'u1' }));
  assert.equal(invalid.searchParams.get('erro'), 'fila');
  assert.equal(env.saved.length, 1);
});

test('perfis sem operação não alteram agendamentos nem a fila', async () => {
  const env = environment({ viewer: { type: 'TENANT', role: 'ACCOUNTANT', barberShopId: 'shop1' } });
  for (const action of [env.modules.addWaitlist, env.actions.createAppointment, env.actions.updateAppointmentNotes]) {
    const url = await redirectOf(action, form(context));
    assert.equal(url.searchParams.get('erro'), 'permissao');
  }
  assert.equal(env.saved.length, 0);
});

test('informações de agendamento existente são atualizadas com escopo do tenant', async () => {
  const env = environment();
  const url = await redirectOf(env.actions.updateAppointmentNotes, form({ ...context, appointmentId: 'a1', notes: 'Shampoo', repurchase: '1' }));
  assert.deepEqual(env.saved[0].where, { id: 'a1', barberShopId: 'shop1' });
  assert.equal(agenda.appointmentNotes(env.saved[0].data.notes).repurchase, true);
  assert.equal(url.searchParams.get('ok'), 'agenda-informacoes');
});

const sample = { id: 'a1', startsAt: at('09:00'), endsAt: at('09:30'), status: 'CONFIRMED', customerId: 'c1', customerName: 'Cliente Exemplo', customerPhone: null, barberId: 'p1', barberName: 'Profissional Um', serviceName: 'Corte', price: 50, unitId: 'u1', unitName: 'Centro', source: 'ERP_DESKTOP', notes: null, hasPlan: true, planName: 'Mensal', firstVisit: true, birthday: true, command: null };
function markup(changes = {}) {
  const { ErpAgendaBoard } = load('components/erp-agenda-board.tsx', {
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'next/link': { __esModule: true, default: ({ children, prefetch, ...props }) => React.createElement('a', props, children) },
    '@/app/erp/[tenant]/actions': { createAppointment() {}, updateAppointmentStatus() {}, updateAppointmentNotes() {} },
    '@/app/erp/[tenant]/module-actions': { addWaitlist() {}, resolveWaitlist() {} },
  });
  return renderToStaticMarkup(React.createElement(ErpAgendaBoard, {
    tenantCode: 'GROMMA', selectedDate: '2026-10-11', view: 'day', appointments: [sample],
    professionals: [{ id: 'p1', name: 'Profissional Um', unitId: 'u1' }, { id: 'p2', name: 'Profissional Dois', unitId: 'u2' }],
    units: [{ id: 'u1', name: 'Centro' }, { id: 'u2', name: 'Shopping' }], customers: [], services: [],
    selectedUnitId: 'u1', selectedClientFilter: '', canOperate: true, settings: workspace.DEFAULT_WORKSPACE.settings,
    waitlist: [], ...changes,
  }));
}

test('grade, símbolos e navegação são renderizados com unidade preservada', () => {
  const html = markup();
  assert.match(html, /Ir para uma data/);
  assert.match(html, /Novo agendamento/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /agendaUnit=u1/);
  assert.match(html, /Primeira visita/);
  assert.match(html, /Aniversariante do dia/);
  assert.match(html, /Agendado pelo computador/);
  assert.match(html, /Sem preferência/);
  assert.match(html, /Abrir agendamento de Cliente Exemplo/);
  assert.match(html, /agenda-professional-lane/);
});

test('horários ocupados continuam bloqueados quando o filtro de plano esconde cartões', () => {
  const html = markup({ selectedClientFilter: 'without-plan' });
  assert.doesNotMatch(html, /Abrir agendamento de Cliente Exemplo/);
  assert.match(html, /<button[^>]*disabled=""[^>]*aria-label="Horário ocupado 09:00 com Profissional Um"/);
});

test('sem profissional e profissional desativado continuam visíveis', () => {
  assert.match(markup({ appointments: [{ ...sample, barberId: null }] }), /Abrir agendamento de Cliente Exemplo/);
  assert.match(markup({ appointments: [{ ...sample, barberId: 'archived', barberName: 'Profissional Antigo' }] }), /Profissional Antigo/);
});

test('semana e mês mantêm fichas clicáveis, inclusive profissionais fora do dia âncora', () => {
  const otherDay = { ...sample, startsAt: at('10:00', '2026-10-09'), endsAt: at('10:30', '2026-10-09'), barberId: 'archived', barberName: 'Profissional Antigo' };
  assert.match(markup({ view: 'week', appointments: [otherDay] }), /Cliente Exemplo/);
  assert.match(markup({ view: 'month' }), /Agendado pelo computador/);
});
