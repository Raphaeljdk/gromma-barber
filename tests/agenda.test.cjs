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
    adminAuditLog: { create: async (query) => { saved.push({ audit: query.data }); return { id: 'audit1' }; } },
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
    '@/app/erp/[tenant]/checkout-actions': { addCommandItem() {}, removeCommandItem() {} },
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
  assert.match(html, /aria-expanded="false" aria-label="Mostrar unidades e informações"/);
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


test('indicadores de dashboard aparecem acima da barra de ferramentas da agenda', () => {
  const html = markup();
  const side = html.indexOf('id="agenda-information-panel"');
  const metrics = html.indexOf('Indicadores do dia');
  const calendar = html.indexOf('class="agenda-main-calendar"');
  const toolbar = html.indexOf('class="agenda-toolbar"');
  assert.ok(side > calendar);
  assert.ok(metrics > 0 && metrics < toolbar && toolbar < calendar);
  assert.match(html, /Agendados/);
  assert.doesNotMatch(html, /Item para recompra/);
});

test('ficha exibe produtos comprados anteriormente, sem campo de recompra', () => {
  const html = markup({ initialAppointmentId: 'a1', appointments: [{
    ...sample, recentProducts: [{ description: 'Pomada modeladora', quantity: 2, date: at('10:00') }],
  }] });
  assert.match(html, /aria-controls="agenda-detail-settings"/);
  assert.match(html, /Opções/);
  assert.match(html, /Pomada modeladora/); // Histórico fica visível na comanda, como na gravação.
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
  assert.match(html, /Cliente e horário/);
  assert.match(html, /Buscar cliente/);
  assert.match(html, /Serviços do atendimento/);
  assert.match(html, /Confirmar agendamento/);
  assert.doesNotMatch(html, /item para recompra/i);
});


test('retorno foi removido da ficha mesmo quando cliente e serviço são conhecidos', () => {
  const html = markup({
    initialAppointmentId: 'a1',
    appointments: [{ ...sample, serviceId: 's1' }],
  });
  assert.doesNotMatch(html, /Agendar retorno/);
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


test('vídeo 14/10: cliente é escolhido na busca, sem segundo dropdown avulso', () => {
  const { AgendaAppointmentForm } = load('components/agenda-forms.tsx', {
    '@/app/erp/[tenant]/actions': { createAppointment() {} },
    '@/app/erp/[tenant]/module-actions': { addWaitlist() {} },
  });
  const props = {
    context, professionals: [{ id: 'p1', name: 'Profissional Um', unitId: 'u1' }],
    units: [{ id: 'u1', name: 'Matriz' }],
    services: [{ id: 's1', name: 'Corte', durationMinutes: 45, price: 50 }],
    customers: [{ id: 'c1', name: 'Bruno Ferreira', phone: '(11) 99999-9999' }],
    rotationEnabled: false,
  };
  const withCustomer = renderToStaticMarkup(React.createElement(AgendaAppointmentForm, {
    ...props, draft: { startsAt: '2026-10-14T09:30', barberId: 'p1', unitId: 'u1', customerId: 'c1', serviceId: 's1' },
  }));
  assert.match(withCustomer, /role="combobox"/);
  assert.match(withCustomer, /name="customerId" value="c1"/);
  assert.match(withCustomer, /Bruno Ferreira/);
  assert.match(withCustomer, /Cadastro vinculado/);
  assert.match(withCustomer, /Cadastrar cliente/);
  assert.doesNotMatch(withCustomer, /<select[^>]*name="customerId"/);
  const avulso = renderToStaticMarkup(React.createElement(AgendaAppointmentForm, {
    ...props, draft: { startsAt: '2026-10-14T09:30', barberId: 'p1', unitId: 'u1', customerId: '', serviceId: 's1' },
  }));
  assert.match(avulso, /Selecione ou cadastre um cliente/);
  assert.match(avulso, /name="customerId" value=""/);
});

test('vídeo 14/10: múltiplos serviços aparecem em contador em vez de chips duplicados', () => {
  const { AgendaAppointmentForm } = load('components/agenda-forms.tsx', {
    '@/app/erp/[tenant]/actions': { createAppointment() {} },
    '@/app/erp/[tenant]/module-actions': { addWaitlist() {} },
  });
  const html = renderToStaticMarkup(React.createElement(AgendaAppointmentForm, {
    context, professionals: [], units: [{ id: 'u1', name: 'Matriz' }],
    services: [
      { id: 's1', name: 'Corte', durationMinutes: 30, price: 50 },
      { id: 's2', name: 'Barba', durationMinutes: 20, price: 30 },
    ],
    customers: [], draft: { startsAt: '2026-10-14T09:30', unitId: 'u1', customerId: '', serviceId: 's1' },
    rotationEnabled: false,
  }));
  assert.match(html, /Selecione para adicionar automaticamente/);
  assert.match(html, /Serviços inseridos/);
  assert.match(html, /30 minutos/);
  assert.match(html, /50,00/);
});

test('opções da ficha reúnem cancelamento, falta, WhatsApp e No local', () => {
  const html = markup({ initialAppointmentId: 'a1', appointments: [{ ...sample, customerPhone: '(11) 99999-4321' }] });
  // O menu é interativo e começa fechado na renderização SSR.
  assert.match(html, /aria-controls="agenda-detail-settings"/);
  assert.doesNotMatch(html, /Personalizar ficha/);
  const code = require('node:fs').readFileSync(require('node:path').resolve('components/erp-agenda-board.tsx'), 'utf8');
  for (const label of ['Cancelar e retirar da agenda', 'Cliente faltou', 'Enviar confirmação pelo WhatsApp', 'Cliente no local']) assert.match(code, new RegExp(label));
});
test('confirmação WhatsApp inclui data, serviço e horário sem envio automático', () => {
  const { whatsappAppointmentConfirmation } = load('lib/checkout.ts');
  const url = whatsappAppointmentConfirmation('(11) 99999-4321', 'João', 'Corte', at('10:30'));
  assert.ok(url);
  const result = new URL(url);
  assert.equal(result.hostname, 'wa.me');
  assert.match(result.searchParams.get('text'), /João/);
  assert.match(result.searchParams.get('text'), /10:30/);
  assert.match(result.searchParams.get('text'), /Corte/);
  assert.equal(whatsappAppointmentConfirmation('123', 'João', 'Corte', at('10:30')), null);
});

test('comanda traz três últimas visitas e dois comandos lado a lado', () => {
  const html = markup({ initialAppointmentId: 'a1', appointments: [{
    ...sample,
    lastThreeAppointments: [
      { id: 'h1', date: at('08:00'), service: 'Corte + Barba', professional: 'Marcos', status: 'COMPLETED' },
      { id: 'h2', date: at('09:00'), service: 'Selagem', professional: 'João', status: 'COMPLETED' },
      { id: 'h3', date: at('10:00'), service: 'Corte', professional: 'Marcos', status: 'COMPLETED' },
    ],
    recentProducts: [{ description: 'Energético', quantity: 1, date: at('09:00'), professional: 'João' }],
    command: { id: 'command1', status: 'OPEN', total: 140, items: [
      { id: 'i1', quantity: 1, description: 'Corte', total: 80 },
      { id: 'i2', quantity: 1, description: 'Barba', total: 60 },
    ] },
  }] });
  for (const label of ['Agendamentos realizados', 'Corte + Barba', 'Selagem', 'Energético', 'Salvar agendamento', 'Fechar comanda', 'Inserir serviço', 'Adicionar produtos e abrir checkout', 'Excluir']) {
    assert.ok(html.includes(label), `Esperado: ${label}`);
  }
  assert.match(html, /agenda-save-a1/);
});

test('vídeo 3: inclusão de serviços usa apenas seletor e botão Inserir', () => {
  const { AgendaAppointmentForm } = load('components/agenda-forms.tsx', {
    '@/app/erp/[tenant]/actions': { createAppointment() {} },
    '@/app/erp/[tenant]/module-actions': { addWaitlist() {} },
  });
  const html = renderToStaticMarkup(React.createElement(AgendaAppointmentForm, {
    context, professionals: [], units: [{id:'u1',name:'Matriz'}],
    services: [{id:'s1',name:'Corte',price:50,durationMinutes:30}],
    customers: [], draft: { startsAt:'2026-10-14T10:00',barberId:'',unitId:'u1',serviceId:'s1' }, rotationEnabled: false,
  }));
  assert.match(html,/Selecione para adicionar automaticamente/);
  assert.match(html,/Serviços inseridos/);
  assert.doesNotMatch(html,/agenda-booking-service-choice/);
  assert.doesNotMatch(html,/Inserir serviço na lista/);
  assert.equal((html.match(/name="serviceId"/g)||[]).length,1);
  assert.match(html,/Unidade, horário e profissional/);
  assert.doesNotMatch(html,/Quando e com quem\?/);
});

test('No local inicia atendimento e cria comanda só uma vez, sem cobrar', async () => {
  const records = [];
  const appointment = { id: 'a1', barberShopId: 'shop1', unitId: 'u1', customerId: 'c1', serviceId: 's1', status: 'CONFIRMED',
    service: { id: 's1', name: 'Corte', price: 55 }, command: null };
  const env = environment({ prisma: {
    appointment: {
      findFirst: async () => appointment,
      updateMany: async query => { records.push({ type: 'status', query }); return { count: 1 }; },
    },
    serviceCommand: {
      findUnique: async () => null,
      create: async query => { records.push({ type: 'command', query }); return { id: 'cmd1' }; },
    },
    commandItem: {
      create: async query => { records.push({ type: 'item', query }); return { id: 'line1' }; },
    },
  } });
  const url = await redirectOf(env.actions.updateAppointmentStatus,
    form({ ...context, appointmentId: 'a1', action: 'arrive' }));
  assert.equal(url.searchParams.get('erro'), null);
  assert.equal(records.find(item => item.type === 'status').query.data.status, 'IN_SERVICE');
  assert.equal(records.filter(item => item.type === 'command').length, 1);
  assert.equal(records.find(item => item.type === 'command').query.data.status, 'OPEN');
  assert.equal(records.filter(item => item.type === 'item').length, 1);
  assert.equal(records.find(item => item.type === 'item').query.data.description, 'Corte');
  assert.ok(!records.some(item => item.type === 'payment'));
});
test('No local não pode recriar comanda quando atendimento já começou', async () => {
  const env = environment({ prisma: { appointment: { findFirst: async () => ({
    id: 'a1', barberShopId: 'shop1', status: 'IN_SERVICE', command: { status: 'OPEN' },
  }) } } });
  const result = await redirectOf(env.actions.updateAppointmentStatus,
    form({ ...context, appointmentId: 'a1', action: 'arrive' }));
  assert.equal(result.searchParams.get('erro'), 'agenda-status');
});


test('reunião: nenhum botão separado para iniciar atendimento na ficha', () => {
  const current = markup({
    initialAppointmentId: 'a1',
    appointments: [{ ...sample, status: 'CONFIRMED', command: null }],
  });
  assert.match(current, /Fechar comanda/);
  assert.doesNotMatch(current, /No local · iniciar serviço/);
  assert.doesNotMatch(current, /Iniciar atendimento/);
  assert.doesNotMatch(current, /name="action" value="start"/);
  const historical = markup({
    initialAppointmentId: 'a1',
    appointments: [{ ...sample, status: 'CHECKED_IN', command: null }],
  });
  assert.match(historical, /Fechar comanda/);
  assert.doesNotMatch(historical, /No local · abrir comanda/);
  assert.doesNotMatch(historical, /Iniciar atendimento/);
  assert.doesNotMatch(historical, /name="action" value="start"/);
});

test('check-in antigo abre comanda pela mesma ação No local, sem registrar pagamento', async () => {
  const actionsRecorded = [];
  const historical = { id: 'a1', barberShopId: 'shop1', unitId: 'u1', customerId: 'c1', serviceId: 's1',
    status: 'CHECKED_IN', service: { id: 's1', name: 'Corte', price: 55 }, command: null };
  const env = environment({ prisma: {
    appointment: {
      findFirst: async () => historical,
      updateMany: async query => { actionsRecorded.push({ kind: 'status', query }); return { count: 1 }; },
    },
    serviceCommand: {
      findUnique: async () => null,
      create: async query => { actionsRecorded.push({ kind: 'command', query }); return { id: 'command1' }; },
    },
    commandItem: {
      create: async query => { actionsRecorded.push({ kind: 'item', query }); return { id: 'line1' }; },
    },
  } });
  const destination = await redirectOf(env.actions.updateAppointmentStatus,
    form({ ...context, appointmentId: 'a1', action: 'arrive' }));
  assert.equal(destination.searchParams.get('erro'), null);
  assert.equal(actionsRecorded.find(record => record.kind === 'status').query.data.status, 'IN_SERVICE');
  assert.equal(actionsRecorded.filter(record => record.kind === 'command').length, 1);
  assert.equal(actionsRecorded.filter(record => record.kind === 'item').length, 1);
  assert.equal(actionsRecorded.filter(record => record.kind === 'payment').length, 0);
});


test('agendamento cancelado desaparece das visões Dia, Semana e Mês', () => {
  for (const view of ['day', 'week', 'month']) {
    const html = markup({ view, appointments: [{ ...sample, status: 'CANCELED' }] });
    assert.doesNotMatch(html, /Abrir agendamento de Cliente Exemplo/);
    assert.doesNotMatch(html, /agenda-appointment canceled/);
    assert.doesNotMatch(html, /agenda-week-item canceled/);
    assert.doesNotMatch(html, /agenda-month-item canceled/);
  }
});

test('cancelar preserva status e cria auditoria com acesso e solicitante separados', async () => {
  const appointment = { id: 'a1', barberShopId: 'shop1', unitId: 'u1', customerId: 'c1', serviceId: 's1',
    startsAt: new Date(at('10:00')), status: 'SCHEDULED', command: null };
  const env = environment({
    viewer: { type: 'TENANT', role: 'RECEPTIONIST', userId: 'recep1', email: 'recepcao@gromma.test', barberShopId: 'shop1' },
    prisma: { appointment: { findFirst: async () => appointment,
      updateMany: async q => { env.saved.push(q); return { count: 1 }; } } },
  });
  const destination = await redirectOf(env.actions.updateAppointmentStatus, form({
    ...context, appointmentId: 'a1', action: 'cancel', cancelRequestedBy: 'CLIENTE',
  }));
  assert.equal(destination.searchParams.get('ok'), 'agenda-status');
  assert.equal(env.saved.find(q => q.data?.status).data.status, 'CANCELED');
  const audit = env.saved.find(q => q.audit)?.audit;
  assert.equal(audit.action, 'APPOINTMENT_CANCELED');
  assert.equal(audit.barberShopId, 'shop1');
  assert.equal(audit.adminEmail, 'recepcao@gromma.test');
  assert.equal(audit.details.actorUserId, 'recep1');
  assert.equal(audit.details.requestedBy, null); // Solicitante não é presumido a partir da sessão.
  assert.equal(audit.details.performedVia, 'ACESSO_BARBEARIA');
});

test('cadastro rápido seleciona o novo cliente sem exigir atendimento avulso', async () => {
  const env = environment({ prisma: { customer: {
    findFirst: async () => null,
    create: async query => ({ id: 'c-new', name: query.data.name, phone: query.data.phone }),
  } } });
  const result = await env.actions.registerAgendaCustomer({ tenantCode: 'GROMMA', name: 'Ana Maria', phone: '(11) 99999-9999', unitId: 'u1' });
  assert.equal(result.ok, true);
  assert.equal(result.customer.name, 'Ana Maria');
  assert.equal(result.customer.phone, '(11) 99999-9999');
  const invalid = await env.actions.registerAgendaCustomer({ tenantCode: 'GROMMA', name: 'A', phone: '123' });
  assert.equal(invalid.ok, false);
});

test('agendamento novo mostra Fechar comanda sem exigir chegada', () => {
  const html = markup({ initialAppointmentId: 'a1', appointments: [{ ...sample, status: 'SCHEDULED', command: null }] });
  assert.match(html, /Fechar comanda/);
  assert.doesNotMatch(html, /No local · iniciar serviço/);
  assert.match(html, /name="appointmentId" value="a1"/);
});

test('controle de informações ao lado das visões e fora da barra de ações', () => {
  const html = markup({ view: 'day' });
  const top = html.indexOf('class="agenda-top-actions"');
  const toolbar = html.indexOf('class="agenda-toolbar"');
  const viewSwitch = html.indexOf('class="agenda-view-switch"');
  const icon = html.indexOf('class="agenda-information-toggle"');
  assert.ok(top >= 0 && toolbar > top && viewSwitch > toolbar && icon > viewSwitch);
  assert.doesNotMatch(html.slice(top, toolbar), /agenda-panel-toggle/);
  assert.match(html, /aria-controls="agenda-information-panel" aria-expanded="false"/);
});

test('rodapé segue ordem Opções, Fechar comanda, Salvar agendamento', () => {
  const code = fs.readFileSync(path.resolve(root, 'components/erp-agenda-board.tsx'), 'utf8');
  const start = code.indexOf('<div className="agenda-command-bottom-actions">');
  const footer = code.slice(start, code.indexOf('</AgendaDialog>', start));
  const options = footer.indexOf('className="agenda-bottom-options"');
  const checkout = footer.indexOf('Fechar comanda →');
  const save = footer.indexOf('Salvar agendamento');
  assert.ok(start >= 0 && options >= 0 && checkout > options && save > checkout);
  const cancel = footer.indexOf('Cancelar e retirar da agenda');
  const missed = footer.indexOf('Cliente faltou');
  const whatsapp = footer.indexOf('Enviar confirmação pelo WhatsApp');
  const onsite = footer.indexOf('Cliente no local');
  assert.ok(cancel > options && missed > cancel && whatsapp > missed && onsite > whatsapp);
  assert.match(footer, /name="action" value="checkin"/);
  const actions = fs.readFileSync(path.resolve(root, 'app/erp/[tenant]/actions.ts'), 'utf8');
  assert.match(actions, /checkin:\s*\{ from: \["SCHEDULED", "CONFIRMED"\], to: "CHECKED_IN" \}/);
});


test('vídeo novo: Cadastrar cliente aparece ao lado da busca, não numa segunda linha', () => {
  const code = fs.readFileSync(path.resolve(root, 'components/agenda-forms.tsx'), 'utf8');
  const begin = code.indexOf('className="agenda-customer-search-heading"');
  const end = code.indexOf('className="agenda-customer-searchbox"', begin);
  const titleAndButton = code.slice(begin, end);
  assert.ok(begin >= 0 && end > begin);
  assert.match(titleAndButton, /Buscar cliente cadastrado/);
  assert.match(titleAndButton, /\+ Cadastrar cliente/);
  assert.equal((code.match(/>\+ Cadastrar cliente<\/button>/g) || []).length, 1);
  assert.doesNotMatch(code, /Selecione um cliente ou cadastre um novo\./);
  for (const field of ['Data de nascimento (opcional)', 'E-mail (opcional)', 'Como conheceu a barbearia? (opcional)']) {
    assert.ok(code.includes(field), 'Campo não pode desaparecer: ' + field);
  }
});


test('ERP móvel mantém acesso à agenda, painel, formulário e checkout sem depender de hover', () => {
  const css = fs.readFileSync(path.resolve(root, 'app/globals.css'), 'utf8');
  const agenda = fs.readFileSync(path.resolve(root, 'components/erp-agenda-board.tsx'), 'utf8');
  const sidebar = fs.readFileSync(path.resolve(root, 'components/erp-sidebar.tsx'), 'utf8');
  for (const expected of [
    '.agenda-mobile-swipe-hint', '.agenda-calendar-shell',
    '.agenda-lane-grid', '.agenda-dialog', '.agenda-dialog-head',
    '.agenda-customer-registration', '.checkout-payment-column',
    '.checkout-payment-shortcuts', '.erp-mobile-trigger',
    '.erp-sidebar.is-mobile-open'
  ]) assert.ok(css.includes(expected), 'Falta estilo móvel: ' + expected);
  assert.match(agenda, /Deslize para os lados para ver outros profissionais/);
  assert.match(agenda, /columns.length > 1/);
  assert.match(sidebar, /aria-expanded=\{mobileOpen\}/);
  assert.match(sidebar, /aria-controls="erp-mobile-navigation"/);
  assert.ok(css.includes('env(safe-area-inset-bottom'), 'Respeitar área segura de iPhone');
  assert.ok(css.includes('font-size:16px !important'), 'Evitar zoom ao focar campos no iPhone');
  assert.ok(css.includes('overscroll-behavior:contain'), 'Permitir rolagem interna sem rolar toda a página');
});


test('menu Opções usa top layer e não é cortado pelo scroll do modal', () => {
  const html = markup({ initialAppointmentId: 'a1' });
  assert.match(html, /id="agenda-detail-settings" popover="auto"/);
  assert.match(html, /aria-controls="agenda-detail-settings"/);
  const css = fs.readFileSync(path.resolve(root, 'app/globals.css'), 'utf8');
  assert.match(css, /#agenda-detail-settings\[popover\]\s*\{[^}]*position:fixed/);
  assert.match(css, /#agenda-detail-settings\[popover\]:not\(:popover-open\)/);
  assert.match(css, /--agenda-options-height/);
  const code = fs.readFileSync(path.resolve(root, 'components/erp-agenda-board.tsx'), 'utf8');
  assert.match(code, /menu\.showPopover\(\)/);
  assert.match(code, /menu\.hidePopover\(\)/);
  assert.match(code, /rect\.top/);
  assert.match(code, /rect\.bottom/);
  assert.match(code, /addEventListener\("scroll", reposition, true\)/);
  for (const label of ['Cancelar e retirar da agenda', 'Cliente faltou', 'Enviar confirmação pelo WhatsApp', 'Cliente no local']) {
    assert.ok(code.includes(label), 'Opção preservada: ' + label);
  }
});


test('menu Opções mostra Cancelar e Cliente faltou mesmo após abertura de comanda sem pagamento', () => {
  const command = { id: 'cmd1', status: 'OPEN', total: 50, items: [] };
  const html = markup({ initialAppointmentId: 'a1', appointments: [{ ...sample, status: 'CONFIRMED', command }] });
  assert.match(html, /Cancelar e retirar da agenda/);
  assert.match(html, /Cliente faltou/);
  assert.match(html, /Enviar confirmação pelo WhatsApp|WhatsApp indisponível/);
  assert.match(html, /Cliente no local/);
  assert.match(html, /Fechar comanda/);
  const canceled = markup({ initialAppointmentId: 'a1', appointments: [{ ...sample, status: 'CONFIRMED', command: { ...command, status: 'CLOSED' } }] });
  assert.doesNotMatch(canceled, /Cancelar e retirar da agenda/);
  assert.doesNotMatch(canceled, /Cliente faltou/);
});

test('cancelamento e ausência encerram comanda não paga e preservam a auditoria', async () => {
  for (const [action, toStatus] of [['cancel', 'CANCELED'], ['no_show', 'NO_SHOW']]) {
    const updates = [];
    const appt = { id:'a1', barberShopId:'shop1', unitId:'u1', customerId:'c1',
      startsAt:new Date(at('10:00')), status:'SCHEDULED', command:{id:'cmd1', status:'OPEN'} };
    const env = environment({ prisma: {
      appointment: { findFirst: async () => appt,
        updateMany: async q => { updates.push({ model:'appointment', query:q }); return { count:1 }; } },
      serviceCommand: { updateMany: async q => { updates.push({ model:'command', query:q }); return { count:1 }; } },
    } });
    const destination = await redirectOf(env.actions.updateAppointmentStatus,
      form({ ...context, appointmentId:'a1', action }));
    assert.equal(destination.searchParams.get('ok'), 'agenda-status');
    assert.equal(updates.find(e => e.model === 'appointment').query.data.status, toStatus);
    assert.deepEqual(updates.find(e => e.model === 'command').query.where,
      { id:'cmd1', barberShopId:'shop1', status:'OPEN' });
    assert.equal(updates.find(e => e.model === 'command').query.data.status, 'CANCELED');
    const audit = env.saved.find(x => x.audit)?.audit;
    assert.equal(audit.details.canceledOpenCommandId,'cmd1');
    assert.equal(audit.details.newStatus,toStatus);
    assert.equal(updates.some(e => e.model === 'payment'), false);
  }
});

test('comanda paga ou encerrada bloqueia cancelamento sem afetar dinheiro e estoque', async () => {
  for (const status of ['CLOSED','CANCELED']) {
    let updated = false;
    const env = environment({ prisma: {
      appointment: { findFirst: async () => ({id:'a1',barberShopId:'shop1',status:'SCHEDULED',command:{id:'cmd1',status}}),
        updateMany: async () => { updated = true; return {count:1}; } },
    } });
    const url = await redirectOf(env.actions.updateAppointmentStatus, form({...context,appointmentId:'a1',action:'cancel'}));
    assert.equal(url.searchParams.get('erro'),'agenda-status');
    assert.equal(updated,false);
  }
});
