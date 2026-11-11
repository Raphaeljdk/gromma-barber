"use server";

import { Prisma } from "@prisma/client";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace,writeWorkspace } from "@/lib/erp-workspace";

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
    const hasBranches=field(form,"hasBranches",3)==="yes";
    if(tradeName.length<2)throw Error("Informe o nome fantasia do negócio.");
    await prisma.$transaction(async tx=>{
      const old=await tx.barberShop.findUniqueOrThrow({where:{id:ctx!.id},
        select:{tradeName:true,legalName:true,enabledFeatures:true}});
      const branchCount=await tx.barberShopUnit.count({where:{barberShopId:ctx!.id}});
      if(branchCount>1&&!hasBranches)
        throw Error("Há filiais cadastradas. Para manter a operação, a opção Possui filial deve permanecer em Sim.");
      const ws=readWorkspace(old.enabledFeatures);
      const previousFlag=ws.hasBranches;
      ws.hasBranches=hasBranches;
      await tx.barberShop.update({where:{id:ctx!.id},data:{
        tradeName,legalName:legalName||null,
        enabledFeatures:writeWorkspace(old.enabledFeatures,ws),
      }});
      await tx.adminAuditLog.create({data:{barberShopId:ctx!.id,
        adminEmail:ctx!.actor,action:"BUSINESS_IDENTITY_UPDATED",
        details:{changedFields:Object.entries({
          tradeName,legalName,hasBranches,
        }).filter(([key,value])=>key==="hasBranches"?
          previousFlag!==value:
          String(old[key as "tradeName"|"legalName"]??"")!==value
        ).map(([key])=>key)} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    refresh(ctx);
  }catch(err){error=message(err);}
  next(code,"identificacao",error);
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
      if(remove){
        if(slot>=images.length)throw Error("Foto não encontrada.");
        images.splice(slot,1);
      }else if(slot===images.length)images.push(imageUrl);
      else images[slot]=imageUrl;
      ws.branding={...ws.branding,carouselImages:images};
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
