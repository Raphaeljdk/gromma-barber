import {prisma} from "@/lib/prisma";
import {requireTenantAccess} from "@/lib/tenant-auth";
import {readWorkspace} from "@/lib/erp-workspace";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{tenant:string;id:string}>}){
  const {tenant,id}=await params;
  const code=tenant.toUpperCase();
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},
    select:{id:true,enabledFeatures:true,status:true,accessReleased:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    !(viewer.type==="ADMIN"||viewer.type==="TENANT"&&viewer.barberShopId===shop.id&&
      ["OWNER","MANAGER","ACCOUNTANT"].includes(viewer.role)))
    return new Response("Não autorizado",{status:403});
  const ws=readWorkspace(shop.enabledFeatures);
  const doc=ws.accountingXmlDocuments.find(item=>item.id===id);
  if(!doc)return new Response("Arquivo não encontrado",{status:404});
  const buffer=Buffer.from(doc.xmlBase64,"base64");
  return new Response(new Uint8Array(buffer),{headers:{
    "Content-Type":"application/xml; charset=utf-8",
    "Content-Disposition":'attachment; filename="NFe-'+doc.accessKey+'.xml"',
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
  }});
}
