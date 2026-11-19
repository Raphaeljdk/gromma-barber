"use server";
import {put} from "@vercel/blob";
import {Prisma} from "@prisma/client";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {prisma} from "@/lib/prisma";
import {requireTenantAccess} from "@/lib/tenant-auth";
import {readWorkspace,writeWorkspace,workspaceId,type ClubPartner} from "@/lib/erp-workspace";
import {isValidCnpj} from "@/lib/unit-operations-policy";
const val=(f:FormData,k:string,max=180)=>String(f.get(k)??"").trim().slice(0,max);
const link=(code:string)=>"/erp/"+encodeURIComponent(code)+"/marketing-parceiros";
async function authorize(form:FormData){
  const code=val(form,"tenantCode",80).toUpperCase();
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},
    select:{id:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER"))
    redirect(link(code)+"?erro=permissao");
  return {code,shopId:shop.id,actor:viewer.email};
}
const fail=(code:string,reason:string):never=>redirect(link(code)+"?erro="+encodeURIComponent(reason));
const categories=["ESPORTE","GASTRONOMIA","LAZER","SAUDE_ESTETICA","SERVICOS","VESTUARIO"];
export async function createClubPartner(form:FormData){
  const ctx=await authorize(form);
  const name=val(form,"name",120),cnpj=val(form,"cnpj",18).replace(/\D/g,""),
    address=val(form,"address",240),phone=val(form,"phone",24),
    instagramUrl=val(form,"instagramUrl",240),category=val(form,"category",30),
    promoCode=val(form,"promoCode",40).toUpperCase(),
    promoDescription=val(form,"promoDescription",400),
    expiresAt=val(form,"expiresAt",10),rawDiscount=val(form,"discountPercent",12);
  const discountPercent=Number(rawDiscount.replace(",","."));
  const instagram=(()=>{try{return new URL(instagramUrl);}catch{return null;}})();
  if(!instagram)return fail(ctx.code,"instagram");
  if(name.length<2||!isValidCnpj(cnpj)||address.length<7||
    !/^\+?\d{10,13}$/.test(phone.replace(/[\s()-]/g,""))||
    instagram.protocol!=="https:"||
    !["www.instagram.com","instagram.com"].includes(instagram.hostname.toLowerCase())||
    !/^\/[a-zA-Z0-9_.]+\/?$/.test(instagram.pathname)||
    !categories.includes(category)||!Number.isFinite(discountPercent)||discountPercent<=0||discountPercent>100||
    !/^[A-Z0-9_-]{3,40}$/.test(promoCode)||promoDescription.length<3||
    !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)||expiresAt<
      new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",
        year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()))
    fail(ctx.code,"dados");
  const logoFile=form.get("logoFile");
  let logoUrl="";
  if(logoFile instanceof File&&logoFile.size>0){
    if(logoFile.size>2*1024*1024||!["image/jpeg","image/png","image/webp"].includes(logoFile.type)||
      form.get("logoConsent")!=="on")fail(ctx.code,"logo");
    const head=new Uint8Array(await logoFile.slice(0,16).arrayBuffer());
    const h=[...head].map(n=>n.toString(16).padStart(2,"0")).join("");
    const valid=logoFile.type==="image/jpeg"&&h.startsWith("ffd8ff")||
      logoFile.type==="image/png"&&h.startsWith("89504e470d0a1a0a")||
      logoFile.type==="image/webp"&&String.fromCharCode(...head.slice(0,4))==="RIFF"&&
        String.fromCharCode(...head.slice(8,12))==="WEBP";
    if(!valid)fail(ctx.code,"logo");
    const token=process.env.BLOB_READ_WRITE_TOKEN;
    if(!token)fail(ctx.code,"armazenamento");
    try{
      const ext=logoFile.type==="image/png"?"png":logoFile.type==="image/webp"?"webp":"jpg";
      const blob=await put("gromma-partners/"+ctx.shopId+"/"+cnpj+"."+ext,logoFile,
        {access:"public",addRandomSuffix:true,contentType:logoFile.type,token});
      logoUrl=blob.url;
    }catch{fail(ctx.code,"armazenamento");}
  }
  try{
    await prisma.$transaction(async tx=>{
      const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:ctx.shopId},
        select:{enabledFeatures:true}});
      const ws=readWorkspace(fresh.enabledFeatures);
      if(ws.clubPartners.length>=100||
        ws.clubPartners.some(partner=>partner.active&&(partner.cnpj===cnpj||
          partner.promoCode.toUpperCase()===promoCode)))throw Error("Parceiro duplicado");
      const partner:ClubPartner={
        id:workspaceId("partner"),name,cnpj,address,phone,instagramUrl:instagram.toString(),
        category:category as ClubPartner["category"],discountPercent,
        logoUrl,promoCode,promoDescription,expiresAt,active:true,createdAt:new Date().toISOString(),
      };
      ws.clubPartners.push(partner);
      await tx.barberShop.update({where:{id:ctx.shopId},
        data:{enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{
        barberShopId:ctx.shopId,adminEmail:ctx.actor,action:"CLUB_PARTNER_CREATED",
        details:{partnerId:partner.id,name,cnpj,category,discountPercent,expiresAt} as Prisma.InputJsonValue,
      }});
    },{isolationLevel:"Serializable"});
  }catch{fail(ctx.code,"cadastro");}
  revalidatePath("/barbearia/"+encodeURIComponent(ctx.code.toLowerCase()));
  revalidatePath("/erp/"+encodeURIComponent(ctx.code),"layout");
  redirect(link(ctx.code)+"?ok=parceiro");
}
export async function deactivateClubPartner(form:FormData){
  const ctx=await authorize(form),id=val(form,"partnerId",100);
  try{
    await prisma.$transaction(async tx=>{
      const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:ctx.shopId},select:{enabledFeatures:true}});
      const ws=readWorkspace(fresh.enabledFeatures);
      const partner=ws.clubPartners.find(item=>item.id===id&&item.active);
      if(!partner)throw Error("Parceiro não encontrado");
      partner.active=false;
      await tx.barberShop.update({where:{id:ctx.shopId},data:{
        enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws),
      }});
      await tx.adminAuditLog.create({data:{
        barberShopId:ctx.shopId,adminEmail:ctx.actor,action:"CLUB_PARTNER_DEACTIVATED",
        details:{partnerId:id},
      }});
    },{isolationLevel:"Serializable"});
  }catch{fail(ctx.code,"parceiro");}
  revalidatePath("/erp/"+encodeURIComponent(ctx.code),"layout");
  revalidatePath("/barbearia/"+encodeURIComponent(ctx.code.toLowerCase()));
  redirect(link(ctx.code)+"?ok=desativado");
}
