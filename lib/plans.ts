export type PlanKey = "ESSENTIAL" | "PRO";

export const MANAGEMENT_FEATURES = [
  "Sistema de gestão",
  "Consulta de dados da equipe via IA",
  "Área da contabilidade com dados autorizados pelo gestor",
  "Portal de chamados para jurídico, contábil e marketing",
  "Solicitação de reposição de estoque",
  "Contas de recebimentos de assinaturas por filial",
  "Metas da equipe projetadas no app do barbeiro",
] as const;

export const BARBER_FEATURES = [
  "Sistema do barbeiro",
  "Assistente IA para faturamento, metas e melhorias",
  "Recebimento de metas do gestor",
  "Prontuário do cliente com foto do corte",
  "Histórico de produtos, itens e serviços",
  "Comparativo de faturamento realizado e projetado",
  "Performance de atendimentos por assinatura",
] as const;

export const AUTOMATION_FEATURES = [
  "Automação no WhatsApp",
  "Recepção automática",
  "Agendamento automático",
  "Respostas a dúvidas frequentes",
  "Follow-up de clientes inativos em 30, 60 ou 90 dias",
  "Envio de promoções",
  "Mensagem para aniversariantes",
  "Cobrança de assinaturas atrasadas",
  "Venda de planos e serviços",
  "Fila de espera quando não houver disponibilidade",
  "Agente de informações IA",
  "Emissão de NF",
] as const;

export const PRO_FEATURES = [
  "Personalização com a marca da barbearia",
  "Totem de agendamento",
  "Check-in no totem",
  "Checkout no totem",
  "Fechamento automático de comandas após checkout",
  "Operação por tablets nas bancadas",
  "Lançamento de produtos, serviços e consumo na comanda",
] as const;

const ESSENTIAL_FEATURES = [
  ...MANAGEMENT_FEATURES,
  ...BARBER_FEATURES,
  ...AUTOMATION_FEATURES,
] as const;

const PRO_ALL_FEATURES = [
  ...ESSENTIAL_FEATURES,
  ...PRO_FEATURES,
] as const;

export const PLAN_FEATURES = {
  ESSENTIAL: ESSENTIAL_FEATURES,
  PRO: PRO_ALL_FEATURES,
} as const;

export const PLAN_CONFIG = {
  ESSENTIAL: {
    key: "ESSENTIAL" as const,
    name: "Essencial",
    subtitle: "Não personalizado",
    description: "Operação completa com gestão, sistema do barbeiro, automação, IA e emissão de NF.",
    setupLabel: "Aquisição",
    setupFee: 5000,
    monthlyFee: 319.9,
    additionalUnitPercent: 50,
    maxUnits: 2 as number | null,
    personalizedBrand: false,
    features: ESSENTIAL_FEATURES,
  },
  PRO: {
    key: "PRO" as const,
    name: "Pro",
    subtitle: "Personalizado para sua marca",
    description: "Tudo do Essencial com identidade da marca, totem, fluxo de check-in/checkout e operação sem limite de unidades.",
    setupLabel: "Implementação",
    setupFee: 30000,
    monthlyFee: 400,
    additionalUnitPercent: 50,
    maxUnits: null as number | null,
    personalizedBrand: true,
    features: PRO_ALL_FEATURES,
  },
} as const;

export const FEATURE_GROUPS = [
  {
    title: "Sistema de gestão",
    description: "Controle central para gestor, equipe, estoque, recebimentos e solicitações internas.",
    items: MANAGEMENT_FEATURES,
  },
  {
    title: "Sistema do barbeiro",
    description: "Rotina do profissional com metas, prontuário, performance e apoio de IA.",
    items: BARBER_FEATURES,
  },
  {
    title: "Recepção e automação",
    description: "Atendimento automático, agenda, relacionamento, vendas e regularização de clientes.",
    items: AUTOMATION_FEATURES,
  },
] as const;

export const PRO_OPERATION_GROUP = {
  title: "Operação Pro",
  description: "Experiência personalizada com totem, comandas e tablets nas bancadas.",
  items: PRO_FEATURES,
} as const;

export const EQUIPMENT_REFERENCE = {
  tablet: 600,
  tabletSupport: 50,
} as const;

export const EXTERNAL_INTEGRATIONS = [
  {
    name: "WhatsApp",
    description: "Necessita número conectado e provedor/API oficial para mensagens, agenda, follow-up e fila de espera.",
  },
  {
    name: "Agente IA",
    description: "Necessita provedor de IA, regras de acesso e base de conhecimento da barbearia.",
  },
  {
    name: "Emissão de NF",
    description: "Necessita integração com emissor fiscal compatível com o município/empresa.",
  },
] as const;

export function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function additionalUnitMonthly(plan: PlanKey) {
  const config = PLAN_CONFIG[plan];
  return config.monthlyFee * (config.additionalUnitPercent / 100);
}

export function monthlyForUnits(plan: PlanKey, units: number) {
  const config = PLAN_CONFIG[plan];
  const safeUnits = Math.max(1, Math.trunc(units));
  if (config.maxUnits && safeUnits > config.maxUnits) return null;
  return config.monthlyFee + Math.max(0, safeUnits - 1) * additionalUnitMonthly(plan);
}
