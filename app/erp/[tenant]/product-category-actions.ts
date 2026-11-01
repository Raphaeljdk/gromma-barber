"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace,writeWorkspace } from "@/lib/erp-workspace";
import { isProductCommissionCategory } from "@/lib/product-commission-rules";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/** Existing products have no category in the legacy schema. This action
 * classifies them without altering stock, price, order or sales records. */
export async function assignProductCategory(form:FormData){
  const tenantCode=String(form.get("tenantCode")??"").slice(0,80).toUpperCase();
  if(!tenantCode)redirect("/cliente/login");
  const base="/erp/"+encodeURIComponent(tenantCode)+"/estoque";
  const viewer=await requireTenantAccess(tenantCode);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode},select:{
    id:true,status:true,accessReleased:true,
  }});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER"))
    redirect(base+"?erro=permissao#estoque");
  const productId=String(form.get("productId")??"").slice(0,80);
  const category=String(form.get("productCategory")??"").slice(0,30);
  if(!productId||!isProductCommissionCategory(category))
    redirect(base+"?erro=categoria#estoque");
  try{
    await prisma.$transaction(async tx=>{
      const product=await tx.product.findFirst({where:{
        id:productId,barberShopId:shop.id},select:{id:true},
      }});
      if(!product)throw Error("Product unavailable");
      const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},
        select:{enabledFeatures:true}});
      const workspace=readWorkspace(fresh.enabledFeatures);
      const before=workspace.productCategoryAssignments[productId]??null;
      workspace.productCategoryAssignments[productId]=category;
      await tx.barberShop.update({where:{id:shop.id},data:{
        enabledFeatures:writeWorkspace(fresh.enabledFeatures,workspace),
      }});
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,adminEmail:viewer.email,
        action:"PRODUCT_CATEGORY_UPDATED",details:{productId,previous:before,next:category}}});
    },{isolationLevel:"Serializable"});
  }catch(error){console.error("Product category save failed",error);
    redirect(base+"?erro=categoria#estoque");}
  revalidatePath("/erp/"+encodeURIComponent(tenantCode),"layout");
  redirect(base+"?ok=categoria#estoque");
}
