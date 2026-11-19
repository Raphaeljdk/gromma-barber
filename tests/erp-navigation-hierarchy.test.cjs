const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const filename = path.join(root, "lib/erp-navigation.ts");
const source = fs.readFileSync(filename, "utf8");
const output = ts.transpileModule(source, {
  fileName: filename,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const moduleObj = { exports: {} };
new Function("module", "exports", output)(moduleObj, moduleObj.exports);
const { ERP_NAVIGATION, ERP_NAVIGATION_EXTRA } = moduleObj.exports;

const EXPECTED = {
  operacional: {
    agenda: ["Cadastro de Feriados"],
    clientes: ["Clientes Bloqueados", "Ranking", "Histórico de compras"],
    caixa: ["Comandas", "Histórico de caixas"],
    estoque: ["Entrada e Saída", "Balanço", "Solicitar compra"],
  },
  gestao: {
    auditoria: ["Estoque", "Agendamentos", "Fechamento de caixa", "Produtividade"],
    "relatorios-assinaturas": [
      "Troca de assinatura", "Cancelados por período", "Históricos de transações",
      "Quantidade de assinantes", "Vendas novas por período", "Vendas por origem", "Resgate de pontos",
    ],
    "relatorios-financeiro": ["Estornos", "Faturamento", "Movimentações", "Vendas e lucro"],
    "relatorios-clientes": [
      "Frequência do cliente", "Histórico de agendamento", "Histórico de vendas de produtos",
      "Serviços", "Clientes novos", "Período e serviços",
    ],
    "relatorios-profissionais": [
      "Comissões", "MC por profissional", "Ticket médio por clientes distintos", "Ticket médio por atendimento",
    ],
  },
  marketing: {
    "marketing-clube": ["Pontos"],
    "marketing-promocoes": ["Cupons"],
    "marketing-experiencia": [
      "Aniversariantes", "Avaliação",
    ],
  },
};

function flatten(nodes) {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])]);
}

test("sectors match the reference image in order", () => {
  assert.deepEqual(ERP_NAVIGATION.map(group => group.id), [
    "operacional", "assinaturas", "gestao", "marketing", "empresa",
    "financeiro", "gromma-ia", "performance", "precificacao", "totem",
  ]);
});

test("every referenced subitem remains in its exact hierarchy", () => {
  const flattened = ERP_NAVIGATION.flatMap(group => flatten(group.items));
  for (const [sectorId, sections] of Object.entries(EXPECTED)) {
    const sector = ERP_NAVIGATION.find(group => group.id === sectorId);
    assert.ok(sector, sectorId + " missing");
    for (const [parentId, labels] of Object.entries(sections)) {
      const parent = flattened.find(node => node.id === parentId);
      assert.ok(parent, parentId + " missing");
      assert.deepEqual((parent.children || []).map(child => child.label), labels, parentId);
    }
  }
  const subscription = ERP_NAVIGATION.find(group => group.id === "assinaturas");
  assert.deepEqual(subscription.items.map(item => item.label), [
    "Abrir Clube / Assinaturas", "Dashboard Gromma Pag", "Programar reajuste", "Calendário de pagamentos",
    "Calendário de recebíveis", "Novos contratos", "Clientes cancelados",
    "Contratos ativos", "Distribuição do Pote", "Inadimplentes", "Planos",
    "Solicitar saque", "Transações financeiras",
  ]);
  const company = flattened.find(item => item.id === "empresa-cadastro");
  assert.deepEqual(company.children.map(x => x.label), [
    "Dados", "Profissionais", "Funcionários em destaque",
    "Serviços", "Grupos de acesso", "Meu plano", "Fatura",
  ]);
});

test("routes are real ERP modules and all node identifiers are unique", () => {
  const existing = new Set([
    "dashboard", "agenda", "clientes", "caixa", "comandas", "estoque", "assinaturas",
    "assinaturas-trocas", "assinaturas-cancelados", "assinaturas-transacoes", "assinaturas-vendas", "assinaturas-origem",
    "assinantes", "clube-pag", "clube-reajustes", "clube-pagamentos", "clube-recebiveis", "clube-cancelados", "clube-pote", "clube-inadimplentes", "clube-saques", "clube-transacoes", "auditoria", "relatorios", "comissoes", "promocoes", "avaliacoes", "equipe",
    "servicos", "unidades", "dados", "identidade", "clube-config", "equipe/novo", "plano", "fatura", "grupos-acesso", "funcionarios-destaque", "configuracoes", "financeiro", "gerencial",
    "alertas", "mensagens", "gromma-ia", "marketing-parceiros", "marketing-pontos", "marketing-cupons", "marketing-promocoes-servicos", "marketing-promocoes-produtos", "marketing-aniversariantes", "relatorios-clientes-novos", "documentos", "treinamentos", "totem",
    "financeiro-contas-pagar", "financeiro-contas-receber", "financeiro-criar-receita",
    "financeiro-criar-despesa", "financeiro-despesas", "financeiro-categorias",
    "financeiro-contas-bancarias", "financeiro-formas-comanda", "financeiro-formas-despesas",
    "financeiro-contabilidade", "financeiro-cardex", "financeiro-relatorio-entrada", "financeiro-relatorio-saida", "financeiro-portal-contador",
    "agenda-feriados", "clientes-bloqueados", "clientes-ranking", "clientes-historico-compras", "caixa-historico", "estoque-balanco", "estoque-compras", "auditoria-estoque", "auditoria-agendamentos", "auditoria-fechamento-caixa", "auditoria-produtividade", "notificacoes",
  ]);
  const all = [...ERP_NAVIGATION.flatMap(group => flatten(group.items)), ...flatten(ERP_NAVIGATION_EXTRA)];
  const ids = all.map(item => item.id);
  assert.equal(ids.length, new Set(ids).size, "duplicate navigation IDs");
  for (const item of all) if (item.route) assert.ok(existing.has(item.route), item.id + " has invalid route");
  assert.ok(all.find(item => item.id === "auditoria").adminOnly, "auditoria must remain management-only");
  assert.ok(all.find(item => item.id === "extra-totem").proOnly, "totem must respect plan");
  const gestao = ERP_NAVIGATION.find(group => group.id === "gestao");
  const finance = ERP_NAVIGATION.find(group => group.id === "financeiro");
  assert.ok(finance, "Financeiro deve ser um setor independente");
  assert.ok(!gestao.items.some(item => item.id === "financeiro"), "Financeiro não fica dentro de Gestão");
  assert.deepEqual(finance.items.map(item => item.label), [
    "Contas a pagar", "Contas a receber", "Despesas", "Cadastros", "Contabilidade", "Gromma NF",
  ]);
  assert.equal(finance.items.at(-1).route, undefined, "NF sem página fictícia");
  assert.equal(ERP_NAVIGATION.at(-2).id, "precificacao", "Precificação avulsa antes de Totem");
  assert.ok(!gestao.items.some(item => item.id === "notificacoes"), "Sem Notificações duplicadas na barra lateral");
  assert.ok(gestao.items.some(item => item.id === "extra-alertas"), "Alertas fica na Gestão");
  assert.ok(gestao.items.some(item => item.id === "extra-gerencial"), "Gerencial fica na Gestão");
  assert.equal(ERP_NAVIGATION.at(-1).id, "totem", "Totem / Check-in is the final standalone item");
  for(const id of ["gromma-ia","performance","precificacao"]){
    const group=ERP_NAVIGATION.find(item=>item.id===id);
    assert.equal(group.items.length,1);
    assert.equal(group.items[0].route,id==="gromma-ia"?"gromma-ia":undefined,
      "Gromma IA já tem tela de relacionamento; módulos futuros continuam desativados");
  }
});

test("sidebar renders every hierarchy level without pretending unimplemented pages exist", () => {
  const sidebar = fs.readFileSync(path.join(root, "components/erp-sidebar.tsx"), "utf8");
  assert.match(sidebar, /function renderNavItem/);
  assert.match(sidebar, /visibleChildren\.map\(\(child\) => renderNavItem/);
  assert.match(sidebar, /item\.route \?/);
  assert.match(sidebar, /erp-nav-planned/);
  assert.match(sidebar, /erp-nav-sector-watermark/);
  assert.match(sidebar, /expandedNodes\[item\.id\]/);
  assert.match(sidebar, /item\.adminOnly && !canManage/);
});
