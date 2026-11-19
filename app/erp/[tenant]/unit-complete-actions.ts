"use server";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace,writeWorkspace } from "@/lib/erp-workspace";
import { isValidCnpj,unitPolicy,PAYMENT_METHODS } from "@/lib/unit-operations-policy";
import {validatedOwnerCnpj} from "@/lib/financial-registry-security";

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
    const verifiedBankAccountId=val(form,"verifiedBankAccountId",100);
    const paymentEmail=val(form,"paymentEmail",180).toLowerCase();
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
    if(paymentEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(paymentEmail))
      throw Error("Informe um e-mail válido.");
    await prisma.$transaction(async tx=>{
      const [shop,unit]=await Promise.all([
        tx.barberShop.findUniqueOrThrow({where:{id:shopId},select:{enabledFeatures:true,document:true,legalName:true}}),
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
      const activeCustom=ws.customPaymentMethods.filter(item=>item.active);
      const submittedCustom=form.getAll("customPaymentMethods").map(String);
      if(submittedCustom.length!==new Set(submittedCustom).size||
        submittedCustom.some(id=>!activeCustom.some(item=>item.id===id)))
        throw Error("Forma personalizada não cadastrada ou repetida");
      for(const item of activeCustom){
        const feePercent=number(form,"feePercent_"+item.id);
        const settlementDays=number(form,"settlementDays_"+item.id);
        if(!validPct(feePercent)||!Number.isSafeInteger(settlementDays)||settlementDays<0||settlementDays>90)
          throw Error("Confira a taxa e o prazo da forma de pagamento "+item.name);
        configurations[item.id]={feePercent,settlementDays,autoMarkPaid:false};
      }
      let bankCountry: "BR"|"INT"="BR";
      let bankCode="",bankName="",bankAgency="",bankAccount="",bankSwift="";
      let pixType: typeof old.pixType="",pixKey="",verifiedAccountId="";
      if(verifiedBankAccountId==="__legacy__"){
        if(!old.bankAccount||old.verifiedBankAccountId)throw Error("Conta antiga não disponível");
        // Somente histórico: permanece sem identificador de verificação.
        ({bankCountry,bankCode,bankName,bankAgency,bankAccount,bankSwift,pixType,pixKey}=old);
      }else if(verifiedBankAccountId){
        const selected=ws.financialBankAccounts.find(account=>account.id===verifiedBankAccountId&&
          account.active&&account.unitId===unitId&&Boolean(account.verifiedAt)&&
          Boolean(account.verificationReference));
        if(!selected)throw Error("Esta conta não tem verificação bancária ativa para a filial.");
        const legal=validatedOwnerCnpj(shop.document,old.legalDocument||legalDocument,shop.legalName??"");
        if(selected.ownerCnpj!==legal)throw Error("Titularidade do CNPJ divergente");
        bankCode=selected.bankCode;bankName=selected.bankName;
        bankAgency=selected.agency;bankAccount=selected.account;
        pixType=selected.pixType;pixKey=selected.pixKey;verifiedAccountId=selected.id;
      }
      const policy={
        ...old,postalCode,complement,bankCountry,bankCode,bankName,
        bankAgency,bankAccount,bankSwift,pixType,pixKey,paymentEmail,
        verifiedBankAccountId:verifiedAccountId,paymentMethods,
        customPaymentMethods:submittedCustom,
        paymentConfigurations:configurations,
        legalDocument:old.legalDocument||legalDocument,
        potPercent:null,
        cancellationMinutes:ws.bookingRules.cancellationMinutes,
        noShowBlockHours:ws.bookingRules.noShowBlockHours,
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
        details:{unitId,bankCountry,bankCode,bankChanged:old.bankCode!==bankCode,
          methods:paymentMethods,customMethods:submittedCustom,addressChanged:unit.address!==address,
          statusChanged:unit.active!==active,pixKeyChanged:old.pixKey!==pixKey,
          accountChanged:old.bankAccount!==bankAccount,
          verifiedBankAccountId:verifiedAccountId||null,
          registrationLocked:Boolean(old.legalDocument),bankOwnershipVerified:Boolean(verifiedAccountId)}}});
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
        details:{unitId,recordsPreserved:true}}});
    },{isolationLevel:"Serializable"});
  }catch(e){error=e instanceof Error?e.message.slice(0,180):"Não foi possível excluir a filial.";}
  revalidatePath("/erp/"+encodeURIComponent(code),"layout");
  redirect(keyUrl(code)+(error?"?unidadeErro="+encodeURIComponent(error):"?unidadeOk=excluida")+"#unidades");
}
