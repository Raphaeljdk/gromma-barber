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
      { id: "assinatura-gromma-pag", label: "Dashboard Gromma Pag" },
      { id: "assinatura-reajuste", label: "Programar reajuste" },
      { id: "assinatura-calendario-pagamentos", label: "Calendário de pagamentos" },
      { id: "assinatura-calendario-recebiveis", label: "Calendário de recebíveis" },
      { id: "assinatura-novos-contratos", label: "Novos contratos", route: "assinaturas" },
      { id: "assinatura-clientes-cancelados", label: "Clientes cancelados" },
      { id: "assinatura-contratos-ativos", label: "Contratos ativos", route: "assinaturas" },
      { id: "assinatura-distribuicao-pote", label: "Distribuição do Pote" },
      { id: "assinatura-inadimplentes", label: "Inadimplentes" },
      { id: "assinatura-planos", label: "Planos", route: "assinaturas" },
      { id: "assinatura-solicitar-saque", label: "Solicitar saque" },
      { id: "assinatura-transacoes", label: "Transações financeiras" },
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
          { id: "rel-ass-troca", label: "Troca de assinatura" },
          { id: "rel-ass-cancelados", label: "Cancelados por período" },
          { id: "rel-ass-transacoes", label: "Históricos de transações" },
          { id: "rel-ass-quantidade", label: "Quantidade de assinantes", route: "assinantes" },
          { id: "rel-ass-vendas-novas", label: "Vendas novas por período" },
          { id: "rel-ass-vendas-origem", label: "Vendas por origem" },
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
        { id: "empresa-categorias", label: "Categorias" },
        { id: "empresa-filiais", label: "Filiais", route: "unidades" },
        { id: "empresa-produtos", label: "Produtos", route: "estoque" },
        { id: "empresa-profissionais", label: "Profissionais", route: "equipe", children: [
          { id: "empresa-profissionais-cadastro", label: "Cadastrar profissional", route: "equipe" },
          { id: "empresa-profissionais-exibicao", label: "Exibição do profissional", route: "equipe" },
          { id: "empresa-profissionais-destaque", label: "Destacar profissional" },
        ] },
        { id: "empresa-servicos", label: "Serviços", route: "servicos", children: [
          { id: "empresa-servicos-cadastro", label: "Cadastrar serviço", route: "servicos" },
          { id: "empresa-servicos-exibicao", label: "Exibição do serviço", route: "servicos" },
          { id: "empresa-servicos-destaque", label: "Destacar serviço" },
        ] },
        { id: "empresa-dados", label: "Dados", route: "configuracoes" },
        { id: "empresa-grupos-acesso", label: "Grupo de acesso" },
        { id: "empresa-meu-plano", label: "Meu plano", route: "plano" },
        { id: "empresa-fatura", label: "Fatura" },
      ] },
    ],
  },
  {
    id: "financeiro", label: "Financeiro", description: "Faremos por último",
    items: [
      { id: "financeiro-atual", label: "Financeiro atual", route: "financeiro" },
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
