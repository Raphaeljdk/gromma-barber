"use server";
import {createHash} from "node:crypto";
import {Prisma} from "@prisma/client";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {prisma} from "@/lib/prisma";
import {requireTenantAccess} from "@/lib/tenant-auth";
import {readWorkspace,writeWorkspace,workspaceId} from "@/lib/erp-workspace";
const val=(f:FormData,k:string,max=100)=>String(f.get(k)??"").trim().slice(0,max);
const url=(tenant:string,target:string)=>"/erp/"+encodeURIComponent(tenant)+"/"+target;
async function authorize(f:FormData,view:string,canAccountant=false){
  const tenant=val(f,"tenantCode",80).toUpperCase();
  const actor=await requireTenantAccess(tenant);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant},
    select:{id:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    actor.type==="TENANT"&&(actor.barberShopId!==shop.id||
      !(actor.role==="OWNER"||(canAccountant&&actor.role==="ACCOUNTANT"))))
    redirect(url(tenant,view)+"?erro=permissao");
  return {tenant,shopId:shop.id,actor:actor.email};
}
async function change(ctx:{tenant:string;shopId:string;actor:string},action:string,
  details:Record<string,unknown>,handler:(ws:ReturnType<typeof readWorkspace>)=>void){
  await prisma.$transaction(async tx=>{
    const fresh=await tx.barberShop.findUniqueOrThrow({where:{id:ctx.shopId},select:{enabledFeatures:true}});
    const ws=readWorkspace(fresh.enabledFeatures);
    handler(ws);
    await tx.barberShop.update({where:{id:ctx.shopId},data:{
      enabledFeatures:writeWorkspace(fresh.enabledFeatures,ws),
    }});
    await tx.adminAuditLog.create({data:{barberShopId:ctx.shopId,adminEmail:ctx.actor,
      action,details:details as Prisma.InputJsonValue}});
  },{isolationLevel:"Serializable"});
  revalidatePath("/erp/"+encodeURIComponent(ctx.tenant),"layout");
}
export async function createStockAccountingCategory(form:FormData){
  const ctx=await authorize(form,"financeiro-cardex");
  const name=val(form,"name",60);
  if(name.length<2||/[<>]/.test(name))redirect(url(ctx.tenant,"financeiro-cardex")+"?erro=categoria");
  try{
    await change(ctx,"STOCK_ACCOUNTING_CATEGORY_CREATED",{name},ws=>{
      if(ws.stockCategories.length>=60||ws.stockCategories.some(item=>item.toLocaleLowerCase("pt-BR")===name.toLocaleLowerCase("pt-BR")))
        throw Error("Categoria duplicada");
      ws.stockCategories.push(name);
    });
  }catch{redirect(url(ctx.tenant,"financeiro-cardex")+"?erro=categoria");}
  redirect(url(ctx.tenant,"financeiro-cardex")+"?ok=categoria");
}
export async function assignStockAccountingCategory(form:FormData){
  const ctx=await authorize(form,"financeiro-cardex");
  const productId=val(form,"productId",100),category=val(form,"category",60);
  const found=await prisma.product.findFirst({where:{id:productId,barberShopId:ctx.shopId},select:{id:true}});
  if(!found)redirect(url(ctx.tenant,"financeiro-cardex")+"?erro=produto");
  try{
    await change(ctx,"STOCK_ACCOUNTING_CATEGORY_ASSIGNED",{productId,category},ws=>{
      if(!ws.stockCategories.includes(category))throw Error("Categoria inexistente");
      ws.stockCategoryOverrides[productId]=category;
    });
  }catch{redirect(url(ctx.tenant,"financeiro-cardex")+"?erro=produto");}
  redirect(url(ctx.tenant,"financeiro-cardex")+"?ok=produto");
}
function xmlValue(xml:string,field:string){
  const m=xml.match(new RegExp("<(?:[a-zA-Z0-9_-]+:)?"+field+"(?:\\s[^>]*)?>([^<>]{1,200})<\\/(?:[a-zA-Z0-9_-]+:)?"+field+">","i"));
  return m?.[1]?.trim()??"";
}
/** Importa e guarda o XML original privado no cadastro da empresa; não emite NFe. */
export async function importAccountingNfeXml(form:FormData){
  const ctx=await authorize(form,"financeiro-portal-contador",true);
  const file=form.get("nfeXml");
  const target=url(ctx.tenant,"financeiro-portal-contador");
  if(!(file instanceof File)||file.size===0||file.size>110000||
    !/\.xml$/i.test(file.name))redirect(target+"?erro=arquivo");
  let xml="";
  try{xml=await file.text();}catch{redirect(target+"?erro=arquivo");}
  if(!/^\s*<\?xml|\s*<(?:\w+:)?nfeProc|\s*<(?:\w+:)?NFe/i.test(xml)||
    /<!DOCTYPE|<!ENTITY|<script\b|<\?xml-stylesheet/i.test(xml)||
    !/<(?:\w+:)?infNFe\b/i.test(xml))
    redirect(target+"?erro=xml");
  const id=xml.match(/<(?:\w+:)?infNFe\b[^>]*\bId=["']NFe(\d{44})["']/i)?.[1]??"";
  const key=xmlValue(xml,"chNFe")||id;
  if(!/^\d{44}$/.test(key)||id&&id!==key)redirect(target+"?erro=chave");
  const emit=xml.match(/<(?:\w+:)?emit\b[^>]*>([\s\S]*?)<\/(?:\w+:)?emit>/i)?.[1]??"";
  const issuer=xmlValue(emit,"CNPJ");
  if(!/^\d{14}$/.test(issuer))redirect(target+"?erro=cnpj");
  const amount=Number(xmlValue(xml.match(/<(?:\w+:)?ICMSTot\b[^>]*>([\s\S]*?)<\/(?:\w+:)?ICMSTot>/i)?.[1]??"","vNF"));
  if(!Number.isFinite(amount)||amount<0||amount>999999999)redirect(target+"?erro=valor");
  const doc={
    id:workspaceId("nfe"),fileName:file.name.slice(0,120),accessKey:key,
    number:xmlValue(xml,"nNF").slice(0,20),
    issueDate:(xmlValue(xml,"dhEmi")||xmlValue(xml,"dEmi")).slice(0,35),
    issuerCnpj:issuer,amount,
    hash:createHash("sha256").update(xml).digest("hex"),
    importedAt:new Date().toISOString(),
    xmlBase64:Buffer.from(xml,"utf8").toString("base64"),
  };
  try{
    await change(ctx,"ACCOUNTING_NFE_XML_IMPORTED",
      {accessKey:key,hash:doc.hash,fileName:doc.fileName},ws=>{
        if(ws.accountingXmlDocuments.length>=20||
          ws.accountingXmlDocuments.some(existing=>existing.accessKey===key))
          throw Error("XML repetido ou limite de arquivo");
        ws.accountingXmlDocuments.push(doc);
      });
  }catch{redirect(target+"?erro=duplicado");}
  redirect(target+"?ok=xml");
}
