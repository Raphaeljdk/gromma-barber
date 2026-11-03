"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { PLAN_CONFIG } from "@/lib/plans";

const field=(form:FormData,key:string,max=180)=>String(form.get(key)??"").trim().slice(0,max);
class UnitError extends Error {}

/** Cadastro e edição não destrutivos. Somente o proprietário/administrador da empresa. */
export async function saveBarbershopUnit(form:FormData){
  const tenantCode=field(form,"tenantCode",80).toUpperCase();
  const base="/erp/"+encodeURIComponent(tenantCode)+"/unidades";
  const id=field(form,"unitId",90);
  const name=field(form,"name",120);
  const code=field(form,"code",16).toUpperCase();
  const city=field(form,"city",100);
  const state=field(form,"state",2).toUpperCase();
  const address=field(form,"address",240);
  const active=form.get("active")==="on";
  const qs=new URLSearchParams();
  try{
    const viewer=await requireTenantAccess(tenantCode);
    const shop=await prisma.barberShop.findUnique({where:{tenantCode},
      select:{id:true,status:true,accessReleased:true,activePlan:true,requestedPlan:true}});
    if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
      (viewer.type!=="ADMIN"&&!(viewer.type==="TENANT"&&viewer.barberShopId===shop.id&&viewer.role==="OWNER")))
      throw new UnitError("Somente o proprietário pode gerenciar as filiais.");
    if(name.length<2||city.length<2||!/^[A-Z]{2}$/.test(state)||
      (!id&&!/^[A-Z0-9_-]{2,16}$/.test(code)))
      throw new UnitError("Revise nome, cidade, UF e código da filial.");
    await prisma.$transaction(async tx=>{
      const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},
        select:{id:true,enabledFeatures:true,activePlan:true,requestedPlan:true}});
      const previous=id?await tx.barberShopUnit.findFirst({where:{id,barberShopId:shop.id},
        select:{id:true,code:true,name:true,address:true,city:true,state:true,active:true}}):null;
      if(id&&!previous)throw new UnitError("A filial não pertence a esta barbearia.");
      if(id && previous && previous.active && !active){
        const enabled=await tx.barberShopUnit.count({where:{barberShopId:shop.id,active:true}});
        if(enabled<=1)throw new UnitError("Mantenha pelo menos uma filial ativa.");
        const openCash=readWorkspace(fresh.enabledFeatures).cashSessions.some(session=>
          session.unitId===id&&!session.closedAt);
        if(openCash)throw new UnitError("Feche o caixa original antes de desativar a filial.");
        const [futureBookings,assignedStaff]=await Promise.all([
          tx.appointment.count({where:{barberShopId:shop.id,unitId:id,
            startsAt:{gte:new Date()},status:{in:["SCHEDULED","CONFIRMED","CHECKED_IN","IN_SERVICE"]}}}),
          tx.shopUser.count({where:{barberShopId:shop.id,unitId:id,active:true}}),
        ]);
        if(futureBookings)throw new UnitError("Reagende os atendimentos futuros antes de desativar a filial.");
        if(assignedStaff)throw new UnitError("Transfira os colaboradores ativos antes de desativar a filial.");
      }
      if(active && (!id || previous && !previous.active)){
        const plan=fresh.activePlan??fresh.requestedPlan;
        const max=PLAN_CONFIG[plan].maxUnits;
        const count=await tx.barberShopUnit.count({where:{barberShopId:shop.id,active:true}});
        if(max!==null && count>=max)
          throw new UnitError("O plano atual atingiu seu limite de unidades ativas.");
      }
      let savedId:string;
      if(previous){
        const saved=await tx.barberShopUnit.update({where:{id:previous.id},
          data:{name,city,state,address:address||null,active},select:{id:true}});
        savedId=saved.id;
      }else{
        if(await tx.barberShopUnit.findFirst({where:{barberShopId:shop.id,code},select:{id:true}}))
          throw new UnitError("Já existe uma filial com este código.");
        const created=await tx.barberShopUnit.create({data:{
          barberShopId:shop.id,code,name,city,state,address:address||null,active,
        },select:{id:true}});
        savedId=created.id;
      }
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,adminEmail:viewer.email,
        action:previous?"BARBERSHOP_UNIT_UPDATED":"BARBERSHOP_UNIT_CREATED",
        details:{unitId:savedId,code:previous?.code??code,previous:previous?{
          name:previous.name,city:previous.city,state:previous.state,
          active:previous.active,address:previous.address}:null,
          next:{name,city,state,active,address:address||null}}}});
    },{isolationLevel:"Serializable"});
    qs.set("unidadeOk",id?"atualizada":"cadastrada");
  }catch(e){
    console.error("Unit registration failed",e);
    qs.set("unidadeErro",e instanceof UnitError?e.message:
      "Não foi possível salvar a unidade. Confira o código, os vínculos e tente novamente.");
  }
  revalidatePath("/erp/"+encodeURIComponent(tenantCode),"layout");
  redirect(base+"?"+qs);
}
