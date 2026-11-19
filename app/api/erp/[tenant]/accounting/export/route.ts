import {prisma} from "@/lib/prisma";
import {requireTenantAccess} from "@/lib/tenant-auth";
import {readWorkspace} from "@/lib/erp-workspace";
import {accountingDate,isoDateToday,loadKardex,escapeCsv,escapeXml,
  quantityText,money,type AccountingView} from "@/lib/accounting-kardex";
export const dynamic="force-dynamic";
function permitted(viewer:Awaited<ReturnType<typeof requireTenantAccess>>,shopId:string){
  return viewer.type==="ADMIN"||viewer.type==="TENANT"&&viewer.barberShopId===shopId&&
    ["OWNER","MANAGER","ACCOUNTANT"].includes(viewer.role);
}
export async function GET(request:Request,{params}:{params:Promise<{tenant:string}>}){
  const {tenant}=await params;
  const viewer=await requireTenantAccess(tenant.toUpperCase());
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:tenant.toUpperCase()},
    select:{id:true,status:true,accessReleased:true,enabledFeatures:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||!permitted(viewer,shop.id))
    return new Response("Não autorizado",{status:403});
  const q=new URL(request.url).searchParams;
  const views=["financeiro-cardex","financeiro-relatorio-entrada","financeiro-relatorio-saida"];
  const view=q.get("view")??"financeiro-cardex";
  if(!views.includes(view))return new Response("Relatório inválido",{status:400});
  const fmt=q.get("format")==="xml"?"xml":"csv";
  const ws=readWorkspace(shop.enabledFeatures);
  const today=isoDateToday(),from=accountingDate(q.get("kInicio")??undefined,today.slice(0,8)+"01");
  const to=accountingDate(q.get("kFim")??undefined,today);
  const cat=ws.stockCategories.includes(q.get("kCategoria")??"")?q.get("kCategoria")??"":"";
  if(from>to)return new Response("Período inválido",{status:400});
  const data=await loadKardex({shopId:shop.id,workspace:ws,from,to,category:cat,view:view as AccountingView});
  if(data.truncated)return new Response("Período excede limite; reduza as datas",{status:422});
  const columns=["Data","Produto","SKU","Categoria","Filial","Tipo","Quantidade","Saldo anterior","Saldo final","Custo estimado","Motivo"];
  const rows=data.rows.map(m=>[
    m.date,m.product,m.sku,m.category,m.unit,m.type,quantityText(m.quantityMilli),
    quantityText(m.openingMilli),quantityText(m.balanceMilli),money(m.estimatedCostCents),m.reason,
  ]);
  const timestamp=from.replaceAll("-","")+"-"+to.replaceAll("-","");
  const filename="GROMMA-kardex-"+timestamp+"."+fmt;
  let body:string;
  if(fmt==="csv"){
    body="\uFEFFsep=;\r\n"+[columns,...rows].map(row=>row.map(value=>escapeCsv(value)).join(";")).join("\r\n");
  }else{
    body='<?xml version="1.0" encoding="UTF-8"?>\n'+
      '<grommaKardex de="'+escapeXml(from)+'" ate="'+escapeXml(to)+'" categoria="'+escapeXml(cat)+'">\n'+
      data.rows.map(m=>'  <movimento id="'+escapeXml(m.id)+'" tipo="'+m.type+'">'+
        '<data>'+escapeXml(m.date)+'</data><produto>'+escapeXml(m.product)+'</produto>'+
        '<categoria>'+escapeXml(m.category)+'</categoria><filial>'+escapeXml(m.unit)+'</filial>'+
        '<quantidade>'+(m.quantityMilli/1000)+'</quantidade><saldo>'+(m.balanceMilli/1000)+'</saldo>'+
        '<custoEstimado>'+(m.estimatedCostCents/100)+'</custoEstimado>'+
        '<motivo>'+escapeXml(m.reason)+'</motivo></movimento>').join("\n")+
      '\n</grommaKardex>';
  }
  return new Response(body,{headers:{
    "Content-Type":fmt==="csv"?"text/csv; charset=utf-8":"application/xml; charset=utf-8",
    "Content-Disposition":'attachment; filename="'+filename+'"',
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
  }});
}
