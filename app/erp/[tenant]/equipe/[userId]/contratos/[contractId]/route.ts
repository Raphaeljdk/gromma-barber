import { get } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";

export const dynamic="force-dynamic";
type RouteProps={params:Promise<{tenant:string;userId:string;contractId:string}>};

/** Documentos são entregues exclusivamente à administração da empresa proprietária. */
export async function GET(_request:Request,{params}:RouteProps){
  const {tenant,userId,contractId}=await params;
  const code=tenant.toUpperCase();
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},select:{
    id:true,status:true,accessReleased:true,enabledFeatures:true,
  }});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    (viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER")))
    return new Response("Acesso negado",{status:403,headers:{"Cache-Control":"private, no-store"}});
  const user=await prisma.shopUser.findFirst({where:{id:userId,barberShopId:shop.id},select:{id:true}});
  if(!user)return new Response("Não encontrado",{status:404});
  const contract=readWorkspace(shop.enabledFeatures).professionalProfiles[userId]
    ?.contracts?.find(item=>item.id===contractId);
  const prefix="professional-contracts/"+shop.id+"/"+userId+"/";
  if(!contract?.url.startsWith("private:")||!contract.url.slice(8).startsWith(prefix))
    return new Response("Não encontrado",{status:404});
  const token=process.env.PROFESSIONAL_CONTRACTS_BLOB_READ_WRITE_TOKEN;
  if(!token)return new Response("Armazenamento privado não configurado",{status:503});
  try{
    const blob=await get(contract.url.slice(8),{access:"private",token});
    if(!blob||blob.statusCode!==200||!blob.stream)return new Response("Não encontrado",{status:404});
    return new Response(blob.stream,{headers:{
      "Content-Type":"application/pdf",
      "Content-Disposition":'attachment; filename="contrato-'+contractId.replace(/[^a-zA-Z0-9_-]/g,"")+'.pdf"',
      "X-Content-Type-Options":"nosniff",
      "Cache-Control":"private, no-store",
    }});
  }catch(error){
    console.error("Private contract read failed",error);
    return new Response("Documento indisponível",{status:503});
  }
}
