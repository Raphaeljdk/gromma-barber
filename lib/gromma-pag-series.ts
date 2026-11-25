export type GrommaPagPeriod = "mes" | "semana" | "dia";
export type PaidClubReceipt = { date: string; amount: number };
export type GrommaPagCandle = {
  key: string;
  label: string;
  periodLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  total: number;
  count: number;
};

const DAY = 86_400_000;
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const saoPauloParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function parts(date: Date) {
  const values = Object.fromEntries(
    saoPauloParts.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]),
  );
  return { year: values.year, month: values.month, day: values.day, hour: values.hour };
}

function dateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function weekStart(timestamp: number) {
  const dayOfWeek = new Date(timestamp).getUTCDay();
  return timestamp - ((dayOfWeek + 6) % 7) * DAY;
}

function labelDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Each candle represents actual confirmed subscription receipts, not market prices.
 * Open/close = first/last day's collected value (hour for the daily view).
 * High/low = largest/smallest collected value in those subperiods.
 * Missing subperiods count as zero; future hours/days in the current period are excluded.
 */
export function buildGrommaPagCandles(
  receipts: PaidClubReceipt[],
  period: GrommaPagPeriod,
  now: Date = new Date(),
): GrommaPagCandle[] {
  const current = parts(now);
  const today = Date.UTC(current.year, current.month - 1, current.day);
  const thisWeek = weekStart(today);
  const months = period === "mes" ? 12 : period === "semana" ? 12 : 14;
  const periods = Array.from({ length: months }, (_, index) => {
    const offset = months - 1 - index;
    let start: number;
    let slots: number;
    let observed: number;
    let label: string;
    let periodLabel: string;

    if (period === "mes") {
      start = Date.UTC(current.year, current.month - 1 - offset, 1);
      const first = new Date(start);
      const year = first.getUTCFullYear(), month = first.getUTCMonth();
      slots = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      observed = offset === 0 ? current.day : slots;
      label = `${MONTHS[month]}/${String(year).slice(-2)}`;
      periodLabel = `${MONTHS[month]}/${year}`;
    } else if (period === "semana") {
      start = thisWeek - offset * 7 * DAY;
      slots = 7;
      observed = offset === 0 ? Math.floor((today - thisWeek) / DAY) + 1 : 7;
      label = labelDate(start);
      periodLabel = `Semana de ${labelDate(start)}`;
    } else {
      start = today - offset * DAY;
      slots = 24;
      observed = offset === 0 ? current.hour + 1 : 24;
      label = labelDate(start);
      periodLabel = `Dia ${labelDate(start)}`;
    }
    return { start, slots, observed, label, periodLabel, amounts: Array<number>(slots).fill(0), count: 0 };
  });
  const indexed = new Map(periods.map(p => [p.start, p]));

  for (const receipt of receipts) {
    const timestamp = new Date(receipt.date);
    const amount = Number(receipt.amount);
    if (Number.isNaN(timestamp.getTime()) || timestamp > now || !Number.isFinite(amount) || amount <= 0) continue;
    const local = parts(timestamp);
    const day = Date.UTC(local.year, local.month - 1, local.day);
    const start = period === "mes" ? Date.UTC(local.year, local.month - 1, 1)
      : period === "semana" ? weekStart(day) : day;
    const group = indexed.get(start);
    if (!group) continue;
    const slot = period === "mes" ? local.day - 1
      : period === "semana" ? Math.floor((day - start) / DAY) : local.hour;
    if (slot < 0 || slot >= group.observed) continue;
    group.amounts[slot] += amount;
    group.count += 1;
  }

  return periods.map(p => {
    const amounts = p.amounts.slice(0, p.observed);
    return {
      key: dateKey(p.start),
      label: p.label,
      periodLabel: p.periodLabel,
      open: amounts[0] ?? 0,
      close: amounts[amounts.length - 1] ?? 0,
      high: Math.max(...amounts),
      low: Math.min(...amounts),
      total: amounts.reduce((sum, value) => sum + value, 0),
      count: p.count,
    };
  });
}
