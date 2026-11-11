import Link from "next/link";
import {Banknote,Building2,Calculator,CheckCircle2,CreditCard,FolderPlus,Plus,ReceiptText} from "lucide-react";
import {createFinancialEntry,markFinancialPaid} from "@/app/erp/[tenant]/actions";
import {createFinancialCategory,createFinancialBankAccount,saveFinancialPaymentMethods} from "@/app/erp/[tenant]/financial-setup-actions";
import {brl} from "@/lib/plans";
import {PAYMENT_METHODS,PAYMENT_LABELS,type PaymentMethod} from "@/lib/checkout";
import {ErpListToolbar} from "@/components/erp-list-toolbar";
import {SectionPagination} from "@/components/section-pagination";
import type {ErpWorkspace} from "@/lib/erp-workspace";

export const FINANCIAL_SUBMODULES=[
 "financeiro-contas-pagar","financeiro-contas-receber",
 "financeiro-criar-receita","financeiro-criar-despesa",
 "financeiro-despesas","financeiro-categorias",
 "financeiro-contas-bancarias","financeiro-formas-comanda",
 "financeiro-formas-despesas","financeiro-contabilidade",
] as const;
export type FinancialSubmodule=typeof FINANCIAL_SUBMODULES[number];

export type FinanceEntryRow={
 id:string;description:string;type:"RECEIVABLE"|"PAYABLE";
 status:"PENDING"|"PAID"|"CANCELED";category:string;amount:number;
 dueDate:string|null;unitName:string|null;paymentMethod:string;bankAccountId:string;
};
type Totals={receivablePending:number;payablePending:number;receivablePaid:number;payablePaid:number};
type Props={
 tenantCode:string;view:FinancialSubmodule;rows:FinanceEntryRow[];total:number;
 page:number;pageSize:number;query:Record<string,string|string[]|undefined>;
 filterQuery:string;filterStatus:string;isOwner:boolean;workspace:ErpWorkspace;
 units:{id:string;name:string;paymentMethods:PaymentMethod[]}[];
 totals:Totals;ok:string;error:string;
};
const viewNames:Record<FinancialSubmodule,string>={
 "financeiro-contas-pagar":"Contas a pagar",
 "financeiro-contas-receber":"Contas a receber",
 "financeiro-criar-receita":"Criar receita",
 "financeiro-criar-despesa":"Criar despesas",
 "financeiro-despesas":"Despesas",
 "financeiro-categorias":"Categorias financeiras",
 "financeiro-contas-bancarias":"Contas bancárias",
 "financeiro-formas-comanda":"Formas de pagamento · Comanda",
 "financeiro-formas-despesas":"Formas de pagamento · Despesas",
 "financeiro-contabilidade":"Contabilidade",
};
const mask=(value:string)=>value.length<=4?"••••":"••••"+value.slice(-4);
const date=(iso:string|null)=>iso?new Intl.DateTimeFormat("pt-BR",{timeZone:"UTC"}).format(new Date(iso)):"—";

function FinancialEntryForm({tenantCode,type,units,workspace,returnModule}:{
 tenantCode:string;type:"RECEIVABLE"|"PAYABLE";
 units:Props["units"];workspace:ErpWorkspace;returnModule:string;
}){
 const allowedCategories=workspace.financialCategories.filter(item=>item.type===type||item.type==="BOTH");
 return <form action={createFinancialEntry} className="gromma-finance-entry-form">
   <input type="hidden" name="tenantCode" value={tenantCode}/>
   <input type="hidden" name="type" value={type}/>
   <input type="hidden" name="returnModule" value={returnModule}/>
   <label className="gromma-finance-form-wide">Descrição do lançamento
     <input className="input" name="description" minLength={2} maxLength={180} required placeholder={type==="PAYABLE"?"Ex.: Aluguel da unidade":"Ex.: Venda de serviço"}/>
   </label>
   <label>Categoria financeira
     <select name="category" className="select" defaultValue="Geral">
       <option value="Geral">Geral</option>
       {allowedCategories.map(item=><option key={item.id} value={item.name}>{item.name}</option>)}
     </select>
   </label>
   <label>Valor (R$)
     <input className="input" type="number" min=".01" max="99999999" step=".01" name="amount" required placeholder="0,00"/>
   </label>
   <label>Vencimento
     <input className="input" name="dueDate" type="date"/>
   </label>
   <label>Filial
     <select name="unitId" className="select" defaultValue=""><option value="">Geral / Empresa</option>
       {units.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
     </select>
   </label>
   <label>Conta bancária (opcional)
     <select className="select" name="bankAccountId" defaultValue="">
       <option value="">Não associar</option>
       {workspace.financialBankAccounts.filter(item=>item.active).map(item=>
         <option key={item.id} value={item.id}>{item.name} · {mask(item.account)}</option>)}
     </select>
   </label>
   {type==="PAYABLE"&&<label>Forma prevista de pagamento (opcional)
     <select name="paymentMethod" className="select" defaultValue="">
       <option value="">Ainda não definida</option>
       {workspace.financialExpenseMethods.map(method=><option key={method} value={method}>
         {PAYMENT_LABELS[method as PaymentMethod]}</option>)}
     </select>
   </label>}
   <div className="gromma-finance-form-footer">
     <p className="small muted">O lançamento entra como pendente. Registrar não efetua transferência ou baixa bancária.</p>
     <button className="btn" type="submit"><Plus size={16}/>{type==="PAYABLE"?"Criar despesa":"Criar receita"}</button>
   </div>
 </form>;
}

function FinanceList({tenantCode,view,rows,total,page,pageSize,query,filterQuery,filterStatus,isOwner}:Pick<Props,
 "tenantCode"|"view"|"rows"|"total"|"page"|"pageSize"|"query"|"filterQuery"|"filterStatus"|"isOwner">){
 return <>
   <ErpListToolbar basePath={`/erp/${encodeURIComponent(tenantCode)}/${view}`} searchParams={query}
     pageParam="financeiroPage" hash="financeiro-subpage"
     search={{param:"financeiroQ",value:filterQuery,placeholder:"Buscar descrição ou categoria"}}
     selects={[{param:"financeiroStatus",value:filterStatus,label:"Status",options:[
       {value:"PENDING",label:"Pendente"},{value:"PAID",label:"Pago"},{value:"CANCELED",label:"Cancelado"}
     ]}]}/>
   <div className="table-wrap gromma-finance-subpage-table"><table>
     <thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Unidade</th>
       <th>Valor</th><th>Situação</th><th>Ações</th></tr></thead>
     <tbody>{rows.length?rows.map(entry=><tr key={entry.id}>
       <td><strong>{entry.description}</strong>{entry.paymentMethod&&
         <small className="gromma-finance-entry-meta"> · {PAYMENT_LABELS[entry.paymentMethod as PaymentMethod]??entry.paymentMethod}</small>}</td>
       <td>{entry.category}</td><td>{date(entry.dueDate)}</td><td>{entry.unitName??"Geral"}</td>
       <td><strong>{brl(entry.amount)}</strong></td>
       <td><span className={entry.status==="PAID"?"gromma-finance-pill done":"gromma-finance-pill"}>
         {entry.status==="PAID"?"Pago":entry.status==="PENDING"?"Pendente":"Cancelado"}</span></td>
       <td>{entry.status==="PENDING"&&isOwner?<details className="gromma-finance-confirm">
         <summary>Dar baixa</summary>
         <form action={markFinancialPaid}>
           <input type="hidden" name="tenantCode" value={tenantCode}/>
           <input type="hidden" name="entryId" value={entry.id}/>
           <input type="hidden" name="returnModule" value={view}/>
           <input className="input" name="reason" minLength={5} maxLength={600} required
             placeholder="Comprovante ou motivo da baixa" aria-label="Motivo da baixa manual"/>
           <button className="btn secondary" type="submit">Confirmar baixa</button>
         </form>
       </details>:<span className="small muted">—</span>}</td>
     </tr>):<tr><td colSpan={7} className="muted">Nenhum lançamento para os filtros selecionados.</td></tr>}</tbody>
   </table></div>
   <SectionPagination basePath={`/erp/${encodeURIComponent(tenantCode)}/${view}`}
     searchParams={query} param="financeiroPage" page={page} total={total} pageSize={pageSize}
     hash="financeiro-subpage" label="lançamentos"/>
 </>;
}

export function FinancialSubpage({tenantCode,view,rows,total,page,pageSize,query,
 filterQuery,filterStatus,isOwner,workspace,units,totals,ok,error}:Props){
 const isList=["financeiro-contas-pagar","financeiro-contas-receber","financeiro-despesas","financeiro-contabilidade"].includes(view);
 const isSetup=view.startsWith("financeiro-formas-")||view==="financeiro-categorias"||view==="financeiro-contas-bancarias";
 const isForm=view==="financeiro-criar-receita"||view==="financeiro-criar-despesa";
 const isExpense=view==="financeiro-criar-despesa";
 const addLink=view==="financeiro-contas-receber"?"financeiro-criar-receita":"financeiro-criar-despesa";
 const paidRevenue=totals.receivablePaid,paidExpense=totals.payablePaid;
 return <section id="financeiro-subpage" className="demo-section gromma-financial-subpage">
   <div className="section-head"><div><div className="eyebrow">Financeiro / Gestão</div>
     <h2>{viewNames[view]}</h2></div><div className="gromma-finance-page-actions">
       {isList&&isOwner&&<Link className="btn" href={`/erp/${encodeURIComponent(tenantCode)}/${addLink}`}>
         <Plus size={16}/> Novo lançamento</Link>}
       <Link className="btn secondary" href={`/erp/${encodeURIComponent(tenantCode)}/financeiro`}>Financeiro atual</Link>
     </div></div>
   {ok&&<p className="notice erp-inline-notice success" role="status">{ok==="financeiro-pago"?"Baixa registrada com sucesso.":ok==="financeiro"?"Lançamento criado.":"Configuração salva."}</p>}
   {error&&<p className="notice erp-inline-notice error-notice" role="alert">Não foi possível concluir a operação. Confira os campos e as permissões.</p>}
   {isList&&<>
     <div className="gromma-finance-subpage-kpis">
       <div><span>Receitas pendentes</span><strong>{brl(totals.receivablePending)}</strong></div>
       <div><span>Despesas pendentes</span><strong>{brl(totals.payablePending)}</strong></div>
       <div><span>Receitas recebidas</span><strong>{brl(paidRevenue)}</strong></div>
       <div><span>Despesas pagas</span><strong>{brl(paidExpense)}</strong></div>
     </div>
     {view==="financeiro-contabilidade"&&<div className="gromma-finance-accounting-note">
       <Calculator size={19}/><div><strong>Resumo para conferência contábil</strong>
         <p>Resultado financeiro registrado: <strong>{brl(paidRevenue-paidExpense)}</strong>.
           Este controle não é balanço fiscal, DRE oficial nem conciliação bancária.</p></div>
     </div>}
     <FinanceList tenantCode={tenantCode} view={view} rows={rows} total={total}
       page={page} pageSize={pageSize} query={query} filterQuery={filterQuery}
       filterStatus={filterStatus} isOwner={isOwner}/>
   </>}
   {isForm&&isOwner&&<article className="card gromma-finance-form-card">
     <h3>{isExpense?"Cadastrar nova despesa":"Cadastrar nova receita"}</h3>
     <p className="small muted">Associe a categoria, a filial e, quando necessário, a conta bancária.</p>
     <FinancialEntryForm tenantCode={tenantCode} type={isExpense?"PAYABLE":"RECEIVABLE"}
       units={units} workspace={workspace} returnModule={view}/>
   </article>}
   {view==="financeiro-categorias"&&isOwner&&<>
     <article className="card gromma-finance-form-card"><h3>Cadastrar categoria financeira</h3>
       <form action={createFinancialCategory} className="gromma-finance-registry-form">
         <input type="hidden" name="tenantCode" value={tenantCode}/>
         <label>Nome<input className="input" name="name" maxLength={80} minLength={2} required placeholder="Ex.: Aluguel, Serviços, Comissão"/></label>
         <label>Aplicável em<select className="select" name="type" defaultValue="BOTH">
           <option value="BOTH">Receitas e despesas</option>
           <option value="RECEIVABLE">Somente receitas</option>
           <option value="PAYABLE">Somente despesas</option></select></label>
         <button className="btn" type="submit"><FolderPlus size={16}/> Cadastrar categoria</button>
       </form>
     </article>
     <div className="gromma-finance-registry-list">{workspace.financialCategories.length?
       workspace.financialCategories.map(item=><div key={item.id}><strong>{item.name}</strong>
         <span>{item.type==="BOTH"?"Receitas e despesas":item.type==="PAYABLE"?"Despesas":"Receitas"}</span></div>):
       <p className="muted">Nenhuma categoria cadastrada. Lançamentos existentes continuam com suas categorias históricas.</p>}</div>
   </>}
   {view==="financeiro-contas-bancarias"&&isOwner&&<>
     <article className="card gromma-finance-form-card"><h3>Cadastrar conta bancária</h3>
       <p className="small muted">Cadastro interno. Não conecta ao banco nem efetua movimentações.</p>
       <form action={createFinancialBankAccount} className="gromma-finance-registry-form gromma-finance-bank-form">
         <input type="hidden" name="tenantCode" value={tenantCode}/>
         <label>Identificação da conta<input className="input" name="name" maxLength={90} minLength={2} required placeholder="Ex.: Conta principal"/></label>
         <label>Código do banco<input className="input" name="bankCode" pattern="[0-9]{1,5}" maxLength={5} inputMode="numeric" required placeholder="Ex.: 001"/></label>
         <label>Banco<input className="input" name="bankName" maxLength={100} minLength={2} required placeholder="Nome do banco"/></label>
         <label>Agência<input className="input" name="agency" maxLength={25} required placeholder="0001"/></label>
         <label>Conta<input className="input" name="account" maxLength={35} required placeholder="Número da conta"/></label>
         <button className="btn" type="submit"><Building2 size={16}/> Cadastrar conta</button>
       </form>
     </article>
     <div className="gromma-finance-registry-list">{workspace.financialBankAccounts.length?
       workspace.financialBankAccounts.map(item=><div key={item.id}><strong>{item.name}</strong>
         <span>{item.bankName} ({item.bankCode}) · Ag. {item.agency} · Conta {mask(item.account)}</span></div>):
       <p className="muted">Nenhuma conta cadastrada.</p>}</div>
   </>}
   {view==="financeiro-formas-comanda"&&isOwner&&<div className="gromma-finance-payment-section">
     <p className="small muted">Configure os meios aceitos em cada filial. Novas comandas respeitam estas opções; pagamentos antigos não são alterados.</p>
     {units.length?units.map(unit=><article className="card" key={unit.id}>
       <h3>{unit.name}</h3>
       <form action={saveFinancialPaymentMethods} className="gromma-finance-method-form">
         <input type="hidden" name="tenantCode" value={tenantCode}/>
         <input type="hidden" name="kind" value="COMMAND"/>
         <input type="hidden" name="unitId" value={unit.id}/>
         <div className="gromma-finance-payment-options">
           {PAYMENT_METHODS.map(method=><label key={method}>
             <input type="checkbox" name="methods" value={method} defaultChecked={unit.paymentMethods.includes(method)}/>
             <span>{PAYMENT_LABELS[method]}</span></label>)}
         </div>
         <button className="btn" type="submit"><CheckCircle2 size={16}/> Salvar meios da comanda</button>
       </form>
     </article>):<p className="muted">Cadastre uma filial para definir os métodos de pagamento da comanda.</p>}
   </div>}
   {view==="financeiro-formas-despesas"&&isOwner&&<article className="card gromma-finance-payment-section">
     <h3>Formas de pagamento das despesas</h3>
     <p className="small muted">Define as opções disponíveis ao registrar despesas. Não realiza pagamentos externos.</p>
     <form action={saveFinancialPaymentMethods} className="gromma-finance-method-form">
       <input type="hidden" name="tenantCode" value={tenantCode}/>
       <input type="hidden" name="kind" value="EXPENSE"/>
       <div className="gromma-finance-payment-options">
         {PAYMENT_METHODS.map(method=><label key={method}>
           <input type="checkbox" name="methods" value={method}
             defaultChecked={workspace.financialExpenseMethods.includes(method)}/>
           <span>{PAYMENT_LABELS[method]}</span></label>)}
       </div>
       <button className="btn" type="submit"><CreditCard size={16}/> Salvar meios das despesas</button>
     </form>
   </article>}
   {isSetup&&<p className="small muted gromma-finance-disclaimer">Os cadastros são exclusivos desta empresa e ficam registrados com auditoria. Nenhuma cobrança, transferência ou liquidação é feita automaticamente.</p>}
 </section>;
}
