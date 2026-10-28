import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { commissionAccess } from "../../commission-actions";
import { commissionPdf, type CommissionDocument } from "@/lib/commission-pdf";
import { commissionFingerprint, commissionPeriod, commissionTotals } from "@/lib/commissions";
export async function GET(request:Request,{params}:{params:Promise<{tenant:string}>}) {
  const {tenant}=await params;const {shop}=await commissionAccess(tenant.toUpperCase());
  const q=new URL(request.url).searchParams;let data:CommissionDocument;
  if(q.get("id")) {const saved=await prisma.commissionSettlement.findFirst({where:{id:q.get("id")!,barberShopId:shop.id},include:{lines:{orderBy:[{occurredAt:"asc"},{id:"asc"}]}}});if(!saved)return new NextResponse("Não encontrado",{status:404});data=saved;}
  else {let range;try{range=commissionPeriod(q.get("start")??"",q.get("end")??"");}catch{return new NextResponse("Período inválido",{status:400});}
    const userId=q.get("professional")??"",user=await prisma.shopUser.findFirst({where:{id:userId,barberShopId:shop.id}});if(!user)return new NextResponse("Não encontrado",{status:404});
    const lines=await prisma.commissionLine.findMany({where:{barberShopId:shop.id,userId,settlementId:null,occurredAt:{gte:range.from,lt:range.to}},orderBy:[{occurredAt:"asc"},{id:"asc"}]});const totals=commissionTotals(lines);
    data={id:`PREVIA-${commissionFingerprint(lines).slice(0,20)}`,shopName:shop.tradeName,shopDocument:shop.document,shopAddress:shop.address,professionalName:user.name,periodStart:range.from,periodEnd:range.to,status:"PENDING",gross:totals.gross/100,deductions:totals.DEDUCTION/100,net:totals.net/100,lines};
  }
  return new NextResponse(Buffer.from(await commissionPdf(data)),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="comissoes-${data.id}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
