import { PLAN_CONFIG, PLAN_FEATURES, PlanKey } from "@/lib/plans";

export type DemoPlanKey = Lowercase<PlanKey>;

export const DEMO_PROFILES = {
  essential: {
    key: "ESSENTIAL" as const,
    slug: "essential",
    label: "Perfil fictício · Essencial",
    business: "Barbearia Central Prime",
    owner: "Lucas Almeida",
    city: "São Paulo / SP",
    units: 1,
    barbers: 4,
    clients: 386,
    revenueMonth: 24680,
    recurringRevenue: 6890,
    appointmentsToday: 18,
    subscriptions: 47,
    description:
      "Operação fictícia de uma barbearia independente usando o plano Essencial com gestão, sistema do barbeiro e automações.",
    metrics: [
      { label: "Faturamento no mês", value: "R$ 24.680", hint: "+12% vs. mês anterior" },
      { label: "Agendamentos hoje", value: "18", hint: "14 confirmados" },
      { label: "Assinaturas ativas", value: "47", hint: "R$ 6.890 recorrentes" },
      { label: "Clientes cadastrados", value: "386", hint: "12 follow-ups pendentes" },
    ],
    appointments: [
      { time: "09:00", client: "Henrique Souza", barber: "Caio", service: "Corte + barba", status: "Confirmado" },
      { time: "10:30", client: "Rafael Lima", barber: "Bruno", service: "Corte degradê", status: "Em atendimento" },
      { time: "11:15", client: "Matheus Rocha", barber: "Diego", service: "Barba", status: "Confirmado" },
      { time: "13:00", client: "João Pedro", barber: "Caio", service: "Corte", status: "Aguardando" },
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
    alerts: [
      "3 itens de estoque abaixo do mínimo",
      "12 clientes aptos para follow-up",
      "Meta mensal da equipe em 74%",
    ],
    features: PLAN_FEATURES.ESSENTIAL,
    plan: PLAN_CONFIG.ESSENTIAL,
  },
  pro: {
    key: "PRO" as const,
    slug: "pro",
    label: "Perfil fictício · Pro",
    business: "Maison 13 Barber Club",
    owner: "Gabriel Martins",
    city: "Campinas / SP",
    units: 3,
    barbers: 11,
    clients: 1248,
    revenueMonth: 79420,
    recurringRevenue: 23900,
    appointmentsToday: 54,
    subscriptions: 163,
    description:
      "Operação fictícia multiunidade usando o plano Pro com identidade própria, totem, check-in/out e comandas automáticas.",
    metrics: [
      { label: "Faturamento no mês", value: "R$ 79.420", hint: "+18% vs. mês anterior" },
      { label: "Agendamentos hoje", value: "54", hint: "22 check-ins no totem" },
      { label: "Assinaturas ativas", value: "163", hint: "R$ 23.900 recorrentes" },
      { label: "Unidades", value: "3", hint: "11 barbeiros ativos" },
    ],
    appointments: [
      { time: "09:00", client: "Victor Moraes", barber: "Enzo", service: "Corte premium", status: "Check-in realizado" },
      { time: "09:40", client: "Gustavo Reis", barber: "Miguel", service: "Corte + barba", status: "Em atendimento" },
      { time: "10:20", client: "Felipe Costa", barber: "Arthur", service: "Plano mensal", status: "Comanda aberta" },
      { time: "11:00", client: "Eduardo Alves", barber: "Enzo", service: "Corte + produto", status: "Checkout no totem" },
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
    alerts: [
      "2 unidades acima de 90% da meta semanal",
      "9 comandas em atendimento",
      "4 solicitações de reposição entre unidades",
    ],
    features: PLAN_FEATURES.PRO,
    plan: PLAN_CONFIG.PRO,
  },
} as const;

export function getDemoProfile(slug: string) {
  if (slug === "essential") return DEMO_PROFILES.essential;
  if (slug === "pro") return DEMO_PROFILES.pro;
  return null;
}
