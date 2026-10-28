"use server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace, writeWorkspace } from "@/lib/erp-workspace";
import { cents } from "@/lib/checkout";
import { rateHundredths, commissionCents, type ProfessionalAvailability, professionalAvailable } from "@/lib/commission-math";
import { commissionPeriod, commissionTotals, commissionFingerprint } from "@/lib/commissions";
const value=(f:FormData,key:string,max=400)=>String(f.get(key)??"").trim().slice(0,max);
export async function commissionAccess(tenant:string,write=false) {
  const viewer=await requireTenantAccess(tenant);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased) throw new Error("Barbearia indisponível.");
  if(viewer.type!=="ADMIN") {
    const user=await prisma.shopUser.findFirst({where:{id:viewer.userId,barberShopId:shop.id,active:true}});
    if(!user||viewer.barberShopId!==shop.id||!(write?["OWNER","MANAGER"]:["OWNER","MANAGER","ACCOUNTANT"]).includes(user.role)) throw new Error("Acesso restrito à gestão.");
  }
  return {shop,actor:viewer.email,viewer};
}
async function run(f:FormData,operation:(tx:Prisma.TransactionClient,shop:Awaited<ReturnType<typeof commissionAccess>>["shop"],actor:string)=>Promise<void>) {
  const tenant=value(f,"tenantCode").toUpperCase();
  const target=["equipe","servicos","relatorio-comissoes"].includes(value(f,"returnTo"))?value(f,"returnTo"):"comissoes";
  const path=`/erp/${encodeURIComponent(tenant)}/${target}`;
  let error="";
  try {
    const {shop,actor}=await commissionAccess(tenant,true);
    await prisma.$transaction(async tx=>{
      // A common tenant lock makes simultaneous payouts and ledger changes serialize.
      await tx.$queryRaw`SELECT id FROM "BarberShop" WHERE id = ${shop.id} FOR UPDATE`;
      await operation(tx,shop,actor);
    },{isolationLevel:"Serializable",timeout:20000});
  } catch(e) { error=e instanceof Prisma.PrismaClientKnownRequestError?"Dados alterados por outra operação. Atualize e confira o histórico antes de tentar novamente.":e instanceof Error?e.message:"Não foi possível salvar."; }
  revalidatePath(`/erp/${encodeURIComponent(tenant)}`,"layout");
  const qs=new URLSearchParams(error?{commissionError:error}:{commissionOk:"1"});
  for(const k of ["start","end"]) if(value(f,k)) qs.set(k,value(f,k));
  redirect(`${path}?${qs}`);
}
export async function saveCommissionProfile(f:FormData) {
  return run(f,async(tx,shop,actor)=>{
    const userId=value(f,"userId");
    const user=await tx.shopUser.findFirst({where:{id:userId,barberShopId:shop.id,active:true,role:{in:["OWNER","MANAGER","BARBER"]}}});
    if(!user) throw new Error("Profissional inválido.");
    const data={servicePercent:rateHundredths(value(f,"servicePercent"))/100,subscriptionPercent:rateHundredths(value(f,"subscriptionPercent"))/100,productPercent:rateHundredths(value(f,"productPercent"))/100};
    let availability:ProfessionalAvailability|null=null;
    if(f.has("scheduleEnabled")) {
      const days=[...new Set(f.getAll("days").map(Number))];
      const start=value(f,"workStart"),end=value(f,"workEnd");
      const valid=(s:string)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
      const breaks=value(f,"breaks").split(",").filter(Boolean).map(part=>{const [start,end]=part.trim().split("-");return {start,end};});
      const serviceIds=[...new Set(f.getAll("serviceIds").map(String))];
      if(!days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6)||!valid(start)||!valid(end)||start>=end||breaks.some(b=>!valid(b.start)||!valid(b.end)||b.start>=b.end||b.start<start||b.end>end)) throw new Error("Revise os dias, horários e intervalos (HH:MM-HH:MM, separados por vírgula).");
      if(await tx.service.count({where:{barberShopId:shop.id,id:{in:serviceIds},active:true}})!==serviceIds.length) throw new Error("Serviço de outra barbearia ou inativo.");
      availability={days,start,end,breaks,serviceIds};
      const existing=await tx.appointment.findMany({where:{barberShopId:shop.id,barberId:userId,startsAt:{gte:new Date()},status:{in:["SCHEDULED","CONFIRMED","CHECKED_IN","IN_SERVICE"]}},include:{service:true}});
      const ws=readWorkspace(shop.enabledFeatures);
      if(existing.some(a=>!professionalAvailable(availability,a.startsAt,a.endsAt??new Date(+a.startsAt+(a.service?.durationMinutes??30)*60000),ws.bookedServices.find(b=>b.appointmentId===a.id)?.services.map(s=>s.id)??(a.serviceId?[a.serviceId]:[])))) throw new Error("A disponibilidade conflita com agendamentos existentes. Reagende-os antes de reduzir os horários ou serviços.");
    }
    const before=await tx.commissionProfile.findUnique({where:{barberShopId_userId:{barberShopId:shop.id,userId}}});
    await tx.commissionProfile.upsert({where:{barberShopId_userId:{barberShopId:shop.id,userId}},create:{barberShopId:shop.id,userId,...data,availability:availability??Prisma.DbNull},update:{...data,availability:availability??Prisma.DbNull}});
    await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"COMMISSION_PROFILE_UPDATED",adminEmail:actor,details:{userId,before:JSON.parse(JSON.stringify(before)),after:{...data,availability}}}});
  });
}
export async function saveServiceCommission(f:FormData) {
  return run(f,async(tx,shop,actor)=>{
    const serviceId=value(f,"serviceId"),percent=value(f,"mode")==="custom"?rateHundredths(value(f,"percent"))/100:null;
    if(!await tx.service.findFirst({where:{id:serviceId,barberShopId:shop.id}})) throw new Error("Serviço inválido.");
    const before=await tx.serviceCommissionRule.findUnique({where:{barberShopId_serviceId:{barberShopId:shop.id,serviceId}}});
    await tx.serviceCommissionRule.upsert({where:{barberShopId_serviceId:{barberShopId:shop.id,serviceId}},create:{barberShopId:shop.id,serviceId,percent},update:{percent}});
    await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"SERVICE_COMMISSION_UPDATED",adminEmail:actor,details:{serviceId,before:before?.percent?.toString()??null,percent}}});
  });
}
export async function addCommissionAdjustment(f:FormData) {
  return run(f,async(tx,shop,actor)=>{
    const userId=value(f,"userId"),description=value(f,"description"),kind=value(f,"kind");
    if(!["BONUS","DEDUCTION"].includes(kind)||description.length<5) throw new Error("Informe o tipo e uma justificativa com pelo menos 5 caracteres.");
    if(!await tx.shopUser.findFirst({where:{id:userId,barberShopId:shop.id}})) throw new Error("Profissional inválido.");
    const amount=cents(value(f,"amount")); if(!amount) throw new Error("Informe um valor positivo.");
    const {from}=commissionPeriod(value(f,"date"),value(f,"date"));
    const correctionOf=value(f,"correctionOf");
    if(correctionOf&&!await tx.commissionSettlement.findFirst({where:{id:correctionOf,barberShopId:shop.id,userId}})) throw new Error("Demonstrativo original inválido.");
    const line=await tx.commissionLine.create({data:{barberShopId:shop.id,userId,sourceKey:`adjustment:${randomUUID()}`,kind,description:correctionOf?`Correção ${correctionOf}: ${description}`:description,baseAmount:0,percent:0,amount:new Prisma.Decimal(amount).div(100),occurredAt:from,createdBy:actor}});
    await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"COMMISSION_ADJUSTMENT",adminEmail:actor,details:{lineId:line.id,correctionOf,description,amount,kind}}});
  });
}
export async function payCommission(f:FormData) {
  return run(f,async(tx,shop,actor)=>{
    const userId=value(f,"userId"),{from,to}=commissionPeriod(value(f,"start"),value(f,"end"));
    const user=await tx.shopUser.findFirst({where:{id:userId,barberShopId:shop.id}}); if(!user) throw new Error("Profissional inválido.");
    const lines=await tx.commissionLine.findMany({where:{barberShopId:shop.id,userId,settlementId:null,occurredAt:{gte:from,lt:to}}});
    if(!lines.length||commissionFingerprint(lines)!==value(f,"fingerprint")) throw new Error("A apuração mudou ou já foi paga. Atualize e consulte o histórico.");
    const totals=commissionTotals(lines);
    if(totals.net<0) throw new Error("Os descontos superam o bruto. Corrija os ajustes antes da quitação.");
    const method=value(f,"paymentMethod");if(!["PIX","CASH","TRANSFER","CREDIT","DEBIT","OTHER"].includes(method)) throw new Error("Forma de pagamento inválida.");
    const {from:paidAt}=commissionPeriod(value(f,"paymentDate"),value(f,"paymentDate"));
    if(paidAt>new Date()) throw new Error("A data de pagamento não pode ser futura.");
    const money=(n:number)=>new Prisma.Decimal(n).div(100);
    const financial=await tx.financialEntry.create({data:{barberShopId:shop.id,type:"PAYABLE",status:"PAID",category:"Comissões",description:`Quitação administrativa · ${user.name}`,amount:money(totals.net),paidAt,dueDate:paidAt}});
    const settlement=await tx.commissionSettlement.create({data:{barberShopId:shop.id,userId,professionalName:user.name,shopName:shop.tradeName,shopDocument:shop.document,shopAddress:shop.address,periodStart:from,periodEnd:to,gross:money(totals.gross),deductions:money(totals.DEDUCTION),net:money(totals.net),paidAt,paymentMethod:method,notes:value(f,"notes"),createdBy:actor,financialEntryId:financial.id}});
    const updated=await tx.commissionLine.updateMany({where:{id:{in:lines.map(l=>l.id)},barberShopId:shop.id,settlementId:null},data:{settlementId:settlement.id}});
    if(updated.count!==lines.length) throw new Error("Uma comissão já foi paga.");
    await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"COMMISSION_PAID",adminEmail:actor,details:{settlementId:settlement.id,lineIds:lines.map(l=>l.id),net:totals.net,method}}});
  });
}
export async function attributeSubscription(f:FormData) {
  return run(f,async(tx,shop,actor)=>{
    const userId=value(f,"userId"),entryId=value(f,"entryId"),reason=value(f,"description");
    if(reason.length<5) throw new Error("Descreva a evidência do vínculo do profissional com a assinatura.");
    const user=await tx.shopUser.findFirst({where:{id:userId,barberShopId:shop.id,active:true}});
    const entry=await tx.financialEntry.findFirst({where:{id:entryId,barberShopId:shop.id,type:"RECEIVABLE",status:"PAID",category:"Clube de assinaturas"}});
    if(!user||!entry?.paidAt) throw new Error("Selecione uma assinatura efetivamente recebida e um profissional válido.");
    const profile=await tx.commissionProfile.findUnique({where:{barberShopId_userId:{barberShopId:shop.id,userId}}});
    const rate=Number(profile?.subscriptionPercent??0),amount=commissionCents(cents(entry.amount),Math.round(rate*100));
    await tx.commissionLine.create({data:{barberShopId:shop.id,userId,sourceKey:`subscription:${entry.id}`,kind:"SUBSCRIPTION",description:`${entry.description} · vínculo: ${reason}`,baseAmount:entry.amount,percent:rate,amount:new Prisma.Decimal(amount).div(100),occurredAt:entry.paidAt,createdBy:actor}});
    await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"SUBSCRIPTION_COMMISSION_ATTRIBUTED",adminEmail:actor,details:{entryId,userId,reason,rate}}});
  });
}
export async function attributeProduct(f:FormData) {
  return run(f,async(tx,shop,actor)=>{
    const userId=value(f,"userId"),itemId=value(f,"itemId"),reason=value(f,"description");
    if(reason.length<5) throw new Error("Descreva a evidência de atribuição da venda.");
    if(!await tx.shopUser.findFirst({where:{id:userId,barberShopId:shop.id,active:true}})) throw new Error("Profissional inválido.");
    const item=await tx.commandItem.findFirst({where:{id:itemId,kind:"PRODUCT",command:{barberShopId:shop.id,status:"OPEN"}}});
    if(!item) throw new Error("Só é possível atribuir produtos de comandas abertas, antes do recebimento.");
    const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id}}),ws=readWorkspace(fresh.enabledFeatures);
    const link=ws.productLines.find(l=>l.itemId===itemId);if(!link) throw new Error("Produto sem vínculo verificável.");
    link.sellerId=userId;
    await tx.barberShop.update({where:{id:shop.id},data:{enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws)}});
    await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"PRODUCT_SELLER_ASSIGNED",adminEmail:actor,details:{itemId,userId,reason}}});
  });
}
