import { Prisma, type PrismaClient } from "@prisma/client";

/** Serviço elegível: item de serviço de comanda fechada, atribuído a um profissional. */
export async function calculateCommission(prisma: PrismaClient | Prisma.TransactionClient, shopId: string, userId: string, start: Date, endExclusive: Date, defaultPercent: number, professionalPercent: number, overrides: Record<string, number>, deductions: { userId: string; amount: number; createdAt: string }[]) {
  const commands = await prisma.serviceCommand.findMany({
    where: { barberShopId: shopId, status: "CLOSED", closedAt: { gte: start, lt: endExclusive }, appointment: { barberId: userId } },
    select: { id: true, closedAt: true, appointment: { select: { serviceId: true } }, items: { select: { id: true, kind: true, total: true, description: true } } },
  });
  let gross = new Prisma.Decimal(0);
  const lines: { commandId: string; itemId: string; description: string; base: string; percent: number; commission: string }[] = [];
  for (const command of commands) {
    for (const item of command.items) {
      if (item.kind !== "SERVICE") continue;
      const serviceId = command.appointment?.serviceId;
      const percent = serviceId && Object.hasOwn(overrides, serviceId) ? overrides[serviceId] : professionalPercent;
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("Invalid commission rate");
      const commission = new Prisma.Decimal(item.total).mul(percent).div(100).toDecimalPlaces(2);
      gross = gross.plus(commission);
      lines.push({ commandId: command.id, itemId: item.id, description: item.description, base: item.total.toString(), percent, commission: commission.toString() });
    }
  }
  const deductionTotal = deductions.filter(d => d.userId === userId && new Date(d.createdAt) >= start && new Date(d.createdAt) < endExclusive).reduce((sum, d) => sum.plus(new Prisma.Decimal(d.amount)), new Prisma.Decimal(0));
  return { gross: gross.toDecimalPlaces(2), deductions: deductionTotal.toDecimalPlaces(2), net: Prisma.Decimal.max(0, gross.minus(deductionTotal)).toDecimalPlaces(2), lines };
}
