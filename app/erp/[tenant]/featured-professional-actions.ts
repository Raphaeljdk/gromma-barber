"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace,writeWorkspace } from "@/lib/erp-workspace";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function toggleFeaturedProfessional(form:FormData){
  const tenant=String(form.get("tenantCode")??"").trim().toUpperCase().slice(0,80);
  const userId=String(form.get("userId")??"").trim().slice(0,100);
  const enabled=form.get("featured")==="yes";
  const path="/erp/"+encodeURIComponent(tenant)+"/funcionarios-destaque#funcionarios-destaque";
  try{
    const viewer=await requireTenantAccess(tenant);
    const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant},
      select:{id:true,status:true,accessReleased:true}});
    if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
      (viewer.type!=="ADMIN"&&!(viewer.type==="TENANT"&&viewer.barberShopId===shop.id&&viewer.role==="OWNER")))
      throw Error("Apenas o proprietário pode destacar profissionais.");
    const professional=await prisma.shopUser.findFirst({where:{
      id:userId,barberShopId:shop.id,active:true,
      role:{in:["BARBER","OWNER","MANAGER"]}},select:{id:true}});
    if(!professional)throw Error("Profissional indisponível.");
    await prisma.$transaction(async tx=>{
      const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(fresh.enabledFeatures);
      const current=new Set(ws.featuredProfessionalIds);
      if(enabled){if(current.size>=12&&!current.has(userId))throw Error("Limite de 12 destaques.");
        current.add(userId);
      }else current.delete(userId);
      ws.featuredProfessionalIds=[...current];
      await tx.barberShop.update({where:{id:shop.id},
        data:{enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,adminEmail:viewer.email,
        action:"FEATURED_PROFESSIONAL_CHANGED",details:{userId,featured:enabled} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    revalidatePath("/barbearia/"+encodeURIComponent(tenant));
    revalidatePath("/erp/"+encodeURIComponent(tenant)+"/equipe");
    revalidatePath("/erp/"+encodeURIComponent(tenant)+"/funcionarios-destaque");
  }catch(error){
    console.error("Featured professional update failed",error);
    redirect("/erp/"+encodeURIComponent(tenant)+"/funcionarios-destaque?erro=destaque#funcionarios-destaque");
  }
  redirect(path);
}

/** Move somente um destaque elegível; a sequência é a ordem pública do site. */
export async function moveFeaturedProfessional(form:FormData){
  const tenant=String(form.get("tenantCode")??"").trim().toUpperCase().slice(0,80);
  const userId=String(form.get("userId")??"").trim().slice(0,100);
  const direction=String(form.get("direction")??"");
  const path="/erp/"+encodeURIComponent(tenant)+"/funcionarios-destaque";
  if(direction!=="up"&&direction!=="down")redirect(path+"?erro=destaque");
  try{
    const viewer=await requireTenantAccess(tenant);
    const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant},
      select:{id:true,status:true,accessReleased:true}});
    if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
      (viewer.type!=="ADMIN"&&!(viewer.type==="TENANT"&&viewer.barberShopId===shop.id&&viewer.role==="OWNER")))
      throw Error("Acesso não autorizado");
    await prisma.$transaction(async tx=>{
      const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(fresh.enabledFeatures);
      const current=[...new Set(ws.featuredProfessionalIds)];
      const index=current.indexOf(userId);
      const next=index+(direction==="up"?-1:1);
      if(index<0||next<0||next>=current.length)throw Error("Posição inválida");
      // Garante que nenhuma permissão ou destaque de outras empresas seja alterado.
      const members=await tx.shopUser.findMany({where:{barberShopId:shop.id,id:{in:[current[index],current[next]]},active:true,
        role:{in:["OWNER","MANAGER","BARBER"]}},select:{id:true}});
      if(members.length!==2)throw Error("Profissional não elegível");
      [current[index],current[next]]=[current[next],current[index]];
      ws.featuredProfessionalIds=current;
      await tx.barberShop.update({where:{id:shop.id},
        data:{enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,adminEmail:viewer.email,
        action:"FEATURED_PROFESSIONAL_REORDERED",
        details:{userId,from:index+1,to:next+1} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
    revalidatePath("/barbearia/"+encodeURIComponent(tenant));
    revalidatePath(path);
  }catch(error){
    console.error("Featured professional order update failed",error);
    redirect(path+"?erro=destaque#funcionarios-destaque");
  }
  redirect(path+"?ok=destaque#funcionarios-destaque");
}
