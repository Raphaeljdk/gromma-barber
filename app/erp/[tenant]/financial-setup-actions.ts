"use server";

import type {Prisma} from "@prisma/client";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {prisma} from "@/lib/prisma";
import {requireTenantAccess} from "@/lib/tenant-auth";
import {readWorkspace,writeWorkspace,workspaceId,type ErpWorkspace} from "@/lib/erp-workspace";
import {unitPolicy} from "@/lib/unit-operations-policy";
import {PAYMENT_METHODS} from "@/lib/checkout";

type FinanceEditor={
  code:string;viewerEmail:string;shopId:string;
};
const val=(form:FormData,key:string,max=100)=>String(form.get(key)??"").trim().slice(0,max);
const scope=(code:string,module:string)=>"/erp/"+encodeURIComponent(code)+"/"+module;

async function authorize(form:FormData):Promise<FinanceEditor>{
  const code=val(form,"tenantCode",80).toUpperCase();
  if(!code)redirect("/cliente/login");
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},
    select:{id:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    (viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER")))
    redirect(scope(code,"financeiro")+"?erro=permissao");
  return {code,shopId:shop.id,viewerEmail:viewer.email};
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
  const name=val(form,"name",80),type=val(form,"type",20);
  if(name.length<2||!["RECEIVABLE","PAYABLE","BOTH"].includes(type))
    fail(url,"cadastro");
  try{
    await mutate(ctx,"FINANCIAL_CATEGORY_CREATED",{name,type},workspace=>{
      if(workspace.financialCategories.length>=250||
        workspace.financialCategories.some(item=>item.name.localeCompare(name,"pt-BR",{sensitivity:"base"})===0&&item.type===type))
        throw Error("Categoria duplicada ou limite atingido");
      workspace.financialCategories.push({
        id:workspaceId("fcat"),name,type:type as "RECEIVABLE"|"PAYABLE"|"BOTH",
      });
    });
  }catch(error){console.error("Financial category failed",error);fail(url,"cadastro");}
  done(url);
}

export async function createFinancialBankAccount(form:FormData){
  const ctx=await authorize(form),url=scope(ctx.code,"financeiro-contas-bancarias");
  const name=val(form,"name",90),bankCode=val(form,"bankCode",12),
    bankName=val(form,"bankName",100),agency=val(form,"agency",25),
    account=val(form,"account",35);
  if(name.length<2||bankName.length<2||!/^\d{1,5}$/.test(bankCode)||
    !/^[0-9a-zA-Z-]{1,25}$/.test(agency)||
    !/^[0-9a-zA-Z-]{2,35}$/.test(account))fail(url,"banco");
  try{
    await mutate(ctx,"FINANCIAL_BANK_ACCOUNT_CREATED",{name,bankCode},
      workspace=>{
        if(workspace.financialBankAccounts.length>=100)throw Error("Limite de contas");
        if(workspace.financialBankAccounts.some(item=>item.bankCode===bankCode&&item.agency===agency&&item.account===account))
          throw Error("Conta duplicada");
        workspace.financialBankAccounts.push({
          id:workspaceId("fbank"),name,bankCode,bankName,agency,account,active:true,
        });
      });
  }catch(error){console.error("Financial bank registration failed",error);fail(url,"banco");}
  done(url);
}

export async function saveFinancialPaymentMethods(form:FormData){
  const ctx=await authorize(form);
  const kind=val(form,"kind",14);
  const isCommand=kind==="COMMAND";
  const url=scope(ctx.code,isCommand?"financeiro-formas-comanda":"financeiro-formas-despesas");
  if(!isCommand&&kind!=="EXPENSE")fail(url,"tipo");
  const submitted=form.getAll("methods").map(String);
  const methods=[...new Set(submitted)]
    .filter((name):name is typeof PAYMENT_METHODS[number]=>PAYMENT_METHODS.some(m=>m===name));
  if(submitted.length!==methods.length||methods.length===0)fail(url,"metodos");
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
        if(isCommand)workspace.unitPolicies[unitId]={
          ...unitPolicy(workspace,unitId),paymentMethods:methods,
        };
        else workspace.financialExpenseMethods=methods;
      });
  }catch(error){console.error("Financial methods failed",error);fail(url,"metodos");}
  done(url);
}
