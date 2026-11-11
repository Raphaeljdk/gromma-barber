"use server";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace,writeWorkspace } from "@/lib/erp-workspace";
import { isValidCnpj,isValidPixKey,unitPolicy,PAYMENT_METHODS } from "@/lib/unit-operations-policy";

const val=(form:FormData,key:string,max=180)=>String(form.get(key)??"").trim().slice(0,max);
const number=(form:FormData,key:string)=>Number(val(form,key,16).replace(",","."));
const validPct=(n:number)=>Number.isFinite(n)&&n>=0&&n<=100;
const digits=(value:string)=>value.replace(/\D/g,"");
const keyUrl=(code:string)=>"/erp/"+encodeURIComponent(code)+"/unidades";
type ViewerContext={shopId:string;actor:string};
async function authorize(tenantCode:string):Promise<ViewerContext>{
  const viewer=await requireTenantAccess(tenantCode);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode},
    select:{id:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    (viewer.type!=="ADMIN"&&!(viewer.type==="TENANT"&&viewer.barberShopId===shop.id&&viewer.role==="OWNER")))
    throw Error("Somente o proprietário pode editar ou excluir filiais.");
  return {shopId:shop.id,actor:viewer.email};
}
async function canDeactivate(
  tx:Prisma.TransactionClient, shopId:string,unitId:string,enabledFeatures:Prisma.JsonValue|null,
  countActive:number,
){
  if(countActive<=1)throw Error("Mantenha pelo menos uma filial ativa.");
  const ws=readWorkspace(enabledFeatures);
  if(ws.cashSessions.some(session=>session.unitId===unitId&&!session.closedAt))
    throw Error("Feche o caixa da filial antes de excluir.");
  const [future,staff]=await Promise.all([
    tx.appointment.count({where:{barberShopId:shopId,unitId,
      startsAt:{gte:new Date()},status:{in:["SCHEDULED","CONFIRMED","CHECKED_IN","IN_SERVICE"]}}}),
    tx.shopUser.count({where:{barberShopId:shopId,unitId,active:true}}),
  ]);
  if(future)throw Error("Reagende ou cancele os agendamentos futuros antes de excluir.");
  if(staff)throw Error("Transfira os funcionários ativos antes de excluir.");
}
/** Salva dados cadastrais, conta de recebimento e regras da filial em uma transação. */
export async function saveCompleteUnit(form:FormData){
  const code=val(form,"tenantCode",80).toUpperCase();
  const unitId=val(form,"unitId",90);
  let error="";
  try{
    const {shopId,actor}=await authorize(code);
    const name=val(form,"name",120);
    const city=val(form,"city",100);
    const state=val(form,"state",2).toUpperCase();
    const address=val(form,"address",240);
    const postalCode=digits(val(form,"postalCode",10));
    const complement=val(form,"complement",120);
    const legalDocument=digits(val(form,"legalDocument",18));
    const bankCountry=val(form,"bankCountry",3)==="INT"?"INT":"BR";
    const bankChoice=val(form,"bankCode",180);
    const bankMatch=bankChoice.match(/^(\\d{3}|\\d{8})(?:\\s*[—-]\\s*(.*))?$/);
    if(bankCountry==="BR"&&bankChoice&&!bankMatch)
      throw Error("Selecione um banco brasileiro da lista por código.");
    const bankCode=bankCountry==="BR"?(bankMatch?.[1]??""):"";
    const bankName=bankCountry==="BR"?(bankMatch?.[2]??"").slice(0,150):val(form,"bankName",150);
    const bankAgency=val(form,"bankAgency",30);
    const bankAccount=val(form,"bankAccount",35);
    const bankSwift=val(form,"bankSwift",11).toUpperCase();
    const pixType=val(form,"pixType",8) as "CNPJ"|"EMAIL"|"PHONE"|"EVP"|"";
    const pixKey=val(form,"pixKey",150);
    const paymentMethods=[...new Set(form.getAll("paymentMethods").map(String))].filter(
      (method):method is typeof PAYMENT_METHODS[number]=>(PAYMENT_METHODS as readonly string[]).includes(method));
    const configurations:Record<string,{feePercent:number;settlementDays:number;autoMarkPaid:boolean}>={};
    for(const method of PAYMENT_METHODS){
      const feePercent=number(form,"feePercent_"+method);
      const settlementDays=number(form,"settlementDays_"+method);
      if(!validPct(feePercent)||!Number.isSafeInteger(settlementDays)||settlementDays<0||settlementDays>90)
        throw Error("Confira taxas e prazos de recebimento das formas de pagamento.");
      configurations[method]={feePercent,settlementDays,
        autoMarkPaid:form.get("autoMarkPaid_"+method)==="on"};
    }
    const welcomeText=val(form,"welcomeText",280);
    const active=form.get("active")==="on";
    if(name.length<2||city.length<2||!/^[A-Z]{2}$/.test(state)||postalCode.length!==0&&postalCode.length!==8)
      throw Error("Confira nome, cidade, UF e CEP da filial.");
    if(legalDocument&&!isValidCnpj(legalDocument))throw Error("CNPJ inválido.");
    if(bankCountry==="BR"&&bankCode&&bankCode.length!==3&&bankCode.length!==8)
      throw Error("Informe o número-código bancário de 3 dígitos ou o ISPB de 8 dígitos.");
    if(bankCountry==="INT"&&bankSwift&&!/^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bankSwift))
      throw Error("O código SWIFT/BIC deve ter 8 ou 11 caracteres.");
    if(!["","CNPJ","EMAIL","PHONE","EVP"].includes(pixType)||
      !isValidPixKey(pixKey,pixType,legalDocument))
      throw Error("Chave Pix inválida. Se for CNPJ, ela deve corresponder ao CNPJ desta filial.");
    await prisma.$transaction(async tx=>{
      const [shop,unit]=await Promise.all([
        tx.barberShop.findUniqueOrThrow({where:{id:shopId},select:{enabledFeatures:true}}),
        tx.barberShopUnit.findFirst({where:{id:unitId,barberShopId:shopId},
          select:{id:true,name:true,city:true,state:true,address:true,active:true}}),
      ]);
      if(!unit)throw Error("Filial não encontrada nesta empresa.");
      const ws=readWorkspace(shop.enabledFeatures);
      const old=unitPolicy(ws,unitId);
      if(old.legalDocument && legalDocument!==old.legalDocument)
        throw Error("O CNPJ cadastrado não pode ser alterado nesta tela.");
      if(!active&&unit.active)await canDeactivate(tx,shopId,unitId,shop.enabledFeatures,
        await tx.barberShopUnit.count({where:{barberShopId:shopId,active:true}}));
      const policy={
        ...old,postalCode,complement,bankCountry,bankCode,bankName,
        bankAgency,bankAccount,bankSwift,pixType,pixKey,paymentMethods,
        paymentConfigurations:configurations,
        legalDocument:old.legalDocument||legalDocument,
        debitFeePercent:configurations.DEBIT.feePercent,
        creditFeePercent:configurations.CREDIT.feePercent,
        settlementDays:configurations.CREDIT.settlementDays,
        welcomeText,
      };
      await tx.barberShopUnit.update({where:{id:unit.id},
        data:{name,city,state,address:address||null,active}});
      ws.unitPolicies[unitId]=policy;
      await tx.barberShop.update({where:{id:shopId},data:{
        enabledFeatures:writeWorkspace(shop.enabledFeatures,ws),
      }});
      await tx.adminAuditLog.create({data:{barberShopId:shopId,adminEmail:actor,
        action:"UNIT_COMPLETE_SETTINGS_UPDATED",
        details:({unitId,bankCountry,bankCode,bankChanged:old.bankCode!==bankCode,
          methods:paymentMethods,addressChanged:unit.address!==address,
          statusChanged:unit.active!==active,pixKeyChanged:old.pixKey!==pixKey,
          accountChanged:old.bankAccount!==bankAccount,
          registrationLocked:Boolean(old.legalDocument),bankOwnershipVerified:false}
          as Prisma.InputJsonValue)}});
    },{isolationLevel:"Serializable"});
  }catch(e){error=e instanceof Error?e.message.slice(0,180):"Não foi possível salvar a filial.";}
  revalidatePath("/erp/"+encodeURIComponent(code),"layout");
  redirect(keyUrl(code)+(error?"?unidadeErro="+encodeURIComponent(error):"?unidadeOk=geral")+"#unidades");
}

/** Excluir = desativar/arquivar, nunca apagar históricos, caixas ou atendimentos. */
export async function archiveBusinessUnit(form:FormData){
  const code=val(form,"tenantCode",80).toUpperCase();
  const unitId=val(form,"unitId",90);
  let error="";
  try{
    const {shopId,actor}=await authorize(code);
    await prisma.$transaction(async tx=>{
      const [shop,unit]=await Promise.all([
        tx.barberShop.findUniqueOrThrow({where:{id:shopId},select:{enabledFeatures:true}}),
        tx.barberShopUnit.findFirst({where:{id:unitId,barberShopId:shopId},select:{id:true,active:true}}),
      ]);
      if(!unit)throw Error("Filial não encontrada.");
      if(!unit.active)throw Error("A filial já está inativa.");
      await canDeactivate(tx,shopId,unitId,shop.enabledFeatures,
        await tx.barberShopUnit.count({where:{barberShopId:shopId,active:true}}));
      await tx.barberShopUnit.update({where:{id:unitId},data:{active:false}});
      await tx.adminAuditLog.create({data:{barberShopId:shopId,adminEmail:actor,
        action:"BARBERSHOP_UNIT_ARCHIVED",
        details:({unitId,recordsPreserved:true} as Prisma.InputJsonValue)}});
    },{isolationLevel:"Serializable"});
  }catch(e){error=e instanceof Error?e.message.slice(0,180):"Não foi possível excluir a filial.";}
  revalidatePath("/erp/"+encodeURIComponent(code),"layout");
  redirect(keyUrl(code)+(error?"?unidadeErro="+encodeURIComponent(error):"?unidadeOk=excluida")+"#unidades");
}
