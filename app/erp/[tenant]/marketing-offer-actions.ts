"use server";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {readWorkspace,writeWorkspace,workspaceId,type ErpWorkspace} from "@/lib/erp-workspace";
import {requireTenantAccess} from "@/lib/tenant-auth";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {marketingTodayISO} from "@/lib/marketing-birthday";
import {resolveStockCategory} from "@/lib/accounting-kardex";
const val=(f:FormData,key:string,max=500)=>String(f.get(key)??"").trim().slice(0,max);
const url=(code:string,target="promocoes")=>"/erp/"+encodeURIComponent(code)+"/"+target;
const week=(day:Date)=>{const d=new Date(day);d.setUTCHours(12,0,0,0);return d};
async function editor(form:FormData,target:string){
 const code=val(form,"tenantCode",80).toUpperCase();
 const viewer=await requireTenantAccess(code);
 const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},
  select:{id:true,accessReleased:true,status:true}});
 if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER"))
   redirect(url(code,target)+"?erro=permissao");
 return {code,shopId:shop.id,actor:viewer.email};
}
async function save(ctx:{code:string;shopId:string;actor:string},action:string,
 details:Record<string,unknown>,mutate:(workspace:ErpWorkspace)=>void){
 await prisma.$transaction(async tx=>{
  const current=await tx.barberShop.findUniqueOrThrow({where:{id:ctx.shopId},select:{enabledFeatures:true}});
  const ws=readWorkspace(current.enabledFeatures);
  mutate(ws);
  await tx.barberShop.update({where:{id:ctx.shopId},
    data:{enabledFeatures:writeWorkspace(current.enabledFeatures,ws)}});
  await tx.adminAuditLog.create({data:{barberShopId:ctx.shopId,adminEmail:ctx.actor,action,
    details:details as Prisma.InputJsonValue}});
 },{isolationLevel:"Serializable"});
 revalidatePath("/erp/"+encodeURIComponent(ctx.code),"layout");
 revalidatePath("/barbearia/"+encodeURIComponent(ctx.code.toLowerCase()));
}
export async function createMarketingOffer(form:FormData){
 const ctx=await editor(form,"promocoes");
 const offerType=val(form,"kind",20);
 const kind=offerType==="DRINK"?"PRODUCT":offerType;
 const title=val(form,"title",120),description=val(form,"description",600),
  itemId=val(form,"itemId",100),audience=val(form,"audience",30),
  expiresAt=val(form,"expiresAt",10),
  discountPercent=Number(val(form,"discountPercent",12).replace(",","."));
 const audiences=["ALL","INACTIVE_30","INACTIVE_60","INACTIVE_90","BIRTHDAY","CLUB"];
 if(!["SERVICE","PRODUCT","DRINK"].includes(offerType)||title.length<2||
   description.length<3||!itemId||!audiences.includes(audience)||
   !Number.isFinite(discountPercent)||discountPercent<=0||discountPercent>100||
   !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)||expiresAt<marketingTodayISO())
   redirect(url(ctx.code)+"?erro=promocao");

 // Vincula exclusivamente um serviço, produto ou bebida ativo da empresa.
 const found=kind==="SERVICE" ? await prisma.service.findFirst({
   where:{id:itemId,barberShopId:ctx.shopId,active:true},select:{id:true,name:true},
 }) : await prisma.product.findFirst({
   where:{id:itemId,barberShopId:ctx.shopId,active:true},select:{id:true,name:true},
 });
 if(!found)redirect(url(ctx.code)+"?erro=item");
 try{
  await save(ctx,"MARKETING_OFFER_CREATED",
   {title,offerType,itemId,audience,discountPercent,expiresAt},ws=>{
    if(ws.marketingOffers.length>=300)throw Error("Limite de ofertas atingido");
    if(kind==="PRODUCT"){
     const isDrink=resolveStockCategory(ws,itemId)==="Bebidas";
     if(isDrink!==(offerType==="DRINK"))throw Error("Categoria do item não corresponde ao tipo");
    }
    ws.marketingOffers.unshift({id:workspaceId("offer"),title,description,
     kind:kind as "SERVICE"|"PRODUCT",offerType:offerType as "SERVICE"|"PRODUCT"|"DRINK",
     itemId,itemIds:[itemId],itemNames:[found.name],discountPercent,
     audience:audience as typeof ws.marketingOffers[number]["audience"],
     expiresAt,active:true,createdAt:new Date().toISOString()});
  });
 }catch{redirect(url(ctx.code)+"?erro=promocao");}
 redirect(url(ctx.code)+"?ok=promocao");
}

/** Oculta a promoção da lista e das vitrines sem apagar o histórico auditável. */
export async function deleteMarketingPromotion(form:FormData){
 const ctx=await editor(form,"promocoes");
 const id=val(form,"promotionId",100),source=val(form,"source",20);
 if(!id||!["OFFER","CAMPAIGN"].includes(source))
  redirect(url(ctx.code)+"?erro=excluir");
 try{
  await save(ctx,"MARKETING_PROMOTION_DELETED",{promotionId:id,source},ws=>{
   if(source==="OFFER"){
    const offer=ws.marketingOffers.find(item=>item.id===id&&item.active);
    if(!offer)throw Error("Promoção não encontrada");
    offer.active=false;
   }else{
    const campaign=ws.campaigns.find(item=>item.id===id&&item.active&&item.kind==="PROMOTION");
    if(!campaign)throw Error("Campanha não encontrada");
    campaign.active=false;
   }
  });
 }catch{redirect(url(ctx.code)+"?erro=excluir");}
 redirect(url(ctx.code)+"?ok=excluida");
}
export async function saveBirthdayPromotion(form:FormData){
 const ctx=await editor(form,"marketing-aniversariantes"),kind=val(form,"kind",12),
  value=Number(val(form,"value",12).replace(",",".")),description=val(form,"description",500),
  enabled=form.get("enabled")==="on";
 if(!["FIXED","PERCENT"].includes(kind)||!Number.isFinite(value)||value<=0||
   value>(kind==="PERCENT"?100:10000)||description.length<3)
  redirect(url(ctx.code,"marketing-aniversariantes")+"?erro=promocao");
 try{
  await save(ctx,"BIRTHDAY_PROMOTION_UPDATED",{kind,value,enabled},ws=>{
   ws.birthdayPromotion={kind:kind as "FIXED"|"PERCENT",value,description,enabled};
  });
 }catch{redirect(url(ctx.code,"marketing-aniversariantes")+"?erro=promocao");}
 redirect(url(ctx.code,"marketing-aniversariantes")+"?ok=promocao");
}
export async function createVerifiedCustomerReview(form:FormData){
 const tenant=val(form,"tenantCode",80).toUpperCase(),token=val(form,"accessToken",100),
  appointmentId=val(form,"appointmentId",100),comment=val(form,"comment",700),
  score=Number(val(form,"score",2));
 const destination="/meu-clube/"+encodeURIComponent(tenant)+"/"+encodeURIComponent(token);
 if(!Number.isSafeInteger(score)||score<1||score>5||comment.length<3)
  redirect(destination+"?erro=avaliacao");
 try{
  const {validatePrivateToken}=await import("@/lib/loyalty");
  await prisma.$transaction(async tx=>{
   const shop=await tx.barberShop.findUnique({where:{tenantCode:tenant},select:{id:true,enabledFeatures:true}});
   if(!shop)throw Error("Tenant inválido");
   const ws=readWorkspace(shop.enabledFeatures),session=validatePrivateToken(ws,token);
   if(!session)throw Error("Sessão inválida");
   const appointment=await tx.appointment.findFirst({where:{id:appointmentId,barberShopId:shop.id,
     customerId:session.customerId,status:"COMPLETED"},
     include:{customer:{select:{name:true}},barber:{select:{name:true}}}});
   if(!appointment||!appointment.barberId)throw Error("Atendimento não confirmado");
   if(ws.reviews.some(r=>r.appointmentId===appointmentId))throw Error("Já avaliado");
   if(ws.reviews.length>=2000)throw Error("Limite de avaliações");
   ws.reviews.unshift({id:workspaceId("review"),customerName:appointment.customer?.name??"Cliente",
    professionalName:appointment.barber?.name??"Profissional",score,comment,source:"CLIENT_APP",
    appointmentId,customerId:session.customerId,barberId:appointment.barberId,createdAt:new Date().toISOString()});
   await tx.barberShop.update({where:{id:shop.id},data:{enabledFeatures:writeWorkspace(shop.enabledFeatures,ws)}});
   await tx.adminAuditLog.create({data:{barberShopId:shop.id,adminEmail:"Portal do cliente",
    action:"VERIFIED_CLIENT_REVIEW",details:{appointmentId,score,customerId:session.customerId}}});
  },{isolationLevel:"Serializable"});
 }catch{redirect(destination+"?erro=avaliacao");}
 revalidatePath(destination);redirect(destination+"?ok=avaliacao");
}
