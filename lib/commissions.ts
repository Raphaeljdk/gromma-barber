import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { readWorkspace } from "./erp-workspace";
import { cents } from "./checkout";
import { commissionCents, professionalAvailable, type ProfessionalAvailability } from "./commission-math";
export { commissionTotals, commissionPeriod } from "./commission-math";
export function commissionFingerprint(lines: {id:string;amount:unknown}[]) { return createHash("sha256").update(lines.map(l=>`${l.id}:${l.amount}`).sort().join("|")).digest("hex"); }
export async function assertProfessionalAvailable(tx:Prisma.TransactionClient,shopId:string,userId:string,start:Date,end:Date,services:string[]) {
  const profile=await tx.commissionProfile.findUnique({where:{barberShopId_userId:{barberShopId:shopId,userId}}});
  if(!professionalAvailable(profile?.availability as ProfessionalAvailability|null,start,end,services)) throw new Error("Horário ou serviço fora da disponibilidade do profissional.");
}
/** Only explicit appointment service links and per-product seller links are eligible. */
export async function snapshotCommand(tx:Prisma.TransactionClient,shopId:string,commandId:string,actor:string) {
  const command=await tx.serviceCommand.findFirst({where:{id:commandId,barberShopId:shopId,status:"CLOSED"},include:{items:true,appointment:true}});
  if(!command?.closedAt) return;
  const shop=await tx.barberShop.findUniqueOrThrow({where:{id:shopId}}), ws=readWorkspace(shop.enabledFeatures);
  const profiles=await tx.commissionProfile.findMany({where:{barberShopId:shopId}});
  const rules=await tx.serviceCommissionRule.findMany({where:{barberShopId:shopId}});
  const users=await tx.shopUser.findMany({where:{barberShopId:shopId},select:{id:true}});
  const subtotal=cents(command.subtotal), total=cents(command.total);
  let allocated=0, cumulative=0;
  for(const item of command.items.sort((a,b)=>a.id.localeCompare(b.id))) {
    cumulative+=cents(item.total);
    const share=subtotal?Number((BigInt(total)*BigInt(cumulative)+BigInt(Math.floor(subtotal/2)))/BigInt(subtotal)):0;
    const base=share-allocated; allocated=share;
    const seller=ws.productLines.find(l=>l.itemId===item.id)?.sellerId;
    const userId=item.kind==="SERVICE"?command.appointment?.barberId:item.kind==="PRODUCT"?seller:null;
    if(!userId||!users.some(u=>u.id===userId)) continue;
    const profile=profiles.find(p=>p.userId===userId);
    const defaultRate=profile?.servicePercent ?? ws.commissionRules.find(r=>r.userId===userId)?.percent ?? ws.settings.defaultCommissionPercent;
    const booked=ws.bookedServices.find(b=>b.appointmentId===command.appointmentId)?.services;
    const serviceId=ws.serviceLines.find(l=>l.itemId===item.id)?.serviceId ?? booked?.find(s=>s.name===item.description && cents(s.price)===cents(item.unitPrice))?.id ?? (command.items.filter(i=>i.kind==="SERVICE").length===1?command.appointment?.serviceId:null);
    const custom=serviceId?rules.find(r=>r.serviceId===serviceId)?.percent:null;
    const rate=Number(item.kind==="PRODUCT"?(profile?.productPercent??30):(custom??defaultRate));
    await tx.commissionLine.createMany({data:[{barberShopId:shopId,userId,commandId,sourceKey:`command:${item.id}`,kind:item.kind,description:item.description,baseAmount:new Prisma.Decimal(base).div(100),percent:rate,amount:new Prisma.Decimal(commissionCents(base,Math.round(rate*100))).div(100),occurredAt:command.closedAt,createdBy:actor}],skipDuplicates:true});
  }
}
