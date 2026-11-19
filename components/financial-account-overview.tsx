import Link from "next/link";
import {CheckCircle2, Plus} from "lucide-react";
import {prisma} from "@/lib/prisma";
import {markFinancialPaid} from "@/app/erp/[tenant]/actions";
import {brl} from "@/lib/plans";
import type {ErpWorkspace} from "@/lib/erp-workspace";
import styles from "./financial-account-overview.module.css";

type Props={
  tenantCode:string; shopId:string;
  view:"financeiro-contas-pagar"|"financeiro-contas-receber";
  units:{id:string;name:string}[];
  query:Record<string,string|string[]|undefined>;isOwner:boolean;workspace:ErpWorkspace;
};
const validDate=(input:string)=>/^\d{4}-\d{2}-\d{2}$/.test(input)&&
  !Number.isNaN(new Date(input+"T12:00:00-03:00").getTime())&&
  new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(input+"T12:00:00-03:00"))===input;
const dateText=(date:Date|null)=>date?new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(date):"—";
const sum=(rows:{amount:number}[])=>Math.round(rows.reduce((total,row)=>total+Math.round(row.amount*100),0))/100;

export async function FinancialAccountOverview({tenantCode,shopId,view,units,query,isOwner,workspace}:Props){
  const param=(key:string)=>typeof query[key]==="string"?query[key] as string:"";
  const nowKey=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const first=validDate(param("accInicio"))?param("accInicio"):nowKey.slice(0,8)+"01";
  const last=validDate(param("accFim"))?param("accFim"):nowKey;
  const filial=units.some(unit=>unit.id===param("accFilial"))?param("accFilial"):"";
  const invalid=first>last;
  const tab=param("accTab")==="taxas"?"taxas":"movimentacoes";
  const rawPage=Number(param("accPage"));
  const page=Number.isSafeInteger(rawPage)&&rawPage>0?rawPage:1;
  const payable=view==="financeiro-contas-pagar";
  const type=payable?"PAYABLE":"RECEIVABLE";
  const from=new Date(first+"T00:00:00-03:00");
  const to=new Date(last+"T23:59:59.999-03:00");
  const entries=invalid?[]:await prisma.financialEntry.findMany({
    where:{
      barberShopId:shopId,type,
      ...(filial?{unitId:filial}:{}),
      OR:[{dueDate:{gte:from,lte:to}},{dueDate:null,createdAt:{gte:from,lte:to}}],
    },
    orderBy:[{dueDate:"desc"},{createdAt:"desc"}],
    include:{unit:{select:{name:true}}},
    take:10001,
  });
  const truncated=entries.length>10000;
  const rows=entries.slice(0,10000).map(entry=>{
    const meta=workspace.financialEntryMetadata[entry.id];
    const amount=Number(entry.amount);
    const fee=meta?.feeAmount??0;
    return {...entry,amount,fee,
      base:Math.max(0,Math.round((amount-fee)*100)/100),
      subcategory:meta?.subcategory??""};
  });
  const overdueAt=new Date(nowKey+"T00:00:00-03:00");
  const expired=rows.filter(row=>row.status==="PENDING"&&row.dueDate&&row.dueDate<overdueAt);
  const pending=rows.filter(row=>row.status==="PENDING"&&!expired.some(exp=>exp.id===row.id));
  const paid=rows.filter(row=>row.status==="PAID");
  const nonCanceled=rows.filter(row=>row.status!=="CANCELED");
  const fees=Math.round(nonCanceled.reduce((total,row)=>total+Math.round(row.fee*100),0))/100;
  const total=sum(nonCanceled);
  const base=Math.round((total-fees)*100)/100;
  const metrics=[
    {label:"Vencido",value:sum(expired),tone:"red"},
    {label:payable?"A pagar":"A receber",value:sum(pending),tone:"amber"},
    {label:payable?"Pago":"Recebido",value:sum(paid),tone:"green"},
    {label:payable?"Total a pagar":"Total a receber",value:base,tone:"blue"},
    {label:"Taxas",value:fees,tone:"purple"},
    {label:"Total com taxas",value:total,tone:"teal"},
  ];
  const list=tab==="taxas"?rows.filter(row=>row.fee>0):rows;
  const pageSize=15;
  const lastPage=Math.max(1,Math.ceil(list.length/pageSize));
  const current=Math.min(page,lastPage);
  const visible=list.slice((current-1)*pageSize,current*pageSize);
  const url="/erp/"+encodeURIComponent(tenantCode)+"/"+view;
  const link=(target:string,number:number)=>{
    const q=new URLSearchParams({accInicio:first,accFim:last,accFilial:filial,accTab:target,accPage:String(number)});
    return url+"?"+q.toString()+"#finance-listagem";
  };
  return <div className={styles.wrapper}>
    <form className={styles.filters} method="get" action={url}>
      <div className={styles.filtersHeading}><strong>Filtros</strong><span>Vencimentos no período selecionado</span></div>
      <div className={styles.fields}>
        <label>Filial<select className="select" name="accFilial" defaultValue={filial}>
          <option value="">Todas as filiais</option>{units.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select></label>
        <label>Data inicial<input className="input" name="accInicio" type="date" required defaultValue={first}/></label>
        <label>Data final<input className="input" name="accFim" type="date" required defaultValue={last}/></label>
        <button type="submit" className={styles.submit}><CheckCircle2 size={15}/> Filtrar</button>
      </div>
      {invalid&&<p role="alert" className={styles.warning}>A data inicial precisa ser anterior ou igual à data final.</p>}
    </form>
    <section className={styles.panel}>
      <h3>Totalizadores</h3>
      {isOwner&&<div className={styles.actions}>
        <Link className={styles.pay} href={"/erp/"+encodeURIComponent(tenantCode)+"/financeiro-criar-despesa"}><Plus size={15}/> Adicionar conta a pagar</Link>
        <Link className={styles.receive} href={"/erp/"+encodeURIComponent(tenantCode)+"/financeiro-criar-receita"}><Plus size={15}/> Adicionar conta a receber</Link>
      </div>}
      <div className={styles.metrics}>{metrics.map(metric=><div key={metric.label} className={[styles.metric,styles[metric.tone]].join(" ")}><span>{metric.label}</span><strong>{brl(metric.value)}</strong></div>)}</div>
    </section>
    <section className={styles.panel} id="finance-listagem">
      <h3>Listagem</h3>
      <nav aria-label="Tipo de listagem" className={styles.tabs}>
        <Link className={tab==="movimentacoes"?styles.selected:""} aria-current={tab==="movimentacoes"?"page":undefined} href={link("movimentacoes",1)}>{payable?"Contas a pagar":"Contas a receber"}</Link>
        <Link className={tab==="taxas"?styles.selected:""} aria-current={tab==="taxas"?"page":undefined} href={link("taxas",1)}>Taxas</Link>
      </nav>
      {truncated&&<p className={styles.warning}>Mais de 10.000 lançamentos encontrados. Reduza o período para consultar os totais completos.</p>}
      <div className={styles.tableScroll}><table className={styles.table}>
        <thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Filial</th><th>Valor</th>{tab==="taxas"&&<th>Taxa</th>}<th>Status</th><th>Ações</th></tr></thead>
        <tbody>{visible.map(entry=><tr key={entry.id}>
          <td>{dateText(entry.dueDate??entry.createdAt)}</td>
          <td><strong>{entry.description}</strong>{entry.subcategory&&<small>{entry.subcategory}</small>}</td>
          <td>{entry.category}</td><td>{entry.unit?.name??"Geral"}</td><td>{brl(entry.amount)}</td>
          {tab==="taxas"&&<td>{brl(entry.fee)}</td>}
          <td>{entry.status==="PAID"?"Pago":entry.status==="PENDING"?"Pendente":"Cancelado"}</td>
          <td>{entry.status==="PENDING"&&isOwner?<details className={styles.confirm}>
            <summary>Dar baixa</summary>
            <form action={markFinancialPaid}>
              <input type="hidden" name="tenantCode" value={tenantCode}/>
              <input type="hidden" name="entryId" value={entry.id}/>
              <input type="hidden" name="returnModule" value={view}/>
              <input name="reason" className="input" minLength={5} maxLength={600} required placeholder="Comprovante ou motivo"/>
              <button className="btn secondary" type="submit">Confirmar</button>
            </form>
          </details>:"—"}</td>
        </tr>)}
        {!visible.length&&<tr><td colSpan={tab==="taxas"?8:7} className={styles.empty}>Nenhum resultado para o período selecionado.</td></tr>}
        </tbody>
      </table></div>
      {lastPage>1&&<div className={styles.pagination}>
        <span>Página {current} de {lastPage}</span>
        {current>1&&<Link href={link(tab,current-1)}>Anterior</Link>}
        {current<lastPage&&<Link href={link(tab,current+1)}>Próxima</Link>}
      </div>}
    </section>
    <p className={styles.disclaimer}>Os totais consideram os lançamentos com vencimento no período. Taxas cadastradas são exibidas separadamente; registrar uma conta não efetua pagamento bancário.</p>
  </div>;
}
