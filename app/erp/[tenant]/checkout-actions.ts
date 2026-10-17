"use server";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readWorkspace, writeWorkspace, workspaceId } from "@/lib/erp-workspace";
import { cents, paymentAmounts, PAYMENT_METHODS, PAYMENT_LABELS, validatePayments, sessionTotals, calculateCheckoutPricing, type CheckoutDiscountInput } from "@/lib/checkout";
import type { Prisma } from "@prisma/client";

const value = (f: FormData, key: string) => String(f.get(key) ?? "").trim().slice(0, 200);
class OperationError extends Error {}
async function run(form: FormData, module: "caixa" | "comandas", operation: (tx: Prisma.TransactionClient, shopId: string, actor: string) => Promise<void>) {
  const tenant = value(form, "tenantCode").toUpperCase();
  const viewer = await requireTenantAccess(tenant);
  const path = `/erp/${encodeURIComponent(tenant)}/${module}`;
  if (viewer.type !== "ADMIN" && !["OWNER", "MANAGER", "RECEPTIONIST", "BARBER", ...(module === "caixa" ? ["ACCOUNTANT"] : [])].includes(viewer.role)) redirect(`${path}?erro=permissao`);
  let error = "";
  try {
    await prisma.$transaction(async tx => {
      const shop = await tx.barberShop.findUnique({ where: { tenantCode: tenant } });
      if (!shop || shop.status !== "APPROVED" || !shop.accessReleased || (viewer.type === "TENANT" && viewer.barberShopId !== shop.id)) throw new OperationError("Acesso indisponível.");
      await operation(tx, shop.id, viewer.type === "ADMIN" ? "Administrador" : viewer.userId);
    }, { isolationLevel: "Serializable" });
  } catch (e) {
    error = e instanceof OperationError ? e.message : "Não foi possível salvar. Atualize a página e confira os valores, o estoque e se a comanda e o caixa continuam abertos.";
    if (!(e instanceof OperationError)) console.error("Checkout operation failed", e);
  }
  revalidatePath(`/erp/${encodeURIComponent(tenant)}`, "layout");
  const command = module === "comandas" ? `&commandId=${encodeURIComponent(value(form, "commandId"))}` : "";
  if (module === "comandas" && value(form, "agendaReturn") === "1") {
    const appointment = encodeURIComponent(value(form, "appointmentId"));
    const agendaDate = encodeURIComponent(value(form, "agendaDate"));
    const filters = new URLSearchParams();
    for (const key of ["agendaView", "agendaUnit", "agendaProfessional", "agendaClient"]) {
      if (value(form, key)) filters.set(key, value(form, key));
    }
    redirect(`/erp/${encodeURIComponent(tenant)}/agenda?${error ? `checkoutError=${encodeURIComponent(error)}` : "checkoutOk=1"}&appointmentId=${appointment}&agendaDate=${agendaDate}&${filters.toString()}`);
  }
  redirect(`${path}?${error ? `checkoutError=${encodeURIComponent(error)}` : "checkoutOk=1"}${command}`);
}
async function configuration(tx: Prisma.TransactionClient, shopId: string) {
  const shop = await tx.barberShop.findUniqueOrThrow({ where: { id: shopId } });
  return { shop, workspace: readWorkspace(shop.enabledFeatures) };
}
export async function openCash(form: FormData) {
  return run(form, "caixa", async (tx, shopId, actor) => {
    const unit = await tx.barberShopUnit.findFirst({ where: { id: value(form, "unitId"), barberShopId: shopId, active: true } });
    if (!unit) throw new OperationError("Selecione uma unidade ativa.");
    const { shop, workspace } = await configuration(tx, shopId);
    if (workspace.cashSessions.some(s => s.unitId === unit.id && !s.closedAt)) throw new OperationError("Esta unidade já possui um caixa aberto.");
    workspace.cashSessions.push({ id: workspaceId("cash"), unitId: unit.id, unitName: unit.name, openedAt: new Date().toISOString(), openedBy: actor, openingCents: cents(form.get("opening")) });
    await tx.barberShop.update({ where: { id: shopId }, data: { enabledFeatures: writeWorkspace(shop.enabledFeatures, workspace) } });
  });
}
export async function closeCash(form: FormData) {
  return run(form, "caixa", async (tx, shopId, actor) => {
    const { shop, workspace } = await configuration(tx, shopId);
    const session = workspace.cashSessions.find(s => s.id === value(form, "sessionId") && !s.closedAt);
    if (!session) throw new OperationError("Este caixa já foi fechado ou não existe.");
    const payments = workspace.commandPayments.filter(p => p.sessionId === session.id);
    if (String(payments.length) !== value(form, "paymentCount")) throw new OperationError("Entraram novos pagamentos. Atualize e confira o caixa novamente.");
    const counted = paymentAmounts(form), expected = sessionTotals(session, payments);
    if (PAYMENT_METHODS.some(m => expected[m] !== counted[m]) && !value(form, "note")) throw new OperationError("Descreva o motivo da diferença antes de fechar o caixa.");
    Object.assign(session, { closedAt: new Date().toISOString(), closedBy: actor, counted, note: value(form, "note") });
    await tx.barberShop.update({ where: { id: shopId }, data: { enabledFeatures: writeWorkspace(shop.enabledFeatures, workspace) } });
  });
}
export async function addCommandItem(form: FormData) {
  return run(form, "comandas", async (tx, shopId) => {
    const command = await tx.serviceCommand.findFirst({ where: { id: value(form, "commandId"), barberShopId: shopId, status: "OPEN" } });
    if (!command) throw new OperationError("A comanda não está aberta.");
    const quantity = Number(value(form, "quantity"));
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new OperationError("Informe uma quantidade entre 1 e 100.");
    const [kind, id] = value(form, "catalogItem").split(":");
    const service = kind === "SERVICE" ? await tx.service.findFirst({ where: { id, barberShopId: shopId, active: true } }) : null;
    const product = kind === "PRODUCT" ? await tx.product.findFirst({ where: { id, barberShopId: shopId, active: true } }) : null;
    const catalog = service || product;
    if (!catalog) throw new OperationError("Selecione um serviço ou produto ativo.");
    const price = cents(service ? service.price : product!.salePrice);
    const item = await tx.commandItem.create({ data: { commandId: command.id, kind, description: catalog.name, quantity, unitPrice: price / 100, total: price * quantity / 100 } });
    if (product) {
      const { shop, workspace } = await configuration(tx, shopId);
      workspace.productLines.push({ itemId: item.id, productId: product.id });
      await tx.barberShop.update({ where: { id: shopId }, data: { enabledFeatures: writeWorkspace(shop.enabledFeatures, workspace) } });
    }
    const subtotal = cents(command.subtotal) + price * quantity;
    await tx.serviceCommand.update({ where: { id: command.id }, data: { subtotal: subtotal / 100, total: Math.max(0, subtotal - cents(command.discount)) / 100 } });
  });
}
export async function removeCommandItem(form: FormData) {
  return run(form, "comandas", async (tx, shopId) => {
    const command = await tx.serviceCommand.findFirst({ where: { id: value(form, "commandId"), barberShopId: shopId, status: "OPEN" }, include: { items: true } });
    const item = command?.items.find(i => i.id === value(form, "itemId"));
    if (!command || !item) throw new OperationError("Item indisponível nesta comanda aberta.");
    const subtotal = command.items.filter(i => i.id !== item.id).reduce((sum, i) => sum + cents(i.total), 0);
    if (subtotal < cents(command.discount)) throw new OperationError("O desconto da comanda supera o valor restante.");
    await tx.commandItem.delete({ where: { id: item.id } });
    const { shop, workspace } = await configuration(tx, shopId);
    workspace.productLines = workspace.productLines.filter(line => line.itemId !== item.id);
    await tx.barberShop.update({ where: { id: shopId }, data: { enabledFeatures: writeWorkspace(shop.enabledFeatures, workspace) } });
    await tx.serviceCommand.update({ where: { id: command.id }, data: { subtotal: subtotal / 100, total: (subtotal - cents(command.discount)) / 100 } });
  });
}
export async function checkoutCommand(form: FormData) {
  return run(form, "comandas", async (tx, shopId) => {
    const command = await tx.serviceCommand.findFirst({ where: { id: value(form, "commandId"), barberShopId: shopId, status: "OPEN" }, include: { items: true, customer: true } });
    if (!command) throw new OperationError("Esta comanda já foi fechada ou não existe.");
    const { shop, workspace } = await configuration(tx, shopId);
    const session = workspace.cashSessions.find(s => s.unitId === command.unitId && !s.closedAt);
    if (!session || session.id !== value(form, "sessionId")) throw new OperationError("Abra o caixa desta unidade e atualize a comanda antes do checkout.");
    const storedTotal = cents(command.total);
    const subtotal = command.items.reduce((sum, item) => sum + cents(item.total), 0);
    if (subtotal - cents(command.discount) !== storedTotal) throw new OperationError("Os valores da comanda mudaram. Atualize antes de receber.");
    const kind = value(form, "discountKind") || "NONE", scope = value(form, "discountScope") || "ORDER";
    if (!["NONE", "PERCENT", "FIXED"].includes(kind) || !["ORDER", "ITEM"].includes(scope))
      throw new OperationError("Tipo ou abrangência de desconto inválidos.");
    const discountInput: CheckoutDiscountInput = {
      kind: kind as CheckoutDiscountInput["kind"],
      scope: scope as CheckoutDiscountInput["scope"],
      itemId: value(form, "discountItemId"),
      value: value(form, "discountValue"),
      couponCode: value(form, "couponCode"),
    };
    let pricing;
    try {
      pricing = calculateCheckoutPricing(
        command.items.map(item => ({ id: item.id, total: Number(item.total) })),
        cents(command.discount), discountInput, workspace.coupons, new Date(),
      );
    } catch (e) { throw new OperationError(e instanceof Error ? e.message : "Desconto inválido."); }
    if (String(pricing.totalCents) !== value(form, "expectedTotal") || pricing.subtotalCents !== subtotal)
      throw new OperationError("O desconto ou os itens mudaram. Atualize e confira o pagamento.");
    const amounts = paymentAmounts(form);
    try { validatePayments(amounts, pricing.totalCents); }
    catch { throw new OperationError("A soma dos pagamentos deve ser igual ao total com desconto."); }
    const productQuantities = new Map<string, number>();
    for (const item of command.items.filter(i => i.kind === "PRODUCT")) {
      const reference = workspace.productLines.find(line => line.itemId === item.id);
      if (!reference) throw new OperationError("Produto antigo sem vínculo de estoque. Remova e inclua novamente antes do checkout.");
      productQuantities.set(reference.productId, (productQuantities.get(reference.productId) ?? 0) + Number(item.quantity));
    }
    for (const [productId, quantity] of productQuantities) {
      const movements = await tx.stockMovement.groupBy({ by: ["type"], where: { productId, barberShopId: shopId, unitId: command.unitId }, _sum: { quantity: true } });
      const available = movements.reduce((sum, m) => sum + (m.type === "OUT" ? -1 : 1) * Number(m._sum.quantity ?? 0), 0);
      if (available < quantity) throw new OperationError("Estoque insuficiente na unidade. Confira os produtos antes de fechar.");
      await tx.stockMovement.create({ data: { barberShopId: shopId, unitId: command.unitId, productId, type: "OUT", quantity, reason: `Checkout ${command.id}` } });
    }
    const now = new Date();
    const updated = await tx.serviceCommand.updateMany({ where: { id: command.id, barberShopId: shopId, status: "OPEN", updatedAt: command.updatedAt }, data: { status: "CLOSED", closedAt: now, subtotal: pricing.subtotalCents / 100, discount: pricing.discountCents / 100, total: pricing.totalCents / 100 } });
    if (updated.count !== 1) throw new OperationError("A comanda mudou. Atualize e confira novamente.");
    for (const method of PAYMENT_METHODS) if (amounts[method] > 0) await tx.financialEntry.create({ data: { barberShopId: shopId, unitId: command.unitId, type: "RECEIVABLE", status: "PAID", category: "Comandas", description: `Comanda ${command.id.slice(-6).toUpperCase()} · ${PAYMENT_LABELS[method]}`, amount: amounts[method] / 100, dueDate: now, paidAt: now } });
    workspace.commandPayments.push({ id: workspaceId("payment"), commandId: command.id, sessionId: session.id, customerName: command.customer?.name ?? "Cliente avulso", paidAt: now.toISOString(), amounts,
      couponCode: pricing.couponCode || undefined, discountCents: pricing.discountCents,
      manualDiscountCents: pricing.manualCents });
    await tx.barberShop.update({ where: { id: shopId }, data: { enabledFeatures: writeWorkspace(shop.enabledFeatures, workspace) } });
    if (command.appointmentId) await tx.appointment.updateMany({ where: { id: command.appointmentId, barberShopId: shopId, status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_SERVICE"] } }, data: { status: "COMPLETED" } });
  });
}
