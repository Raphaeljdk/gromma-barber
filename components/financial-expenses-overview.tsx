import Link from "next/link";
import {CheckCheck, Filter, Plus, Search} from "lucide-react";
import {prisma} from "@/lib/prisma";
import {markFinancialPaidBulk} from "@/app/erp/[tenant]/actions";
import {brl} from "@/lib/plans";
import type {ErpWorkspace} from "@/lib/erp-workspace";
import styles from "./financial-expenses-overview.module.css";

type Props={
  tenantCode:string;shopId:string;
  query:Record<string,string|string[]|undefined>;
  units:{id:string;name:string}[];isOwner:boolean;workspace:ErpWorkspace;
};
const realDate=(key:string)=>/^\d{4}-\d{2}-\d{2}$/.test(key)&&
  !Number.isNaN(new Date(key+"T12:00:00-03:00").getTime())&&
  new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(key+"T12:00:00-03:00"))===key;
const dateLabel=(d:Date|null)=>d?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(d):"—";
const money=(num:number)=>brl(Math.round(num*100)/100);
const sum=(rows:{amount:number}[])=>Math.round(rows.reduce((acc,item)=>acc+Math.round(item.amount*100),0))/100;

export async function FinancialExpensesOverview({tenantCode,shopId,query,units,isOwner,workspace}:Props){
  const param=(key:string)=>typeof query[key]==="string"?query[key] as string:"";
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const fromText=realDate(param("expInicio"))?param("expInicio"):today.slice(0,8)+"01";
  const toText=realDate(param("expFim"))?param("expFim"):today;
  const invalid=fromText>toText;
  const unit=units.some(item=>item.id===param("expFilial"))?param("expFilial"):"";
  const search=param("expBusca").trim().slice(0,100);
  const statuses=["todos","PENDING","PAID","CANCELED"] as const;
  const status=statuses.some(item=>item===param("expStatus"))?param("expStatus"):"todos";
  const first=new Date(fromText+"T00:00:00-03:00"),last=new Date(toText+"T23:59:59.999-03:00");
  const commonWhere={
    barberShopId:shopId,type:"PAYABLE" as const,
    ...(unit?{unitId:unit}:{}),
    OR:[{dueDate:{gte:first,lte:last}},{dueDate:null,createdAt:{gte:first,lte:last}}],
  };
  const [categories,raw]=await Promise.all([
    prisma.financialEntry.findMany({where:{barberShopId:shopId,type:"PAYABLE"},select:{category:true},distinct:["category"],orderBy:{category:"asc"},take:500}),
    invalid?Promise.resolve([]):prisma.financialEntry.findMany({
      where:commonWhere,include:{unit:{select:{name:true}}},
      orderBy:[{dueDate:"desc"},{createdAt:"desc"}],take:10001,
    }),
  ]);
  const categoryNames=[...new Set([
    ...categories.map(item=>item.category),
    ...workspace.financialCategories.filter(item=>item.type==="PAYABLE"||item.type==="BOTH").map(item=>item.name),
  ])].filter(Boolean).sort((a,b)=>a.localeCompare(b,"pt-BR"));
  const category=categoryNames.includes(param("expCategoria"))?param("expCategoria"):"";
  const truncated=raw.length>10000;
  const all=raw.slice(0,10000).filter(entry=>!category||entry.category===category)
    .map(entry=>({
      ...entry,amount:Number(entry.amount),
      subcategory:workspace.financialEntryMetadata[entry.id]?.subcategory??"",
    }));
  const valid=all.filter(entry=>entry.status!=="CANCELED");
  const paid=valid.filter(entry=>entry.status==="PAID");
  const pending=valid.filter(entry=>entry.status==="PENDING");
  const summary=[
    {label:"Total de despesas",value:sum(valid),tone:"total"},
    {label:"Despesas pagas",value:sum(paid),tone:"paid"},
    {label:"Despesas pendentes",value:sum(pending),tone:"pending"},
  ];
  const filtered=all.filter(entry=>
    (status==="todos"||entry.status===status)&&
    (!search||entry.description.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))
  );
  const pageNumber=Number(param("expPage"));
  const page=Number.isSafeInteger(pageNumber)&&pageNumber>0?pageNumber:1;
  const lastPage=Math.max(1,Math.ceil(filtered.length/15));
  const current=Math.min(page,lastPage);
  const shown=filtered.slice((current-1)*15,current*15);
  const base="/erp/"+encodeURIComponent(tenantCode)+"/financeiro-despesas";
  const queryUrl=(nextStatus:string,pg=1)=>{
    const params=new URLSearchParams({expInicio:fromText,expFim:toText,expFilial:unit,
      expCategoria:category,expBusca:search,expStatus:nextStatus,expPage:String(pg)});
    return base+"?"+params.toString()+"#expense-list";
  };
  const returnQuery=new URLSearchParams({expInicio:fromText,expFim:toText,expFilial:unit,
    expCategoria:category,expBusca:search,expStatus:status}).toString();
  return <div className={styles.wrapper}>
    <form method="get" action={base} className={styles.filters}>
      <div className={styles.filterTitle}><Filter size={16}/><strong>Filtros de despesas</strong><span>Período de vencimento</span></div>
      <div className={styles.filterGrid}>
        <label>De<input className="input" type="date" name="expInicio" defaultValue={fromText} required/></label>
        <label>Até<input className="input" type="date" name="expFim" defaultValue={toText} required/></label>
        <label>Filial<select className="select" name="expFilial" defaultValue={unit}>
          <option value="">Todas as filiais</option>{units.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <label>Categoria<select className="select" name="expCategoria" defaultValue={category}>
          <option value="">Todas as categorias</option>{categoryNames.map(name=><option value={name} key={name}>{name}</option>)}
        </select></label>
        <label>Buscar por descrição<div className={styles.search}><Search size={15}/><input name="expBusca" defaultValue={search} maxLength={100} placeholder="Descrição da despesa"/></div></label>
        <button className={styles.apply} type="submit">Filtrar</button>
      </div>
      {invalid&&<p role="alert" className={styles.warning}>A data inicial não pode ser posterior à data final.</p>}
    </form>
    <section className={styles.panel}>
      <div className={styles.heading}><div><h3>{category?"Dashboard da categoria: "+category:"Resumo de despesas"}</h3><p>Valores da filial e do período selecionados</p></div>
        {isOwner&&<Link className={styles.new} href={"/erp/"+encodeURIComponent(tenantCode)+"/financeiro-criar-despesa"}><Plus size={15}/> Criar despesa</Link>}
      </div>
      <div className={styles.metrics}>{summary.map(metric=><div key={metric.label} className={[styles.metric,styles[metric.tone]].join(" ")}>
        <span>{metric.label}</span><strong>{money(metric.value)}</strong>
      </div>)}</div>
    </section>
    <section id="expense-list" className={styles.panel}>
      <div className={styles.heading}><div><h3>Listagem de despesas</h3><p>{filtered.length} registro(s) encontrados</p></div></div>
      <div className={styles.statusTabs} role="navigation" aria-label="Situação das despesas">
        {[["todos","Todos"],["PENDING","Pendentes"],["PAID","Pago"],["CANCELED","Cancelado"]].map(([key,label])=>
          <Link key={key} href={queryUrl(key)} aria-current={status===key?"page":undefined} className={status===key?styles.selected:""}>{label}</Link>)}
      </div>
      {truncated&&<p className={styles.warning}>Mais de 10.000 lançamentos no período. Reduza o intervalo para consultar os totais completos.</p>}
      <form action={markFinancialPaidBulk}>
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <input type="hidden" name="returnQuery" value={returnQuery}/>
        {isOwner&&<div className={styles.bulk}>
          <span>Marque as despesas pendentes para dar baixa</span>
          <label>Motivo ou comprovante <input name="reason" className="input" minLength={5} maxLength={600} required placeholder="Ex.: Pagamento confirmado no extrato"/></label>
          <button type="submit"><CheckCheck size={15}/> Dar baixa nas selecionadas</button>
        </div>}
        <div className={styles.tableScroll}><table className={styles.table}>
          <thead><tr>{isOwner&&<th>Selecionar</th>}<th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Filial</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>
            {shown.map(entry=><tr key={entry.id}>
              {isOwner&&<td><input aria-label={"Selecionar despesa "+entry.description} type="checkbox" name="entryIds" value={entry.id} disabled={entry.status!=="PENDING"}/></td>}
              <td>{dateLabel(entry.dueDate??entry.createdAt)}</td>
              <td><strong>{entry.description}</strong>{entry.subcategory&&<small>{entry.subcategory}</small>}</td>
              <td>{entry.category}</td><td>{entry.unit?.name??"Geral"}</td><td>{money(entry.amount)}</td>
              <td>{entry.status==="PAID"?"Pago":entry.status==="PENDING"?"Pendente":"Cancelado"}</td>
            </tr>)}
            {!shown.length&&<tr><td colSpan={isOwner?7:6} className={styles.empty}>Nenhuma despesa encontrada para os filtros selecionados.</td></tr>}
          </tbody>
        </table></div>
      </form>
      {lastPage>1&&<nav className={styles.pagination} aria-label="Paginação de despesas">
        <span>Página {current} de {lastPage}</span>
        {current>1&&<Link href={queryUrl(status,current-1)}>Anterior</Link>}
        {current<lastPage&&<Link href={queryUrl(status,current+1)}>Próxima</Link>}
      </nav>}
    </section>
    <p className={styles.disclaimer}>Os valores consideram despesas com vencimento no período. Lançamentos cancelados aparecem na listagem, mas não compõem os totalizadores. A baixa em lote exige motivo e registra auditoria.</p>
  </div>;
}
