"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace, writeWorkspace, workspaceId, type ErpWorkspace } from "@/lib/erp-workspace";
import {
  PROFESSIONAL_PERMISSION_IDS, PRODUCT_CATEGORIES, WEEK_DAYS, isDate, isTime,
  validInterval, professionalCanServeAt, type ProfessionalProfile, type ProfessionalPermission,
  type ProfessionalShift, type ProfessionalBreak,
} from "@/lib/professional-profile";
import { put } from "@vercel/blob";
import { isProductCommissionCategory, type ProductCommissionRule } from "@/lib/product-commission-rules";
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
/** Manter a pessoa na seção que foi editada depois do redirect do Server Action. */
function professionalSectionAnchor(section:string):string{
  const anchors:Record<string,string>={
    "dados":"dados-profissional","foto":"dados-profissional",
    "contract-add":"contratos-profissional","contract-remove":"contratos-profissional",
    "permissions":"permissoes-profissional",
    "service-batch":"servicos-profissional","service":"servicos-profissional",
    "remove-service":"servicos-profissional","enabled-services":"servicos-profissional",
    "schedule":"jornada-profissional",
    "break-add":"folgas-profissional","break-remove":"folgas-profissional",
    "leave-add":"folgas-profissional","leave-remove":"folgas-profissional",
    "product-category-rule":"produtos-profissional","product-category-reset":"produtos-profissional",
    "base-commissions":"assinaturas-profissional","subscription-tiers":"assinaturas-profissional",
  };
  return anchors[section]??"";
}
function success(ctx:Ctx,msg:string):never{
  revalidatePath("/erp/"+encodeURIComponent(ctx.code),"layout");
  const anchor=professionalSectionAnchor(msg);
  redirect(ctx.path+"?ok="+encodeURIComponent(msg)+(anchor?"#"+anchor:""));
}
/** Não salvar escala/pausa que invalide reservas já existentes.
 * A conferência é feita na mesma transação que grava o cadastro.
 */
async function assertNoConflictingBookings(tx:Prisma.TransactionClient,ctx:Ctx,
  profile:ProfessionalProfile,from=new Date()){
  const until=new Date(from.getTime()+366*86400000);
  const appointments=await tx.appointment.findMany({where:{
    barberShopId:ctx.shopId,barberId:ctx.userId,
    status:{in:["SCHEDULED","CONFIRMED","CHECKED_IN","IN_SERVICE"]},
    startsAt:{gte:from,lt:until},
  },select:{id:true,startsAt:true,endsAt:true,serviceId:true,
    service:{select:{durationMinutes:true}}},take:3001});
  if(appointments.length>3000)throw new Error("Excesso de agendamentos; revise manualmente");
  for(const appointment of appointments){
    const end=appointment.endsAt??new Date(appointment.startsAt.getTime()+(appointment.service?.durationMinutes??30)*60000);
    if(!professionalCanServeAt(profile,appointment.startsAt,end,
      appointment.serviceId?[appointment.serviceId]:[]))
      throw new Error("A nova escala ou pausa conflita com um atendimento já agendado");
  }
}

async function change(ctx:Ctx,action:string,reason:string,fn:(profile:ProfessionalProfile,tx:Prisma.TransactionClient,ws:ErpWorkspace)=>Promise<Record<string,unknown>|void>){
  // Auditoria automática sem exigir justificativa ao editar um cadastro comum.
  const auditReason=reason.trim().length>=4 ? reason.trim() : "Atualização do cadastro do profissional";
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
        details:{userId:ctx.userId,reason:auditReason,...details} as Prisma.InputJsonValue}});
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
  const nextRole=text(form,"role",30) as ShopUserRole;
  const active=checked(form,"active");
  const birthDate=text(form,"birthDate",10);
  const cpf=text(form,"cpf",14).replace(/\D/g,"");
  const cnpj=text(form,"cnpj",18).replace(/\D/g,"");
  const zipCode=text(form,"zipCode",9).replace(/\D/g,"");
  const cadenceDays=num(form,"cadenceDays");
  const state=text(form,"state",2).toUpperCase();
  const photoUrl=text(form,"photoUrl",600);
  if(!roles.includes(nextRole)&&nextRole!=="OWNER")fail(ctx,"funcao");
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
    if(!existing || existing.role==="OWNER" && (!active || nextRole!=="OWNER"))
      throw Error("Owner must remain active with owner role");
    if(existing.role!=="OWNER" && nextRole==="OWNER")throw Error("Changing owner role is not allowed");
    const currentActor=await tx.shopUser.findFirst({where:{barberShopId:ctx.shopId,email:ctx.actor},
      select:{id:true}});
    if(currentActor?.id===existing.id && !active)throw Error("Cannot disable own account");
    await tx.shopUser.update({where:{id:existing.id},data:{
      name,email,role:nextRole,phone:phone||null,unitId:unitId||null,active,
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
      next:{name,email,role:nextRole,active,unitId:unitId||null},
      changedProfileFields:fields.filter(key=>Boolean(profile[key])!==previousFields[key])};
  });
  success(ctx,"dados");
}

/** Foto de perfil: somente JPEG, PNG ou WEBP até 3 MB.
 * O administrador deve confirmar que possui autorização para armazenar
 * e exibir a foto, que ficará em um endereço público não enumerável.
 */
export async function uploadProfessionalPhoto(form:FormData){
  const ctx=await context(form);
  const consent=checked(form,"photoConsent");
  const file=form.get("photo");
  if(!consent||!(file instanceof File)||file.size===0||file.size>3*1024*1024)
    fail(ctx,"foto");
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))fail(ctx,"foto");
  const head=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const signature=Array.from(head).map(n=>n.toString(16).padStart(2,"0")).join("");
  const validJpeg=file.type==="image/jpeg"&&signature.startsWith("ffd8ff");
  const validPng=file.type==="image/png"&&signature.startsWith("89504e470d0a1a0a");
  const validWebp=file.type==="image/webp"&&String.fromCharCode(...head.slice(0,4))==="RIFF"&&
    String.fromCharCode(...head.slice(8,12))==="WEBP";
  if(!validJpeg&&!validPng&&!validWebp)fail(ctx,"foto");
  if(!process.env.BLOB_READ_WRITE_TOKEN)fail(ctx,"armazenamento");
  const extension=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  let url="";
  try{
    const uploaded=await put("professional-photos/"+ctx.shopId+"/"+ctx.userId+"/profile."+extension,
      file,{access:"public",addRandomSuffix:true,contentType:file.type,token:process.env.BLOB_READ_WRITE_TOKEN});
    url=uploaded.url;
  }catch(error){console.error("Photo upload failed",error);fail(ctx,"armazenamento");}
  await change(ctx,"PROFESSIONAL_PHOTO_UPLOADED","Foto autorizada pelo administrador",async(profile)=>{
    const previous=Boolean(profile.photoUrl);
    profile.photoUrl=url;
    return {previousPhoto:previous,newPhoto:true};
  });
  success(ctx,"foto");
}

/** Contratos PDF precisam de Blob privado e URL entregue só após autorização. */
export async function uploadProfessionalContract(form:FormData){
  const ctx=await context(form);
  const label=text(form,"label",140);
  const validFrom=text(form,"validFrom",10);
  const file=form.get("contractPdf");
  if(label.length<3||(validFrom&&!isDate(validFrom))||
    !(file instanceof File)||file.size===0||file.size>3*1024*1024||
    (file.type&&file.type!=="application/pdf"))fail(ctx,"contrato");
  const signature=new Uint8Array(await file.slice(0,5).arrayBuffer());
  if(String.fromCharCode(...signature)!=="%PDF-")fail(ctx,"contrato");
  const privateToken=(process.env.GROMMA_PRIVATE_BLOB_TOKEN || process.env.GROMMA_PRIVATE_BLOB_READ_WRITE_TOKEN);
  // Falhar fechado: nunca migrar documento sensível para o armazenamento público de fotos.
  if(!privateToken)fail(ctx,"armazenamento-privado");
  let url="";
  try{
    const created=await put("professional-contracts/"+ctx.shopId+"/"+ctx.userId+"/contract.pdf",file,{
      access:"private",token:privateToken,addRandomSuffix:true,contentType:"application/pdf",
    });
    url=created.url;
  }catch(error){console.error("Private PDF upload failed",error);fail(ctx,"armazenamento-privado");}
  if(!/^https:\/\/[^/]+\.private\.blob\.vercel-storage\.com\//.test(url))
    fail(ctx,"armazenamento-privado");
  await change(ctx,"PROFESSIONAL_CONTRACT_PRIVATE_UPLOADED",
    "Contrato PDF recebido em armazenamento privado",async profile=>{
      const id=workspaceId("contract");
      profile.contracts=[...(profile.contracts??[]),{
        id,label,url,validFrom,notes:"PDF privado, acesso restrito",
      }].slice(-30);
      return {contractId:id,validFrom,private:true,size:file.size};
    });
  success(ctx,"contract-add");
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
  }else if(section==="service-batch"){
    const services=await prisma.service.findMany({where:{barberShopId:ctx.shopId,active:true},
      select:{id:true,name:true},orderBy:{name:"asc"}});
    if(services.length>250)fail(ctx,"servicos");
    const validIds=new Set(services.map(item=>item.id));
    const permitted=[...new Set(form.getAll("enabledServiceIds").map(String))];
    if(permitted.some(id=>!validIds.has(id)))fail(ctx,"servicos");
    const rates:Record<string,number>={};
    for(const item of services){
      const raw=form.get("rate_"+item.id);
      // Um percentual pode ser zero e é validado, não omitido.
      const parsed=Number(String(raw??"").trim().replace(",","."));
      if(raw===null||String(raw).trim()===""||!moneyPercent(parsed))fail(ctx,"percentual");
      rates[item.id]=Math.round(parsed*100)/100;
    }
    await change(ctx,"PROFESSIONAL_SERVICES_BATCH_UPDATED",reason,async(profile)=>{
      const previousEnabled=profile.enabledServices??null;
      const previousRates=profile.services??{};
      profile.enabledServices=permitted;
      // Manter percentuais históricos de serviços inativos, sem excluir dados.
      const changedRates=services.filter(item=>previousRates[item.id]!==rates[item.id]).map(item=>({
        serviceId:item.id,previous:previousRates[item.id]??null,next:rates[item.id],
      }));
      profile.services={...previousRates,...rates};
      return {previousEnabled,nextEnabled:permitted,
        updatedServices:services.length,changedRates};
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
    await change(ctx,"PROFESSIONAL_SCHEDULE_UPDATED",reason,async(profile,tx)=>{
      const previous=profile.workHours??null;
      const candidate={...profile,workHours:shifts};
      await assertNoConflictingBookings(tx,ctx,candidate);
      profile.workHours=shifts;
      return {previous,next:shifts};
    });
  }else if(section==="break-add"){
    const day=num(form,"day"),start=text(form,"start",5),end=text(form,"end",5);
    if(!Number.isInteger(day)||day<0||day>6||!validInterval(start,end))fail(ctx,"intervalo");
    await change(ctx,"PROFESSIONAL_BREAK_ADDED",reason,async(profile,tx)=>{
      // Evita novos intervalos idênticos ou sobrepostos no mesmo dia;
      // registros antigos continuam disponíveis para remoção manual.
      if((profile.breaks??[]).some(item=>item.day===day &&
        start<item.end && end>item.start))fail(ctx,"intervalo");
      const id=workspaceId("break");
      const breaks:ProfessionalBreak[]=[...(profile.breaks??[]),{id,day,start,end}];
      await assertNoConflictingBookings(tx,ctx,{...profile,breaks});
      profile.breaks=breaks.slice(-35);
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
    await change(ctx,"PROFESSIONAL_LEAVE_ADDED",reason,async(profile,tx)=>{
      const id=workspaceId("leave");
      const leaves=[...(profile.leaves??[]),{id,from,to,reason:label}];
      await assertNoConflictingBookings(tx,ctx,{...profile,leaves},
        new Date(from+"T00:00:00-03:00"));
      profile.leaves=leaves.slice(-100);
      return {id,from,to,label};
    });
  }else if(section==="leave-remove"){
    const id=text(form,"id",100);
    await change(ctx,"PROFESSIONAL_LEAVE_REMOVED",reason,async(profile)=>{
      const before=profile.leaves??[];
      profile.leaves=before.filter(x=>x.id!==id);
      return {id,removed:before.length-profile.leaves.length};
    });
  // Contatos antigos permanecem no histórico de dados, mas o cadastro e a
  // exclusão manual foram desativados conforme a simplificação solicitada.
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
    const salesEnabled=checked(form,"salesSubscriptionCommissionEnabled");
    if(!moneyPercent(subscriptionPercent))fail(ctx,"comissoes");
    await change(ctx,"PROFESSIONAL_BASE_COMMISSIONS_UPDATED",reason,async(profile,tx,ws)=>{
      const previous={rates:ws.professionalExtraRates[ctx.userId]??null,
        salesEnabled:profile.salesSubscriptionCommissionEnabled??null};
      // Não sobrescrever comissão de produtos ao editar vendas de planos.
      const productPercent=ws.professionalExtraRates[ctx.userId]?.productPercent??30;
      ws.professionalExtraRates[ctx.userId]={subscriptionPercent,productPercent};
      profile.salesSubscriptionCommissionEnabled=salesEnabled;
      return {previous,next:{subscriptionPercent,salesEnabled}};
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
  }else if(section==="product-category-reset"){
    const category=text(form,"category",25);
    if(!isProductCommissionCategory(category))fail(ctx,"categoria");
    await change(ctx,"PROFESSIONAL_PRODUCT_CATEGORY_COMMISSION_RESET",reason,async(profile)=>{
      const previous=profile.productCommissionRules?.[category]??null;
      if(profile.productCommissionRules){
        const rules={...profile.productCommissionRules};
        delete rules[category];
        profile.productCommissionRules=rules;
      }
      return {category,previous,next:null,usesLegacyRule:true};
    });
  }else if(section==="product-category-rule"){
    const category=text(form,"category",25);
    const mode=text(form,"mode",15);
    const fixedPercent=num(form,"fixedPercent");
    if(!isProductCommissionCategory(category)||!["FIXED","SCALED"].includes(mode))
      fail(ctx,"categoria");
    if(mode==="FIXED"&&!moneyPercent(fixedPercent))fail(ctx,"percentual");
    const tiers:ProductCommissionRule["tiers"]=[];
    if(mode==="SCALED"){
      const minimums=form.getAll("tierMin").map(String);
      const percentages=form.getAll("tierPercent").map(String);
      if(minimums.length!==percentages.length||minimums.length>10)fail(ctx,"faixas");
      for(let i=0;i<minimums.length;i++){
        const minRaw=minimums[i].trim(),percentRaw=percentages[i].trim();
        if(!minRaw&&!percentRaw)continue;
        const min=Number(minRaw.replace(",",".")),percent=Number(percentRaw.replace(",","."));
        if(!minRaw||!percentRaw||!Number.isFinite(min)||min<0||min>1e9||
          Math.abs(Math.round(min*100)-min*100)>0.00001 ||
          !moneyPercent(percent))fail(ctx,"faixas");
        tiers.push({min:Math.round(min*100)/100,percent:Math.round(percent*100)/100});
      }
      tiers.sort((a,b)=>a.min-b.min);
      if(!tiers.length||tiers[0].min!==0||tiers.some((tier,i)=>i>0&&tier.min===tiers[i-1].min))
        fail(ctx,"faixas");
    }
    const rule:ProductCommissionRule={
      mode:mode as ProductCommissionRule["mode"],
      fixedPercent:mode==="FIXED"?Math.round(fixedPercent*100)/100:0,
      tiers,
    };
    await change(ctx,"PROFESSIONAL_PRODUCT_CATEGORY_COMMISSION_UPDATED",reason,async(profile)=>{
      const previous=profile.productCommissionRules?.[category]??null;
      profile.productCommissionRules={...(profile.productCommissionRules??{}),[category]:rule};
      return {category,previous,next:rule};
    });
  }else fail(ctx,"secao");
  success(ctx,section);
}

/**
 * Exclusão segura: retira a conta da lista operacional e revoga seu acesso,
 * sem apagar atendimentos, pagamentos, comissões e auditoria.
 * Somente o proprietário ou administrador autorizado pode executar.
 */
export async function archiveProfessional(form:FormData){
  const ctx=await context(form);
  const listPath="/erp/"+encodeURIComponent(ctx.code)+"/equipe";
  let blocked="";
  try {
    await prisma.$transaction(async tx=>{
      const professional=await tx.shopUser.findFirst({
        where:{id:ctx.userId,barberShopId:ctx.shopId},
        select:{id:true,name:true,role:true,email:true,active:true},
      });
      if(!professional||!professional.active){blocked="excluir-invalido";return;}
      if(professional.role==="OWNER"||professional.email.toLowerCase()===ctx.actor.toLowerCase()){
        blocked="excluir-protegido";return;
      }
      const future=await tx.appointment.count({where:{
        barberShopId:ctx.shopId,
        barberId:ctx.userId,
        OR:[
          {startsAt:{gte:new Date()},status:{in:["SCHEDULED","CONFIRMED","CHECKED_IN","IN_SERVICE"]}},
          {status:{in:["CHECKED_IN","IN_SERVICE"]}},
        ],
      }});
      if(future){blocked="excluir-agenda";return;}
      // No deletes or cascades. All historical foreign keys stay intact.
      await tx.shopUser.update({where:{id:professional.id},data:{active:false}});
      const shop=await tx.barberShop.findUniqueOrThrow({where:{id:ctx.shopId}});
      const ws=readWorkspace(shop.enabledFeatures);
      ws.featuredProfessionalIds=ws.featuredProfessionalIds.filter(id=>id!==professional.id);
      await tx.barberShop.update({where:{id:ctx.shopId},data:{
        enabledFeatures:writeWorkspace(shop.enabledFeatures,ws),
      }});
      await tx.adminAuditLog.create({data:{
        barberShopId:ctx.shopId,adminEmail:ctx.actor,action:"PROFESSIONAL_ARCHIVED",
        details:{userId:professional.id,role:professional.role,accessRevoked:true,historicalRecordsKept:true},
      }});
    },{isolationLevel:"Serializable"});
  }catch(error){
    console.error("Professional archive failed",error);
    redirect(listPath+"?erro=excluir-falhou#equipe");
  }
  if(blocked)redirect(listPath+"?erro="+blocked+"#equipe");
  revalidatePath(listPath);
  revalidatePath("/erp/"+encodeURIComponent(ctx.code),"layout");
  redirect(listPath+"?ok=excluido#equipe");
}
