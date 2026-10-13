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
const availability = load('lib/agenda-availability.ts');

test('bloqueios respeitam interseção e expediente, incluindo término à meia-noite', () => {
  const blocks = [{ barberId: 'p1', startsAt: at('12:00'), endsAt: at('13:00') }];
  assert.equal(availability.hasAgendaBlock(blocks, 'p1', new Date(at('11:45')), new Date(at('12:15'))), true);
  assert.equal(availability.hasAgendaBlock(blocks, 'p1', new Date(at('13:00')), new Date(at('13:30'))), false);
  assert.equal(availability.hasAgendaBlock(blocks, 'p2', new Date(at('12:00')), new Date(at('12:30'))), false);
  assert.equal(availability.withinAgendaHours(new Date(at('23:30')), new Date(at('00:00', '2026-10-12')), 8, 24), true);
  assert.equal(availability.parseAgendaInput('2026-02-31T12:00'), null);
  assert.equal(availability.parseAgendaInput('2026-10-11T24:30'), null);
});

test('remarcação preserva duração e verifica conflito no tenant', async () => {
  let updated;
  const item = { id: 'a1', barberShopId: 'shop1', unitId: 'u1', status: 'CONFIRMED', startsAt: new Date(at('10:00')), endsAt: new Date(at('10:45')), command: null };
  const env = environment({ prisma: { appointment: {
    findFirst: async q => { assert.equal(q.where.barberShopId, 'shop1'); return q.where.id === 'a1' ? item : null; },
    update: async q => { updated = q.data; },
  } } });
  const result = await redirectOf(env.operations.rescheduleAppointment, form({ ...context, appointmentId: 'a1', originalStartsAt: item.startsAt.toISOString(), startsAt: '2026-10-11T14:00', barberId: 'p1' }));
  assert.equal(result.searchParams.get('ok'), 'agenda-operacao');
  assert.equal(updated.endsAt - updated.startsAt, 45 * 60000);
});

test('remarcação recusa conflito e versão antiga sem gravar', async () => {
  const item = { id: 'a1', unitId: 'u1', status: 'SCHEDULED', startsAt: new Date(at('10:00')), endsAt: new Date(at('10:30')), command: null };
  const env = environment({ prisma: { appointment: { findFirst: async q => q.where.id === 'a1' ? item : { id: 'conflict' }, update: async () => assert.fail('must not write') } } });
  for (const originalStartsAt of [item.startsAt.toISOString(), new Date(at('09:00')).toISOString()]) {
    const result = await redirectOf(env.operations.rescheduleAppointment, form({ ...context, appointmentId: 'a1', originalStartsAt, startsAt: '2026-10-11T14:00', barberId: 'p1' }));
    assert.equal(result.searchParams.get('erro'), 'agenda-operacao');
  }
});

test('bloqueio é salvo no workspace e perfis de leitura não podem alterá-lo', async () => {
  const values = form({ ...context, startsAt: '2026-10-11T12:00', endsAt: '2026-10-11T13:00', barberId: 'p1', unitId: 'u1', reason: 'Almoço' });
  const env = environment();
  const result = await redirectOf(env.operations.saveAgendaBlock, values);
  assert.equal(result.searchParams.get('ok'), 'agenda-operacao');
  const data = env.saved[0].data.enabledFeatures;
  assert.equal(data.operations.agendaBlocks[0].reason, 'Almoço');
  assert.equal(data.otherFeature, true);
  assert.equal(data.operations.waitlist[0].id, 'old');
  const denied = environment({ viewer: { type: 'TENANT', role: 'ACCOUNTANT', barberShopId: 'shop1' } });
  assert.equal((await redirectOf(denied.operations.saveAgendaBlock, values)).searchParams.get('erro'), 'permissao');
  assert.equal(denied.saved.length, 0);
});

test('encaixe remove apenas a entrada escolhida depois de criar o agendamento', async () => {
  const env = environment({ features: { operations: { waitlist: [
    { id: 'w1', unitId: 'u1', barberId: 'p1', serviceId: 's1', requestedDate: '2026-10-11', customerName: 'Ana' },
    { id: 'w2', customerName: 'Outro' },
  ] } } });
  const result = await redirectOf(env.actions.createAppointment, form({ ...context, unitId: 'u1', barberId: 'p1', serviceId: 's1', startsAt: '2026-10-11T14:00', waitlistId: 'w1' }));
  assert.equal(result.searchParams.get('ok'), 'agenda');
  assert.equal(env.saved.find(q => q.data?.serviceId)?.data.serviceId, 's1');
  assert.deepEqual(env.saved.find(q => q.data?.enabledFeatures)?.data.enabledFeatures.operations.waitlist.map(w => w.id), ['w2']);
  assert.equal(env.saved.find(q => q.customerCreate)?.customerCreate.name, 'Ana');
  assert.equal(env.saved.find(q => q.data?.serviceId)?.data.customerId, 'queue-c1');
});

test('novo agendamento não ignora bloqueios do profissional', async () => {
  const env = environment({ features: { operations: { agendaBlocks: [{ id: 'b1', barberId: 'p1', unitId: 'u1', startsAt: at('14:00'), endsAt: at('15:00'), reason: 'Pausa' }] } } });
  const result = await redirectOf(env.actions.createAppointment, form({ ...context, unitId: 'u1', barberId: 'p1', serviceId: 's1', startsAt: '2026-10-11T14:15' }));
  assert.equal(result.searchParams.get('erro'), 'agenda');
  assert.equal(env.saved.length, 0);
});

function environment(overrides = {}) {
  const saved = [];
  const queries = [];
  const shop = { id: 'shop1', status: 'APPROVED', accessReleased: true, enabledFeatures: overrides.features || { otherFeature: true, operations: { waitlist: [{ id: 'old', customerName: 'Existente', notes: 'Manter dados anteriores' }] } } };
  const scoped = (model) => async (query) => { queries.push({ model, query }); return { id: query.where.id, durationMinutes: 30 }; };
  const prisma = {
    barberShop: { findUnique: async () => shop, findUniqueOrThrow: async () => shop, update: async (query) => { saved.push(query); return shop; } },
    barberShopUnit: { findFirst: scoped('unit') }, service: { findFirst: scoped('service') },
    customer: {
      findFirst: async (query) => { queries.push({ model: 'customer', query }); return query.where.id ? { id: query.where.id } : null; },
      create: async (query) => { saved.push({ customerCreate: query.data }); return { id: 'queue-c1' }; },
    }, shopUser: { findFirst: scoped('professional') },
    appointment: { findFirst: async () => null, create: async (query) => { saved.push(query); return { id: 'new' }; }, updateMany: async (query) => { saved.push(query); return { count: 1 }; } },
  };
  Object.assign(prisma, overrides.prisma);
  prisma.$transaction = async (callback) => callback(prisma);
  const mocks = {
    '@/lib/prisma': { prisma }, '@/lib/tenant-auth': { requireTenantAccess: async () => overrides.viewer ?? { type: 'TENANT', role: 'OWNER', barberShopId: 'shop1' } },
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': { redirect: (url) => { throw Object.assign(new Error('Redirect'), { redirect: url }); } },
    'next/headers': { headers: async () => new Headers({ 'user-agent': overrides.agent ?? 'Mozilla/5.0 (iPhone; Mobile)' }) },
  };
  return { saved, queries, actions: load('app/erp/[tenant]/actions.ts', mocks), operations: load('app/erp/[tenant]/agenda-actions.ts', mocks), modules: load('app/erp/[tenant]/module-actions.ts', mocks) };
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
  assert.match(html, /aria-expanded="true"/);
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

test('múltiplos serviços reservam a duração combinada e salvam todos os itens', async () => {
  const env = environment({ prisma: { service: {
    findFirst: async () => ({ id: 's1', name: 'Corte', durationMinutes: 30, price: 40 }),
    findMany: async q => { assert.equal(q.where.barberShopId, 'shop1'); return [{ id: 's2', name: 'Barba', durationMinutes: 20, price: 30 }]; },
  } } });
  const data = form({ ...context, unitId: 'u1', serviceId: 's1', customerId: 'c1', barberId: 'p1', startsAt: '2026-10-11T10:00' });
  data.append('serviceIds', 's2');
  const result = await redirectOf(env.actions.createAppointment, data);
  assert.equal(result.searchParams.get('ok'), 'agenda');
  const created = env.saved.find(q => q.data.startsAt);
  assert.equal(created.data.endsAt - created.data.startsAt, 50 * 60000);
  const settings = env.saved.find(q => q.data.enabledFeatures).data.enabledFeatures;
  assert.deepEqual(workspace.readWorkspace(settings).bookedServices[0].services.map(s => s.name), ['Corte', 'Barba']);
});


test('indicadores aparecem dentro do painel de unidades, não acima da agenda', () => {
  const html = markup();
  const side = html.indexOf('id="agenda-information-panel"');
  const metrics = html.indexOf('Indicadores do dia');
  const calendar = html.indexOf('class="agenda-main-calendar"');
  assert.ok(side > calendar);
  assert.ok(metrics > side);
  assert.match(html, /Agendados/);
  assert.doesNotMatch(html, /Item para recompra/);
});

test('ficha exibe produtos comprados anteriormente, sem campo de recompra', () => {
  const html = markup({ initialAppointmentId: 'a1', appointments: [{
    ...sample, recentProducts: [{ description: 'Pomada modeladora', quantity: 2, date: at('10:00') }],
  }] });
  assert.match(html, /aria-controls="agenda-detail-settings"/);
  assert.match(html, /Opções/);
  assert.doesNotMatch(html, /Pomada modeladora/); // Compras aparecem sob demanda.
});

test('formulário novo exibe etapas, busca e total antes de confirmar', () => {
  const { AgendaAppointmentForm } = load('components/agenda-forms.tsx', {
    '@/app/erp/[tenant]/actions': { createAppointment() {} },
    '@/app/erp/[tenant]/module-actions': { addWaitlist() {} },
  });
  const html = renderToStaticMarkup(React.createElement(AgendaAppointmentForm, {
    context, professionals: [{ id: 'p1', name: 'Profissional Um', unitId: 'u1' }],
    units: [{ id: 'u1', name: 'Centro' }],
    services: [{ id: 's1', name: 'Corte', durationMinutes: 45, price: 55 }],
    customers: [{ id: 'c1', name: 'Daniel', phone: '11999999999' }],
    draft: { startsAt: '2026-10-11T09:00', barberId: 'p1', unitId: 'u1', customerId: 'c1', serviceId: 's1' },
    rotationEnabled: false,
  }));
  assert.match(html, /Quem será atendido/);
  assert.match(html, /Buscar cliente/);
  assert.match(html, /Serviços do atendimento/);
  assert.match(html, /Confirmar agendamento/);
  assert.doesNotMatch(html, /item para recompra/i);
});


test('atalho de retorno aparece na ficha quando cliente e serviço são conhecidos', () => {
  const html = markup({
    initialAppointmentId: 'a1',
    appointments: [{ ...sample, serviceId: 's1' }],
  });
  assert.match(html, /Agendar retorno/);
  assert.match(html, /Opções/); // Seções adicionais ficam recolhidas por padrão.
});

test('retorno não é oferecido para agendamento avulso sem cadastro', () => {
  const html = markup({
    initialAppointmentId: 'a1',
    appointments: [{ ...sample, serviceId: 's1', customerId: null }],
  });
  assert.doesNotMatch(html, /Agendar retorno/);
});


test('serviços repetidos e sem limite de quantidade ficam no agendamento e somam duração', async () => {
  const env = environment({ prisma: { service: {
    findFirst: async () => ({ id: 's1', name: 'Corte', durationMinutes: 15, price: 40 }),
    findMany: async q => { assert.deepEqual(q.where.id.in, ['s2']); return [{ id: 's2', name: 'Barba', durationMinutes: 10, price: 30 }]; },
  } } });
  const data = form({ ...context, unitId: 'u1', serviceId: 's1', customerId: 'c1', barberId: 'p1', startsAt: '2026-10-11T09:00' });
  for (let i = 0; i < 12; i++) data.append('serviceIds', i % 2 ? 's2' : 's1');
  const result = await redirectOf(env.actions.createAppointment, data);
  assert.equal(result.searchParams.get('ok'), 'agenda');
  const created = env.saved.find(q => q.data?.startsAt);
  assert.equal(created.data.endsAt - created.data.startsAt, 165 * 60000);
  const settings = env.saved.find(q => q.data?.enabledFeatures).data.enabledFeatures;
  const booked = workspace.readWorkspace(settings).bookedServices[0].services;
  assert.equal(booked.length, 13);
  assert.deepEqual(booked.map(item => item.id).slice(0, 5), ['s1', 's1', 's2', 's1', 's2']);
});
