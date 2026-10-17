export const PAYMENT_METHODS = ["CASH", "DEBIT", "CREDIT", "PIX"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export const PAYMENT_LABELS: Record<PaymentMethod, string> = { CASH: "Dinheiro", DEBIT: "Débito", CREDIT: "Crédito", PIX: "Pix" };
export type CashSession = { id: string; unitId: string; unitName: string; openedAt: string; openedBy: string; openingCents: number; closedAt?: string; closedBy?: string; counted?: Record<PaymentMethod, number>; note?: string };
export type CommandPayment = { id: string; commandId: string; sessionId: string; customerName: string; paidAt: string; amounts: Record<PaymentMethod, number>; couponCode?: string; discountCents?: number; manualDiscountCents?: number };
export type BookedServices = { appointmentId: string; services: { id: string; name: string; price: number; durationMinutes: number }[] };
export function cents(value: unknown): number {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(raw)) throw new Error("Informe um valor válido com até duas casas decimais.");
  const [whole, fraction = ""] = raw.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function paymentAmounts(form: FormData): Record<PaymentMethod, number> {
  return Object.fromEntries(PAYMENT_METHODS.map(method => [method, cents(form.get(method) || "0")])) as Record<PaymentMethod, number>;
}
export function validatePayments(amounts: Record<PaymentMethod, number>, total: number) {
  if (PAYMENT_METHODS.reduce((sum, method) => sum + amounts[method], 0) !== total) throw new Error("A soma dos pagamentos deve ser igual ao total da comanda.");
}
export function sessionTotals(session: CashSession, payments: CommandPayment[]): Record<PaymentMethod, number> {
  const totals = { CASH: session.openingCents, DEBIT: 0, CREDIT: 0, PIX: 0 };
  for (const payment of payments) if (payment.sessionId === session.id) for (const method of PAYMENT_METHODS) totals[method] += payment.amounts[method];
  return totals;
}
export function whatsappWaitlist(phone: string, name: string, service: string) {
  let number = phone.replace(/\D/g, "");
  if (number.length === 10 || number.length === 11) number = `55${number}`;
  if (!/^[1-9]\d{11,14}$/.test(number)) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(`Olá, ${name}! Surgiu uma possibilidade de encaixe para ${service}. Podemos combinar o horário por aqui?`)}`;
}

/**
 * Prepara uma mensagem no WhatsApp sem disparar mensagens automaticamente.
 * Somente números brasileiros válidos são aceitos, evitando links incorretos.
 */
export function whatsappAppointmentConfirmation(
  phone: string,
  customerName: string,
  serviceName: string,
  startsAt: string,
): string | null {
  let number = phone.replace(/\D/g, "");
  if (number.length === 10 || number.length === 11) number = "55" + number;
  if (!/^55\d{10,11}$/.test(number)) return null;
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return null;
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(start);
  const message = `Olá, ${customerName}! Tudo bem? Gostaríamos de confirmar seu agendamento de ${serviceName} para ${date} às ${time}. Pode confirmar sua presença por aqui?`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}


export type CheckoutCoupon = { code: string; kind: "PERCENT" | "FIXED"; value: number; expiresAt: string | null; active: boolean };
export type CheckoutDiscountInput = {
  kind: "NONE" | "PERCENT" | "FIXED"; scope: "ORDER" | "ITEM";
  itemId: string; value: string; couponCode: string;
};
export type AppliedItemDiscount = { itemId: string; kind: "PERCENT" | "FIXED"; value: string };
export function parseAppliedItemDiscounts(raw: string): AppliedItemDiscount[] {
  if (raw.length > 4000) throw new Error("Muitos descontos.");
  let data: unknown;
  try { data = JSON.parse(raw || "[]"); } catch { throw new Error("Descontos inválidos."); }
  if (!Array.isArray(data) || data.length > 50) throw new Error("Quantidade de descontos inválida.");
  return data.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") throw new Error("Desconto inválido.");
    const d = entry as Record<string, unknown>;
    if (typeof d.itemId !== "string" || d.itemId.length > 100 || !["PERCENT","FIXED"].includes(String(d.kind)) || typeof d.value !== "string" || d.value.length > 20)
      throw new Error("Desconto inválido.");
    return { itemId: d.itemId, kind: d.kind as "PERCENT" | "FIXED", value: d.value };
  });
}
export function calculateAppliedItemDiscounts(items: CheckoutPricingLine[], discounts: AppliedItemDiscount[]) {
  const totals = new Map(items.map(item => [item.id, Math.round(item.total * 100)]));
  const deductions = new Map<string, number>();
  for (const d of discounts) {
    const base = totals.get(d.itemId);
    if (base === undefined) throw new Error("O item com desconto não está mais na comanda.");
    const used = deductions.get(d.itemId) ?? 0;
    let amount: number;
    if (d.kind === "FIXED") amount = cents(d.value);
    else {
      if (!/^\\d{1,3}([.,]\\d{1,2})?$/.test(d.value)) throw new Error("Percentual inválido.");
      const rate = Math.round(Number(d.value.replace(",", ".")) * 100);
      if (rate <= 0 || rate > 10000) throw new Error("Percentual fora do limite.");
      amount = Math.round(base * rate / 10000);
    }
    if (amount <= 0 || used + amount > base) throw new Error("O desconto supera o valor do item.");
    deductions.set(d.itemId, used + amount);
  }
  return deductions;
}
export type CheckoutPricingLine = { id: string; total: number };
export function calculateCheckoutPricing(
  items: CheckoutPricingLine[], existingDiscountCents: number,
  input: CheckoutDiscountInput, coupons: CheckoutCoupon[], now = new Date(), appliedItemDiscounts: AppliedItemDiscount[] = [],
) {
  const subtotalCents = items.reduce((total, item) => total + Math.round(item.total * 100), 0);
  if (subtotalCents < 0 || !Number.isSafeInteger(subtotalCents)) throw new Error("Subtotal inválido.");
  const appliedCents = [...calculateAppliedItemDiscounts(items, appliedItemDiscounts).values()].reduce((a,b) => a+b,0);
  let manualCents = 0;
  let legacyCents = 0;
  if (input.kind === "NONE") {
    if (input.value.trim()) throw new Error("Tipo de desconto inválido.");
    if (!Number.isInteger(existingDiscountCents) || existingDiscountCents < 0 || existingDiscountCents > subtotalCents)
      throw new Error("Desconto antigo inválido.");
    legacyCents = existingDiscountCents;
  } else {
    const base = input.scope === "ITEM"
      ? items.find(item => item.id === input.itemId)
      : { total: subtotalCents / 100 };
    if (!base) throw new Error("Selecione um item válido para o desconto.");
    const baseCents = Math.round(base.total * 100);
    if (input.kind === "FIXED") {
      manualCents = cents(input.value);
    } else {
      if (!/^\d{1,3}([.,]\d{1,2})?$/.test(input.value)) throw new Error("Percentual inválido.");
      const hundredths = Math.round(Number(input.value.replace(",", ".")) * 100);
      if (!Number.isFinite(hundredths) || hundredths > 10000) throw new Error("O desconto máximo é 100%.");
      manualCents = Math.round(baseCents * hundredths / 10000);
    }
    if (manualCents > baseCents) throw new Error("O desconto supera o valor do item ou da comanda.");
  }
  const code = input.couponCode.trim().toUpperCase();
  let couponCents = 0;
  if (code) {
    const coupon = coupons.find(item => item.code.toUpperCase() === code && item.active);
    if (!coupon) throw new Error("Cupom inexistente ou inativo.");
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now.getTime()) throw new Error("Cupom expirado.");
    const available = subtotalCents - manualCents - legacyCents - appliedCents;
    if (coupon.kind === "PERCENT") {
      if (!Number.isFinite(coupon.value) || coupon.value < 0 || coupon.value > 100) throw new Error("Cupom inválido.");
      couponCents = Math.round(available * coupon.value / 100);
    } else {
      if (!Number.isFinite(coupon.value) || coupon.value < 0) throw new Error("Cupom inválido.");
      couponCents = Math.round(coupon.value * 100);
    }
    if (couponCents > available) throw new Error("Cupom supera o valor restante da comanda.");
  }
  const discountCents = legacyCents + manualCents + appliedCents + couponCents;
  const totalCents = subtotalCents - discountCents;
  if (totalCents <= 0) throw new Error("O total precisa ser maior que zero para registrar um recebimento.");
  return { subtotalCents, manualCents, couponCents, discountCents, totalCents, couponCode: code };
}

/** Reconciles the agenda's reserved service duration with the command's service lines.
 * Product lines never occupy barber time. Legacy command items can be identified
 * by their immutable item description and price, with the saved booking as fallback.
 */
export function servicesFromCommandLines(
  items: { id: string; kind: string; description: string; unitPrice: number; quantity: number }[],
  catalog: { id: string; name: string; price: number; durationMinutes: number }[],
  lineLinks: { itemId: string; serviceId: string }[],
  booked: BookedServices["services"],
): BookedServices["services"] {
  const result: BookedServices["services"] = [];
  for (const line of items.filter(item => item.kind === "SERVICE")) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 100) throw new Error("Quantidade de serviço inválida.");
    const ref = lineLinks.find(ref => ref.itemId === line.id);
    const service = (ref ? catalog.find(service => service.id === ref.serviceId) : null)
      ?? catalog.find(service => service.name === line.description && Math.round(service.price * 100) === Math.round(line.unitPrice * 100))
      ?? booked.find(service => service.name === line.description && Math.round(service.price * 100) === Math.round(line.unitPrice * 100));
    if (!service || !Number.isSafeInteger(service.durationMinutes) || service.durationMinutes <= 0)
      throw new Error("Não foi possível identificar a duração deste serviço. Atualize o cadastro do serviço antes de alterar a comanda.");
    for (let n = 0; n < line.quantity; n++) result.push({
      id: service.id, name: line.description, price: line.unitPrice, durationMinutes: service.durationMinutes,
    });
  }
  return result;
}
