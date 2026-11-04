import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { readWorkspace } from "@/lib/erp-workspace";
import { requireTenantAccess } from "@/lib/tenant-auth";

export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{
  params:Promise<{tenant:string;userId:string;contractId:string}>
}){
  const {tenant,userId,contractId}=await params;
  const code=tenant.toUpperCase();
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},select:{
    id:true,status:true,accessReleased:true,enabledFeatures:true,
  }});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
     (viewer.type!=="ADMIN"&&!(viewer.type==="TENANT"&&viewer.barberShopId===shop.id&&viewer.role==="OWNER")))
    return new Response("Não autorizado",{status:403});
  const employee=await prisma.shopUser.findFirst({where:{id:userId,barberShopId:shop.id},
    select:{id:true}});
  if(!employee)return new Response("Não encontrado",{status:404});
  const url=readWorkspace(shop.enabledFeatures).professionalProfiles[userId]?.contracts?.find(
    c=>c.id===contractId)?.url;
  if(!url||!/^https:\/\/[^/]+\.private\.blob\.vercel-storage\.com\//.test(url))
    return new Response("Contrato não é documento privado",{status:404});
  const token=process.env.GROMMA_PRIVATE_BLOB_TOKEN;
  if(!token)return new Response("Armazenamento privado indisponível",{status:503});
  try{
    const result=await get(url,{access:"private",token});
    if(!result||result.statusCode!==200||!result.stream)
      return new Response("Contrato não localizado",{status:404});
    return new Response(result.stream,{
      headers:{
        "Content-Type":"application/pdf",
        "Content-Disposition":'attachment; filename="contrato-profissional.pdf"',
        "Cache-Control":"private, no-store, max-age=0",
        "Content-Security-Policy":"sandbox",
        "X-Content-Type-Options":"nosniff",
        "Referrer-Policy":"no-referrer",
      },
    });
  }catch(error){
    console.error("Private contract fetch failed",error);
    return new Response("Não foi possível buscar o contrato",{status:502});
  }
}
