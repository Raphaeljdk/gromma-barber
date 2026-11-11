/**
 * Estrutura oficial das abas GROMMA (referência recebida em 19/10/2026).
 *
 * "route" aponta EXCLUSIVAMENTE para uma página já existente no ERP.
 * Entradas sem route aparecem como "Planejado": não criamos links 404 nem
 * simulamos operações inexistentes. Os IDs não alteram rotas ou permissões.
 */
export type ErpNavigationNode = {
  id: string;
  label: string;
  route?: string;
  proOnly?: boolean;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  children?: readonly ErpNavigationNode[];
};

export type ErpNavigationSector = {
  id: string;
  label: string;
  description: string;
  items: readonly ErpNavigationNode[];
};

export const ERP_NAVIGATION: readonly ErpNavigationSector[] = [
  {
    id: "operacional", label: "Operacional", description: "Atendimento e rotina",
    items: [
      { id: "dashboard", label: "Dashboard", route: "dashboard" },
      { id: "agenda", label: "Agenda", route: "agenda", children: [
        { id: "agenda-feriados", label: "Cadastro de Feriados", route: "agenda-feriados" },
      ] },
      { id: "clientes", label: "Clientes", route: "clientes", children: [
        { id: "clientes-bloqueados", label: "Clientes Bloqueados", route: "clientes-bloqueados" },
        { id: "clientes-ranking", label: "Ranking", route: "clientes-ranking" },
        { id: "clientes-historico-compras", label: "Histórico de compras", route: "clientes-historico-compras" },
      ] },
      { id: "caixa", label: "Caixa", route: "caixa", children: [
        { id: "comandas", label: "Comandas", route: "comandas" },
        { id: "caixa-historico", label: "Histórico de caixas", route: "caixa-historico" },
      ] },
      { id: "estoque", label: "Estoque", route: "estoque", children: [
        { id: "estoque-movimentacao", label: "Entrada e Saída", route: "estoque" },
        { id: "estoque-balanco", label: "Balanço", route: "estoque-balanco" },
        { id: "estoque-compras", label: "Solicitar compra", route: "estoque-compras" },
      ] },
    ],
  },
  {
    id: "assinaturas", label: "Clube / Assinaturas", description: "Planos, clientes e cobranças",
    items: [
      { id: "assinatura-clube", label: "Abrir Clube / Assinaturas", route: "assinaturas" },
      { id: "assinatura-gromma-pag", label: "Dashboard Gromma Pag", route: "clube-pag" },
      { id: "assinatura-reajuste", label: "Programar reajuste", route: "clube-reajustes", ownerOnly: true },
      { id: "assinatura-calendario-pagamentos", label: "Calendário de pagamentos", route: "clube-pagamentos" },
      { id: "assinatura-calendario-recebiveis", label: "Calendário de recebíveis", route: "clube-recebiveis" },
      { id: "assinatura-novos-contratos", label: "Novos contratos", route: "assinaturas" },
      { id: "assinatura-clientes-cancelados", label: "Clientes cancelados", route: "clube-cancelados" },
      { id: "assinatura-contratos-ativos", label: "Contratos ativos", route: "assinaturas" },
      { id: "assinatura-distribuicao-pote", label: "Distribuição do Pote", route: "clube-pote" },
      { id: "assinatura-inadimplentes", label: "Inadimplentes", route: "clube-inadimplentes" },
      { id: "assinatura-planos", label: "Planos", route: "assinaturas" },
      { id: "assinatura-solicitar-saque", label: "Solicitar saque", route: "clube-saques", ownerOnly: true },
      { id: "assinatura-transacoes", label: "Transações financeiras", route: "clube-transacoes" },
    ],
  },
  {
    id: "gestao", label: "Gestão", description: "Auditoria, relatórios e comissões",
    items: [
      { id: "auditoria", label: "Auditoria", route: "auditoria", adminOnly: true, children: [
        { id: "auditoria-estoque", label: "Estoque", route: "auditoria-estoque", adminOnly: true },
        { id: "auditoria-agendamentos", label: "Agendamentos", route: "auditoria-agendamentos", adminOnly: true },
        { id: "auditoria-fechamento-caixa", label: "Fechamento de caixa", route: "auditoria-fechamento-caixa", adminOnly: true },
        { id: "auditoria-produtividade", label: "Produtividade", route: "auditoria-produtividade", adminOnly: true },
      ] },
      { id: "notificacoes", label: "Notificações", route: "notificacoes", ownerOnly: true },
      { id: "gerar-comissao", label: "Gerar comissão", route: "comissoes" },
      { id: "relatorios", label: "Relatórios", route: "relatorios", children: [
        { id: "relatorios-assinaturas", label: "Assinaturas", children: [
          { id: "rel-ass-troca", label: "Troca de assinatura", route: "assinaturas-trocas" },
          { id: "rel-ass-cancelados", label: "Cancelados por período", route: "assinaturas-cancelados" },
          { id: "rel-ass-transacoes", label: "Históricos de transações", route: "assinaturas-transacoes" },
          { id: "rel-ass-quantidade", label: "Quantidade de assinantes", route: "assinantes" },
          { id: "rel-ass-vendas-novas", label: "Vendas novas por período", route: "assinaturas-vendas" },
          { id: "rel-ass-vendas-origem", label: "Vendas por origem", route: "assinaturas-origem" },
          { id: "rel-ass-pontos", label: "Resgate de pontos" },
        ] },
        { id: "relatorios-financeiro", label: "Financeiro", children: [
          { id: "rel-fin-estornos", label: "Estornos" },
          { id: "rel-fin-faturamento", label: "Faturamento" },
          { id: "rel-fin-movimentacoes", label: "Movimentações" },
          { id: "rel-fin-vendas-lucro", label: "Vendas e lucro" },
        ] },
        { id: "relatorios-clientes", label: "Clientes", children: [
          { id: "rel-cli-frequencia", label: "Frequência do cliente" },
          { id: "rel-cli-agendamento", label: "Histórico de agendamento" },
          { id: "rel-cli-vendas-produtos", label: "Histórico de vendas de produtos" },
          { id: "rel-cli-servicos", label: "Serviços" },
          { id: "rel-cli-periodo", label: "Período e serviços" },
        ] },
        { id: "relatorios-profissionais", label: "Profissionais", children: [
          { id: "rel-pro-comissoes", label: "Comissões", route: "comissoes" },
          { id: "rel-pro-mc", label: "MC por profissional" },
          { id: "rel-pro-ticket-clientes", label: "Ticket médio por clientes distintos" },
          { id: "rel-pro-ticket-atendimento", label: "Ticket médio por atendimento" },
        ] },
      ] },
    ],
  },
  {
    id: "marketing", label: "Marketing e promoção", description: "Fidelização e experiência",
    items: [
      { id: "marketing-clube", label: "Clube do assinante", route: "assinaturas", children: [
        { id: "marketing-parceiros", label: "Parceiros do clube" },
        { id: "marketing-pontos", label: "Pontos" },
        { id: "marketing-cupons", label: "Cupons", route: "promocoes" },
      ] },
      { id: "marketing-promocoes", label: "Promoções", route: "promocoes", children: [
        { id: "marketing-promocoes-servicos", label: "Serviços", route: "promocoes" },
        { id: "marketing-promocoes-produtos", label: "Produtos", route: "promocoes" },
      ] },
      { id: "marketing-experiencia", label: "Experiência", route: "avaliacoes", children: [
        { id: "marketing-aniversariantes", label: "Aniversariante por período" },
        { id: "marketing-avaliacao", label: "Avaliação", route: "avaliacoes" },
        { id: "marketing-agendamento-cliente", label: "Agendamento do cliente", route: "agenda" },
        { id: "marketing-clientes-ausentes", label: "Clientes ausentes" },
        { id: "marketing-clientes-sem-preferencia", label: "Clientes sem preferência" },
        { id: "marketing-clientes-novos", label: "Clientes novos", route: "clientes" },
      ] },
    ],
  },
  {
    id: "empresa", label: "Empresa", description: "Cadastros e configuração",
    items: [
      { id: "empresa-cadastro", label: "Cadastro", children: [
        { id: "empresa-dados", label: "Dados", route: "dados" },
        { id: "empresa-profissionais", label: "Profissionais", route: "equipe" },
        { id: "empresa-destaques", label: "Funcionários em destaque", route: "funcionarios-destaque", ownerOnly: true },
        { id: "empresa-servicos", label: "Serviços", route: "servicos" },

        { id: "empresa-grupos-acesso", label: "Grupos de acesso", route: "grupos-acesso", ownerOnly: true },

        { id: "empresa-meu-plano", label: "Meu plano", route: "plano" },
        { id: "empresa-fatura", label: "Fatura", route: "fatura", ownerOnly: true },
      ] },
    ],
  },
  {
    id: "financeiro", label: "Financeiro", description: "Contas, lançamentos e cadastros",
    items: [
      { id: "financeiro-atual", label: "Financeiro atual", route: "financeiro" },
      { id: "financeiro-contas-pagar", label: "Contas a pagar", route: "financeiro-contas-pagar" },
      { id: "financeiro-contas-receber", label: "Contas a receber", route: "financeiro-contas-receber" },
      { id: "financeiro-criar-receita", label: "Criar receita", route: "financeiro-criar-receita", ownerOnly: true },
      { id: "financeiro-criar-despesa", label: "Criar despesas", route: "financeiro-criar-despesa", ownerOnly: true },
      { id: "financeiro-despesas", label: "Despesas", route: "financeiro-despesas" },
      { id: "financeiro-cadastros", label: "Cadastros", ownerOnly: true, children: [
        { id: "financeiro-categorias", label: "Categorias financeiras", route: "financeiro-categorias" },
        { id: "financeiro-contas-bancarias", label: "Contas bancárias", route: "financeiro-contas-bancarias" },
        { id: "financeiro-formas-pagamento", label: "Formas de pagamento", children: [
          { id: "financeiro-formas-comanda", label: "Comanda", route: "financeiro-formas-comanda" },
          { id: "financeiro-formas-despesas", label: "Despesas", route: "financeiro-formas-despesas" },
        ] },
      ] },
      { id: "financeiro-contabilidade", label: "Contabilidade", route: "financeiro-contabilidade" },
    ],
  },
  {
    id: "totem", label: "Totem / Check-in", description: "Etapa futura",
    items: [
      { id: "extra-totem", label: "Totem / Check-in", route: "totem", proOnly: true },
    ],
  },
] as const satisfies readonly ErpNavigationSector[];

/* Preserva acesso aos módulos atuais que não são itens explícitos da imagem. */
export const ERP_NAVIGATION_EXTRA: readonly ErpNavigationNode[] = [
  { id: "extra-gerencial", label: "Gerencial", route: "gerencial" },
  { id: "extra-alertas", label: "Alertas", route: "alertas" },
  { id: "extra-mensagens", label: "Mensagens", route: "mensagens" },
  { id: "extra-documentos", label: "Documentos", route: "documentos" },
  { id: "extra-treinamentos", label: "Tutoriais / Cursos", route: "treinamentos" },
  { id: "extra-configuracoes", label: "Configurações", route: "configuracoes" },
];

/**
 * Escolhe apenas um item visualmente ativo para uma rota. Algumas entradas
 * comerciais (ex.: Planos e Novos contratos) apontam para a mesma página.
 * Isso não muda seus links ou permissões: evita apenas vários destaques.
 */
function firstNavigationRouteId(nodes: readonly ErpNavigationNode[], route: string): string | undefined {
  for (const node of nodes) {
    if (node.route === route) return node.id;
    const nested = node.children ? firstNavigationRouteId(node.children, route) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

export function primaryNavigationItemId(route: string): string | undefined {
  for (const group of ERP_NAVIGATION) {
    const result = firstNavigationRouteId(group.items, route);
    if (result) return result;
  }
  return firstNavigationRouteId(ERP_NAVIGATION_EXTRA, route);
}
