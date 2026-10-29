'use server';
import { randomBytes, createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireTenantAccess } from '@/lib/tenant-auth';
import { readWorkspace, writeWorkspace, workspaceId } from '@/lib/erp-workspace';

const value = (form: FormData, key: string, max = 300) => String(form.get(key) ?? '').trim().slice(0, max);
async function context(form: FormData, roles: string[]) {
  const tenantCode = value(form, 'tenantCode', 80).toUpperCase();
  const viewer = await requireTenantAccess(tenantCode);
  const shop = await prisma.barberShop.findUnique({ where: { tenantCode } });
  if (!shop || shop.status !== 'APPROVED' || !shop.accessReleased ||
      (viewer.type !== 'ADMIN' && (viewer.barberShopId !== shop.id || !roles.includes(viewer.role)))) throw new Error('Acesso negado');
  return { shop, tenantCode, viewer };
}
export async function createClubInvite(form: FormData) {
  const { shop, tenantCode } = await context(form, ['OWNER','MANAGER','RECEPTIONIST']);
  const path = `/erp/${encodeURIComponent(tenantCode)}/assinaturas`;
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  try {
    await prisma.$transaction(async tx => {
      const customerId = value(form, 'customerId', 80);
      const customer = await tx.customer.findFirst({ where: { id: customerId, barberShopId: shop.id, active: true }, select: { id: true } });
      const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
      if (!customer || !fresh) throw new Error('Cliente indisponível');
      const workspace = readWorkspace(fresh.enabledFeatures);
      workspace.clubInvites = workspace.clubInvites.filter(i => new Date(i.expiresAt).getTime() > Date.now() && !i.usedAt && i.customerId !== customerId);
      workspace.clubInvites.push({ hash, customerId, expiresAt: new Date(Date.now()+7*86400000).toISOString() });
      await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) } });
    }, { isolationLevel: 'Serializable' });
  } catch { redirect(`${path}?erro=convite`); }
  redirect(`${path}?convite=${token}`);
}
export async function requestClubRefund(form: FormData) {
  const { shop, tenantCode, viewer } = await context(form, ['OWNER','MANAGER','ACCOUNTANT']);
  const path = `/erp/${encodeURIComponent(tenantCode)}/assinaturas-transacoes`;
  try {
    const reason = value(form, 'reason', 600);
    if (reason.length < 5) throw new Error('Informe o motivo');
    await prisma.$transaction(async tx => {
      const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
      const entry = await tx.financialEntry.findFirst({ where: { id: value(form,'entryId',80), barberShopId: shop.id, category: 'Clube de assinaturas', type: 'RECEIVABLE', status: 'PAID' } });
      if (!fresh || !entry) throw new Error('Pagamento indisponível');
      const workspace = readWorkspace(fresh.enabledFeatures);
      if (workspace.clubRefunds.some(r => r.entryId === entry.id)) throw new Error('Estorno já solicitado');
      workspace.clubRefunds.push({ id: workspaceId('refund'), entryId: entry.id, requestedAt: new Date().toISOString(), reason, status: 'REQUESTED' });
      await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) } });
      await tx.adminAuditLog.create({ data: { barberShopId: shop.id, action: 'CLUB_REFUND_REQUESTED', adminEmail: viewer.email, details: { entryId: entry.id, reason } } });
    }, { isolationLevel: 'Serializable' });
  } catch { redirect(`${path}?erro=estorno`); }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, 'layout');
  redirect(`${path}?ok=estorno-solicitado`);
}
export async function confirmClubRefund(form: FormData) {
  const { shop, tenantCode, viewer } = await context(form, ['OWNER','MANAGER','ACCOUNTANT']);
  const path = `/erp/${encodeURIComponent(tenantCode)}/assinaturas-transacoes`;
  try {
    const reference = value(form, 'reference', 200);
    if (value(form,'confirmed') !== 'on' || reference.length < 5) throw new Error('Confirme a devolução realizada e informe o comprovante');
    await prisma.$transaction(async tx => {
      const fresh = await tx.barberShop.findUnique({ where: { id: shop.id } });
      if (!fresh) throw new Error('Barbearia indisponível');
      const workspace = readWorkspace(fresh.enabledFeatures);
      const refund = workspace.clubRefunds.find(r => r.id === value(form,'refundId',80) && r.status === 'REQUESTED');
      if (!refund) throw new Error('Estorno inválido');
      const entry = await tx.financialEntry.findFirst({ where: { id: refund.entryId, barberShopId: shop.id, category: 'Clube de assinaturas', type: 'RECEIVABLE', status: 'PAID' } });
      if (!entry) throw new Error('Pagamento indisponível');
      const now = new Date();
      const expense = await tx.financialEntry.create({ data: { barberShopId: shop.id, unitId: entry.unitId, type: 'PAYABLE', status: 'PAID', category: 'Estorno de assinatura', description: `Estorno de ${entry.id} · ${entry.description}`, amount: entry.amount, paidAt: now, dueDate: now } });
      refund.status = 'COMPLETED'; refund.completedAt = now.toISOString(); refund.expenseId = expense.id;
      await tx.barberShop.update({ where: { id: shop.id }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) } });
      await tx.adminAuditLog.create({ data: { barberShopId: shop.id, action: 'CLUB_REFUND_CONFIRMED', adminEmail: viewer.email, details: { entryId: entry.id, expenseId: expense.id, reference, reason: refund.reason } } });
    }, { isolationLevel: 'Serializable' });
  } catch { redirect(`${path}?erro=estorno`); }
  revalidatePath(`/erp/${encodeURIComponent(tenantCode)}`, 'layout');
  redirect(`${path}?ok=estorno-confirmado`);
}
