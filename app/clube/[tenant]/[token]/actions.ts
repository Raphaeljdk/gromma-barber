'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { readWorkspace } from '@/lib/erp-workspace';
import { registerClubMember } from '@/lib/club-operations';
import { findValidInvite } from '@/lib/club-invite';
export async function purchaseClubPlan(tenant: string, token: string, form: FormData) {
  const path = `/clube/${encodeURIComponent(tenant)}/${encodeURIComponent(token)}`;
  try {
    if (form.get('accept') !== 'on') throw new Error('Confirme a contratação');
    await prisma.$transaction(async tx => {
      const shop = await tx.barberShop.findUnique({ where: { tenantCode: tenant.toUpperCase() } });
      if (!shop || shop.status !== 'APPROVED' || !shop.accessReleased) throw new Error('Indisponível');
      const invite = findValidInvite(readWorkspace(shop.enabledFeatures).clubInvites, token);
      if (!invite) throw new Error('Convite expirado ou utilizado');
      await registerClubMember(tx, shop.id, invite.customerId, String(form.get('planId') ?? '').slice(0,80),
        String(form.get('sellerId') ?? '').slice(0,80), true, 'CUSTOMER', invite.hash);
    }, { isolationLevel: 'Serializable' });
  } catch { redirect(`${path}?erro=contratacao`); }
  revalidatePath(`/erp/${encodeURIComponent(tenant.toUpperCase())}`, 'layout');
  redirect(`${path}?ok=contratado`);
}
