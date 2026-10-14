export const PAYMENT_METHODS = ["CASH", "DEBIT", "CREDIT", "PIX"] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export const PAYMENT_LABELS: Record<PaymentMethod, string> = { CASH: "Dinheiro", DEBIT: "Débito", CREDIT: "Crédito", PIX: "Pix" };
export type CashSession = { id: string; unitId: string; unitName: string; openedAt: string; openedBy: string; openingCents: number; closedAt?: string; closedBy?: string; counted?: Record<PaymentMethod, number>; note?: string };
export type CommandPayment = { id: string; commandId: string; sessionId: string; customerName: string; paidAt: string; amounts: Record<PaymentMethod, number> };
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
