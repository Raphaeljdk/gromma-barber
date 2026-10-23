import { addAgendaDays, agendaDateKey, isAgendaDate } from "@/lib/agenda";
import { PAYMENT_METHODS, type CommandPayment, type PaymentMethod } from "@/lib/checkout";
import type { AgendaBlock } from "@/lib/erp-workspace";

export type AuditPeriod = { from: string; to: string; invalid: boolean; days: number };
export function auditPeriod(fromRaw: string, toRaw: string, today = agendaDateKey(new Date())): AuditPeriod {
  const from = isAgendaDate(fromRaw) ? fromRaw : addAgendaDays(today, -29);
  const to = isAgendaDate(toRaw) ? toRaw : today;
  const days = Math.round((Date.parse(to + "T12:00:00-03:00") - Date.parse(from + "T12:00:00-03:00")) / 86_400_000) + 1;
  return { from, to, invalid: from > to || days > 366 || days < 1, days };
}
export function periodBounds(period: AuditPeriod) {
  return {
    gte: new Date(period.from + "T00:00:00-03:00"),
    lt: new Date(addAgendaDays(period.to, 1) + "T00:00:00-03:00"),
  };
}
export const dateTimeBR = (date: Date | string) => new Date(date).toLocaleString("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});
export const dateBR = (date: Date | string) => new Date(date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
export function moneyCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
}

/** A single payment split among methods is one sale but may create multiple entries. */
export function cashMethodSummary(payments: CommandPayment[]) {
  return PAYMENT_METHODS.map(method => ({
    method,
    count: payments.filter(p => (p.amounts?.[method] ?? 0) > 0).length,
    cents: payments.reduce((sum, p) => sum + Math.max(0, p.amounts?.[method] ?? 0), 0),
  }));
}
export function paymentTotalCents(payment: CommandPayment) {
  return PAYMENT_METHODS.reduce((sum, method) => sum + Math.max(0, payment.amounts?.[method] ?? 0), 0);
}
export function effectiveDiscountCents(payment: CommandPayment, command?: { discount: unknown } | null) {
  return Math.max(0, Number.isFinite(Number(payment.discountCents))
    ? Number(payment.discountCents)
    : Math.round(Number(command?.discount ?? 0) * 100));
}
export type MinuteInterval = { start: number; end: number };
export function intervalMinutes(intervals: MinuteInterval[]) {
  const sorted = intervals.filter(item => item.end > item.start)
    .sort((a,b)=>a.start-b.start||a.end-b.end);
  let result=0, start=0, end=0, first=true;
  for(const interval of sorted) {
    if(first){start=interval.start;end=interval.end;first=false;continue;}
    if(interval.start <= end) end=Math.max(end,interval.end);
    else {result+=end-start;start=interval.start;end=interval.end;}
  }
  return result + (first ? 0 : end-start);
}
export function intersect(interval: MinuteInterval, start: number, end: number): MinuteInterval | null {
  const left=Math.max(interval.start,start), right=Math.min(interval.end,end);
  return right>left ? {start:left,end:right} : null;
}
export function subtractIntervals(base: MinuteInterval[], excluded: MinuteInterval[]): MinuteInterval[] {
  let available=base.filter(i=>i.end>i.start);
  for(const block of excluded.filter(i=>i.end>i.start).sort((a,b)=>a.start-b.start)){
    available=available.flatMap(i=>{
      if(block.end<=i.start || block.start>=i.end) return [i];
      const result:MinuteInterval[]=[];
      if(block.start>i.start)result.push({start:i.start,end:Math.min(block.start,i.end)});
      if(block.end<i.end)result.push({start:Math.max(block.end,i.start),end:i.end});
      return result;
    });
  }
  return available;
}
/** Exact overlap of occupancy with available intervals, deduplicated. */
export function occupancyMinutes(bookings: MinuteInterval[], available: MinuteInterval[]) {
  return intervalMinutes(bookings.flatMap(booking=>available.flatMap(slot=>{
    const part=intersect(booking,slot);
    return part?[part]:[];
  })));
}
export function barbershopDayBounds(day: string, openHour: number, closeHour: number): MinuteInterval {
  const midnight=Date.parse(day+"T00:00:00-03:00");
  const open=Math.max(0,Math.min(23,Math.floor(openHour)));
  const close=Math.max(open+1,Math.min(24,Math.floor(closeHour)));
  return {start:midnight+open*3_600_000,end:midnight+close*3_600_000};
}
export function availableForProfessional(
  day: string, openHour: number, closeHour: number,
  blocks: AgendaBlock[], professionalId: string, unitId: string,
) {
  const base=barbershopDayBounds(day,openHour,closeHour);
  const closed=blocks.filter(block=>
    (block.status ?? "CLOSED") !== "OPEN" &&
    (block.barberId===professionalId || block.barberId==="*") &&
    (!block.unitId || block.unitId===unitId)
  ).flatMap(block=>{
    const interval=intersect({start:Date.parse(block.startsAt),end:Date.parse(block.endsAt)},base.start,base.end);
    return interval?[interval]:[];
  });
  const available=subtractIntervals([base],closed);
  return {base,available,blockedMinutes:Math.max(0,(base.end-base.start)-intervalMinutes(available)) / 60000};
}
export type HeatBooking = {barberId:string|null;unitId:string;startsAt:Date;endsAt:Date|null;durationMinutes?:number|null;status:string};
export function bookedIntervals(bookings: HeatBooking[], barberId: string, unitId: string, base: MinuteInterval) {
  return bookings.filter(a=>a.barberId===barberId && a.unitId===unitId && !["CANCELED","NO_SHOW"].includes(a.status))
    .flatMap(a=>{
      const start=a.startsAt.getTime(), end=a.endsAt?.getTime() ?? start + (a.durationMinutes || 30)*60000;
      const clipped=intersect({start,end},base.start,base.end);
      return clipped?[clipped]:[];
    });
}
