import { Prisma, type PrismaClient } from "@prisma/client";
import type { ClubMemberConfig, ErpWorkspace } from "./erp-workspace";
import { potPercentForUnit } from "./unit-operations-policy";

type Database = PrismaClient | Prisma.TransactionClient;
type Receipt = { id: string; memberId: string; plan: string; amountCents: number; paidAt: string; unitId: string | null };
type Refund = { id: string; amountCents: number; completedAt: string; unitId: string | null };
export type PotDistribution = { sharePercent: number; amountCents: number; attendances: number };

function moneyCents(amount: Prisma.Decimal): number {
  const cents = amount.mul(100).toDecimalPlaces(0).toNumber();
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Valor financeiro inválido");
  return cents;
}

/** Um atendimento é de assinante quando o cliente possuía contrato vigente na
 * data do serviço. Cada agendamento COMPLETED conta uma única vez, mesmo com
 * vários serviços na comanda. Cancelados, faltas, avulsos e ciclos não pagos não entram.
 *
 * Contratos antigos sem histórico detalhado de suspensão/inadimplência podem
 * precisar de revisão antes da homologação financeira definitiva.
 */
function activeMembershipAt(members: ClubMemberConfig[], at: Date): boolean {
  const time = at.getTime();
  return members.some(member => {
    const started = new Date(member.startedAt).getTime();
    const ended = Math.min(
      member.canceledAt ? new Date(member.canceledAt).getTime() : Infinity,
      member.brokenAt ? new Date(member.brokenAt).getTime() : Infinity,
      member.cancelEffectiveAt ? new Date(member.cancelEffectiveAt).getTime() : Infinity,
    );
    return Number.isFinite(started) && time >= started && time < ended;
  });
}

/** Rateio puro por produtividade. Arredondamento em centavos pela técnica de
 * maiores restos; a soma individual é sempre igual ao pote se houver atendimentos.
 * Porcentagens de exibição também somam exatamente 100,00%.
 */
export function splitPotByProductivity(potCents: number, counts: Record<string, number>): {
  totalAttendances: number;
  distributions: Record<string, PotDistribution>;
  assignedCents: number;
  remainingCents: number;
} {
  if (!Number.isSafeInteger(potCents) || potCents < 0) throw new Error("Pote inválido");
  const items = Object.entries(counts)
    .filter(([, n]) => Number.isSafeInteger(n) && n > 0)
    .map(([id, attendances]) => ({ id, attendances }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const totalAttendances = items.reduce((sum, item) => sum + item.attendances, 0);
  if (totalAttendances === 0)
    return { totalAttendances: 0, distributions: {}, assignedCents: 0, remainingCents: potCents };

  const allocate = (total: number) => {
    const shares = items.map(item => {
      const numerator = total * item.attendances;
      const base = Math.floor(numerator / totalAttendances);
      return { id: item.id, base, fraction: numerator % totalAttendances };
    });
    let pending = total - shares.reduce((sum, item) => sum + item.base, 0);
    const order = [...shares].sort((a, b) => b.fraction - a.fraction || a.id.localeCompare(b.id));
    const extras = new Set<string>();
    for (const item of order) {
      if (pending <= 0) break;
      extras.add(item.id);
      pending--;
    }
    return new Map(shares.map(item => [item.id, item.base + (extras.has(item.id) ? 1 : 0)]));
  };

  const cents = allocate(potCents);
  const basisPoints = allocate(10000);
  const distributions = Object.fromEntries(items.map(item => [item.id, {
    attendances: item.attendances,
    sharePercent: (basisPoints.get(item.id) ?? 0) / 100,
    amountCents: cents.get(item.id) ?? 0,
  }])) as Record<string, PotDistribution>;
  return { totalAttendances, distributions, assignedCents: potCents, remainingCents: 0 };
}

/** O montante do pote nunca vem de um campo digitável: somente cobranças do
 * clube baixadas como PAID. Abate estornos concluídos na data de devolução.
 * Até integrar o gateway, a baixa manual não constitui conciliação bancária.
 */
export async function calculateSubscriptionPot(
  prisma: Database, shopId: string, workspace: ErpWorkspace,
  start: Date, endExclusive: Date, eligibleProfessionalIds: string[], unitId?: string,
) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(endExclusive.getTime()) || start >= endExclusive)
    throw new Error("Período de apuração inválido");
  const eligible = new Set(eligibleProfessionalIds);
  const chargeByEntry = new Map(workspace.clubCharges.map(c => [c.entryId, c]));
  const ids = [...chargeByEntry.keys()];
  const entries = ids.length ? await prisma.financialEntry.findMany({
    where: { barberShopId: shopId, id: { in: ids }, type: "RECEIVABLE",
      category: "Clube de assinaturas", status: "PAID", paidAt: { lt: endExclusive } },
    select: { id: true, amount: true, paidAt: true, unitId: true },
  }) : [];
  const receipts: Receipt[] = [];
  const refunds: Refund[] = [];
  const refundByEntry = new Map(workspace.clubRefunds
    .filter(r => r.status === "COMPLETED" && r.completedAt)
    .map(r => [r.entryId, r]));
  let unassignedCount = 0;
  for (const entry of entries) {
    if (!entry.paidAt || !chargeByEntry.has(entry.id)) continue;
    if (!entry.unitId && entry.paidAt >= start) unassignedCount++;
    if (unitId && entry.unitId !== unitId) continue;
    const amountCents = moneyCents(new Prisma.Decimal(entry.amount));
    if (entry.paidAt >= start) {
      const charge = chargeByEntry.get(entry.id)!;
      receipts.push({ id: entry.id, memberId: charge.memberId, plan: charge.planName,
        amountCents, paidAt: entry.paidAt.toISOString(), unitId: entry.unitId });
    }
    const refund = refundByEntry.get(entry.id);
    if (refund?.completedAt) {
      const refundedAt = new Date(refund.completedAt);
      if (Number.isFinite(refundedAt.getTime()) && refundedAt >= start && refundedAt < endExclusive)
        refunds.push({ id: entry.id, amountCents, completedAt: refundedAt.toISOString(), unitId:entry.unitId });
    }
  }
  receipts.sort((a,b) => b.paidAt.localeCompare(a.paidAt));
  const paidCents = receipts.reduce((sum, r) => sum + r.amountCents, 0);
  const refundedCents = refunds.reduce((sum, r) => sum + r.amountCents, 0);
  // O percentual do pote é calculado separadamente por unidade para impedir
  // que o caixa de uma filial subsidie comissões de outra filial.
  const unitPaid = new Map<string,number>();
  const unitRefunded = new Map<string,number>();
  for(const receipt of receipts){
    const key=receipt.unitId??"";
    unitPaid.set(key,(unitPaid.get(key)??0)+receipt.amountCents);
  }
  for(const refund of refunds){
    const key=refund.unitId??"";
    unitRefunded.set(key,(unitRefunded.get(key)??0)+refund.amountCents);
  }
  const unitKeys=new Set([...unitPaid.keys(),...unitRefunded.keys()]);
  const potByUnit = Object.fromEntries([...unitKeys].map(key=>{
    const net=Math.max(0,(unitPaid.get(key)??0)-(unitRefunded.get(key)??0));
    const rate=potPercentForUnit(workspace,key||null);
    if(!Number.isFinite(rate)||rate<0||rate>100)throw new Error("Percentual de pote inválido");
    return [key,Math.round(net*rate/100)];
  })) as Record<string,number>;
  const netCents = [...unitKeys].reduce((total,key)=>
    total+Math.max(0,(unitPaid.get(key)??0)-(unitRefunded.get(key)??0)),0);
  const potCents=Object.values(potByUnit).reduce((sum,value)=>sum+value,0);
  const percent=unitId?potPercentForUnit(workspace,unitId):
    netCents?Math.round((potCents/netCents)*10000)/100:workspace.subscriptionPot.percent;

  // O histórico do contrato, sozinho, não prova que o atendimento foi realizado
  // como assinante: um cliente inadimplente pode comprar um serviço avulso.
  // Exigimos um ciclo com recebimento confirmado antes do atendimento.
  const paidCycles = new Map<string, { start: number; end: number; paid: number }[]>();
  for (const entry of entries) {
    if (!entry.paidAt) continue;
    const charge = chargeByEntry.get(entry.id);
    if (!charge) continue;
    const startAt = new Date(charge.periodStart).getTime();
    const endAt = new Date(charge.periodEnd).getTime();
    if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) continue;
    const cycles = paidCycles.get(charge.memberId) ?? [];
    cycles.push({ start: startAt, end: endAt, paid: entry.paidAt.getTime() });
    paidCycles.set(charge.memberId, cycles);
  }

  const appointments = await prisma.appointment.findMany({
    where: { barberShopId: shopId, status: "COMPLETED",
      startsAt: { gte: start, lt: endExclusive },
      customerId: { not: null }, barberId: { not: null },
      ...(unitId ? { unitId } : {}) },
    select: { customerId: true, barberId: true, startsAt: true, unitId: true },
  });
  const byCustomer = new Map<string, ClubMemberConfig[]>();
  for (const member of workspace.clubMembers) {
    const group = byCustomer.get(member.customerId) ?? [];
    group.push(member);
    byCustomer.set(member.customerId, group);
  }
  const attendanceCounts: Record<string, number> = {};
  const attendanceByUnit:Record<string,Record<string,number>>={};
  const uniqueReceiptUnits=[...new Set(receipts.map(r=>r.unitId).filter((id):id is string=>!!id))];
  let unassignedAttendances = 0;
  let nonSubscriberAttendances = 0;
  let unverifiedAttendances = 0;
  for (const appointment of appointments) {
    if (!appointment.barberId || !appointment.customerId) continue;
    const at = appointment.startsAt.getTime();
    const memberships = (byCustomer.get(appointment.customerId) ?? []).filter(member =>
      activeMembershipAt([member], appointment.startsAt));
    if (!memberships.length) { nonSubscriberAttendances++; continue; }
    const verified = memberships.some(member => (paidCycles.get(member.id) ?? []).some(cycle =>
      cycle.start <= at && at < cycle.end && cycle.paid <= at));
    if (!verified) { unverifiedAttendances++; continue; }
    if (!eligible.has(appointment.barberId)) { unassignedAttendances++; continue; }
    attendanceCounts[appointment.barberId] = (attendanceCounts[appointment.barberId] ?? 0) + 1;
    // Fixtures legados podem não incluir unitId; só inferir quando há uma única filial
    // no período. Caso contrário não atribuir receita incerta a um profissional.
    const sourceUnit=appointment.unitId??unitId??
      (uniqueReceiptUnits.length===1?uniqueReceiptUnits[0]:"");
    attendanceByUnit[sourceUnit]??={};
    attendanceByUnit[sourceUnit][appointment.barberId]=
      (attendanceByUnit[sourceUnit][appointment.barberId]??0)+1;
  }
  const perUnit=Object.entries(potByUnit).map(([key,amount])=>
    splitPotByProductivity(amount,attendanceByUnit[key]??{}));
  const assignedCents=perUnit.reduce((sum,part)=>sum+part.assignedCents,0);
  const remainingCents=potCents-assignedCents;
  const distributionCents:Record<string,number>={};
  for(const part of perUnit)for(const [userId,share] of Object.entries(part.distributions))
    distributionCents[userId]=(distributionCents[userId]??0)+share.amountCents;
  const shareBasis=assignedCents?splitPotByProductivity(10000,distributionCents).distributions:{};
  const distributions=Object.fromEntries(Object.entries(distributionCents).map(([id,amountCents])=>[
    id,{amountCents,sharePercent:shareBasis[id]?.sharePercent??0,
      attendances:attendanceCounts[id]??0},
  ])) as Record<string,PotDistribution>;
  const totalAttendances=Object.values(attendanceCounts).reduce((sum,n)=>sum+n,0);
  return {
    paidCents, refundedCents, netCents, potCents,
    assignedCents,remainingCents,totalAttendances,distributions,
    attendanceCounts,unassignedAttendances,nonSubscriberAttendances,unverifiedAttendances,
    paymentCount: receipts.length, refundCount: refunds.length, unassignedCount, percent,
    receipts, refunds,
    // Compatibilidade temporária com consumidores anteriores; a regra fixa foi desativada.
    invalidShares: false,
  };
}
