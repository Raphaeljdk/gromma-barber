'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { readWorkspace, writeWorkspace, workspaceId } from '@/lib/erp-workspace';
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


/** Avaliação feita no acesso individual enviado ao cliente cadastrado. */
export async function saveInvitedCustomerReview(tenant: string, token: string, form: FormData) {
  const path = "/clube/" + encodeURIComponent(tenant) + "/" + encodeURIComponent(token);
  const appointmentId = String(form.get("appointmentId") ?? "").slice(0,100);
  const rawScore = Number(form.get("score"));
  const score = Number.isInteger(rawScore) ? rawScore : 0;
  const comment = String(form.get("comment") ?? "").trim().slice(0,700);
  if (!appointmentId || score < 1 || score > 5) redirect(path + "?erro=avaliacao");

  try {
    await prisma.$transaction(async tx => {
      const shop = await tx.barberShop.findUnique({where:{tenantCode:tenant.toUpperCase()}});
      if (!shop || shop.status !== "APPROVED" || !shop.accessReleased) throw new Error("Shop unavailable");
      const workspace = readWorkspace(shop.enabledFeatures);
      const invite = findValidInvite(workspace.clubInvites,token);
      if (!invite) throw new Error("Invalid personal link");
      const customer = await tx.customer.findFirst({where:{
        id:invite.customerId,barberShopId:shop.id,active:true,
      },select:{id:true,name:true}});
      if (!customer) throw new Error("Customer not found");
      const visit = await tx.appointment.findFirst({where:{
        id:appointmentId,customerId:customer.id,barberShopId:shop.id,status:"COMPLETED",
      },select:{id:true,barber:{select:{name:true}}}});
      if (!visit || workspace.reviews.some(item=>item.appointmentId===visit.id))
        throw new Error("Appointment invalid or already rated");
      const at = new Date().toISOString();
      workspace.reviews.unshift({
        id:workspaceId("review"), customerId:customer.id, appointmentId:visit.id,
        customerName:customer.name,professionalName:visit.barber?.name??"Profissional não informado",
        score,comment,source:"CUSTOMER_LINK",verifiedAt:at,createdAt:at,
      });
      await tx.barberShop.update({where:{id:shop.id},data:{
        enabledFeatures:writeWorkspace(shop.enabledFeatures,workspace),
      }});
      await tx.adminAuditLog.create({data:{
        barberShopId:shop.id,action:"CUSTOMER_REVIEW_CREATED",adminEmail:"CLIENT_SELF_SERVICE",
        details:{customerId:customer.id,appointmentId:visit.id,score,source:"CUSTOMER_LINK"},
      }});
    },{isolationLevel:"Serializable"});
  } catch(error) {
    console.error("Customer review not accepted",error);
    redirect(path + "?erro=avaliacao");
  }
  revalidatePath("/erp/" + encodeURIComponent(tenant.toUpperCase()) + "/avaliacoes");
  redirect(path + "?ok=avaliacao");
}
