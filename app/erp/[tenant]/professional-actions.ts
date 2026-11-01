"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace, writeWorkspace, workspaceId, type ErpWorkspace } from "@/lib/erp-workspace";
import {
  PROFESSIONAL_PERMISSION_IDS, PRODUCT_CATEGORIES, WEEK_DAYS, isDate, isTime,
  validInterval, type ProfessionalProfile, type ProfessionalPermission,
  type ProfessionalShift, type ProfessionalBreak,
} from "@/lib/professional-profile";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma, ShopUserRole } from "@prisma/client";

const text = (f:FormData,k:string,max=180)=>String(f.get(k)??"").trim().slice(0,max);
const num=(f:FormData,k:string)=>Number(text(f,k,30).replace(",","."));
const checked=(f:FormData,k:string)=>f.get(k)==="on";
const roles:ShopUserRole[]=["BARBER","RECEPTIONIST","MANAGER","ACCOUNTANT"];
const cleanEmail=(raw:string)=>raw.trim().toLowerCase();
const emailValid=(raw:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) && raw.length<=180;
const moneyPercent=(raw:number)=>Number.isFinite(raw)&&raw>=0&&raw<=100;

type Ctx={code:string;shopId:string;actor:string;userId:string;path:string};
async function context(form:FormData,withUser=true):Promise<Ctx>{
  const code=text(form,"tenantCode",80).toUpperCase();
  if(!code)redirect("/cliente/login");
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},
    select:{id:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
      (viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER")))
    redirect("/cliente/login");
  const userId=withUser?text(form,"userId",80):"";
  const path=withUser?"/erp/"+encodeURIComponent(code)+"/equipe/"+encodeURIComponent(userId):
    "/erp/"+encodeURIComponent(code)+"/equipe";
  if(withUser){
    const exists=await prisma.shopUser.findFirst({where:{id:userId,barberShopId:shop.id},select:{id:true}});
    if(!exists)redirect("/erp/"+encodeURIComponent(code)+"/equipe?erro=profissional");
  }
  return {code,shopId:shop.id,actor:viewer.email,userId,path};
}
function fail(ctx:Ctx,msg:string):never{
  redirect(ctx.path+"?erro="+encodeURIComponent(msg));
}
function success(ctx:Ctx,msg:string):never{
  revalidatePath("/erp/"+encodeURIComponent(ctx.code),"layout");
  redirect(ctx.path+"?ok="+encodeURIComponent(msg));
}
async function change(ctx:Ctx,action:string,reason:string,fn:(profile:ProfessionalProfile,tx:Prisma.TransactionClient,ws:ErpWorkspace)=>Promise<Record<string,unknown>|void>){
  if(reason.trim().length<4) fail(ctx,"motivo");
  try{
    await prisma.$transaction(async tx=>{
      const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:ctx.shopId}});
      const ws=readWorkspace(fresh.enabledFeatures);
      const profile:ProfessionalProfile=structuredClone(ws.professionalProfiles[ctx.userId]??{});
      const details=await fn(profile,tx,ws);
      ws.professionalProfiles[ctx.userId]=profile;
      await tx.barberShop.update({where:{id:ctx.shopId},data:{
        enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws),
      }});
      await tx.adminAuditLog.create({data:{barberShopId:ctx.shopId,adminEmail:ctx.actor,action,
        details:{userId:ctx.userId,reason,...details} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
  }catch(error){
    console.error("Professional profile update failed",action,error);
    fail(ctx,"salvar");
  }
}

export async function createProfessional(form:FormData){
  const ctx=await context(form,false);
  const name=text(form,"name",120);
  const email=cleanEmail(text(form,"email",180));
  const role=text(form,"role",30) as ShopUserRole;
  const unitId=text(form,"unitId",80);
  if(name.length<2||!emailValid(email)||!roles.includes(role))fail(ctx,"dados");
  if(unitId && !(await prisma.barberShopUnit.findFirst({where:{
    id:unitId,barberShopId:ctx.shopId,active:true},select:{id:true}})))fail(ctx,"unidade");
  let newId="";
  try{
    const created=await prisma.$transaction(async tx=>{
      const user=await tx.shopUser.create({data:{
        barberShopId:ctx.shopId,name,email,role,
        unitId:unitId||null,active:true,passwordHash:null,
      }});
      await tx.adminAuditLog.create({data:{barberShopId:ctx.shopId,adminEmail:ctx.actor,
        action:"PROFESSIONAL_CREATED",details:{userId:user.id,role,unitId:unitId||null,
          loginProvisioned:false}}});
      return user;
    },{isolationLevel:"Serializable"});
    newId=created.id;
  }catch(error){console.error("Employee creation failed",error);fail(ctx,"cadastro");}
  revalidatePath("/erp/"+encodeURIComponent(ctx.code),"layout");
  redirect("/erp/"+encodeURIComponent(ctx.code)+"/equipe/"+encodeURIComponent(newId)+"?ok=cadastrado");
}

export async function saveProfessionalIdentity(form:FormData){
  const ctx=await context(form);
  const name=text(form,"name",120);
  const email=cleanEmail(text(form,"email",180));
  const phone=text(form,"phone",28);
  const unitId=text(form,"unitId",80);
  const active=checked(form,"active");
  const birthDate=text(form,"birthDate",10);
  const cpf=text(form,"cpf",14).replace(/\D/g,"");
  const cnpj=text(form,"cnpj",18).replace(/\D/g,"");
  const zipCode=text(form,"zipCode",9).replace(/\D/g,"");
  const cadenceDays=num(form,"cadenceDays");
  const state=text(form,"state",2).toUpperCase();
  const photoUrl=text(form,"photoUrl",600);
  if(name.length<2||!emailValid(email)||phone.length>28||
    (birthDate&&!isDate(birthDate))||(cpf&&cpf.length!==11)||(cnpj&&cnpj.length!==14)||
    (zipCode&&zipCode.length!==8)||(state&&!/^[A-Z]{2}$/.test(state))||
    !Number.isInteger(cadenceDays)||cadenceDays<0||cadenceDays>365||
    (photoUrl&&!/^https:\/\//i.test(photoUrl))) fail(ctx,"dados");
  if(unitId && !(await prisma.barberShopUnit.findFirst({where:{
    id:unitId,barberShopId:ctx.shopId,active:true},select:{id:true}})))fail(ctx,"unidade");
  await change(ctx,"PROFESSIONAL_IDENTITY_UPDATED",text(form,"reason",200),async(profile,tx)=>{
    const existing=await tx.shopUser.findFirst({where:{id:ctx.userId,barberShopId:ctx.shopId},
      select:{id:true,role:true,active:true,email:true,unitId:true,name:true}});
    if(!existing || existing.role==="OWNER" && !active) throw Error("Owner must remain active");
    const currentActor=await tx.shopUser.findFirst({where:{barberShopId:ctx.shopId,email:ctx.actor},
      select:{id:true}});
    if(currentActor?.id===existing.id && !active)throw Error("Cannot disable own account");
    await tx.shopUser.update({where:{id:existing.id},data:{
      name,email,phone:phone||null,unitId:unitId||null,active,
    }});
    // PII is deliberately not duplicated in the audit trail.
    const fields: (keyof ProfessionalProfile)[]=[
      "nickname","cpf","cnpj","birthDate","whatsapp","zipCode","street",
      "district","city","state","streetNumber","complement","photoUrl",
    ];
    const previousFields=Object.fromEntries(fields.map(key=>[key,Boolean(profile[key])]));
    Object.assign(profile,{
      nickname:text(form,"nickname",100),cpf,cnpj,birthDate,
      whatsapp:text(form,"whatsapp",28),cadenceDays,
      accessToOtherUnits:checked(form,"accessToOtherUnits"),
      zipCode,street:text(form,"street",150),district:text(form,"district",100),
      city:text(form,"city",100),state,streetNumber:text(form,"streetNumber",20),
      complement:text(form,"complement",100),photoUrl,
    });
    return {previous:{name:existing.name,email:existing.email,role:existing.role,active:existing.active,unitId:existing.unitId},
      next:{name,email,active,unitId:unitId||null},
      changedProfileFields:fields.filter(key=>Boolean(profile[key])!==previousFields[key])};
  });
  success(ctx,"dados");
}

export async function saveProfessionalSection(form:FormData){
  const ctx=await context(form);
  const section=text(form,"section",40);
  const reason=text(form,"reason",200) || "Atualização de cadastro do profissional";
  if(section==="permissions"){
    const selected=[...new Set(form.getAll("permissions").map(String))]
      .filter((s):s is ProfessionalPermission=>(PROFESSIONAL_PERMISSION_IDS as string[]).includes(s));
    await change(ctx,"PROFESSIONAL_PERMISSIONS_UPDATED",reason,async(profile)=>{
      const previous=profile.permissions??null;
      profile.permissions=selected;
      return {previous,next:selected};
    });
  }else if(section==="enabled-services"){
    const ids=[...new Set(form.getAll("serviceIds").map(String).filter(id=>id.length<=80))];
    if(ids.length>200)fail(ctx,"servicos");
    const matched=ids.length?await prisma.service.count({where:{
      id:{in:ids},barberShopId:ctx.shopId,active:true,
    }}):0;
    if(matched!==ids.length)fail(ctx,"servicos");
    await change(ctx,"PROFESSIONAL_SERVICES_UPDATED",reason,async(profile)=>{
      const previous=profile.enabledServices??null;
      profile.enabledServices=ids;
      return {previous,next:ids};
    });
  }else if(section==="service"){
    const serviceId=text(form,"serviceId",80),percent=num(form,"percent");
    if(!moneyPercent(percent))fail(ctx,"percentual");
    const service=await prisma.service.findFirst({where:{
      id:serviceId,barberShopId:ctx.shopId,active:true},select:{id:true}});
    if(!service)fail(ctx,"servico");
    await change(ctx,"PROFESSIONAL_SERVICE_RATE_UPDATED",reason,async(profile)=>{
      const previous=profile.services?.[serviceId]??null;
      profile.services={...(profile.services??{}),[serviceId]:percent};
      return {serviceId,previous,next:percent};
    });
  }else if(section==="remove-service"){
    const serviceId=text(form,"serviceId",80);
    await change(ctx,"PROFESSIONAL_SERVICE_RATE_REMOVED",reason,async(profile)=>{
      const previous=profile.services?.[serviceId]??null;
      if(profile.services)delete profile.services[serviceId];
      return {serviceId,previous,next:null};
    });
  }else if(section==="schedule"){
    const shifts:ProfessionalShift[]=[];
    for(const {id} of WEEK_DAYS){
      if(!checked(form,"enabled"+id))continue;
      const start=text(form,"start"+id,5),end=text(form,"end"+id,5);
      if(!validInterval(start,end))fail(ctx,"horario");
      shifts.push({day:id,start,end});
    }
    await change(ctx,"PROFESSIONAL_SCHEDULE_UPDATED",reason,async(profile)=>{
      const previous=profile.workHours??null;
      profile.workHours=shifts;
      return {previous,next:shifts};
    });
  }else if(section==="break-add"){
    const day=num(form,"day"),start=text(form,"start",5),end=text(form,"end",5);
    if(!Number.isInteger(day)||day<0||day>6||!validInterval(start,end))fail(ctx,"intervalo");
    await change(ctx,"PROFESSIONAL_BREAK_ADDED",reason,async(profile)=>{
      const id=workspaceId("break");
      profile.breaks=[...(profile.breaks??[]),{id,day,start,end}].slice(-35);
      return {id,day,start,end};
    });
  }else if(section==="break-remove"){
    const id=text(form,"id",100);
    await change(ctx,"PROFESSIONAL_BREAK_REMOVED",reason,async(profile)=>{
      const before=profile.breaks??[];
      profile.breaks=before.filter(x=>x.id!==id);
      return {id,removed:before.length-profile.breaks.length};
    });
  }else if(section==="leave-add"){
    const from=text(form,"from",10),to=text(form,"to",10),label=text(form,"label",100);
    if(!isDate(from)||!isDate(to)||to<from||!label|| 
       (Date.parse(to+"T12:00:00Z")-Date.parse(from+"T12:00:00Z"))>366*86400000)
      fail(ctx,"folga");
    await change(ctx,"PROFESSIONAL_LEAVE_ADDED",reason,async(profile)=>{
      const id=workspaceId("leave");
      profile.leaves=[...(profile.leaves??[]),{id,from,to,reason:label}].slice(-100);
      return {id,from,to,label};
    });
  }else if(section==="leave-remove"){
    const id=text(form,"id",100);
    await change(ctx,"PROFESSIONAL_LEAVE_REMOVED",reason,async(profile)=>{
      const before=profile.leaves??[];
      profile.leaves=before.filter(x=>x.id!==id);
      return {id,removed:before.length-profile.leaves.length};
    });
  }else if(section==="contact-add"){
    const name=text(form,"name",120),relation=text(form,"relation",70),
      phone=text(form,"phone",28),email=text(form,"email",180);
    if(name.length<2||phone.replace(/\D/g,"").length<8||(email&&!emailValid(email)))fail(ctx,"contato");
    await change(ctx,"PROFESSIONAL_CONTACT_ADDED",reason,async(profile)=>{
      const id=workspaceId("contact");
      profile.contacts=[...(profile.contacts??[]),{id,name,relation,phone,email}].slice(-20);
      return {contactId:id,relation};
    });
  }else if(section==="contact-remove"){
    const id=text(form,"id",100);
    await change(ctx,"PROFESSIONAL_CONTACT_REMOVED",reason,async(profile)=>{
      const before=profile.contacts??[];
      profile.contacts=before.filter(x=>x.id!==id);
      return {contactId:id,removed:before.length-profile.contacts.length};
    });
  }else if(section==="contract-add"){
    const label=text(form,"label",140),url=text(form,"url",700),validFrom=text(form,"validFrom",10);
    if(label.length<3||!/^https:\/\//i.test(url)||(validFrom&&!isDate(validFrom)))fail(ctx,"contrato");
    await change(ctx,"PROFESSIONAL_CONTRACT_ADDED",reason,async(profile)=>{
      const id=workspaceId("contract");
      profile.contracts=[...(profile.contracts??[]),{id,label,url,validFrom,notes:text(form,"notes",250)}].slice(-30);
      return {contractId:id,label,validFrom};
    });
  }else if(section==="contract-remove"){
    const id=text(form,"id",100);
    await change(ctx,"PROFESSIONAL_CONTRACT_REMOVED",reason,async(profile)=>{
      const before=profile.contracts??[];
      profile.contracts=before.filter(x=>x.id!==id);
      return {contractId:id,removed:before.length-profile.contracts.length};
    });
  }else if(section==="base-commissions"){
    const subscriptionPercent=num(form,"subscriptionPercent");
    const productPercent=num(form,"productPercent");
    if(!moneyPercent(subscriptionPercent)||!moneyPercent(productPercent))fail(ctx,"comissoes");
    await change(ctx,"PROFESSIONAL_BASE_COMMISSIONS_UPDATED",reason,async(profile,tx,ws)=>{
      const previous=ws.professionalExtraRates[ctx.userId]??null;
      ws.professionalExtraRates[ctx.userId]={subscriptionPercent,productPercent};
      return {previous,next:{subscriptionPercent,productPercent}};
    });
  }else if(section==="subscription-tiers"){
    const mins=form.getAll("tierMin").map(String);
    const maxs=form.getAll("tierMax").map(String);
    const percents=form.getAll("tierPercent").map(String);
    if(mins.length!==maxs.length||mins.length!==percents.length||mins.length>8)fail(ctx,"metas");
    const tiers: {min:number;max:number|null;percent:number}[]=[];
    for(let index=0;index<mins.length;index++){
      const a=mins[index].trim(),b=maxs[index].trim(),c=percents[index].trim();
      if(!a&&!b&&!c)continue;
      const min=Number(a.replace(",",".")),max=b?Number(b.replace(",",".")):null,
        percent=Number(c.replace(",","."));
      if(!a||!c||!Number.isFinite(min)||min<0||min>1e8||
          (max!==null&&(!Number.isFinite(max)||max<=min||max>1e8))||
          !moneyPercent(percent))fail(ctx,"metas");
      tiers.push({min,max,percent});
    }
    tiers.sort((a,b)=>a.min-b.min);
    if(tiers.some((tier,index)=>index>0&&
       (tiers[index-1].max===null||tier.min<tiers[index-1].max!)))fail(ctx,"metas");
    await change(ctx,"PROFESSIONAL_SUBSCRIPTION_TIERS_UPDATED",reason,async(profile,tx,ws)=>{
      const previous=ws.subscriptionCommissionTiers[ctx.userId]??[];
      ws.subscriptionCommissionTiers[ctx.userId]=tiers;
      return {previous,next:tiers};
    });
  }else if(section==="product-tier"){
    const category=text(form,"category",80),minimum=num(form,"minimum"),percent=num(form,"percent");
    if(!(PRODUCT_CATEGORIES as readonly string[]).includes(category)||!Number.isFinite(minimum)||
       minimum<0||minimum>1e8||!moneyPercent(percent))fail(ctx,"produto");
    await change(ctx,"PROFESSIONAL_PRODUCT_TIER_UPDATED",reason,async(profile)=>{
      const previous=(profile.productTiers??[]).find(x=>x.category===category&&x.minimum===minimum);
      profile.productTiers=[...(profile.productTiers??[]).filter(x=>!(x.category===category&&x.minimum===minimum)),
        {id:previous?.id??workspaceId("tier"),category,minimum,percent}].sort((a,b)=>a.category.localeCompare(b.category)||a.minimum-b.minimum).slice(0,70);
      return {category,minimum,previous:previous?.percent??null,next:percent};
    });
  }else if(section==="product-tier-remove"){
    const id=text(form,"id",100);
    await change(ctx,"PROFESSIONAL_PRODUCT_TIER_REMOVED",reason,async(profile)=>{
      const before=profile.productTiers??[];
      profile.productTiers=before.filter(x=>x.id!==id);
      return {id,removed:before.length-profile.productTiers.length};
    });
  }else fail(ctx,"secao");
  success(ctx,section);
}
