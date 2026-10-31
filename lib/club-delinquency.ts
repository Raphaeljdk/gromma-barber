import type { Prisma } from "@prisma/client";
import { workspaceId, type ErpWorkspace } from "./erp-workspace";

/** Rompimento exige primeiro ciclo pago e duas cobranças mensais consecutivas vencidas e não pagas.
 * A multa não é gerada antes de o contrato definir seu valor.
 */
export async function reconcileClubRuptures(
  tx: Prisma.TransactionClient, shopId: string, workspace: ErpWorkspace, now: Date,
): Promise<number> {
  const ids = [...new Set(workspace.clubCharges.map(c=>c.entryId))];
  if(!ids.length) return 0;
  const entries=await tx.financialEntry.findMany({
    where:{barberShopId:shopId,id:{in:ids},type:"RECEIVABLE",category:"Clube de assinaturas"},
    select:{id:true,status:true,dueDate:true},
  });
  const byId=new Map(entries.map(e=>[e.id,e]));
  let count=0;
  for(const member of workspace.clubMembers) {
    if(member.status==="CANCELED" || member.brokenAt) continue;
    const cycles=workspace.clubCharges.filter(c=>c.memberId===member.id)
      .sort((a,b)=>a.periodStart.localeCompare(b.periodStart));
    if(cycles.length<3 || byId.get(cycles[0].entryId)?.status!=="PAID") continue;
    const pastDue=cycles.slice(1).filter(c=>{
      const entry=byId.get(c.entryId);
      return entry?.dueDate && entry.dueDate.getTime()<=now.getTime();
    });
    if(pastDue.length<2) continue;
    const lastTwo=pastDue.slice(-2);
    if(lastTwo.some(c=>byId.get(c.entryId)?.status!=="PENDING")) continue;
    const plan=workspace.clubPlans.find(p=>p.id===member.planId);
    member.status="CANCELED";
    member.brokenAt=now.toISOString();
    member.canceledAt=now.toISOString();
    member.pendingPlanId=undefined;
    member.cancelEffectiveAt=undefined;
    workspace.clubEvents.push({id:workspaceId("break"),memberId:member.id,customerId:member.customerId,
      at:now.toISOString(),effectiveAt:now.toISOString(),status:"APPLIED",kind:"BREAK",
      previousPlanId:member.planId,previousPlanName:plan?.name??"Plano indisponível",
      previousAmount:plan?.monthlyAmount??null,actor:"SISTEMA",
      reason:"Rompimento após dois ciclos consecutivos vencidos e não pagos"});
    await tx.adminAuditLog.create({data:{barberShopId:shopId,action:"CLUB_BROKEN_NONPAYMENT",
      adminEmail:"SISTEMA",details:{memberId:member.id,customerId:member.customerId,
      unpaidEntries:lastTwo.map(c=>c.entryId),contractFine:"PENDING_DEFINITION"}}});
    count++;
  }
  return count;
}
