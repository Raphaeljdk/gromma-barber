"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { calculateCommission } from "@/lib/commission-calculation";
import { calculateSubscriptionPot } from "@/lib/subscription-commission-pool";
import { isDate } from "@/lib/professional-profile";

const raw = (f: FormData, key: string, limit = 160) => String(f.get(key) ?? "").trim().slice(0, limit);
const money = (cents: number) => new Prisma.Decimal(cents).div(100);
const dateUTC = (s: string) => new Date(s + "T00:00:00.000Z");

class PaymentError extends Error {}

/**
 * Registra a baixa administrativa de comissões já efetivamente pagas.
 * NÃO envia Pix ou transferência. Recalcula tudo no servidor e salva
 * um snapshot imutável, saída financeira e auditoria na mesma transação.
 */
export async function recordCommissionPayments(form: FormData) {
  const tenant = raw(form, "tenantCode", 80).toUpperCase();
  const redirectTo = "/erp/" + encodeURIComponent(tenant) + "/comissoes";
  let error: string | null = null;
  let paidCount = 0;
  const startText = raw(form, "start", 10);
  const endText = raw(form, "end", 10);
  const query = new URLSearchParams();
  if (isDate(startText)) query.set("comissoesDe", startText);
  if (isDate(endText)) query.set("comissoesAte", endText);
  try {
    if (process.env.COMMISSION_PAYMENTS_ENABLED !== "true")
      throw new PaymentError("O fechamento financeiro de comissões ainda não foi habilitado.");
    const viewer = await requireTenantAccess(tenant);
    const shop = await prisma.barberShop.findUnique({
      where: { tenantCode: tenant },
      select: { id: true, tradeName: true, status: true, accessReleased: true },
    });
    if (!shop || shop.status !== "APPROVED" || !shop.accessReleased ||
      (viewer.type !== "ADMIN" && (viewer.type !== "TENANT" ||
        viewer.barberShopId !== shop.id || viewer.role !== "OWNER")))
      throw new PaymentError("Apenas o proprietário autorizado pode registrar uma quitação.");
    if (!isDate(startText) || !isDate(endText) || startText > endText)
      throw new PaymentError("Período de comissões inválido.");
    const start = new Date(startText + "T00:00:00-03:00");
    const endExclusive = new Date(new Date(endText + "T00:00:00-03:00").getTime() + 86400000);
    const localToday = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    if (endExclusive.getTime() - start.getTime() > 366 * 86400000 || endText >= localToday)
      throw new PaymentError("Selecione um período de até 366 dias já encerrado (até ontem).");
    const paidDate = raw(form, "paidDate", 10);
    if (!isDate(paidDate) || paidDate > localToday)
      throw new PaymentError("Informe a data real do pagamento, sem datas futuras.");
    const method = raw(form, "paymentMethod", 20);
    if (!["PIX", "DINHEIRO", "TRANSFERENCIA", "DEBITO", "CREDITO", "OUTRO"].includes(method))
      throw new PaymentError("Forma de pagamento inválida.");
    if (raw(form, "confirmPaid", 8) !== "sim")
      throw new PaymentError("Confirme que o dinheiro já foi entregue ao profissional.");
    const ids = raw(form, "userIds", 3000).split(",").map(x => x.trim()).filter(Boolean);
    if (!ids.length || ids.length > 50 || new Set(ids).size !== ids.length ||
      ids.some(id => !/^[a-zA-Z0-9_-]{5,80}$/.test(id)))
      throw new PaymentError("Selecione de 1 a 50 profissionais válidos.");
    const declaredCents = Number(raw(form, "expectedTotalCents", 18));
    if (!Number.isSafeInteger(declaredCents) || declaredCents <= 0)
      throw new PaymentError("Atualize os valores da apuração antes de registrar.");
    await prisma.$transaction(async tx => {
      const currentShop = await tx.barberShop.findUniqueOrThrow({ where: { id: shop.id } });
      const ws = readWorkspace(currentShop.enabledFeatures);
      const users = await tx.shopUser.findMany({
        where: { barberShopId: shop.id, id: { in: ids }, role: { in: ["OWNER", "MANAGER", "BARBER"] } },
        select: { id: true, name: true },
      });
      if (users.length !== ids.length) throw new PaymentError("Profissional de outra empresa ou não elegível.");
      const eligible = await tx.shopUser.findMany({
        where: { barberShopId: shop.id, role: { in: ["OWNER", "MANAGER", "BARBER"] } },
        select: { id: true },
      });
      const pot = await calculateSubscriptionPot(tx, shop.id, ws, start, endExclusive, eligible.map(u => u.id));
      // Não permitir quitação parcial do pote antes de conferir rateio e origem.
      if (pot.remainingCents > 0 || pot.unassignedAttendances > 0)
        throw new PaymentError("Confira o pote de assinaturas: há valores ou atendimentos sem distribuição.");
      let calculatedCents = 0;
      const prepared: Array<{user: typeof users[number]; grossCents: number;
        deductionsCents: number; netCents: number; breakdown: Prisma.InputJsonValue}> = [];
      for (const user of users) {
        const overlap = await tx.commissionPayment.findFirst({
          where: { barberShopId: shop.id, userId: user.id,
            periodStart: { lte: dateUTC(endText) }, periodEnd: { gte: dateUTC(startText) } },
          select: { id: true },
        });
        if (overlap) throw new PaymentError("Já existe pagamento de período sobreposto para " + user.name + ".");
        const pct = ws.commissionRules.find(r => r.userId === user.id)?.percent ??
          ws.settings.defaultCommissionPercent;
        const commission = await calculateCommission(tx, shop.id, user.id, start, endExclusive,
          ws.settings.defaultCommissionPercent, pct, ws.serviceCommissionOverrides, ws.deductions,
          { workspace: ws });
        const potCents = pot.distributions[user.id]?.amountCents ?? 0;
        const grossCents = Math.round(Number(commission.gross) * 100) + potCents;
        const deductionsCents = Math.round(Number(commission.deductions) * 100);
        const netCents = Math.max(0, grossCents - deductionsCents);
        if (netCents <= 0) throw new PaymentError("O profissional " + user.name + " não tem saldo positivo.");
        if (![grossCents, deductionsCents, netCents].every(Number.isSafeInteger))
          throw new PaymentError("Valor financeiro fora da faixa segura.");
        calculatedCents += netCents;
        prepared.push({user, grossCents, deductionsCents, netCents,
          breakdown: { lines: commission.lines, potCents,
            potAttendances: pot.distributions[user.id]?.attendances ?? 0,
            potSharePercent: pot.distributions[user.id]?.sharePercent ?? 0,
            receipts: pot.receipts.map(r => r.id),
            origin: "apuracao-confirmada", schemaVersion: 1 } as Prisma.InputJsonValue});
      }
      // A pessoa pode ter atualizado percentuais, comandas ou deduções após abrir a tela.
      if (calculatedCents !== declaredCents)
        throw new PaymentError("A apuração mudou. Atualize a página e confira os valores antes de pagar.");
      for (const item of prepared) {
        const receipt = await tx.commissionPayment.create({ data: {
          barberShopId: shop.id, userId: item.user.id, periodStart: dateUTC(startText),
          periodEnd: dateUTC(endText), gross: money(item.grossCents),
          deductions: money(item.deductionsCents), net: money(item.netCents),
          breakdown: item.breakdown, paymentMethod: method,
          paidAt: new Date(paidDate + "T12:00:00-03:00"), paidBy: viewer.email,
        } });
        const expense = await tx.financialEntry.create({ data: {
          barberShopId: shop.id, unitId: null, type: "PAYABLE", status: "PAID",
          category: "Comissões", description: "Comissão paga · " + item.user.name + " · " + receipt.id,
          amount: money(item.netCents), paidAt: receipt.paidAt, dueDate: receipt.paidAt,
        } });
        await tx.adminAuditLog.create({ data: {
          barberShopId: shop.id, adminEmail: viewer.email, action: "COMMISSION_PAYMENT_RECORDED",
          details: { receiptId: receipt.id, financialEntryId: expense.id,
            userId: item.user.id, periodStart: startText, periodEnd: endText,
            netCents: item.netCents, method, recordedAs: "MANUAL_CONFIRMED" },
        } });
      }
      paidCount = prepared.length;
    }, { isolationLevel: "Serializable", timeout: 25000 });
  } catch (e) {
    console.error("Commission manual payment record failed", e);
    error = e instanceof PaymentError ? e.message :
      "Não foi possível registrar a quitação. Verifique pagamentos anteriores ou tente novamente após atualizar.";
  }
  revalidatePath("/erp/" + encodeURIComponent(tenant), "layout");
  if (error) query.set("comissaoPagamentoErro", error);
  else query.set("comissaoPagamentoOk", String(paidCount));
  redirect(redirectTo + "?" + query.toString());
}
