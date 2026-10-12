import type { AgendaBlock } from "./erp-workspace";
import { agendaDateKey, agendaMinutes, isAgendaDate } from "./agenda";

export function parseAgendaInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !isAgendaDate(value.slice(0, 10))) return null;
  const hours = Number(value.slice(11, 13)), minutes = Number(value.slice(14, 16));
  if (hours > 23 || minutes > 59) return null;
  return new Date(`${value}:00-03:00`);
}
export function hasAgendaBlock(blocks: AgendaBlock[], barberId: string, start: Date, end: Date) {
  return blocks.some(b => b.barberId === barberId && new Date(b.startsAt) < end && new Date(b.endsAt) > start);
}
export function withinAgendaHours(start: Date, end: Date, open: number, close: number) {
  const last = new Date(end.getTime() - 1);
  return start < end && agendaDateKey(start) === agendaDateKey(last) && agendaMinutes(start) >= open * 60 && agendaMinutes(last) < close * 60;
}
