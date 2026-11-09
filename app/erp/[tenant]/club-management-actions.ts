"use server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace, writeWorkspace, workspaceId } from "@/lib/erp-workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const currency = (input: unknown) => {
  const number = Number(String(input ?? "").replace(",", "."));
  return Number.isFinite(number) && number > 0 && number <= 1_000_000 && Math.round(number*100) === number*100
    ? number : null;
};
const dateToday = () => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const validDay = (input: string) => /^\d{4}-\d{2}-\d{2}$/.test(input) && !Number.isNaN(Date.parse(input+"T12:00:00Z"));
const txt = (data: FormData,key: string,max=150) => String(data.get(key)??"").trim().slice(0,max);
const urlFor = (tenant: string,view: string,part: string) => `/erp/${encodeURIComponent(tenant)}/${view}?${part}`;

async function context(data: FormData,view: string) {
  const tenant=txt(data,"tenantCode",80).toUpperCase();
  const viewer=await requireTenantAccess(tenant);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant},select:{id:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    (viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER"))) redirect("/cliente/login");
  return {tenant,viewer,shop,path:(part:string)=>urlFor(tenant,view,part)};
}

export async function scheduleClubPriceAdjustment(data:FormData) {
  const {tenant,viewer,shop,path}=await context(data,"clube-reajustes");
  const planId=txt(data,"planId",100);
  const amount=currency(data.get("newAmount"));
  const date=txt(data,"effectiveDate",10);
  if(!planId||amount===null||!validDay(date)||date<=dateToday())redirect(path("erro=campos"));
  try {
    await prisma.$transaction(async tx=>{
      const entity=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(entity.enabledFeatures);
      if(!ws.clubPlans.some(p=>p.id===planId&&p.active))throw Error("Invalid plan");
      if(ws.clubPriceAdjustments.some(p=>p.planId===planId&&p.status==="SCHEDULED"))throw Error("Already scheduled");
      const id=workspaceId("reajuste");
      ws.clubPriceAdjustments.unshift({id,planId,newAmount:amount,effectiveDate:date,createdAt:new Date().toISOString(),status:"SCHEDULED"});
      await tx.barberShop.update({where:{id:shop.id},data:{enabledFeatures:writeWorkspace(entity.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"CLUB_PRICE_ADJUSTMENT_SCHEDULED",adminEmail:viewer.email,details:{id,planId,amount,date}}});
    },{isolationLevel:"Serializable"});
  } catch(error){console.error("Failed to schedule club price adjustment",error);redirect(path("erro=reajuste"))}
  revalidatePath(`/erp/${encodeURIComponent(tenant)}`,"layout");
  redirect(path("ok=agendado"));
}

export async function applyClubPriceAdjustment(data:FormData) {
  const {tenant,viewer,shop,path}=await context(data,"clube-reajustes");
  const requestId=txt(data,"requestId",100);
  if(!requestId)redirect(path("erro=reajuste"));
  try {
    await prisma.$transaction(async tx=>{
      const entity=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(entity.enabledFeatures);
      const request=ws.clubPriceAdjustments.find(p=>p.id===requestId&&p.status==="SCHEDULED");
      if(!request||request.effectiveDate>dateToday())throw Error("Not eligible");
      const plan=ws.clubPlans.find(p=>p.id===request.planId&&p.active);
      if(!plan)throw Error("Plan missing");
      const oldAmount=plan.monthlyAmount;
      plan.monthlyAmount=request.newAmount;
      request.status="APPLIED";
      request.appliedAt=new Date().toISOString();
      await tx.barberShop.update({where:{id:shop.id},data:{enabledFeatures:writeWorkspace(entity.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"CLUB_PRICE_ADJUSTMENT_APPLIED",adminEmail:viewer.email,details:{requestId,planId:plan.id,oldAmount,newAmount:plan.monthlyAmount}}});
    },{isolationLevel:"Serializable"});
  } catch(error){console.error("Failed to apply club price adjustment",error);redirect(path("erro=reajuste"))}
  revalidatePath(`/erp/${encodeURIComponent(tenant)}`,"layout");
  redirect(path("ok=aplicado"));
}

export async function cancelClubPriceAdjustment(data:FormData) {
  const {tenant,viewer,shop,path}=await context(data,"clube-reajustes");
  const requestId=txt(data,"requestId",100);
  try {
    await prisma.$transaction(async tx=>{
      const entity=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(entity.enabledFeatures);
      const request=ws.clubPriceAdjustments.find(p=>p.id===requestId&&p.status==="SCHEDULED");
      if(!request)throw Error("Not scheduled");
      request.status="CANCELED";
      await tx.barberShop.update({where:{id:shop.id},data:{enabledFeatures:writeWorkspace(entity.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"CLUB_PRICE_ADJUSTMENT_CANCELED",adminEmail:viewer.email,details:{requestId}}});
    },{isolationLevel:"Serializable"});
  }catch(error){console.error("Failed to cancel adjustment",error);redirect(path("erro=reajuste"))}
  revalidatePath(`/erp/${encodeURIComponent(tenant)}`,"layout");
  redirect(path("ok=cancelado"));
}

export async function requestClubWithdrawal(data:FormData) {
  const {tenant,viewer,shop,path}=await context(data,"clube-saques");
  const amount=currency(data.get("amount"));
  const reason=txt(data,"reason",500);
  if(amount===null||reason.length<10)redirect(path("erro=campos"));
  try {
    await prisma.$transaction(async tx=>{
      const entity=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(entity.enabledFeatures);
      const id=workspaceId("saque");
      ws.clubWithdrawalRequests.unshift({id,amount,reason,requestedAt:new Date().toISOString(),requestedBy:viewer.email,status:"REQUESTED"});
      await tx.barberShop.update({where:{id:shop.id},data:{enabledFeatures:writeWorkspace(entity.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"CLUB_WITHDRAWAL_REQUEST_RECORDED",adminEmail:viewer.email,details:{id,amount,reason}}});
    },{isolationLevel:"Serializable"});
  }catch(error){console.error("Failed to request withdrawal",error);redirect(path("erro=saque"))}
  revalidatePath(`/erp/${encodeURIComponent(tenant)}`,"layout");
  redirect(path("ok=solicitado"));
}

export async function cancelClubWithdrawalRequest(data:FormData) {
  const {tenant,viewer,shop,path}=await context(data,"clube-saques");
  const id=txt(data,"requestId",100);
  try {
    await prisma.$transaction(async tx=>{
      const entity=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(entity.enabledFeatures);
      const request=ws.clubWithdrawalRequests.find(q=>q.id===id&&q.status==="REQUESTED");
      if(!request)throw Error("Not found");
      request.status="CANCELED";
      await tx.barberShop.update({where:{id:shop.id},data:{enabledFeatures:writeWorkspace(entity.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,action:"CLUB_WITHDRAWAL_REQUEST_CANCELED",adminEmail:viewer.email,details:{id}}});
    },{isolationLevel:"Serializable"});
  }catch(error){console.error("Failed to cancel withdrawal request",error);redirect(path("erro=saque"))}
  revalidatePath(`/erp/${encodeURIComponent(tenant)}`,"layout");
  redirect(path("ok=cancelado"));
}
