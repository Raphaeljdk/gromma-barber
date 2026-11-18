"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarRange, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FileText, ReceiptText, RefreshCw, RotateCcw, WalletCards } from "lucide-react";
import { financeDetailRows, financeOverviewTotals, type FinanceDetail, type FinanceOverviewRow, type FinanceRefundRow } from "@/lib/finance-overview";
import styles from "./finance-current-dashboard.module.css";

type Props = {
  tenantCode: string;
  units: { id: string; name: string }[];
  selectedUnit: string;
  startDate: string;
  endDate: string;
  invalidPeriod: boolean;
  entries: FinanceOverviewRow[];
  refunds: FinanceRefundRow[];
};

const money = (amount: number) => new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL",
}).format(amount);
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  timeZone: "America/Sao_Paulo",
}).format(new Date(value));

const detailLabels: Record<FinanceDetail, string> = {
  bruto: "Faturamento bruto",
  despesas: "Despesas",
  liquido: "Faturamento líquido",
  receber: "A receber",
  assinaturas: "Receita de assinaturas",
  comandas: "Receita de comandas",
  categorias: "Despesas por categoria",
  operacionais: "Despesas operacionais",
  fixas: "Despesas fixas",
  comissoes: "Comissões",
  estornos: "Estornos",
};

export function FinanceCurrentDashboard({
  tenantCode, units, selectedUnit, startDate, endDate, invalidPeriod, entries, refunds,
}: Props) {
  const totals = useMemo(() => financeOverviewTotals(entries, refunds), [entries, refunds]);
  const [detail, setDetail] = useState<FinanceDetail | null>(null);
  const [page, setPage] = useState(1);

  const openDetail = (kind: FinanceDetail) => {
    setDetail(previous => previous === kind ? null : kind);
    setPage(1);
  };
  const rows = useMemo(() => detail ? financeDetailRows(entries, detail) : [], [entries, detail]);
  const refundDetail = detail === "estornos";
  const count = refundDetail ? refunds.length : rows.length;
  const perPage = 15;
  const pages = Math.max(1, Math.ceil(count / perPage));
  const visibleRows = rows.slice((page - 1) * perPage, page * perPage);
  const visibleRefunds = refunds.slice((page - 1) * perPage, page * perPage);
  const groups = [
    { key: "operacionais" as const, label: "Operacionais", value: totals.operacionais },
    { key: "fixas" as const, label: "Fixas", value: totals.fixas },
    { key: "comissoes" as const, label: "Comissões", value: totals.comissoes },
  ];
  const refundPending = refunds.filter(refund => refund.status === "REQUESTED").length;

  const card = (key: FinanceDetail, label: string, value: number, tone: string, Icon: typeof WalletCards, note: string) => (
    <button type="button" key={key} aria-pressed={detail === key}
      className={[styles.metric, styles[tone], detail === key ? styles.active : ""].join(" ")}
      onClick={() => openDetail(key)}>
      <span className={styles.metricTop}><span className={styles.metricIcon}><Icon size={19} /></span><ChevronDown size={17} className={styles.cardChevron}/></span>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{money(value)}</strong>
      <span className={styles.metricNote}>{note}</span>
    </button>
  );

  return <div className={styles.overview}>
    <form method="get" action={"/erp/" + encodeURIComponent(tenantCode) + "/financeiro"} className={styles.filters}>
      <div className={styles.filterHeading}><CalendarRange size={18}/><strong>Filtros</strong><span>Selecione a filial e o período para atualizar os indicadores.</span></div>
      <div className={styles.filterFields}>
        <label>Filial
          <select name="finFilial" defaultValue={selectedUnit} className="select">
            <option value="">Todas as filiais</option>
            {units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </label>
        <label>Data inicial
          <input type="date" name="finInicio" defaultValue={startDate} className="input" required />
        </label>
        <label>Data final
          <input type="date" name="finFim" defaultValue={endDate} className="input" required />
        </label>
        <button type="submit" className={styles.submit}><RefreshCw size={16}/> Atualizar</button>
      </div>
      {invalidPeriod && <p role="alert" className={styles.warning}>A data inicial não pode ser maior que a final. Confira as datas antes de atualizar.</p>}
    </form>

    <section className={styles.section} aria-labelledby="finance-cash-title">
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Módulo 01</span><h2 id="finance-cash-title">Demonstrativo do caixa</h2></div><span className={styles.periodPill}>{date(startDate + "T12:00:00-03:00")} a {date(endDate + "T12:00:00-03:00")}</span></div>
      <div className={styles.metrics}>
        {card("bruto", "Faturamento bruto", totals.bruto, "blue", ArrowUpRight, "Receitas recebidas no período")}
        {card("despesas", "Despesas", totals.despesas, "red", ArrowDownRight, "Despesas pagas no período")}
        {card("liquido", "Faturamento líquido", totals.liquido, "green", WalletCards, "Recebimentos menos despesas")}
        {card("receber", "A receber", totals.receber, "amber", ReceiptText, "Receitas com vencimento no período")}
      </div>
    </section>

    <section className={styles.section} aria-labelledby="finance-breakdown-title">
      <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Módulo 02</span><h2 id="finance-breakdown-title">Receita / Despesa detalhada</h2></div></div>
      <div className={styles.metrics}>
        {card("assinaturas", "Receita de assinaturas", totals.assinaturas, "violet", WalletCards, "Recebimentos confirmados do clube")}
        {card("comandas", "Receita de comandas", totals.comandas, "cyan", FileText, "Comandas pagas no período")}
        <div className={[styles.metric, styles.categoryMetric, styles.gold, ["categorias","operacionais","fixas","comissoes"].includes(detail || "") ? styles.active : ""].join(" ")}>
          <button type="button" aria-pressed={detail === "categorias"} className={styles.categoryHeader} onClick={() => openDetail("categorias")}>
            <span className={styles.metricTop}><span className={styles.metricIcon}><ArrowDownRight size={19}/></span><ChevronDown size={17} className={styles.cardChevron}/></span>
            <span className={styles.metricLabel}>Despesas por categoria</span>
            <strong className={styles.categoryTotal}>{money(totals.despesas)}</strong>
          </button>
          <div className={styles.bars}>
            {groups.map(group => <button key={group.key} type="button" className={[styles.barButton, detail === group.key ? styles.barSelected : ""].join(" ")} onClick={() => openDetail(group.key)} aria-label={"Detalhar despesas " + group.label}>
              <span className={styles.barLabels}><span>{group.label}</span><strong>{money(group.value)}</strong></span>
              <span className={styles.barTrack}><span style={{ width: (totals.despesas ? group.value / totals.despesas * 100 : 0) + "%" }} /></span>
            </button>)}
          </div>
        </div>
        {card("estornos", "Estornos", totals.estornos, "rose", RotateCcw, refundPending + " solicitação(ões) pendente(s)")}
      </div>
    </section>

    {detail && <section className={styles.detail} id="finance-detail" aria-live="polite">
      <div className={styles.detailHeading}>
        <div><span className={styles.eyebrow}>Detalhamento</span><h3>{detailLabels[detail]}</h3><p>{count} {count === 1 ? "registro encontrado" : "registros encontrados"} no período e filial selecionados.</p></div>
        <button type="button" className={styles.close} onClick={() => setDetail(null)}>Fechar</button>
      </div>
      {detail === "liquido" && <p className={styles.detailHint}>Faturamento líquido = receitas recebidas ({money(totals.bruto)}) − despesas pagas ({money(totals.despesas)}). As despesas aparecem com sinal negativo.</p>}
      <div className={styles.tableScroll}><table className={styles.table}>
        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Filial</th><th>Status</th><th className={styles.right}>Valor</th></tr></thead>
        <tbody>
          {refundDetail ? visibleRefunds.map(refund => <tr key={refund.id}>
            <td>{date(refund.date)}</td>
            <td><strong>{refund.description}</strong><small>{refund.reason}</small></td>
            <td>Estorno de assinatura</td>
            <td>{refund.unitName}</td>
            <td><span className={styles.status}>{refund.status === "REQUESTED" ? "Solicitado" : "Concluído"}</span></td>
            <td className={styles.right}>{money(refund.amount)}</td>
          </tr>) : visibleRows.map(row => <tr key={row.id}>
            <td>{date(row.date)}</td>
            <td><strong>{row.description}</strong></td>
            <td>{row.category}</td>
            <td>{row.unitName}</td>
            <td><span className={styles.status}>{row.status === "PAID" ? "Confirmado" : "Pendente"}</span></td>
            <td className={styles.right}>{detail === "liquido" && row.type === "PAYABLE" ? "− " : ""}{money(row.amount)}</td>
          </tr>)}
          {!count && <tr><td colSpan={6} className={styles.empty}>Nenhum registro encontrado neste filtro.</td></tr>}
        </tbody>
      </table></div>
      {pages > 1 && <div className={styles.pagination}>
        <span>Página {page} de {pages}</span>
        <button type="button" disabled={page === 1} onClick={() => setPage(current => current - 1)} aria-label="Página anterior"><ChevronLeft size={16}/></button>
        <button type="button" disabled={page === pages} onClick={() => setPage(current => current + 1)} aria-label="Próxima página"><ChevronRight size={16}/></button>
      </div>}
    </section>}

    <p className={styles.disclaimer}><CheckCircle2 size={14}/> Valores baseados nos lançamentos registrados. Receitas e despesas usam a data da confirmação de pagamento; contas a receber usam vencimento. Estornos solicitados e concluídos são exibidos separadamente no detalhe e não são somados duas vezes ao caixa. Despesas sem classificação fixa ou comissão entram em Operacionais.</p>
  </div>;
}
