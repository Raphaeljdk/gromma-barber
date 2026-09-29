export const PLAN_FEATURES = {
  ESSENTIAL: [
    "Clientes",
    "Serviços",
    "Agenda",
    "Check-in e comandas",
    "Recebimentos",
  ],
  PRO: [
    "Clientes",
    "Serviços",
    "Agenda",
    "Check-in e comandas",
    "Recebimentos",
    "Financeiro",
    "Estoque",
    "Equipe e metas",
    "Comissões",
    "Assinaturas",
    "Chamados",
  ],
} as const;

export type PlanKey = keyof typeof PLAN_FEATURES;
