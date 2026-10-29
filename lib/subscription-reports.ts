import type { ClubMemberConfig, ErpWorkspace } from './erp-workspace';
import { isAgendaDate } from './agenda';

export const SUBSCRIPTION_REPORTS: Record<string, string> = {
  assinantes: 'Quantidade de assinantes',
  'assinaturas-trocas': 'Troca de assinatura',
  'assinaturas-cancelados': 'Cancelados por período',
  'assinaturas-transacoes': 'Históricos de transações',
  'assinaturas-vendas': 'Vendas novas por período',
  'assinaturas-origem': 'Vendas por origem',
};
export function normalizeName(text: string) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}
export function dateInPeriod(value: string | Date | null | undefined, from: string, to: string) {
  if (!value) return !from && !to;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return (!from || time >= new Date(`${from}T00:00:00-03:00`).getTime()) &&
    (!to || time < new Date(`${to}T00:00:00-03:00`).getTime() + 86400000);
}
export function validPeriod(from: string, to: string) {
  return (!from || isAgendaDate(from)) && (!to || isAgendaDate(to)) && (!from || !to || from <= to);
}
export function movementKind(previous: number | null, next: number) {
  return previous === null || previous === next ? 'CHANGE' : next > previous ? 'UPGRADE' : 'DOWNGRADE';
}
export type ReportEntry = { id: string; status: string; dueDate: Date | null; amount: number };
export function memberStatus(member: ClubMemberConfig, workspace: ErpWorkspace, entries: ReportEntry[], now: Date) {
  if (member.status === 'CANCELED' || member.status === 'PAUSED') return member.status;
  const ids = new Set(workspace.clubCharges.filter(c => c.memberId === member.id).map(c => c.entryId));
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const overdue = entries.some(e => ids.has(e.id) && e.status === 'PENDING' && e.dueDate && day(e.dueDate) < day(now));
  if (member.status === 'PAST_DUE' || overdue || (!ids.size && new Date(member.nextBillingAt) < now)) return 'OVERDUE';
  return 'ACTIVE';
}
export function pageRows<T>(rows: T[], requested: number, size = 10) {
  const page = Math.min(Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : 1), Math.max(1, Math.ceil(rows.length / size)));
  return { page, rows: rows.slice((page - 1) * size, page * size) };
}
export function salesRows(workspace: ErpWorkspace) {
  const recorded = new Set(workspace.clubSales.map(s => s.memberId));
  return [...workspace.clubSales, ...workspace.clubMembers.filter(m => !recorded.has(m.id)).map(m => ({
    id: `legacy-${m.id}`, memberId: m.id, customerId: m.customerId, planId: m.planId,
    planName: `${workspace.clubPlans.find(p => p.id === m.planId)?.name ?? 'Plano indisponível'} (plano atual)`,
    amount: null, at: m.startedAt, sellerId: null, sellerName: 'Origem não registrada', source: 'LEGACY' as const,
  }))];
}
