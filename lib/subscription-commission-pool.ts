import { Prisma, type PrismaClient } from "@prisma/client";
import type { ErpWorkspace } from "./erp-workspace";

/** O pote nunca aceita uma base digitada: somente títulos do clube baixados como PAID.
 * Reembolso confirmado é subtraído no período em que ocorreu, inclusive de cobrança antiga.
 * Um pagamento marcado como PAID manualmente é uma confirmação no ERP, não conciliação bancária.
 */
export async function calculateSubscriptionPot(
  prisma: PrismaClient | Prisma.TransactionClient, shopId: string, workspace: ErpWorkspace,
  start: Date, endExclusive: Date, eligibleProfessionalIds: string[], unitId?: string,
) {
  const chargeByEntry = new Map(workspace.clubCharges.map(c => [c.entryId, c]));
  const ids = [...chargeByEntry.keys()];
  const percent = workspace.subscriptionPot.percent;
  const zero = { paidCents: 0, refundedCents: 0, netCents: 0, potCents: 0,
    assignedCents: 0, remainingCents: 0, paymentCount: 0, refundCount: 0, unassignedCount: 0,
    percent, receipts: [] as { id: string; memberId: string; plan: string; amountCents: number; paidAt: string; unitId: string | null }[],
    refunds: [] as { id: string; amountCents: number; completedAt: string }[],
    distributions: {} as Record<string, { sharePercent: number; amountCents: number }>, invalidShares: false };
  if (!ids.length) return zero;
  const entries = await prisma.financialEntry.findMany({
    where: { barberShopId: shopId, id: { in: ids }, type: "RECEIVABLE",
      category: "Clube de assinaturas", status: "PAID", paidAt: { lt: endExclusive } },
    select: { id: true, amount: true, paidAt: true, unitId: true },
  });
  const receipts: typeof zero.receipts = [];
  const completedRefunds = workspace.clubRefunds.filter(r => r.status === "COMPLETED" && r.completedAt);
  const refundByEntry = new Map(completedRefunds.map(r => [r.entryId, r]));
  const refunds: typeof zero.refunds = [];
  let unassignedCount = 0;
  for (const entry of entries) {
    if (!entry.paidAt || !chargeByEntry.has(entry.id)) continue;
    if (!entry.unitId && entry.paidAt >= start) unassignedCount++;
    if (unitId && entry.unitId !== unitId) continue;
    const amountCents = new Prisma.Decimal(entry.amount).mul(100).toDecimalPlaces(0).toNumber();
    if (!Number.isSafeInteger(amountCents) || amountCents < 0) throw new Error("Valor de recebimento inválido");
    if (entry.paidAt >= start) {
      const charge = chargeByEntry.get(entry.id)!;
      receipts.push({ id: entry.id, memberId: charge.memberId, plan: charge.planName,
        amountCents, paidAt: entry.paidAt.toISOString(), unitId: entry.unitId });
    }
    const refund = refundByEntry.get(entry.id);
    if (refund?.completedAt) {
      const refundDate = new Date(refund.completedAt);
      if (Number.isFinite(refundDate.getTime()) && refundDate >= start && refundDate < endExclusive)
        refunds.push({ id: entry.id, amountCents, completedAt: refundDate.toISOString() });
    }
  }
  receipts.sort((a,b) => b.paidAt.localeCompare(a.paidAt));
  const paidCents=receipts.reduce((sum,r)=>sum+r.amountCents,0);
  const refundedCents=refunds.reduce((sum,r)=>sum+r.amountCents,0);
  const netCents=Math.max(0,paidCents-refundedCents);
  const potCents=Math.round(netCents*percent/100);
  const eligible = new Set(eligibleProfessionalIds);
  const shares=Object.entries(workspace.subscriptionPot.shares).filter(([id])=>eligible.has(id))
    .map(([id,pct])=>({id,pct,points:Math.round(pct*100)})).sort((a,b)=>a.id.localeCompare(b.id));
  const totalPoints=shares.reduce((sum,item)=>sum+item.points,0);
  if (totalPoints>10000) return {...zero,paidCents,refundedCents,netCents,potCents,
    paymentCount:receipts.length,refundCount:refunds.length,unassignedCount,receipts,refunds,
    invalidShares:true};
  const roundedTarget=Math.round(potCents*totalPoints/10000);
  const parts=shares.map(item=>{
    const raw=potCents*item.points/10000;
    return {...item,base:Math.floor(raw),fraction:raw-Math.floor(raw)};
  });
  let remaining=roundedTarget-parts.reduce((sum,item)=>sum+item.base,0);
  const order=[...parts].sort((a,b)=>b.fraction-a.fraction || a.id.localeCompare(b.id));
  const bonus=new Set<string>();
  for(const item of order) { if(remaining<=0) break; bonus.add(item.id); remaining--; }
  const distributions=Object.fromEntries(parts.map(item=>[item.id,{
    sharePercent:item.pct,amountCents:item.base+(bonus.has(item.id)?1:0),
  }])) as Record<string,{sharePercent:number;amountCents:number}>;
  return { paidCents,refundedCents,netCents,potCents,assignedCents:roundedTarget,
    remainingCents:potCents-roundedTarget,paymentCount:receipts.length,refundCount:refunds.length,
    unassignedCount,percent,receipts,refunds,distributions,invalidShares:false };
}
