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
  const path="/erp/"+encodeURIComponent(tenant)+"/equipe#equipe";
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
  }catch(error){
    console.error("Featured professional update failed",error);
    redirect("/erp/"+encodeURIComponent(tenant)+"/equipe?erro=destaque#equipe");
  }
  redirect(path);
}
