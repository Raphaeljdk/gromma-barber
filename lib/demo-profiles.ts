import { PLAN_CONFIG, PLAN_FEATURES, PlanKey } from "@/lib/plans";

export type DemoPlanKey = Lowercase<PlanKey>;

export const DEMO_PROFILES = {
  essential: {
    key: "ESSENTIAL" as const,
    slug: "essential",
    label: "Perfil fictício · Essencial",
    business: "Barbearia Central Prime",
    owner: "Lucas Almeida",
    tenantCode: "GROMMA-DEMO-ESS",
    city: "São Paulo / SP",
    units: 1,
    barbers: 4,
    clients: 386,
    revenueMonth: 24680,
    recurringRevenue: 6890,
    appointmentsToday: 18,
    subscriptions: 47,
    description: "Operação fictícia de uma barbearia independente usando o plano Essencial com gestão, barbeiros, agenda, estoque, financeiro e automações.",
    metrics: [
      { label: "Faturamento no mês", value: "R$ 24.680", hint: "+12% vs. mês anterior" },
      { label: "Agendamentos hoje", value: "18", hint: "14 confirmados" },
      { label: "Assinaturas ativas", value: "47", hint: "R$ 6.890 recorrentes" },
      { label: "Clientes cadastrados", value: "386", hint: "12 follow-ups pendentes" },
    ],
    unitDetails: [
      { name: "Unidade Centro", status: "Ativa", revenue: "R$ 24.680", team: 4, occupancy: "74%" },
    ],
    appointments: [
      { time: "09:00", client: "Henrique Souza", barber: "Caio", service: "Corte + barba", status: "Confirmado" },
      { time: "10:30", client: "Rafael Lima", barber: "Bruno", service: "Corte degradê", status: "Em atendimento" },
      { time: "11:15", client: "Matheus Rocha", barber: "Diego", service: "Barba", status: "Confirmado" },
      { time: "13:00", client: "João Pedro", barber: "Caio", service: "Corte", status: "Aguardando" },
    ],
    customers: [
      { name: "Henrique Souza", phone: "(11) 9 8801-0044", lastVisit: "Hoje", plan: "Mensal", status: "Ativo" },
      { name: "Rafael Lima", phone: "(11) 9 7741-1220", lastVisit: "Hoje", plan: "Avulso", status: "Ativo" },
      { name: "Matheus Rocha", phone: "(11) 9 9910-2234", lastVisit: "12/09", plan: "Mensal", status: "Ativo" },
      { name: "João Pedro", phone: "(11) 9 6120-4418", lastVisit: "28/08", plan: "Avulso", status: "Follow-up" },
    ],
    commands: [
      { code: "#1048", client: "Rafael Lima", total: "R$ 55,00", items: "Corte degradê", status: "Aberta" },
      { code: "#1047", client: "Henrique Souza", total: "R$ 85,00", items: "Corte + barba", status: "Pago" },
      { code: "#1046", client: "Carlos Nunes", total: "R$ 124,90", items: "Corte + pomada", status: "Pago" },
    ],
    inventory: [
      { sku: "ESS-POM-001", name: "Pomada Modeladora", stock: 7, min: 5, status: "Normal" },
      { sku: "ESS-SHA-001", name: "Shampoo Profissional", stock: 3, min: 4, status: "Repor" },
      { sku: "ESS-LAM-001", name: "Lâmina", stock: 18, min: 20, status: "Repor" },
      { sku: "ESS-TAL-001", name: "Talco", stock: 9, min: 4, status: "Normal" },
    ],
    finance: [
      { date: "29/09", description: "Serviços e produtos", type: "Receita", amount: "R$ 1.420,00", status: "Recebido" },
      { date: "30/09", description: "Assinaturas mensais", type: "Receita", amount: "R$ 2.180,00", status: "Previsto" },
      { date: "02/10", description: "Fornecedor cosméticos", type: "Despesa", amount: "R$ 680,00", status: "Pendente" },
      { date: "05/10", description: "Aluguel", type: "Despesa", amount: "R$ 3.200,00", status: "Pendente" },
    ],
    team: [
      { name: "Caio", revenue: "R$ 7.840", goal: 86, services: 94 },
      { name: "Bruno", revenue: "R$ 6.210", goal: 74, services: 81 },
      { name: "Diego", revenue: "R$ 5.990", goal: 71, services: 76 },
      { name: "André", revenue: "R$ 4.640", goal: 63, services: 61 },
    ],
    automations: [
      "8 confirmações de agenda enviadas pelo WhatsApp",
      "5 clientes em follow-up de 30 dias",
      "3 aniversariantes receberam mensagem automática",
      "2 cobranças de assinatura aguardando retorno",
    ],
    alerts: ["3 itens de estoque abaixo do mínimo", "12 clientes aptos para follow-up", "Meta mensal da equipe em 74%"],
    features: PLAN_FEATURES.ESSENTIAL,
    plan: PLAN_CONFIG.ESSENTIAL,
  },
  pro: {
    key: "PRO" as const,
    slug: "pro",
    label: "Perfil fictício · Pro",
    business: "Maison 13 Barber Club",
    owner: "Gabriel Martins",
    tenantCode: "GROMMA-DEMO-PRO",
    city: "Campinas / SP",
    units: 3,
    barbers: 11,
    clients: 1248,
    revenueMonth: 79420,
    recurringRevenue: 23900,
    appointmentsToday: 54,
    subscriptions: 163,
    description: "Operação fictícia multiunidade usando o plano Pro com marca própria, totem, check-in/out, comandas, estoque e financeiro consolidados.",
    metrics: [
      { label: "Faturamento no mês", value: "R$ 79.420", hint: "+18% vs. mês anterior" },
      { label: "Agendamentos hoje", value: "54", hint: "22 check-ins no totem" },
      { label: "Assinaturas ativas", value: "163", hint: "R$ 23.900 recorrentes" },
      { label: "Unidades", value: "3", hint: "11 barbeiros ativos" },
    ],
    unitDetails: [
      { name: "Campinas Centro", status: "Ativa", revenue: "R$ 32.400", team: 5, occupancy: "91%" },
      { name: "Cambuí", status: "Ativa", revenue: "R$ 28.760", team: 4, occupancy: "87%" },
      { name: "Campinas Norte", status: "Ativa", revenue: "R$ 18.260", team: 2, occupancy: "76%" },
    ],
    appointments: [
      { time: "09:00", client: "Victor Moraes", barber: "Enzo", service: "Corte premium", status: "Check-in realizado" },
      { time: "09:40", client: "Gustavo Reis", barber: "Miguel", service: "Corte + barba", status: "Em atendimento" },
      { time: "10:20", client: "Felipe Costa", barber: "Arthur", service: "Plano mensal", status: "Comanda aberta" },
      { time: "11:00", client: "Eduardo Alves", barber: "Enzo", service: "Corte + produto", status: "Checkout no totem" },
    ],
    customers: [
      { name: "Victor Moraes", phone: "(19) 9 8810-3312", lastVisit: "Hoje", plan: "Club Black", status: "Ativo" },
      { name: "Gustavo Reis", phone: "(19) 9 7902-0421", lastVisit: "Hoje", plan: "Avulso", status: "Ativo" },
      { name: "Felipe Costa", phone: "(19) 9 6122-7530", lastVisit: "Hoje", plan: "Club Gold", status: "Ativo" },
      { name: "Eduardo Alves", phone: "(19) 9 9050-2287", lastVisit: "18/09", plan: "Club Black", status: "Ativo" },
    ],
    commands: [
      { code: "#M13-882", client: "Felipe Costa", total: "R$ 120,00", items: "Plano + produto", status: "Aberta" },
      { code: "#M13-881", client: "Eduardo Alves", total: "R$ 134,90", items: "Corte + produto", status: "Checkout" },
      { code: "#M13-880", client: "Victor Moraes", total: "R$ 75,00", items: "Corte premium", status: "Pago" },
    ],
    inventory: [
      { sku: "PRO-POM-001", name: "Pomada Maison", stock: 29, min: 10, status: "Normal" },
      { sku: "PRO-OLE-001", name: "Óleo para Barba", stock: 14, min: 8, status: "Normal" },
      { sku: "PRO-SHA-001", name: "Shampoo Maison", stock: 7, min: 10, status: "Transferir" },
      { sku: "PRO-LAM-001", name: "Lâmina Premium", stock: 42, min: 30, status: "Normal" },
    ],
    finance: [
      { date: "29/09", description: "Consolidado 3 unidades", type: "Receita", amount: "R$ 4.860,00", status: "Recebido" },
      { date: "30/09", description: "Assinaturas Club", type: "Receita", amount: "R$ 8.920,00", status: "Previsto" },
      { date: "03/10", description: "Reposição de estoque", type: "Despesa", amount: "R$ 2.480,00", status: "Pendente" },
      { date: "05/10", description: "Custos operacionais", type: "Despesa", amount: "R$ 9.600,00", status: "Pendente" },
    ],
    team: [
      { name: "Enzo", revenue: "R$ 12.480", goal: 94, services: 128 },
      { name: "Miguel", revenue: "R$ 11.760", goal: 91, services: 119 },
      { name: "Arthur", revenue: "R$ 10.980", goal: 87, services: 112 },
      { name: "Theo", revenue: "R$ 9.740", goal: 82, services: 104 },
    ],
    automations: [
      "22 check-ins realizados em totens hoje",
      "9 comandas abertas sincronizadas com tablets",
      "6 checkouts fecharam comandas automaticamente",
      "17 mensagens automáticas de agenda e relacionamento",
    ],
    alerts: ["2 unidades acima de 90% da meta semanal", "9 comandas em atendimento", "4 solicitações de reposição entre unidades"],
    features: PLAN_FEATURES.PRO,
    plan: PLAN_CONFIG.PRO,
  },
} as const;

export function getDemoProfile(slug: string) {
  if (slug === "essential") return DEMO_PROFILES.essential;
  if (slug === "pro") return DEMO_PROFILES.pro;
  return null;
}
