"use server";
import {Prisma} from "@prisma/client";
import {prisma} from "@/lib/prisma";
import {requireTenantAccess} from "@/lib/tenant-auth";
import {readWorkspace,writeWorkspace,workspaceId,type ErpWorkspace} from "@/lib/erp-workspace";
import {loyaltyBalance,appendMovement,newPrivateLoyaltyToken,newReferralCode,tokenHash,
  validatePrivateToken,normalizePhone} from "@/lib/loyalty";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
const value=(f:FormData,k:string,max=100)=>String(f.get(k)??"").trim().slice(0,max);
const url=(tenant:string)=>"/erp/"+encodeURIComponent(tenant)+"/marketing-pontos";
const today=()=>new Date().toISOString();
async function owner(f:FormData){
  const tenant=value(f,"tenantCode",80).toUpperCase();
  const viewer=await requireTenantAccess(tenant);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant},
    select:{id:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER"))
    redirect(url(tenant)+"?erro=permissao");
  return {tenant,shopId:shop.id,actor:viewer.email};
}
type Ctx={tenant:string;shopId:string;actor:string};
async function update(ctx:Ctx,action:string,details:Record<string,unknown>,
  handler:(workspace:ErpWorkspace,tx:Prisma.TransactionClient)=>Promise<void>|void){
  await prisma.$transaction(async tx=>{
    const shop=await tx.barberShop.findUniqueOrThrow({
      where:{id:ctx.shopId},select:{enabledFeatures:true},
    });
    const ws=readWorkspace(shop.enabledFeatures);
    await handler(ws,tx);
    await tx.barberShop.update({where:{id:ctx.shopId},data:{
      enabledFeatures:writeWorkspace(shop.enabledFeatures,ws),
    }});
    await tx.adminAuditLog.create({data:{barberShopId:ctx.shopId,
      adminEmail:ctx.actor,action,details:details as Prisma.InputJsonValue}});
  },{isolationLevel:"Serializable"});
  revalidatePath("/erp/"+encodeURIComponent(ctx.tenant),"layout");
}
export async function saveLoyaltySettings(form:FormData){
  const ctx=await owner(form),enabled=form.get("enabled")==="on";
  const referralPoints=Number(value(form,"referralPoints",8));
  if(!Number.isSafeInteger(referralPoints)||referralPoints<0||referralPoints>100000)
    redirect(url(ctx.tenant)+"?erro=pontos");
  try{
    await update(ctx,"LOYALTY_SETTINGS_UPDATED",{enabled,referralPoints},ws=>{
      ws.loyaltySettings={enabled,referralPoints};
    });
  }catch{redirect(url(ctx.tenant)+"?erro=pontos");}
  redirect(url(ctx.tenant)+"?ok=config");
}
export async function createLoyaltyReward(form:FormData){
  const ctx=await owner(form),kind=value(form,"kind",20);
  const itemId=value(form,"itemId",100),points=Number(value(form,"points",8));
  if(!["SERVICE","PRODUCT"].includes(kind)||!itemId||!Number.isSafeInteger(points)||
    points<1||points>1000000)redirect(url(ctx.tenant)+"?erro=recompensa");
  const item=kind==="SERVICE"?await prisma.service.findFirst({where:{
    id:itemId,barberShopId:ctx.shopId,active:true},select:{name:true}}):
    await prisma.product.findFirst({where:{id:itemId,barberShopId:ctx.shopId,active:true},select:{name:true}});
  if(!item)redirect(url(ctx.tenant)+"?erro=recompensa");
  try{
    await update(ctx,"LOYALTY_REWARD_CREATED",{itemId,kind,points},ws=>{
      if(ws.loyaltyRewards.length>=150||ws.loyaltyRewards.some(reward=>reward.active&&reward.kind===kind&&
        reward.itemId===itemId))throw Error("Recompensa duplicada");
      ws.loyaltyRewards.push({id:workspaceId("reward"),kind:kind as "SERVICE"|"PRODUCT",
        itemId,name:item.name,points,active:true});
    });
  }catch{redirect(url(ctx.tenant)+"?erro=recompensa");}
  redirect(url(ctx.tenant)+"?ok=recompensa");
}
export async function disableLoyaltyReward(form:FormData){
  const ctx=await owner(form),id=value(form,"rewardId",100);
  try{
    await update(ctx,"LOYALTY_REWARD_DISABLED",{rewardId:id},ws=>{
      const reward=ws.loyaltyRewards.find(item=>item.id===id&&item.active);
      if(!reward)throw Error("Recompensa indisponível");reward.active=false;
    });
  }catch{redirect(url(ctx.tenant)+"?erro=recompensa");}
  redirect(url(ctx.tenant)+"?ok=recompensa");
}
export async function createCustomerPointsLink(form:FormData){
  const ctx=await owner(form),customerId=value(form,"customerId",100);
  const customer=await prisma.customer.findFirst({where:{barberShopId:ctx.shopId,id:customerId,active:true},
    select:{id:true}});
  if(!customer)redirect(url(ctx.tenant)+"?erro=cliente");
  const token=newPrivateLoyaltyToken(),hash=tokenHash(token);
  try{
    await update(ctx,"LOYALTY_PRIVATE_LINK_ISSUED",{customerId},ws=>{
      const previous=ws.loyaltyAccess.find(item=>item.customerId===customerId);
      if(!previous&&ws.loyaltyAccess.length>=3000)throw Error("Limite de links");
      const referralCode=previous?.referralCode??newReferralCode();
      ws.loyaltyAccess=ws.loyaltyAccess.filter(item=>item.customerId!==customerId);
      ws.loyaltyAccess.push({customerId,tokenHash:hash,referralCode,
        createdAt:today(),expiresAt:new Date(Date.now()+90*24*60*60*1000).toISOString()});
    });
  }catch{redirect(url(ctx.tenant)+"?erro=cliente");}
  redirect(url(ctx.tenant)+"?ok=link&cliente="+encodeURIComponent(customerId)+
    "&acesso="+encodeURIComponent(token));
}
async function redeem(tenant:string,token:string,rewardId:string){
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant},
    select:{id:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased)throw Error("Acesso indisponível");
  await prisma.$transaction(async tx=>{
    const fresh=await tx.barberShop.findUniqueOrThrow({
      where:{id:shop.id},select:{enabledFeatures:true}});
    const ws=readWorkspace(fresh.enabledFeatures),link=validatePrivateToken(ws,token);
    if(!link||!ws.loyaltySettings.enabled)throw Error("Link inválido ou programa inativo");
    const customer=await tx.customer.findFirst({where:{id:link.customerId,barberShopId:shop.id,active:true},
      select:{id:true}});
    if(!customer)throw Error("Cliente indisponível");
    const reward=ws.loyaltyRewards.find(r=>r.id===rewardId&&r.active);
    if(!reward)throw Error("Recompensa não disponível");
    const remaining=loyaltyBalance(ws,customer.id);
    if(remaining<reward.points)throw Error("Pontos insuficientes");
    const redemptionId=workspaceId("redeem");
    if(ws.loyaltyRedemptions.length>=4000)throw Error("Limite de resgates");
    appendMovement(ws,{customerId:customer.id,delta:-reward.points,kind:"REDEMPTION",
      sourceKey:"redeem:"+redemptionId,description:"Solicitação: "+reward.name});
    ws.loyaltyRedemptions.push({id:redemptionId,customerId:customer.id,rewardId:reward.id,
      rewardName:reward.name,kind:reward.kind,itemId:reward.itemId,points:reward.points,
      status:"PENDING",createdAt:today(),fulfilledAt:""});
    await tx.barberShop.update({where:{id:shop.id},data:{
      enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws)}});
    await tx.adminAuditLog.create({data:{barberShopId:shop.id,
      adminEmail:"Portal do cliente",action:"LOYALTY_REDEMPTION_REQUESTED",
      details:{customerId:customer.id,rewardId:reward.id,redemptionId,points:reward.points}}});
  },{isolationLevel:"Serializable"});
}
export async function requestLoyaltyReward(form:FormData){
  const tenant=value(form,"tenantCode",80).toUpperCase();
  const token=value(form,"accessToken",100),rewardId=value(form,"rewardId",100);
  if(!/^[A-Z0-9-]{4,80}$/.test(tenant)||!token||!rewardId)
    redirect("/cliente/login");
  try{await redeem(tenant,token,rewardId);}
  catch{redirect("/meu-clube/"+encodeURIComponent(tenant)+"/"+encodeURIComponent(token)+"?erro=resgate");}
  revalidatePath("/meu-clube/"+encodeURIComponent(tenant)+"/"+encodeURIComponent(token));
  redirect("/meu-clube/"+encodeURIComponent(tenant)+"/"+encodeURIComponent(token)+"?ok=resgate");
}
export async function finishLoyaltyReward(form:FormData){
  const ctx=await owner(form),id=value(form,"redemptionId",100);
  const status=value(form,"status",10);
  if(!["FULFILLED","CANCELED"].includes(status))redirect(url(ctx.tenant)+"?erro=resgate");
  try{
    await update(ctx,status==="FULFILLED"?"LOYALTY_REDEMPTION_FULFILLED":"LOYALTY_REDEMPTION_CANCELLED",
      {redemptionId:id,status},async(ws,tx)=>{
      const redemption=ws.loyaltyRedemptions.find(item=>item.id===id&&item.status==="PENDING");
      if(!redemption)throw Error("Resgate não pendente");
      if(status==="CANCELED"){
        appendMovement(ws,{customerId:redemption.customerId,delta:redemption.points,
          kind:"REVERSAL",sourceKey:"cancel-redeem:"+id,
          description:"Devolução de pontos do resgate cancelado"});
        redemption.status="CANCELED";
        return;
      }
      if(redemption.kind==="PRODUCT"){
        const product=await tx.product.findFirst({where:{
          id:redemption.itemId,barberShopId:ctx.shopId,active:true},select:{id:true}});
        if(!product)throw Error("Produto não encontrado");
        const customer=await tx.customer.findFirst({where:{
          id:redemption.customerId,barberShopId:ctx.shopId},select:{unitId:true}});
        const unit=await tx.barberShopUnit.findFirst({where:{
          barberShopId:ctx.shopId,active:true,...(customer?.unitId?{id:customer.unitId}:{}),
        },orderBy:{name:"asc"},select:{id:true}});
        if(!unit)throw Error("Sem filial ativa");
        const stock=await tx.stockMovement.groupBy({by:["type"],
          where:{barberShopId:ctx.shopId,unitId:unit.id,productId:product.id},
          _sum:{quantity:true}});
        const available=stock.reduce((n,item)=>n+(item.type==="OUT"?-1:1)*Number(item._sum.quantity??0),0);
        if(available<1)throw Error("Estoque insuficiente para resgate");
        await tx.stockMovement.create({data:{barberShopId:ctx.shopId,unitId:unit.id,
          productId:product.id,type:"OUT",quantity:1,reason:"Resgate pontos "+id}});
      }
      redemption.status="FULFILLED";redemption.fulfilledAt=today();
    });
  }catch{redirect(url(ctx.tenant)+"?erro=resgate");}
  redirect(url(ctx.tenant)+"?ok=resgate");
}
export async function registerReferralLead(form:FormData){
  const tenant=value(form,"tenantCode",80).toUpperCase(),code=value(form,"referralCode",24).toUpperCase();
  const phone=normalizePhone(value(form,"phone",25));
  const target="/indique/"+encodeURIComponent(tenant)+"/"+encodeURIComponent(code);
  if(!phone)return redirect(target+"?erro=telefone");
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant},select:{
    id:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased)
    redirect(target+"?erro=link");
  try{
    await prisma.$transaction(async tx=>{
      const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},select:{enabledFeatures:true}});
      const ws=readWorkspace(fresh.enabledFeatures);
      if(!ws.loyaltySettings.enabled||!ws.loyaltySettings.referralPoints)
        throw Error("Indicações desabilitadas");
      const link=ws.loyaltyAccess.find(item=>item.referralCode===code);
      if(!link)throw Error("Código inválido");
      const referring=await tx.customer.findFirst({where:{id:link.customerId,barberShopId:shop.id,active:true},
        select:{phone:true,whatsapp:true}});
      if(!referring||[referring.phone,referring.whatsapp].some(v=>normalizePhone(v??"")===phone))
        throw Error("Indicação própria ou inválida");
      const existing=await tx.customer.findMany({where:{barberShopId:shop.id,active:true},
        select:{phone:true,whatsapp:true},take:5000});
      if(existing.some(c=>[c.phone,c.whatsapp].some(p=>normalizePhone(p??"")===phone)))return;
      if(ws.loyaltyReferrals.some(item=>item.phone===phone)||ws.loyaltyReferrals.length>=4000||
        ws.loyaltyReferrals.filter(item=>item.referrerId===link.customerId&&item.status==="PENDING").length>=30)
        return;
      const id=workspaceId("referral");
      ws.loyaltyReferrals.push({id,referrerId:link.customerId,phone,status:"PENDING",
        rewardCommandId:"",createdAt:today()});
      await tx.barberShop.update({where:{id:shop.id},data:{enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws)}});
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,adminEmail:"Site de indicação",
        action:"LOYALTY_REFERRAL_REGISTERED",details:{referralId:id,referrerId:link.customerId}}});
    },{isolationLevel:"Serializable"});
  }catch{redirect(target+"?erro=link");}
  redirect(target+"?ok=indicacao");
}
