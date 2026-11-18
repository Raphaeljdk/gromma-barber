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
      "Serviços", "Período e serviços",
    ],
    "relatorios-profissionais": [
      "Comissões", "MC por profissional", "Ticket médio por clientes distintos", "Ticket médio por atendimento",
    ],
  },
  marketing: {
    "marketing-clube": ["Parceiros do clube", "Pontos", "Cupons"],
    "marketing-promocoes": ["Serviços", "Produtos"],
    "marketing-experiencia": [
      "Aniversariante por período", "Avaliação", "Agendamento do cliente",
      "Clientes ausentes", "Clientes sem preferência", "Clientes novos",
    ],
  },
};

function flatten(nodes) {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])]);
}

test("sectors match the reference image in order", () => {
  assert.deepEqual(ERP_NAVIGATION.map(group => group.id), [
    "operacional", "assinaturas", "gestao", "marketing", "empresa", "gromma-ia", "performance", "precificacao", "totem",
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
    "alertas", "mensagens", "documentos", "treinamentos", "totem",
    "financeiro-contas-pagar", "financeiro-contas-receber", "financeiro-criar-receita",
    "financeiro-criar-despesa", "financeiro-despesas", "financeiro-categorias",
    "financeiro-contas-bancarias", "financeiro-formas-comanda", "financeiro-formas-despesas",
    "financeiro-contabilidade", "financeiro-gromma-nf",
    "gromma-ia", "performance", "precificacao",
    "agenda-feriados", "clientes-bloqueados", "clientes-ranking", "clientes-historico-compras", "caixa-historico", "estoque-balanco", "estoque-compras", "auditoria-estoque", "auditoria-agendamentos", "auditoria-fechamento-caixa", "auditoria-produtividade", "notificacoes",
  ]);
  const all = [...ERP_NAVIGATION.flatMap(group => flatten(group.items)), ...flatten(ERP_NAVIGATION_EXTRA)];
  const ids = all.map(item => item.id);
  assert.equal(ids.length, new Set(ids).size, "duplicate navigation IDs");
  for (const item of all) if (item.route) assert.ok(existing.has(item.route), item.id + " has invalid route");
  assert.ok(all.find(item => item.id === "auditoria").adminOnly, "auditoria must remain management-only");
  assert.ok(all.find(item => item.id === "extra-totem").proOnly, "totem must respect plan");
  const gestao = ERP_NAVIGATION.find(group => group.id === "gestao");
  const finance = gestao.items.find(item => item.id === "financeiro");
  assert.ok(finance, "Financeiro deve estar dentro de Gestão");
  assert.equal(finance.route, "financeiro");
  assert.ok(finance.children.some(item => item.id === "financeiro-contas-pagar"));
  assert.equal(ERP_NAVIGATION.at(-2).id, "precificacao", "Precificação precede Totem");
  assert.ok(!gestao.items.some(item => item.id === "notificacoes"), "Sem Notificações duplicadas na barra lateral");
  assert.ok(gestao.items.some(item => item.id === "extra-alertas"), "Alertas fica na Gestão");
  assert.ok(gestao.items.some(item => item.id === "extra-gerencial"), "Gerencial fica na Gestão");
  assert.equal(ERP_NAVIGATION.at(-1).id, "totem", "Totem / Check-in is the final standalone item");
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

test("Gromma NF fica sob Financeiro dentro de Gestão, ferramentas independentes fora", () => {
  const gestao = ERP_NAVIGATION.find(group => group.id === "gestao");
  const finance = gestao.items.find(node => node.id === "financeiro");
  assert.ok(finance.children.some(node => node.id === "financeiro-gromma-nf" && node.route === "financeiro-gromma-nf"));
  for (const name of ["gromma-ia", "performance", "precificacao"]) {
    const sector = ERP_NAVIGATION.find(group => group.id === name);
    assert.equal(sector.items.length, 1);
    assert.equal(sector.items[0].route, name);
  }
  const routes = fs.readFileSync(path.join(root, "app/erp/[tenant]/[module]/page.tsx"), "utf8");
  for (const route of ["financeiro-gromma-nf","gromma-ia","performance","precificacao"])
    assert.ok(routes.includes('"'+route+'"'));
});
