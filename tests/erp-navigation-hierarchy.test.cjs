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
    clientes: ["Clientes Bloqueados", "Ranking"],
    caixa: ["Comandas", "Histórico de caixas"],
    estoque: ["Entrada e Saída"],
  },
  gestao: {
    auditoria: ["Estoque", "Agendamentos", "Batimento de caixa", "Produtividade"],
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
  empresa: {
    "empresa-profissionais": ["Cadastrar profissional", "Exibição do profissional", "Destacar profissional"],
    "empresa-servicos": ["Cadastrar serviço", "Exibição do serviço", "Destacar serviço"],
  },
};

function flatten(nodes) {
  return nodes.flatMap(node => [node, ...flatten(node.children || [])]);
}

test("sectors match the reference image in order", () => {
  assert.deepEqual(ERP_NAVIGATION.map(group => group.id), [
    "operacional", "assinaturas", "gestao", "marketing", "empresa", "financeiro",
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
    "Dashboard Gromma Pag", "Programar reajuste", "Calendário de pagamentos",
    "Calendário de recebíveis", "Novos contratos", "Clientes cancelados",
    "Contratos ativos", "Distribuição do Pote", "Inadimplentes", "Planos",
    "Solicitar saque", "Transações financeiras",
  ]);
  const company = flattened.find(item => item.id === "empresa-cadastro");
  assert.deepEqual(company.children.map(x => x.label), [
    "Categorias", "Filiais", "Produtos", "Profissionais", "Serviços",
    "Dados", "Grupo de acesso", "Meu plano", "Fatura",
  ]);
});

test("routes are real ERP modules and all node identifiers are unique", () => {
  const existing = new Set([
    "dashboard", "agenda", "clientes", "caixa", "comandas", "estoque", "assinaturas",
    "auditoria", "relatorios", "comissoes", "promocoes", "avaliacoes", "equipe",
    "servicos", "unidades", "plano", "configuracoes", "financeiro", "gerencial",
    "alertas", "mensagens", "documentos", "treinamentos", "totem",
  ]);
  const all = [...ERP_NAVIGATION.flatMap(group => flatten(group.items)), ...flatten(ERP_NAVIGATION_EXTRA)];
  const ids = all.map(item => item.id);
  assert.equal(ids.length, new Set(ids).size, "duplicate navigation IDs");
  for (const item of all) if (item.route) assert.ok(existing.has(item.route), item.id + " has invalid route");
  assert.ok(all.find(item => item.id === "auditoria").adminOnly, "auditoria must remain management-only");
  assert.ok(all.find(item => item.id === "extra-totem").proOnly, "totem must respect plan");
  assert.equal(ERP_NAVIGATION.at(-1).id, "financeiro", "Financeiro remains the last sector");
});

test("sidebar renders every hierarchy level without pretending unimplemented pages exist", () => {
  const sidebar = fs.readFileSync(path.join(root, "components/erp-sidebar.tsx"), "utf8");
  assert.match(sidebar, /function renderNavItem/);
  assert.match(sidebar, /visibleChildren\.map\(\(child\) => renderNavItem/);
  assert.match(sidebar, /item\.route \?/);
  assert.match(sidebar, /erp-nav-planned/);
  assert.match(sidebar, /item\.adminOnly && !canManage/);
});
