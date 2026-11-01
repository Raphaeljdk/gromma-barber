import type { Prisma } from '@prisma/client';
import { billingDayFromDate, nextMonthlyBillingAt } from './club-billing-date';
import { readWorkspace, writeWorkspace, workspaceId, type ErpWorkspace, type ClubMemberConfig, type ClubPlanConfig } from './erp-workspace';

export async function appendClubCharge(tx: Prisma.TransactionClient, shopId: string, workspace: ErpWorkspace, member: ClubMemberConfig, plan: ClubPlanConfig, name: string, dueDate: Date, periodEnd: Date) {
  const customerUnit = member.unitId === undefined ? (await tx.customer.findFirst({where:{barberShopId:shopId,id:member.customerId},select:{unitId:true}}))?.unitId ?? null : member.unitId;
  const entry = await tx.financialEntry.create({ data: {
    barberShopId: shopId, unitId: customerUnit, type: 'RECEIVABLE', status: 'PENDING', category: 'Clube de assinaturas',
    description: `${plan.name} · ${name}`, amount: plan.monthlyAmount, dueDate,
  } });
  workspace.clubCharges.push({ entryId: entry.id, memberId: member.id, customerId: member.customerId,
    planId: plan.id, planName: plan.name, startedAt: member.startedAt,
    periodStart: dueDate.toISOString(), periodEnd: periodEnd.toISOString() });
  return entry;
}
export async function registerClubMember(tx: Prisma.TransactionClient, shopId: string, customerId: string, planId: string, sellerId: string, chargeNow: boolean, source: 'STAFF' | 'CUSTOMER', inviteHash?: string, regularization?: {reason:string;receiptReference:string;approvedBy:string}) {
  const fresh = await tx.barberShop.findUnique({ where: { id: shopId } });
  if (!fresh || fresh.status !== 'APPROVED' || !fresh.accessReleased) throw new Error('Barbearia indisponível');
  const workspace = readWorkspace(fresh.enabledFeatures);
  const now = new Date();
  const invite = inviteHash ? workspace.clubInvites.find(i => i.hash === inviteHash && i.customerId === customerId) : null;
  if (inviteHash && (!invite || invite.usedAt || new Date(invite.expiresAt) <= now)) throw new Error('Convite inválido');
  const [customer, seller] = await Promise.all([
    tx.customer.findFirst({ where: { id: customerId, barberShopId: shopId, active: true }, select: { id: true, name: true, unitId: true } }),
    sellerId ? tx.shopUser.findFirst({ where: { id: sellerId, barberShopId: shopId, active: true }, select: { id: true, name: true } }) : Promise.resolve(null),
  ]);
  const plan = workspace.clubPlans.find(p => p.id === planId && p.active);
  if (!customer || !plan || (sellerId && !seller)) throw new Error('Cliente, plano ou vendedor inválido');
  if (workspace.clubMembers.some(m => m.customerId === customerId && m.status !== 'CANCELED')) throw new Error('Cliente já possui assinatura');
  const previousBroken = workspace.clubMembers.some(m => m.customerId === customerId && m.brokenAt);
  if (previousBroken && (source !== 'STAFF' || !regularization ||
      regularization.reason.trim().length < 5 || regularization.receiptReference.trim().length < 5 ||
      !regularization.approvedBy.trim()))
    throw new Error('Recontratação após ruptura exige validação administrativa da multa / regularização');
  const billingDay = billingDayFromDate(now);
  const next = nextMonthlyBillingAt(now, billingDay);
  const member: ClubMemberConfig = { id: workspaceId('member'), customerId, planId, unitId: customer.unitId, status: 'ACTIVE', billingDay, startedAt: now.toISOString(), nextBillingAt: next.toISOString() };
  workspace.clubMembers.unshift(member);
  workspace.clubSales.push({ id: workspaceId('sale'), memberId: member.id, customerId, planId, planName: plan.name,
    amount: plan.monthlyAmount, at: now.toISOString(), sellerId: seller?.id ?? null, sellerName: seller?.name ?? 'Sem indicação', source });
  if (chargeNow && plan.monthlyAmount > 0) await appendClubCharge(tx, shopId, workspace, member, plan, customer.name, now, next);
  if (previousBroken && regularization) {
    await tx.adminAuditLog.create({data:{barberShopId:shopId,action:'CLUB_RECONTRACT_AFTER_BREAK',
      adminEmail:regularization.approvedBy,details:{customerId,newMemberId:member.id,
        reason:regularization.reason,receiptReference:regularization.receiptReference,
        previousBrokenMemberIds:workspace.clubMembers.filter(m=>m.customerId===customerId && m.brokenAt).map(m=>m.id)}}});
  }
  if (invite) invite.usedAt = now.toISOString();
  await tx.barberShop.update({ where: { id: shopId }, data: { enabledFeatures: writeWorkspace(fresh.enabledFeatures, workspace) } });
  return member;
}
