import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { calculateSubscriptionPot } from "@/lib/subscription-commission-pool";
import { isAgendaDate, agendaDateKey, addAgendaDays } from "@/lib/agenda";
import { spreadsheet, pdf } from "@/lib/report-export";

export const runtime="nodejs";

export async function GET(request:Request,{params}:{params:Promise<{tenant:string}>}){
  const {tenant}=await params;
  const code=decodeURIComponent(tenant).toUpperCase();
  const viewer=await requireTenantAccess(code);
  if(viewer.type==="TENANT" && !["OWNER","MANAGER"].includes(viewer.role))
    return new Response("Acesso restrito",{status:403});
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},
    select:{id:true,status:true,accessReleased:true,enabledFeatures:true,
      units:{select:{id:true,name:true,active:true}},
      users:{select:{id:true,name:true,role:true,active:true,unitId:true}}}});
  if(!shop || shop.status!=="APPROVED" || !shop.accessReleased ||
     (viewer.type==="TENANT" && viewer.barberShopId!==shop.id))
    return new Response("Empresa indisponível",{status:403});
  const q=new URL(request.url).searchParams;
  const today=agendaDateKey(new Date());
  const from=q.get("comissoesDe")??addAgendaDays(today,-29);
  const to=q.get("comissoesAte")??today;
  const unit=q.get("comissoesUnidade")??"";
  const formato=q.get("formato")??"";
  const start=new Date(from+"T00:00:00-03:00"),end=new Date(new Date(to+"T00:00:00-03:00").getTime()+86400000);
  if(!isAgendaDate(from)||!isAgendaDate(to)||from>to || (end.getTime()-start.getTime())>366*86400000 ||
    !["xlsx","pdf"].includes(formato) || (unit && !shop.units.some(u=>u.id===unit&&u.active)))
    return new Response("Parâmetros inválidos",{status:400});
  const workspace=readWorkspace(shop.enabledFeatures);
  const eligible=shop.users.filter(u=>u.active&&["OWNER","MANAGER","BARBER"].includes(u.role)&&(!unit||u.unitId===unit));
  const pot=await calculateSubscriptionPot(prisma,shop.id,workspace,start,end,eligible.map(u=>u.id),unit||undefined);
  if(pot.receipts.length>10000)return new Response("Período contém mais de 10.000 recibos. Filtre por unidade ou período.",{status:413});
  const amount=(cents:number)=>(cents/100).toFixed(2).replace(".",",");
  const rows:string[][]=[
    ["Relatório de rateio do pote","De","Até","Unidade","Data de exportação"],
    ["Assinaturas pagas",from,to,unit?shop.units.find(u=>u.id===unit)?.name??unit:"Todas as unidades",new Date().toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})],
    ["Montante recebido (R$)",amount(pot.paidCents)],
    ["Estornos concluídos (R$)",amount(pot.refundedCents)],
    ["Base líquida (R$)",amount(pot.netCents)],
    ["Percentual de pote (%)",String(pot.percent)],
    ["Valor do pote (R$)",amount(pot.potCents)],
    ["Participação atribuída (R$)",amount(pot.assignedCents)],
    ["Saldo sem rateio (R$)",amount(pot.remainingCents)],
    [],
    ["Profissional","Participação no pote (%)","Valor estimado (R$)"],
    ...eligible.map(user=>[user.name,String(pot.distributions[user.id]?.sharePercent??0),
      amount(pot.distributions[user.id]?.amountCents??0)]),
    [],
    ["Recebimento","Plano","Data da baixa","Unidade","Valor (R$)"],
    ...pot.receipts.map(entry=>[entry.id,entry.plan,new Date(entry.paidAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}),
      shop.units.find(u=>u.id===entry.unitId)?.name??"Não vinculada",amount(entry.amountCents)]),
    [],
    ["Estorno","Data da devolução","Valor (R$)"],
    ...pot.refunds.map(entry=>[entry.id,new Date(entry.completedAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}),amount(entry.amountCents)]),
    [],
    ["Observação","Prévia baseada em baixas internas. Ainda sem conciliação automática do gateway."],
  ];
  const content=formato==="xlsx"?spreadsheet(rows):pdf(rows);
  return new Response(new Uint8Array(content),{headers:{
    "Content-Type":formato==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/pdf",
    "Content-Disposition":`attachment; filename="gromma-pote-assinaturas-${from}-${to}.${formato}"`,
    "Cache-Control":"private, no-store",
  }});
}
