/** Calcula saldos em milésimos para não comparar valores monetários/quantidades com ponto flutuante. */
export function parseCountMilli(input: unknown): number | null {
  const raw = String(input ?? "").trim().replace(",", ".");
  if (!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,3})?$/.test(raw)) return null;
  const [whole, fractional = ""] = raw.split(".");
  const count = Number(whole) * 1000 + Number(fractional.padEnd(3, "0"));
  return Number.isSafeInteger(count) ? count : null;
}

export type StockAggregate = { type: string; _sum: { quantity: unknown } };

/** IN e ADJUSTMENT (inclusive ajustes negativos) somam; OUT subtrai. */
export function stockBalanceMilli(aggregates: readonly StockAggregate[]): number {
  return aggregates.reduce((total, row) => {
    const quantity = Math.round(Number(row._sum.quantity ?? 0) * 1000);
    return total + (row.type === "OUT" ? -quantity : quantity);
  }, 0);
}

export function formatQuantityMilli(milli: number): string {
  return (milli / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}
