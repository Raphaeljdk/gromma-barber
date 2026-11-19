import Link from "next/link";
import {Calculator,Download,FileCode2,FileSpreadsheet,FileUp,Plus} from "lucide-react";
import {prisma} from "@/lib/prisma";
import {loadKardex,isoDateToday,accountingDate,quantityText,money,resolveStockCategory,
  type AccountingView} from "@/lib/accounting-kardex";
import {createStockAccountingCategory,assignStockAccountingCategory,importAccountingNfeXml}
  from "@/app/erp/[tenant]/accounting-actions";
import type {ErpWorkspace} from "@/lib/erp-workspace";
import styles from "./accounting-views.module.css";
type View="financeiro-contabilidade"|AccountingView|"financeiro-portal-contador";
type Props={
  tenantCode:string;shopId:string;view:View;
  workspace:ErpWorkspace;isOwner:boolean;canImport:boolean;
  query:Record<string,string|string[]|undefined>;
};
const sections=[
  {id:"financeiro-cardex",name:"Kardex",detail:"Todas as entradas, saídas e saldos de estoque"},
  {id:"financeiro-relatorio-entrada",name:"Relatório de entrada",detail:"Movimentações que aumentaram o estoque"},
  {id:"financeiro-relatorio-saida",name:"Relatório de saída",detail:"Movimentações que reduziram o estoque"},
  {id:"financeiro-portal-contador",name:"Portal do contador",detail:"XMLs de NF-e e documentos para conferência"},
] as const;
const dateLabel=(iso:string)=>new Intl.DateTimeFormat("pt-BR",{
  day:"2-digit",month:"2-digit",year:"numeric",timeZone:"America/Sao_Paulo",
}).format(new Date(iso));
const href=(tenant:string,id:string)=>"/erp/"+encodeURIComponent(tenant)+"/"+id;
export async function AccountingViews({tenantCode,shopId,view,workspace,isOwner,canImport,query}:Props){
  const p=(name:string)=>typeof query[name]==="string"?(query[name] as string):"";
  const base="/erp/"+encodeURIComponent(tenantCode)+"/";
  const today=isoDateToday(),from=accountingDate(p("kInicio"),today.slice(0,8)+"01");
  const to=accountingDate(p("kFim"),today);
  const cat=workspace.stockCategories.includes(p("kCategoria"))?p("kCategoria"):"";
  const isReport=view==="financeiro-cardex"||view==="financeiro-relatorio-entrada"||view==="financeiro-relatorio-saida";
  const invalid=from>to;
  const result=isReport&&!invalid?await loadKardex({shopId,workspace,from,to,category:cat,view}):null;
  const reportQuery=new URLSearchParams({kInicio:from,kFim:to,kCategoria:cat,view});
  const products=isOwner&&view==="financeiro-cardex"?await prisma.product.findMany({
    where:{barberShopId:shopId,active:true},
    orderBy:{name:"asc"},select:{id:true,name:true},take:101,
  }):[];
  return <section className={styles.wrap}>
    <div className={styles.top}><div><div className="eyebrow">Financeiro / Contabilidade</div>
      <h2>{sections.find(s=>s.id===view)?.name??"Contabilidade"}</h2>
    </div></div>
    <nav aria-label="Módulos da contabilidade" className={styles.nav}>
      {sections.map(item=><Link href={href(tenantCode,item.id)} key={item.id}
        aria-current={view===item.id?"page":undefined} className={view===item.id?styles.current:""}>
        {item.name}</Link>)}
    </nav>
    {view==="financeiro-contabilidade"&&<div className={styles.cards}>
      {sections.map(item=><Link href={href(tenantCode,item.id)} className={styles.moduleCard} key={item.id}>
        <strong>{item.name}</strong><span>{item.detail}</span>
      </Link>)}
    </div>}
    {isReport&&<>
      <div className={styles.exportBar}>
        <span>Exportação das movimentações filtradas</span>
        <Link href={"/api/erp/"+encodeURIComponent(tenantCode)+"/accounting/export?"+reportQuery.toString()+"&format=csv"}>
          <FileSpreadsheet size={16}/> Excel (CSV)
        </Link>
        <Link href={"/api/erp/"+encodeURIComponent(tenantCode)+"/accounting/export?"+reportQuery.toString()+"&format=xml"}>
          <FileCode2 size={16}/> XML do estoque
        </Link>
      </div>
      <form className={styles.filters} method="get" action={href(tenantCode,view)}>
        <label>De<input className="input" type="date" name="kInicio" defaultValue={from} required/></label>
        <label>Até<input className="input" type="date" name="kFim" defaultValue={to} required/></label>
        <label>Categoria<select className="select" name="kCategoria" defaultValue={cat}>
          <option value="">Todas as categorias</option>
          {workspace.stockCategories.map(c=><option value={c} key={c}>{c}</option>)}
        </select></label>
        <button type="submit" className="btn">Filtrar</button>
      </form>
      {invalid&&<p className={styles.warning} role="alert">A data inicial deve ser anterior à data final.</p>}
      {result&&<>
        <div className={styles.metrics}>
          {view!=="financeiro-relatorio-saida"&&<div className={styles.metric}><span>Total de entrada</span>
            <strong>{quantityText(result.incomingMilli)}</strong><small>Unidades movimentadas</small></div>}
          {view!=="financeiro-relatorio-entrada"&&<div className={styles.metric}><span>Total de saída</span>
            <strong>{quantityText(result.outgoingMilli)}</strong><small>Unidades movimentadas</small></div>}
          {view==="financeiro-cardex"&&<>
            <div className={styles.metric}><span>Custo estimado das saídas</span>
              <strong>{money(result.estimatedCostCents)}</strong><small>Valores cadastrais atuais</small></div>
            <div className={styles.metric}><span>Lucro líquido (estimativa financeira)</span>
              <strong>{money(result.financialResultCents)}</strong>
              <small>Recebido menos pago, não lucro fiscal definitivo</small></div>
          </>}
        </div>
        {result.truncated&&<p className={styles.warning} role="alert">O período ultrapassa 10.000 movimentos. Reduza o filtro para gerar totais completos.</p>}
        <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th>Data</th><th>Produto</th><th>Categoria</th><th>Filial</th>
            <th>Movimento</th><th>Quantidade</th><th>Saldo anterior</th><th>Saldo final</th>
            <th>Custo estimado</th><th>Motivo</th></tr></thead>
          <tbody>{result.rows.slice().reverse().slice(0,250).map(item=><tr key={item.id}>
            <td>{dateLabel(item.date)}</td><td><strong>{item.product}</strong>{item.sku&&<small>SKU: {item.sku}</small>}</td>
            <td>{item.category}</td><td>{item.unit}</td><td>{item.type==="IN"?"Entrada":item.type==="OUT"?"Saída":"Ajuste"}</td>
            <td>{quantityText(item.quantityMilli)}</td><td>{quantityText(item.openingMilli)}</td>
            <td>{quantityText(item.balanceMilli)}</td><td>{money(item.estimatedCostCents)}</td>
            <td>{item.reason||"—"}</td>
          </tr>)}
          {!result.rows.length&&<tr><td colSpan={10} className={styles.empty}>Nenhuma movimentação encontrada no período.</td></tr>}
          </tbody>
        </table></div>
        {result.rows.length>250&&<p className={styles.hint}>Exibindo os 250 movimentos mais recentes. Exporte o arquivo para consultar todos os {result.rows.length} registros filtrados.</p>}
        <p className={styles.hint}>{result.costDisclaimer} {result.financeDisclaimer}</p>
      </>}
      {view==="financeiro-cardex"&&isOwner&&<details className={styles.settings}>
        <summary>Configurar categorias dos produtos <Plus size={14}/></summary>
        <div className={styles.settingsContents}>
          <form action={createStockAccountingCategory} className={styles.inline}>
            <input type="hidden" name="tenantCode" value={tenantCode}/>
            <label>Nova categoria do estoque<input className="input" name="name" required minLength={2} maxLength={60} placeholder="Ex.: Acessórios"/></label>
            <button className="btn" type="submit">Cadastrar categoria</button>
          </form>
          <div className={styles.productList}>{products.slice(0,100).map(product=><form key={product.id}
            action={assignStockAccountingCategory} className={styles.productItem}>
            <input type="hidden" name="tenantCode" value={tenantCode}/>
            <input type="hidden" name="productId" value={product.id}/>
            <strong>{product.name}</strong>
            <select className="select" name="category"
              defaultValue={resolveStockCategory(workspace,product.id)}>
              {workspace.stockCategories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <button type="submit" className="btn secondary">Salvar</button>
          </form>)}</div>
          {products.length>100&&<p className={styles.hint}>Exibindo os primeiros 100 produtos em ordem alfabética.</p>}
        </div>
      </details>}
    </>}
    {view==="financeiro-portal-contador"&&<>
      <div className={styles.moduleCard}><h3>Importar XML de NF-e</h3>
        <p>Envie o XML original da nota fiscal para consulta do contador. Este portal
          não emite nem autoriza notas e não substitui a verificação na SEFAZ.</p>
        {canImport&&<form action={importAccountingNfeXml} className={styles.inline}>
          <input type="hidden" name="tenantCode" value={tenantCode}/>
          <label>Arquivo XML (até 110 KB)
            <input type="file" name="nfeXml" accept=".xml,application/xml,text/xml" required/></label>
          <button className="btn" type="submit"><FileUp size={16}/> Importar XML</button>
        </form>}
      </div>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>NF</th><th>Emissão</th><th>Chave de acesso</th><th>Valor</th><th>Arquivo</th></tr></thead>
        <tbody>{workspace.accountingXmlDocuments.map(item=><tr key={item.id}>
          <td>{item.number||"—"}</td><td>{item.issueDate?item.issueDate.slice(0,10):"—"}</td>
          <td><code>{item.accessKey}</code></td><td>{money(Math.round(item.amount*100))}</td>
          <td><Link href={"/api/erp/"+encodeURIComponent(tenantCode)+"/accounting/xml/"+encodeURIComponent(item.id)}>
            <Download size={14}/> Baixar XML</Link></td>
        </tr>)}
        {!workspace.accountingXmlDocuments.length&&<tr><td colSpan={5} className={styles.empty}>Nenhum XML importado.</td></tr>}
        </tbody>
      </table></div>
      <p className={styles.hint}>Documentos privados e limitados à empresa; o XML é mantido para download autorizado. A importação não valida a autenticidade fiscal da NF-e.</p>
    </>}
  </section>;
}
