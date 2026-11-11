"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace,writeWorkspace } from "@/lib/erp-workspace";
import { DEFAULT_UNIT_POLICY,PAYMENT_METHODS,isValidCnpj,isValidPixKey } from "@/lib/unit-operations-policy";

const str=(f:FormData,key:string,max=250)=>String(f.get(key)??"").trim().slice(0,max);
const n=(f:FormData,key:string)=>Number(str(f,key,30).replace(",","."));
const pct=(x:number)=>Number.isFinite(x)&&x>=0&&x<=100;
const errorText=(e:unknown)=>e instanceof Error?e.message:"Não foi possível salvar os parâmetros.";

export async function saveUnitOperationsPolicy(form:FormData){
  const tenant=str(form,"tenantCode",80).toUpperCase();
  const base="/erp/"+encodeURIComponent(tenant)+"/unidades";
  const unitId=str(form,"unitId",90);
  let error="";
  try{
    const viewer=await requireTenantAccess(tenant);
    const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant},
      select:{id:true,accessReleased:true,status:true}});
    if(!shop||!shop.accessReleased||shop.status!=="APPROVED"||
      (viewer.type!=="ADMIN"&&!(viewer.type==="TENANT"&&viewer.barberShopId===shop.id&&viewer.role==="OWNER")))
      throw new Error("Somente o proprietário pode definir recebimentos e regras da unidade.");
    if(!await prisma.barberShopUnit.findFirst({where:{id:unitId,barberShopId:shop.id},select:{id:true}}))
      throw new Error("Filial não pertence à empresa.");

    const legalDocument=str(form,"legalDocument",20).replace(/\D/g,"");
    const paymentEmail=str(form,"paymentEmail",180).toLowerCase();
    const paymentPhone=str(form,"paymentPhone",25);
    const pixKey=str(form,"pixKey",150);
    const pixType=str(form,"pixType",8) as typeof DEFAULT_UNIT_POLICY.pixType;
    const methods=[...new Set(form.getAll("paymentMethods").map(String))]
      .filter((x):x is typeof PAYMENT_METHODS[number]=>(PAYMENT_METHODS as readonly string[]).includes(x));
    const debitFeePercent=n(form,"debitFeePercent");
    const creditFeePercent=n(form,"creditFeePercent");
    const settlementDays=n(form,"settlementDays");
    const cancellationMinutes=n(form,"cancellationMinutes");
    const noShowBlockHours=n(form,"noShowBlockHours");
    const potRaw=str(form,"potPercent",10);
    const potPercent=potRaw===""?null:Number(potRaw.replace(",","."));
    const coverImageUrl=str(form,"coverImageUrl",700);
    const welcomeText=str(form,"welcomeText",280);
    if(legalDocument&&!isValidCnpj(legalDocument))throw new Error("CNPJ inválido.");
    if(paymentEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentEmail))
      throw new Error("E-mail de recebimento inválido.");
    if(paymentPhone&&!/^\+?\d{10,15}$/.test(paymentPhone))
      throw new Error("Telefone de recebimento deve conter DDD e número.");
    if(!isValidPixKey(pixKey,pixType,legalDocument))
      throw new Error("Chave Pix inválida para o tipo escolhido; chave CNPJ deve corresponder ao CNPJ da unidade.");
    if(!pct(debitFeePercent)||!pct(creditFeePercent)||!Number.isInteger(settlementDays)||settlementDays<0||settlementDays>90||
       (potPercent!==null&&!pct(potPercent))||!Number.isInteger(cancellationMinutes)||
       cancellationMinutes<0||cancellationMinutes>10080||!Number.isInteger(noShowBlockHours)||
       noShowBlockHours<0||noShowBlockHours>720||
       (coverImageUrl&&!/^https:\/\//i.test(coverImageUrl)))
      throw new Error("Revise taxas, prazos, regras e URL HTTPS.");
    await prisma.$transaction(async tx=>{
      const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:shop.id},
        select:{enabledFeatures:true}});
      const ws=readWorkspace(fresh.enabledFeatures);
      const before=ws.unitPolicies[unitId]??DEFAULT_UNIT_POLICY;
      ws.unitPolicies[unitId]={
        ...before,
        legalDocument,paymentEmail,paymentPhone,pixKey,pixType,
        paymentMethods:methods,
        debitFeePercent,creditFeePercent,settlementDays,potPercent,
        cancellationMinutes,noShowBlockHours,coverImageUrl,welcomeText,
      };
      await tx.barberShop.update({where:{id:shop.id},
        data:{enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws)}});
      // Auditoria não registra a chave Pix nem dados de contato completos.
      await tx.adminAuditLog.create({data:{barberShopId:shop.id,adminEmail:viewer.email,
        action:"UNIT_OPERATIONS_POLICY_UPDATED",
        details:{unitId,paymentMethods:methods,
          previousPotPercent:before.potPercent??null,potPercent,
          cancellationMinutes,noShowBlockHours,
          changesInPaymentAccount:before.pixKey!==pixKey||before.legalDocument!==legalDocument,
          providerVerified:false} as Prisma.InputJsonValue}});
    },{isolationLevel:"Serializable"});
  }catch(e){error=errorText(e);}
  revalidatePath("/erp/"+encodeURIComponent(tenant),"layout");
  redirect(base+(error?"?unidadeErro="+encodeURIComponent(error):"?unidadeOk=politica")+
    "#unidades");
}
