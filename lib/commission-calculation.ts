import { Prisma, type PrismaClient } from "@prisma/client";
import type { ErpWorkspace } from "./erp-workspace";

/** Serviço elegível: item de serviço de comanda fechada, atribuído a um profissional. */
export async function calculateCommission(prisma: PrismaClient | Prisma.TransactionClient, shopId: string, userId: string, start: Date, endExclusive: Date, defaultPercent: number, professionalPercent: number, overrides: Record<string, number>, deductions: { userId: string; amount: number; createdAt: string }[], options?: { workspace: ErpWorkspace; unitId?: string }) {
  const commands = await prisma.serviceCommand.findMany({
    where: { barberShopId: shopId, status: "CLOSED", closedAt: { gte: start, lt: endExclusive }, ...(options?.unitId ? { unitId: options.unitId } : {}), appointment: { barberId: userId, status: { notIn: ["CANCELED","NO_SHOW"] } } },
    select: { id: true, total: true, closedAt: true, appointment: { select: { serviceId: true } }, items: { select: { id: true, kind: true, total: true, description: true, quantity: true } } },
  });
  let gross = new Prisma.Decimal(0);
  const lines: { commandId: string; itemId: string; category: string; description: string; quantity: number; base: string; percent: number; commission: string }[] = [];
  const categoryTotals = { SERVICE: new Prisma.Decimal(0), PRODUCT: new Prisma.Decimal(0), SUBSCRIPTION: new Prisma.Decimal(0) };
  const receipts = new Map((options?.workspace.commandPayments ?? []).map(p => [p.commandId, p]));
  const serviceLinks = new Map((options?.workspace.serviceLines ?? []).map(l => [l.itemId, l.serviceId]));
  for (const command of commands) {
    const receipt = receipts.get(command.id);
    if (!receipt || !command.closedAt) continue;
    const paidCents = Object.values(receipt.amounts ?? {}).reduce((sum, amount) => sum + (Number.isSafeInteger(amount) && amount >= 0 ? amount : 0), 0);
    if (paidCents !== Math.round(Number(command.total) * 100)) continue;
    const paidAt = new Date(receipt.paidAt);
    if (!Number.isFinite(paidAt.getTime()) || Math.abs(paidAt.getTime() - command.closedAt.getTime()) > 86400000) continue;
    const original = command.items.reduce((sum, item) => sum.plus(new Prisma.Decimal(item.total)), new Prisma.Decimal(0));
    if (original.lte(0)) continue;
    const factor = Prisma.Decimal.min(1, Prisma.Decimal.max(0, new Prisma.Decimal(command.total).div(original)));
    for (const item of command.items) {
      if (item.kind !== "SERVICE" && item.kind !== "PRODUCT") continue;
      const category = item.kind;
      const serviceId = serviceLinks.get(item.id) ?? command.appointment?.serviceId;
      const percent = category === "SERVICE"
        ? (serviceId && Object.hasOwn(overrides, serviceId) ? overrides[serviceId] : professionalPercent)
        : (options?.workspace.professionalExtraRates[userId]?.productPercent ?? 0);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("Invalid commission rate");
      const base = Prisma.Decimal.max(0, new Prisma.Decimal(item.total).mul(factor)).toDecimalPlaces(2);
      const commission = base.mul(percent).div(100).toDecimalPlaces(2);
      gross = gross.plus(commission);
      categoryTotals[category] = categoryTotals[category].plus(commission);
      lines.push({ commandId: command.id, itemId: item.id, category, description: item.description,
        quantity: Number(item.quantity), base: base.toString(), percent, commission: commission.toString() });
    }
  }
  const extraRate = options?.workspace.professionalExtraRates[userId]?.subscriptionPercent ?? 0;
  if (options?.workspace && extraRate > 0) {
    if (!Number.isFinite(extraRate) || extraRate > 100) throw new Error("Invalid subscription rate");
    const workspace = options.workspace;
    const sales = workspace.clubSales.filter(s => s.sellerId === userId);
    const firstCharges = new Map<string, typeof workspace.clubCharges[number]>();
    for (const charge of [...workspace.clubCharges].sort((a,b) => a.periodStart.localeCompare(b.periodStart))) {
      if (!firstCharges.has(charge.memberId)) firstCharges.set(charge.memberId, charge);
    }
    const linked = sales.map(sale => ({ sale, charge: firstCharges.get(sale.memberId) }))
      .filter((entry): entry is { sale: typeof sales[number]; charge: typeof workspace.clubCharges[number] } => Boolean(entry.charge));
    if (linked.length) {
      const paidEntries = await prisma.financialEntry.findMany({
        where: { barberShopId: shopId, id: { in: linked.map(x => x.charge.entryId) },
          type: "RECEIVABLE", status: "PAID", paidAt: { gte: start, lt: endExclusive } },
        select: { id: true, amount: true },
      });
      for (const entry of paidEntries) {
        const match = linked.find(x => x.charge.entryId === entry.id);
        if (!match || workspace.clubRefunds.some(refund => refund.entryId === entry.id && refund.status === "COMPLETED")) continue;
        const base = new Prisma.Decimal(entry.amount);
        const commission = base.mul(extraRate).div(100).toDecimalPlaces(2);
        categoryTotals.SUBSCRIPTION = categoryTotals.SUBSCRIPTION.plus(commission);
        gross = gross.plus(commission);
        lines.push({ commandId: entry.id, itemId: match.sale.id, category: "SUBSCRIPTION",
          description: match.sale.planName, quantity: 1, base: base.toString(),
          percent: extraRate, commission: commission.toString() });
      }
    }
  }
  const deductionTotal = deductions.filter(d => d.userId === userId && new Date(d.createdAt) >= start && new Date(d.createdAt) < endExclusive).reduce((sum, d) => sum.plus(new Prisma.Decimal(d.amount)), new Prisma.Decimal(0));
  return { gross: gross.toDecimalPlaces(2), deductions: deductionTotal.toDecimalPlaces(2), net: Prisma.Decimal.max(0, gross.minus(deductionTotal)).toDecimalPlaces(2), categories: categoryTotals, lines };
}
