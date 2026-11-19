/** Painel financeiro: usa somente lançamentos efetivamente registrados, sem estimativas. */
export type FinanceExpenseGroup = "operacionais" | "fixas" | "comissoes";
export type FinanceOrigin = "assinaturas" | "comandas" | "outras";
export type FinanceOverviewRow = {
  id: string;
  description: string;
  category: string;
  type: "RECEIVABLE" | "PAYABLE";
  status: "PAID" | "PENDING";
  amount: number;
  date: string;
  unitName: string;
  origin: FinanceOrigin;
  expenseGroup: FinanceExpenseGroup;
};
export type FinanceRefundRow = {
  id: string;
  entryId: string;
  description: string;
  reason: string;
  amount: number;
  date: string;
  unitName: string;
  status: "REQUESTED" | "COMPLETED";
};

export function financeNormalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function classifyFinanceOrigin(category: string, subscriptionCharge = false): FinanceOrigin {
  if (subscriptionCharge || /assinatura|clube/.test(financeNormalize(category))) return "assinaturas";
  if (/comanda/.test(financeNormalize(category))) return "comandas";
  return "outras";
}

/** As categorias livres ficam em Operacionais, exceto fixas ou comissões identificadas. */
export function classifyFinanceExpense(category: string): FinanceExpenseGroup {
  const text = financeNormalize(category);
  if (/comiss|repasse profissional|pagamento barbeiro/.test(text)) return "comissoes";
  if (/fixa|aluguel|condominio|internet|energia|agua|telefone|software|salario|folha/.test(text)) return "fixas";
  return "operacionais";
}

export function financeOverviewTotals(rows: FinanceOverviewRow[], refunds: FinanceRefundRow[]) {
  const paidReceivables = rows.filter(row => row.type === "RECEIVABLE" && row.status === "PAID");
  const paidExpenses = rows.filter(row => row.type === "PAYABLE" && row.status === "PAID");
  const pending = rows.filter(row => row.type === "RECEIVABLE" && row.status === "PENDING");
  const sum = (items: { amount: number }[]) => Math.round(items.reduce((total, item) => total + Math.round(item.amount * 100), 0)) / 100;
  const bruto = sum(paidReceivables);
  const despesas = sum(paidExpenses);
  return {
    bruto,
    despesas,
    liquido: Math.round((bruto - despesas) * 100) / 100,
    receber: sum(pending),
    assinaturas: sum(paidReceivables.filter(row => row.origin === "assinaturas")),
    comandas: sum(paidReceivables.filter(row => row.origin === "comandas")),
    estornos: sum(refunds),
    operacionais: sum(paidExpenses.filter(row => row.expenseGroup === "operacionais")),
    fixas: sum(paidExpenses.filter(row => row.expenseGroup === "fixas")),
    comissoes: sum(paidExpenses.filter(row => row.expenseGroup === "comissoes")),
  };
}

export type FinanceDetail =
  | "bruto" | "despesas" | "liquido" | "receber"
  | "assinaturas" | "comandas" | "categorias"
  | "operacionais" | "fixas" | "comissoes" | "estornos";

export function financeDetailRows(rows: FinanceOverviewRow[], kind: FinanceDetail): FinanceOverviewRow[] {
  const paid = rows.filter(row => row.status === "PAID");
  switch (kind) {
    case "bruto": return paid.filter(row => row.type === "RECEIVABLE");
    case "despesas":
    case "categorias": return paid.filter(row => row.type === "PAYABLE");
    case "liquido": return paid;
    case "receber": return rows.filter(row => row.type === "RECEIVABLE" && row.status === "PENDING");
    case "assinaturas": return paid.filter(row => row.type === "RECEIVABLE" && row.origin === "assinaturas");
    case "comandas": return paid.filter(row => row.type === "RECEIVABLE" && row.origin === "comandas");
    case "operacionais":
    case "fixas":
    case "comissoes": return paid.filter(row => row.type === "PAYABLE" && row.expenseGroup === kind);
    case "estornos": return [];
  }
}
