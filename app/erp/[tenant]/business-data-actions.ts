"use server";

import { Prisma } from "@prisma/client";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace,writeWorkspace,workspaceId } from "@/lib/erp-workspace";

const field=(form:FormData,name:string,max=250)=>String(form.get(name)??"").trim().slice(0,max);
type Ctx={code:string;id:string;actor:string;slug:string|null};
async function authorize(form:FormData):Promise<Ctx>{
  const code=field(form,"tenantCode",80).toUpperCase();
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},
    select:{id:true,slug:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    (viewer.type!=="ADMIN"&&!(viewer.type==="TENANT"&&viewer.barberShopId===shop.id&&viewer.role==="OWNER")))
    throw Error("Somente o proprietário pode editar os dados da empresa.");
  return {code,id:shop.id,actor:viewer.email,slug:shop.slug};
}
function refresh(ctx:Ctx){
  revalidatePath("/erp/"+encodeURIComponent(ctx.code),"layout");
  revalidatePath("/barbearia/"+encodeURIComponent(ctx.code.toLowerCase()));
  if(ctx.slug)revalidatePath("/barbearia/"+encodeURIComponent(ctx.slug));
}
const base=(tenant:string)=>"/erp/"+encodeURIComponent(tenant)+"/dados";
function next(tenant:string,ok:string,error:string):never{
  redirect(base(tenant)+(error?"?dadosErro="+encodeURIComponent(error):
    "?dadosOk="+encodeURIComponent(ok))+"#dados");
}
function message(error:unknown){return error instanceof Error?error.message.slice(0,150):
  "Não foi possível salvar. Tente novamente.";}

export async function saveBusinessIdentity(form:FormData){
  const code=field(form,"tenantCode",80).toUpperCase();
  let error="";let ctx:Ctx|undefined;
  try{
    ctx=await authorize(form);
    const tradeName=field(form,"tradeName",120);
    const legalName=field(form,"legalName",180);
    const contactEmail=field(form,"businessContactEmail",180).toLowerCase();
    const timeZone=field(form,"businessTimeZone",60);
    const allowedTimeZones=["America/Sao_Paulo","America/Manaus","America/Rio_Branco","America/Noronha"];
    if(tradeName.length<2)throw Error("Informe o nome fantasia.");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
      throw Error("Informe um e-mail da empresa válido.");
    if(!allowedTimeZones.includes(timeZone))throw Error("Selecione um fuso horário válido.");
    await prisma.$transaction(async tx=>{
      const old=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},
        select:{tradeName:true,legalName:true,enabledFeatures:true}});
      const ws=readWorkspace(old.enabledFeatures);
      const beforeEmail=ws.businessContactEmail;
      const beforeZone=ws.businessTimeZone;
      ws.businessContactEmail=contactEmail;
      ws.businessTimeZone=timeZone;
      await tx.barberShop.update({where:{id:ctx!.id},data:{
        tradeName,legalName:legalName||null,
        enabledFeatures:writeWorkspace(old.enabledFeatures,ws),
      }});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,
        adminEmail:ctx!.actor,action:"BUSINESS_IDENTITY_UPDATED",
        details:{changedFields:[
          ...(tradeName!==old.tradeName?["tradeName"]:[]),
          ...(legalName!==(old.legalName??"")?["legalName"]:[]),
          ...(beforeEmail!==contactEmail?["businessContactEmail"]:[]),
          ...(beforeZone!==timeZone?["businessTimeZone"]:[]),
        ]} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
  }catch(err){error=message(err);}
  next(code,"identificacao",error);
}

/** Atualiza identidade pública, sem alterar domínio DNS, login ou dados fiscais. */
export async function saveBusinessAppearance(form:FormData){
  const code=field(form,"tenantCode",80).toUpperCase();
  let error="";let ctx:Ctx|undefined;
  try{
    ctx=await authorize(form);
    const accentColor=field(form,"accentColor",7);
    const secondaryColor=field(form,"secondaryColor",7);
    const slug=field(form,"slug",60).toLowerCase();
    if(!/^#[a-f0-9]{6}$/i.test(accentColor)||!/^#[a-f0-9]{6}$/i.test(secondaryColor))
      throw Error("Informe cores em formato hexadecimal.");
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length<3)
      throw Error("Use um endereço de 3 a 60 caracteres: letras, números e hífen, sem espaços.");
    await prisma.$transaction(async tx=>{
      const current=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},
        select:{id:true,slug:true,enabledFeatures:true}});
      const collision=await tx.barberShop.findFirst({where:{id:{not:ctx!.id},
        OR:[{slug},{tenantCode:slug.toUpperCase()}]},select:{id:true}});
      if(collision)throw Error("Esse endereço já está sendo utilizado por outra barbearia.");
      const ws=readWorkspace(current.enabledFeatures);
      const before=ws.branding;
      ws.branding={...before,accentColor,secondaryColor};
      await tx.barberShop.update({where:{id:ctx!.id},data:{
        slug,enabledFeatures:writeWorkspace(current.enabledFeatures,ws),
      }});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,adminEmail:ctx!.actor,
        action:"BUSINESS_APPEARANCE_UPDATED",
        details:{slugChanged:current.slug!==slug,
          primaryChanged:before.accentColor!==accentColor,
          secondaryChanged:before.secondaryColor!==secondaryColor} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
    revalidatePath("/barbearia/"+encodeURIComponent(slug));
  }catch(err){error=message(err);}
  next(code,"personalizacao",error);
}

export async function saveBusinessIntroduction(form:FormData){
  const code=field(form,"tenantCode",80).toUpperCase();
  let error="";let ctx:Ctx|undefined;
  try{
    ctx=await authorize(form);
    const heroTitle=field(form,"heroTitle",110);
    const heroDescription=field(form,"heroDescription",600);
    const secondaryTitle=field(form,"secondaryTitle",110);
    const secondaryDescription=field(form,"secondaryDescription",600);
    if(heroTitle.length>110||secondaryTitle.length>110)
      throw Error("Título acima do limite permitido.");
    await prisma.$transaction(async tx=>{
      const shop=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},
        select:{enabledFeatures:true}});
      const ws=readWorkspace(shop.enabledFeatures);
      const before=ws.branding;
      ws.branding={...before,heroTitle,heroDescription,secondaryTitle,secondaryDescription};
      await tx.barberShop.update({where:{id:ctx!.id},
        data:{enabledFeatures:writeWorkspace(shop.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,adminEmail:ctx!.actor,
        action:"BUSINESS_INTRODUCTION_UPDATED",
        details:{heroChanged:before.heroTitle!==heroTitle,
          subtitleChanged:before.heroDescription!==heroDescription,
          secondaryChanged:before.secondaryTitle!==secondaryTitle||
            before.secondaryDescription!==secondaryDescription} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
  }catch(err){error=message(err);}
  next(code,"apresentacao",error);
}

/** Salva textos de uma imagem independentemente do upload — não sobrescreve a foto. */
export async function saveBusinessCarouselCaption(form:FormData){
  const code=field(form,"tenantCode",80).toUpperCase();
  let error="";let ctx:Ctx|undefined;
  try{
    ctx=await authorize(form);
    const slot=Number(field(form,"slot",2));
    if(!Number.isInteger(slot)||slot<0||slot>=3)throw Error("Posição inválida.");
    const title=field(form,"title",110);
    const subtitle=field(form,"subtitle",240);
    await prisma.$transaction(async tx=>{
      const shop=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(shop.enabledFeatures);
      const captions=Array.from({length:3},(_,i)=>ws.branding.carouselCaptions[i]??{title:"",subtitle:""});
      captions[slot]={title,subtitle};
      ws.branding={...ws.branding,carouselCaptions:captions};
      await tx.barberShop.update({where:{id:ctx!.id},data:{enabledFeatures:writeWorkspace(shop.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,adminEmail:ctx!.actor,
        action:"BUSINESS_CAROUSEL_CAPTION_UPDATED",details:{slot:slot+1} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
  }catch(err){error=message(err);}
  next(code,"carrossel",error);
}

/** Tolerância e penalidade padrão, sem sobrescrever regras particulares de filiais. */
export async function saveBusinessBookingRules(form:FormData){
  const code=field(form,"tenantCode",80).toUpperCase();
  let error="";let ctx:Ctx|undefined;
  try{
    ctx=await authorize(form);
    const cancellationMinutes=Number(field(form,"cancellationMinutes",7));
    const noShowBlockHours=Number(field(form,"noShowBlockHours",5));
    const mode=field(form,"mode",15);
    const customExplanation=field(form,"customExplanation",500);
    if(!Number.isSafeInteger(cancellationMinutes)||cancellationMinutes<0||cancellationMinutes>10080||
      !Number.isSafeInteger(noShowBlockHours)||noShowBlockHours<0||noShowBlockHours>720||
      !["STANDARD","CUSTOM"].includes(mode))
      throw Error("Informe tolerância e penalidade em valores válidos.");
    if(mode==="CUSTOM"&&customExplanation.length<8)
      throw Error("Descreva a penalidade personalizada.");
    await prisma.$transaction(async tx=>{
      const shop=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(shop.enabledFeatures);
      ws.bookingRules={cancellationMinutes,noShowBlockHours,
        mode:mode==="CUSTOM"?"CUSTOM":"STANDARD",
        customExplanation:mode==="CUSTOM"?customExplanation:""};
      await tx.barberShop.update({where:{id:ctx!.id},data:{enabledFeatures:writeWorkspace(shop.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,adminEmail:ctx!.actor,
        action:"BUSINESS_BOOKING_RULES_UPDATED",
        details:{cancellationMinutes,noShowBlockHours,mode} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
  }catch(err){error=message(err);}
  next(code,"regras",error);
}

/** Clubes são os planos de assinatura existentes: mantém vínculos e cobranças. */
export async function saveBusinessClub(form:FormData){
  const code=field(form,"tenantCode",80).toUpperCase();
  let error="";let ctx:Ctx|undefined;
  try{
    ctx=await authorize(form);
    const planId=field(form,"planId",100);
    const name=field(form,"name",100);
    const benefits=field(form,"benefits",600);
    const monthlyAmount=Number(field(form,"monthlyAmount",18).replace(",","."));
    const visits=Number(field(form,"visitsPerMonth",8));
    const subscriberDiscountPercent=Number(field(form,"subscriberDiscountPercent",7).replace(",","."));
    const subscriberDiscountAppliesTo=field(form,"subscriberDiscountAppliesTo",10);
    const active=form.get("active")==="on";
    const isPercent=(n:number)=>Number.isFinite(n)&&n>=0&&n<=100;
    if(name.length<2||!Number.isFinite(monthlyAmount)||monthlyAmount<0||monthlyAmount>1e6||
      Math.round(monthlyAmount*100)!==monthlyAmount*100||
      !Number.isSafeInteger(visits)||visits<0||visits>1000||
      !isPercent(subscriberDiscountPercent)||
      !["SERVICES","PRODUCTS","BOTH"].includes(subscriberDiscountAppliesTo))
      throw Error("Revise mensalidade, limites e descontos do clube.");
    await prisma.$transaction(async tx=>{
      const shop=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(shop.enabledFeatures);
      const duplicate=ws.clubPlans.some(p=>p.id!==planId&&p.name.toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR"));
      if(duplicate)throw Error("Já existe um clube com esse nome.");
      const selected=planId?ws.clubPlans.find(p=>p.id===planId):undefined;
      if(planId&&!selected)throw Error("Clube não encontrado.");
      if(!planId&&ws.clubPlans.length>=40)throw Error("Limite de 40 clubes atingido.");
      const fields={name,monthlyAmount,visitsPerMonth:visits>0?visits:null,benefits,
        subscriberDiscountPercent,
        subscriberDiscountAppliesTo:subscriberDiscountAppliesTo as "SERVICES"|"PRODUCTS"|"BOTH",
        active};
      if(selected)Object.assign(selected,fields);
      else ws.clubPlans.unshift({...fields,id:workspaceId("club"),createdAt:new Date().toISOString()});
      await tx.barberShop.update({where:{id:ctx!.id},data:{enabledFeatures:writeWorkspace(shop.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,adminEmail:ctx!.actor,
        action:selected?"BUSINESS_CLUB_UPDATED":"BUSINESS_CLUB_CREATED",
        details:{clubId:selected?.id??"created",name,active,subscriberDiscountPercent}
          as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
  }catch(err){error=message(err);}
  next(code,"clubes",error);
}

/** Parceiros são ofertas vinculadas a um clube, sem modificar transações passadas. */
export async function saveBusinessClubPartner(form:FormData){
  const code=field(form,"tenantCode",80).toUpperCase();
  let error="";let ctx:Ctx|undefined;
  try{
    ctx=await authorize(form);
    const planId=field(form,"planId",100);
    const partnerId=field(form,"partnerId",100);
    const remove=form.get("remove")==="yes";
    const name=field(form,"name",100);
    const percent=Number(field(form,"discountPercent",7).replace(",","."));
    if(!remove&&(name.length<2||!Number.isFinite(percent)||percent<=0||percent>100))
      throw Error("Informe nome do parceiro e desconto de 0,01% a 100%.");
    await prisma.$transaction(async tx=>{
      const shop=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(shop.enabledFeatures);
      const plan=ws.clubPlans.find(p=>p.id===planId);
      if(!plan)throw Error("Clube não encontrado.");
      const partners=[...(plan.partners??[])];
      if(remove){
        if(!partners.some(p=>p.id===partnerId))throw Error("Parceiro não encontrado.");
        plan.partners=partners.filter(p=>p.id!==partnerId);
      }else{
        if(partners.length>=20)throw Error("Limite de 20 parceiros por clube.");
        if(partners.some(p=>p.name.toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR")))
          throw Error("Parceiro já cadastrado.");
        partners.push({id:workspaceId("partner"),name,discountPercent:percent});
        plan.partners=partners;
      }
      await tx.barberShop.update({where:{id:ctx!.id},data:{enabledFeatures:writeWorkspace(shop.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,adminEmail:ctx!.actor,
        action:remove?"BUSINESS_CLUB_PARTNER_REMOVED":"BUSINESS_CLUB_PARTNER_CREATED",
        details:{planId,partnerId:remove?partnerId:"created"} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
  }catch(err){error=message(err);}
  next(code,"parceiros",error);
}

/** Pote global existente: a mesma regra usada nos relatórios e no rateio real. */
export async function saveBusinessPotRule(form:FormData){
  const code=field(form,"tenantCode",80).toUpperCase();
  let error="";let ctx:Ctx|undefined;
  try{
    ctx=await authorize(form);
    const percent=Number(field(form,"potPercent",7).replace(",","."));
    const reason=field(form,"reason",400);
    if(!Number.isFinite(percent)||percent<0||percent>100||reason.length<5)
      throw Error("Informe o percentual de 0 a 100 e o motivo da alteração.");
    await prisma.$transaction(async tx=>{
      const shop=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(shop.enabledFeatures);
      const previousPercent=ws.subscriptionPot.percent;
      ws.subscriptionPot.percent=percent;
      await tx.barberShop.update({where:{id:ctx!.id},data:{enabledFeatures:writeWorkspace(shop.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,adminEmail:ctx!.actor,
        action:"SUBSCRIPTION_POT_RATE_UPDATED",
        details:{previousPercent,newPercent:percent,reason} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
  }catch(err){error=message(err);}
  next(code,"pote",error);
}

export async function updateBusinessCarousel(form:FormData){
  const code=field(form,"tenantCode",80).toUpperCase();
  let error="";let ctx:Ctx|undefined;
  try{
    ctx=await authorize(form);
    const slot=Number(field(form,"slot",2));
    if(!Number.isInteger(slot)||slot<0||slot>2)throw Error("Posição de foto inválida.");
    const remove=form.get("remove")==="yes";
    let imageUrl="";
    let imageType="";
    if(!remove){
      const file=form.get("carouselFile");
      if(!(file instanceof File)||file.size===0||file.size>2*1024*1024||
        !["image/jpeg","image/png","image/webp"].includes(file.type)||
        form.get("imageConsent")!=="on")
        throw Error("Envie imagem JPEG, PNG ou WebP até 2 MB e confirme a autorização.");
      const head=new Uint8Array(await file.slice(0,16).arrayBuffer());
      const hex=[...head].map(x=>x.toString(16).padStart(2,"0")).join("");
      const valid=file.type==="image/jpeg"&&hex.startsWith("ffd8ff")||
        file.type==="image/png"&&hex.startsWith("89504e470d0a1a0a")||
        file.type==="image/webp"&&String.fromCharCode(...head.slice(0,4))==="RIFF"&&
          String.fromCharCode(...head.slice(8,12))==="WEBP";
      if(!valid)throw Error("O conteúdo do arquivo não corresponde ao formato de imagem.");
      const token=process.env.BLOB_READ_WRITE_TOKEN;
      if(!token)throw Error("O armazenamento público de imagens ainda não está configurado.");
      imageType=file.type;
      const extension=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
      const blob=await put("gromma-business/"+ctx.id+"/carousel-"+(slot+1)+"."+extension,file,{
        access:"public",token,addRandomSuffix:true,contentType:file.type,
      });
      imageUrl=blob.url;
    }
    await prisma.$transaction(async tx=>{
      const shop=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(shop.enabledFeatures);
      const images=[...ws.branding.carouselImages];
      if(slot>images.length)throw Error("Preencha as fotos anteriores primeiro.");
      const captions=[...ws.branding.carouselCaptions];
      if(remove){
        if(slot>=images.length)throw Error("Foto não encontrada.");
        images.splice(slot,1);
        captions.splice(slot,1);
      }else if(slot===images.length)images.push(imageUrl);
      else images[slot]=imageUrl;
      ws.branding={...ws.branding,carouselImages:images,carouselCaptions:captions};
      await tx.barberShop.update({where:{id:ctx!.id},data:{
        enabledFeatures:writeWorkspace(shop.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,adminEmail:ctx!.actor,
        action:remove?"BUSINESS_CAROUSEL_REMOVED":"BUSINESS_CAROUSEL_UPLOADED",
        details: ({position:slot+1,fileType:imageType||null,numberOfImages:images.length} as Prisma.InputJsonValue)}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
  }catch(err){error=message(err);}
  next(code,"carrossel",error);
}
