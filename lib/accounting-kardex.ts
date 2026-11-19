import {prisma} from "@/lib/prisma";
import type {ErpWorkspace} from "@/lib/erp-workspace";

export type AccountingView="financeiro-cardex"|"financeiro-relatorio-entrada"|"financeiro-relatorio-saida";
export type MovementRow={
  id:string;date:string;product:string;sku:string;category:string;unit:string;
  type:"IN"|"OUT"|"ADJUSTMENT";reason:string;quantityMilli:number;
  openingMilli:number;balanceMilli:number;costUnitCents:number;estimatedCostCents:number;
};
export const resolveStockCategory=(workspace:Pick<ErpWorkspace,"stockCategoryOverrides"|"productCategoryAssignments">,id:string)=>{
  const override=workspace.stockCategoryOverrides[id];
  if(override)return override;
  return workspace.productCategoryAssignments[id]==="DRINKS"?"Bebidas":"Produtos";
};
export function accountingDate(value:string|undefined,defaultValue:string){
  if(!value||!/^\d{4}-\d{2}-\d{2}$/.test(value))return defaultValue;
  const candidate=new Date(value+"T12:00:00Z");
  return candidate.toISOString?.()&&candidate.toISOString().slice(0,10)===value?value:defaultValue;
}
export function isoDateToday(){
  return new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",
    timeZone:"America/Sao_Paulo"}).format(new Date());
}
export async function loadKardex(args:{
  shopId:string;workspace:ErpWorkspace;from:string;to:string;
  category:string;view:AccountingView;
}){
  const {shopId,workspace,from,to,category,view}=args;
  if(from>to)throw Error("Período inválido");
  const min=new Date(from+"T00:00:00-03:00"),max=new Date(to+"T23:59:59.999-03:00");
  const where={barberShopId:shopId,createdAt:{gte:min,lte:max}};
  const [raw,opening,finance]=await Promise.all([
    prisma.stockMovement.findMany({
      where,orderBy:[{createdAt:"asc"},{id:"asc"}],take:10001,
      include:{product:{select:{id:true,name:true,sku:true,costPrice:true,salePrice:true}},
        unit:{select:{name:true}}},
    }),
    prisma.stockMovement.groupBy({by:["productId","unitId","type"],
      where:{barberShopId:shopId,createdAt:{lt:min}},_sum:{quantity:true}}),
    prisma.financialEntry.findMany({where:{barberShopId:shopId,status:"PAID",
      paidAt:{gte:min,lte:max}},
      select:{amount:true,type:true}}),
  ]);
  const truncated=raw.length>10000;
  const balances=new Map<string,number>();
  for(const o of opening){
    const key=o.unitId+"|"+o.productId;
    const q=Math.round(Number(o._sum.quantity??0)*1000);
    balances.set(key,(balances.get(key)??0)+(o.type==="OUT"?-q:q));
  }
  const all=raw.slice(0,10000).map(m=>{
    const key=m.unitId+"|"+m.productId;
    const previous=balances.get(key)??0;
    const q=Math.round(Number(m.quantity)*1000);
    const delta=m.type==="OUT"?-q:q;
    balances.set(key,previous+delta);
    const costUnitCents=Math.round(Number(m.product.costPrice)*100);
    return {
      id:m.id,date:m.createdAt.toISOString(),product:m.product.name,sku:m.product.sku??"",
      category:resolveStockCategory(workspace,m.productId),unit:m.unit.name,
      type:m.type,reason:m.reason??"",quantityMilli:q,
      openingMilli:previous,balanceMilli:previous+delta,costUnitCents,
      estimatedCostCents:Math.round(Math.abs(q)*costUnitCents/1000),
    } as MovementRow;
  });
  const rows=all.filter(m=>(!category||m.category===category)&&
    (view==="financeiro-relatorio-entrada"?m.type==="IN"||m.type==="ADJUSTMENT"&&m.quantityMilli>0:
      view==="financeiro-relatorio-saida"?m.type==="OUT"||m.type==="ADJUSTMENT"&&m.quantityMilli<0:true));
  const incoming=rows.filter(m=>m.type==="IN"||m.type==="ADJUSTMENT"&&m.quantityMilli>0);
  const outgoing=rows.filter(m=>m.type==="OUT"||m.type==="ADJUSTMENT"&&m.quantityMilli<0);
  const totalMilli=(list:MovementRow[])=>list.reduce((n,m)=>n+Math.abs(m.quantityMilli),0);
  const costs=outgoing.reduce((n,m)=>n+m.estimatedCostCents,0);
  const financialResultCents=finance.reduce((n,m)=>n+(m.type==="RECEIVABLE"?1:-1)*Math.round(Number(m.amount)*100),0);
  return {rows,truncated,incomingMilli:totalMilli(incoming),outgoingMilli:totalMilli(outgoing),
    estimatedCostCents:costs,financialResultCents,
    financeDisclaimer:"Resultado de receitas recebidas menos despesas pagas no período. Não é lucro contábil definitivo: impostos, CMV real e ajustes podem faltar.",
    costDisclaimer:"O valor de custo é estimado pelo preço de custo atual cadastrado no produto; não representa necessariamente o custo histórico da movimentação."};
}
export const quantityText=(milli:number)=>new Intl.NumberFormat("pt-BR",{minimumFractionDigits:0,maximumFractionDigits:3}).format(milli/1000);
export const money=(cents:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);
export function escapeCsv(value:string){const safe=/^[=+\-@\t\r]/.test(value)?("'"+value):value;return '"'+safe.replaceAll('"','""')+'"';}
export function escapeXml(value:string){return value.replace(/[<>&"']/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]??c));}
