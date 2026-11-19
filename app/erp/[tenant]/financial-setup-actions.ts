"use server";

import type {Prisma} from "@prisma/client";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {prisma} from "@/lib/prisma";
import {requireTenantAccess} from "@/lib/tenant-auth";
import {readWorkspace,writeWorkspace,workspaceId,type ErpWorkspace} from "@/lib/erp-workspace";
import {unitPolicy} from "@/lib/unit-operations-policy";
import {PAYMENT_METHODS} from "@/lib/checkout";
import {getBrazilBankDirectory} from "@/lib/bank-directory";
import {validatedOwnerCnpj,validPixKey,verifyBankAccountOwnership,isBankVerifierConfigured,bankDigits,type PixRegistrationType} from "@/lib/financial-registry-security";
import {unitPolicy} from "@/lib/unit-operations-policy";

type FinanceEditor={
  code:string;viewerEmail:string;shopId:string;isTenantOwner:boolean;
  document:string;legalName:string;
};
const val=(form:FormData,key:string,max=100)=>String(form.get(key)??"").trim().slice(0,max);
const scope=(code:string,module:string)=>"/erp/"+encodeURIComponent(code)+"/"+module;

async function authorize(form:FormData):Promise<FinanceEditor>{
  const code=val(form,"tenantCode",80).toUpperCase();
  if(!code)redirect("/cliente/login");
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},
    select:{id:true,status:true,accessReleased:true,document:true,legalName:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    (viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER")))
    redirect(scope(code,"financeiro")+"?erro=permissao");
  return {code,shopId:shop.id,viewerEmail:viewer.email,
    isTenantOwner:viewer.type==="TENANT"&&viewer.barberShopId===shop.id&&viewer.role==="OWNER",
    document:shop.document,legalName:shop.legalName??""};
}
async function mutate(
  ctx:FinanceEditor,action:string,details:Record<string,unknown>,
  update:(workspace:ErpWorkspace)=>void,
){
  await prisma.$transaction(async tx=>{
    const shop=await tx.barberShop.findUniqueOrThrow({
      where:{id:ctx.shopId},select:{enabledFeatures:true},
    });
    const ws=readWorkspace(shop.enabledFeatures);
    update(ws);
    await tx.barberShop.update({where:{id:ctx.shopId},
      data:{enabledFeatures:writeWorkspace(shop.enabledFeatures,ws)}});
    await tx.adminAuditLog.create({data:{
      barberShopId:ctx.shopId,adminEmail:ctx.viewerEmail,
      action,details:details as Prisma.InputJsonValue,
    }});
  },{isolationLevel:"Serializable"});
  revalidatePath("/erp/"+encodeURIComponent(ctx.code),"layout");
}
const fail=(url:string,reason:string):never=>redirect(url+"?erro="+encodeURIComponent(reason));
const done=(url:string):never=>redirect(url+"?ok=salvo");

export async function createFinancialCategory(form:FormData){
  const ctx=await authorize(form),url=scope(ctx.code,"financeiro-categorias");
  const name=val(form,"name",80),subcategory=val(form,"subcategory",80);
  const type=val(form,"type",20);
  const classification=val(form,"classification",30);
  const choices:Record<string,string[]>={
    RECEIVABLE:["REVENUE_FIXED","REVENUE_VARIABLE"],
    PAYABLE:["EXPENSE_FIXED","EXPENSE_OPERATIONAL","EXPENSE_COMMISSION"],
    BOTH:["GENERAL"],
  };
  if(name.length<2||!choices[type]?.includes(classification)||subcategory.length>80)
    fail(url,"cadastro");
  try{
    await mutate(ctx,"FINANCIAL_CATEGORY_CREATED",{name,subcategory,type,classification},workspace=>{
      if(workspace.financialCategories.length>=250||
        workspace.financialCategories.some(item=>item.name.localeCompare(name,"pt-BR",{sensitivity:"base"})===0&&
          item.subcategory.localeCompare(subcategory,"pt-BR",{sensitivity:"base"})===0&&item.type===type))
        throw Error("Categoria e subcategoria duplicadas ou limite atingido");
      workspace.financialCategories.push({
        id:workspaceId("fcat"),name,subcategory,type:type as "RECEIVABLE"|"PAYABLE"|"BOTH",
        classification:classification as typeof workspace.financialCategories[number]["classification"],
      });
    });
  }catch(error){console.error("Financial category failed",error);fail(url,"cadastro");}
  done(url);
}

/** Bank records are activated ONLY after external institution-level ownership verification. */
export async function createFinancialBankAccount(form:FormData){
  const ctx=await authorize(form),url=scope(ctx.code,"financeiro-contas-bancarias");
  if(!ctx.isTenantOwner)fail(url,"titularidade");
  const name=val(form,"name",90),bankCode=val(form,"bankCode",12),
    unitId=val(form,"unitId",100),agency=val(form,"agency",25),account=val(form,"account",35),
    pixKey=val(form,"pixKey",150),pixType=val(form,"pixType",10) as PixRegistrationType;
  if(name.length<2||!/^\\d{3}$/.test(bankCode)||!/^[0-9a-zA-Z-]{1,25}$/.test(agency)||
    !/^[0-9a-zA-Z-]{2,35}$/.test(account)||!["PHONE","CPF","CNPJ","EMAIL","EVP"].includes(pixType))
      fail(url,"banco");
  const unit=await prisma.barberShopUnit.findFirst({
    where:{id:unitId,barberShopId:ctx.shopId,active:true},select:{id:true},
  });
  if(!unit)fail(url,"filial");
  const shop=await prisma.barberShop.findUniqueOrThrow({
    where:{id:ctx.shopId},select:{enabledFeatures:true},
  });
  const existing=readWorkspace(shop.enabledFeatures);
  let ownerCnpj="";
  try{
    ownerCnpj=validatedOwnerCnpj(ctx.document,unitPolicy(existing,unitId).legalDocument,ctx.legalName);
  }catch{fail(url,"cnpj");}
  if(!validPixKey(pixKey,pixType,ownerCnpj))fail(url,"pix");
  const banks=await getBrazilBankDirectory();
  const selectedBank=banks.find(bank=>bank.code===bankCode);
  if(!selectedBank)fail(url,"banco");
  const input={bankCode,ispb:selectedBank.ispb,agency,account,ownerCnpj,pixKey,pixType};
  const proof=await verifyBankAccountOwnership(input);
  let pending=false;
  try{
    await mutate(ctx,proof?"FINANCIAL_BANK_ACCOUNT_VERIFIED":"FINANCIAL_BANK_VERIFICATION_REQUESTED",
      {unitId,bankCode,verified:Boolean(proof)},workspace=>{
        const same=(item:{bankCode:string;agency:string;account:string;unitId:string})=>
          item.unitId===unitId&&item.bankCode===bankCode&&item.agency===agency&&item.account===account;
        if(workspace.financialBankAccounts.some(account=>account.active&&same(account)))
          throw Error("Conta já cadastrada");
        if(proof){
          if(workspace.financialBankAccounts.length>=100)throw Error("Limite de contas");
          workspace.financialBankAccounts.push({
            id:workspaceId("fbank"),name,bankCode,bankName:selectedBank.name,
            agency,account,unitId,ownerCnpj,pixType,pixKey,active:true,
            verifiedAt:proof.verifiedAt,verificationReference:proof.provider,
          });
          workspace.financialBankRequests=workspace.financialBankRequests.filter(request=>!same(request));
        }else{
          pending=true;
          if(workspace.financialBankRequests.length>=50)throw Error("Limite de solicitações");
          if(!workspace.financialBankRequests.some(same))
            workspace.financialBankRequests.push({
              id:workspaceId("fbreq"),name,bankCode,bankName:selectedBank.name,
              agency,account,unitId,ownerCnpj,pixType,pixKey,requestedAt:new Date().toISOString(),
            });
        }
      });
  }catch(error){console.error("Financial bank registration rejected",error instanceof Error?error.message:"error");fail(url,"banco");}
  if(pending)redirect(url+"?ok=verificacao-pendente");
  done(url);
}

export async function removeFinancialBankAccount(form:FormData){
  const ctx=await authorize(form),url=scope(ctx.code,"financeiro-contas-bancarias");
  if(!ctx.isTenantOwner)fail(url,"titularidade");
  const id=val(form,"bankAccountId",100);
  if(!id)fail(url,"banco");
  try{
    await mutate(ctx,"FINANCIAL_BANK_ACCOUNT_REMOVED",{bankAccountId:id},workspace=>{
      const account=workspace.financialBankAccounts.find(item=>item.id===id&&item.active);
      if(!account)throw Error("Conta não localizada ou já removida");
      account.active=false;
      const policy=workspace.unitPolicies[account.unitId];
      if(policy&&policy.bankCode===account.bankCode&&policy.bankAgency===account.agency&&
        policy.bankAccount===account.account){
          workspace.unitPolicies[account.unitId]={...policy,bankCode:"",bankName:"",bankAgency:"",
            bankAccount:"",pixKey:"",pixType:""};
        }
    });
  }catch(error){console.error("Financial bank removal failed",error instanceof Error?error.message:"error");fail(url,"banco");}
  done(url);
}

export async function removeFinancialBankRequest(form:FormData){
  const ctx=await authorize(form),url=scope(ctx.code,"financeiro-contas-bancarias");
  if(!ctx.isTenantOwner)fail(url,"titularidade");
  const id=val(form,"requestId",100);
  try{
    await mutate(ctx,"FINANCIAL_BANK_VERIFICATION_CANCELLED",{requestId:id},workspace=>{
      if(!workspace.financialBankRequests.some(item=>item.id===id))throw Error("Solicitação não encontrada");
      workspace.financialBankRequests=workspace.financialBankRequests.filter(item=>item.id!==id);
    });
  }catch(error){console.error("Financial bank request cancellation failed",error instanceof Error?error.message:"error");fail(url,"banco");}
  done(url);
}

export async function createFinancialCustomPaymentMethod(form:FormData){
  const ctx=await authorize(form),url=scope(ctx.code,"financeiro-formas-comanda");
  const name=val(form,"name",80),type=val(form,"type",12);
  if(name.length<2||!["PIX","CASH","DEBIT","CREDIT","TRANSFER"].includes(type))fail(url,"metodos");
  try{
    await mutate(ctx,"FINANCIAL_CUSTOM_PAYMENT_METHOD_CREATED",{name,type},workspace=>{
      if(workspace.customPaymentMethods.length>=60||workspace.customPaymentMethods.some(method=>
        method.name.localeCompare(name,"pt-BR",{sensitivity:"base"})===0))
        throw Error("Forma de pagamento duplicada ou limite de cadastro");
      workspace.customPaymentMethods.push({
        id:workspaceId("fpay"),name,type:type as "PIX"|"CASH"|"DEBIT"|"CREDIT"|"TRANSFER",active:true,
      });
    });
  }catch(error){console.error("Financial custom method failed",error);fail(url,"metodos");}
  done(url);
}

export async function saveFinancialPaymentMethods(form:FormData){
  const ctx=await authorize(form);
  const kind=val(form,"kind",14);
  const isCommand=kind==="COMMAND";
  const url=scope(ctx.code,isCommand?"financeiro-formas-comanda":"financeiro-formas-despesas");
  if(!isCommand&&kind!=="EXPENSE")fail(url,"tipo");
  const submitted=form.getAll("methods").map(String);
  const submittedCustom=form.getAll("customMethods").map(String);
  const methods=[...new Set(submitted)]
    .filter((name):name is typeof PAYMENT_METHODS[number]=>PAYMENT_METHODS.some(m=>m===name));
  if(submitted.length!==methods.length||methods.length===0)fail(url,"metodos");
  if(submittedCustom.length!==new Set(submittedCustom).size||submittedCustom.length>60)fail(url,"metodos");
  const unitId=val(form,"unitId",100);
  if(isCommand){
    const unit=await prisma.barberShopUnit.findFirst({
      where:{id:unitId,barberShopId:ctx.shopId,active:true},select:{id:true},
    });
    if(!unit)fail(url,"filial");
  }
  try{
    await mutate(ctx,"FINANCIAL_PAYMENT_METHODS_UPDATED",
      {kind,unitId:isCommand?unitId:null,methods},
      workspace=>{
        if(isCommand){
          const valid=workspace.customPaymentMethods.filter(m=>m.active).map(m=>m.id);
          if(submittedCustom.some(id=>!valid.includes(id)))throw Error("Método personalizado inválido");
          workspace.unitPolicies[unitId]={
            ...unitPolicy(workspace,unitId),paymentMethods:methods,customPaymentMethods:submittedCustom,
          };
        }
        else workspace.financialExpenseMethods=methods;
      });
  }catch(error){console.error("Financial methods failed",error);fail(url,"metodos");}
  done(url);
}
