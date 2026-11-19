import Link from "next/link";
import {Banknote,Building2,Calculator,CheckCircle2,CreditCard,FolderPlus,Plus,ReceiptText} from "lucide-react";
import {markFinancialPaid} from "@/app/erp/[tenant]/actions";
import {FinancialEntryCreateForm} from "@/components/financial-entry-create-form";
import {FinancialAccountOverview} from "@/components/financial-account-overview";
import {FinancialExpensesOverview} from "@/components/financial-expenses-overview";
import {createFinancialBankAccount,removeFinancialBankAccount,removeFinancialBankRequest,createFinancialCustomPaymentMethod,saveFinancialPaymentMethods} from "@/app/erp/[tenant]/financial-setup-actions";
import {FinancialCategoryForm} from "@/components/financial-category-form";
import {CustomPaymentMethodForm} from "@/components/custom-payment-method-form";
import {isBankVerifierConfigured} from "@/lib/financial-registry-security";
import type {BankOption} from "@/lib/bank-directory";
import styles from "@/components/financial-registry-forms.module.css";
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
 tenantCode:string;shopId:string;view:FinancialSubmodule;rows:FinanceEntryRow[];total:number;
 bankDirectory:BankOption[];bankOwner:boolean;
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

export function FinancialSubpage({tenantCode,shopId,view,bankDirectory,bankOwner,rows,total,page,pageSize,query,
 filterQuery,filterStatus,isOwner,workspace,units,totals,ok,error}:Props){
 const isList=view==="financeiro-contabilidade";
 const isAccount=view==="financeiro-contas-pagar"||view==="financeiro-contas-receber";
 const isExpenseSummary=view==="financeiro-despesas";
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
   {ok&&<p className="notice erp-inline-notice success" role="status">{ok==="verificacao-pendente"?"Solicitação de verificação registrada. A conta não está ativa.":ok==="financeiro-pago"?"Baixa registrada com sucesso.":ok==="financeiro"?"Lançamento criado.":"Configuração salva."}</p>}
   {error&&<p className="notice erp-inline-notice error-notice" role="alert">{error==="cnpj"?"Cadastre razão social/CNPJ em Dados e um CNPJ compatível na filial.":error==="pix"?"Chave Pix inválida ou incompatível com o CNPJ informado.":error==="titularidade"?"Somente o proprietário da empresa pode gerenciar contas bancárias.":"Não foi possível concluir a operação. Confira os campos, categorias e permissões."}</p>}
   {isAccount&&<FinancialAccountOverview tenantCode={tenantCode} shopId={shopId}
     view={view as "financeiro-contas-pagar"|"financeiro-contas-receber"}
     units={units} query={query} isOwner={isOwner} workspace={workspace}/>}
   {isExpenseSummary&&<FinancialExpensesOverview tenantCode={tenantCode} shopId={shopId}
     units={units} query={query} isOwner={isOwner} workspace={workspace}/>}
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
     <FinancialEntryCreateForm tenantCode={tenantCode} type={isExpense?"PAYABLE":"RECEIVABLE"}
       units={units} categories={workspace.financialCategories} banks={workspace.financialBankAccounts}
       expenseMethods={workspace.financialExpenseMethods}
       expenseCustomMethods={workspace.financialExpenseCustomMethods}
       customPaymentMethods={workspace.customPaymentMethods} returnModule={view}/>
   </article>}
   {view==="financeiro-categorias"&&isOwner&&<>
     <article className="card gromma-finance-form-card"><h3>Cadastrar categoria financeira</h3>
       <FinancialCategoryForm tenantCode={tenantCode}/>
     </article>
     <div className={styles.list}>
       {workspace.financialCategories.length?workspace.financialCategories.map(item=><div className={styles.listRow} key={item.id}>
         <div className={styles.listInfo}><strong>{item.name}</strong><small>{item.subcategory||"Sem subcategoria"}</small></div>
         <span className={styles.pill}>{{
           REVENUE_FIXED:"Receita fixa",REVENUE_VARIABLE:"Receita variável",
           EXPENSE_FIXED:"Despesa fixa",EXPENSE_OPERATIONAL:"Despesa operacional",
           EXPENSE_COMMISSION:"Comissões",GENERAL:"Receitas e despesas",
         }[item.classification]}</span>
         <span className="small muted">{item.type==="BOTH"?"Receitas e despesas":item.type==="PAYABLE"?"Despesas":"Receitas"}</span>
       </div>):
         <p className="muted">Nenhuma categoria cadastrada. Os lançamentos históricos foram preservados.</p>}
     </div>
   </>}
   {view==="financeiro-contas-bancarias"&&<>
     <article className="card gromma-finance-form-card"><h3>Contas bancárias e titularidade</h3>
       <p className="small muted">Somente o proprietário contratante pode solicitar, cadastrar e remover contas. O CNPJ cadastrado em Dados deve ter a mesma raiz do CNPJ da filial.</p>
       <p className={styles.warning}>A lista de bancos valida a instituição, não a existência da conta. Sem verificação bancária externa confirmada, nenhuma conta nova é ativada.</p>
       {!isBankVerifierConfigured()&&<p className={styles.warning} role="status">Integração de titularidade ainda não conectada: você pode enviar uma solicitação, mas ela ficará pendente e não poderá ser usada para recebimentos.</p>}
       {bankOwner&&<form action={createFinancialBankAccount} className={styles.bankForm}>
         <input type="hidden" name="tenantCode" value={tenantCode}/>
         <label>Identificação da conta
           <input className="input" name="name" maxLength={90} minLength={2} required placeholder="Ex.: Conta empresarial"/>
         </label>
         <label>Filial vinculada
           <select className="select" name="unitId" defaultValue="" required>
             <option value="" disabled>Selecionar filial</option>
             {units.map(unit=><option value={unit.id} key={unit.id}>{unit.name}</option>)}
           </select>
         </label>
         <label>Banco brasileiro
           <select name="bankCode" className="select" defaultValue="" required>
             <option value="" disabled>Selecionar instituição</option>
             {bankDirectory.map(bank=><option key={bank.ispb+bank.code} value={bank.code}>{bank.code} · {bank.name}</option>)}
           </select>
         </label>
         <label>Agência
           <input className="input" name="agency" maxLength={25} minLength={1} required placeholder="0001"/>
         </label>
         <label>Conta e dígito
           <input className="input" name="account" maxLength={35} minLength={2} required placeholder="00000-0"/>
         </label>
         <label>Tipo de chave Pix
           <select className="select" name="pixType" defaultValue="CNPJ" required>
             <option value="CNPJ">CNPJ</option>
             <option value="CPF">CPF</option>
             <option value="PHONE">Número de telefone (+55...)</option>
             <option value="EMAIL">E-mail</option>
             <option value="EVP">Chave aleatória</option>
           </select>
         </label>
         <label>Chave Pix
           <input className="input" name="pixKey" maxLength={150} required autoComplete="off" placeholder="Chave Pix cadastrada na instituição"/>
         </label>
         <div className={styles.bankActions}>
           <p>Será necessário comprovar titularidade do CNPJ, instituição, agência, conta e chave Pix antes da ativação.</p>
           <button type="submit" className="btn"><Building2 size={15}/> Solicitar verificação</button>
         </div>
       </form>}
     </article>
     <div className={styles.list}>
       {workspace.financialBankAccounts.filter(item=>item.active).map(item=><div key={item.id} className={styles.listRow}>
         <div className={styles.listInfo}><strong>{item.name} · {item.bankName}</strong>
           <small>{units.find(unit=>unit.id===item.unitId)?.name??"Filial"} · Banco {item.bankCode} · Ag. {item.agency} · Conta ••••{item.account.slice(-4)} · CNPJ final {item.ownerCnpj.slice(-4)}</small>
         </div>
         <span className={styles.pill}>Titularidade verificada</span>
         {bankOwner&&<form action={removeFinancialBankAccount}>
           <input type="hidden" name="tenantCode" value={tenantCode}/>
           <input type="hidden" name="bankAccountId" value={item.id}/>
           <button type="submit" className={styles.danger}>Excluir conta</button>
         </form>}
       </div>)}
       {workspace.financialBankRequests.map(item=><div key={item.id} className={styles.listRow}>
         <div className={styles.listInfo}><strong>{item.name} · {item.bankName}</strong>
           <small>{units.find(unit=>unit.id===item.unitId)?.name??"Filial"} · Conta ••••{item.account.slice(-4)}</small>
         </div>
         <span className={styles.pill}>Aguardando verificação externa — não ativa</span>
         {bankOwner&&<form action={removeFinancialBankRequest}>
           <input type="hidden" name="tenantCode" value={tenantCode}/>
           <input type="hidden" name="requestId" value={item.id}/>
           <button type="submit" className={styles.secondaryButton}>Cancelar solicitação</button>
         </form>}
       </div>)}
       {!workspace.financialBankAccounts.some(item=>item.active)&&!workspace.financialBankRequests.length&&
         <p className="small muted">Nenhuma conta bancária verificada. Cadastros antigos sem confirmação de titularidade não são considerados ativos.</p>}
     </div>
   </>}
   {view==="financeiro-formas-comanda"&&isOwner&&<div className="gromma-finance-payment-section">
     <p className="small muted">Configure os meios aceitos em cada filial. Novas comandas respeitam estas opções; pagamentos antigos não são alterados.</p>
     <CustomPaymentMethodForm tenantCode={tenantCode} destination="COMMAND"/>
     {workspace.customPaymentMethods.length>0&&<div className={styles.list}>
       {workspace.customPaymentMethods.filter(item=>item.active).map(item=><div className={styles.listRow} key={item.id}>
         <strong>{item.name}</strong><span className="small muted">Tipo: {PAYMENT_LABELS[item.type]}</span><span className={styles.pill}>Configuração disponível nas filiais</span>
       </div>)}
     </div>}
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
         {workspace.customPaymentMethods.some(item=>item.active)&&<div className={styles.methodGrid}>
           {workspace.customPaymentMethods.filter(item=>item.active).map(method=><label key={method.id}>
             <input type="checkbox" name="customMethods" value={method.id}
               defaultChecked={workspace.unitPolicies[unit.id]?.customPaymentMethods?.includes(method.id)??false}/>
             {method.name} ({PAYMENT_LABELS[method.type]})
           </label>)}
         </div>}
         <button className="btn" type="submit"><CheckCircle2 size={16}/> Salvar meios da comanda</button>
       </form>
     </article>):<p className="muted">Cadastre uma filial para definir os métodos de pagamento da comanda.</p>}
   </div>}
   {view==="financeiro-formas-despesas"&&isOwner&&<article className="card gromma-finance-payment-section">
     <h3>Formas de pagamento das despesas</h3>
     <CustomPaymentMethodForm tenantCode={tenantCode} destination="EXPENSE"/>
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
       {workspace.customPaymentMethods.some(item=>item.active)&&<div className={styles.methodGrid}>
         {workspace.customPaymentMethods.filter(item=>item.active).map(item=><label key={item.id}>
           <input type="checkbox" name="customMethods" value={item.id}
             defaultChecked={workspace.financialExpenseCustomMethods.includes(item.id)}/>
           {item.name} ({PAYMENT_LABELS[item.type]})
         </label>)}
       </div>}
       <button className="btn" type="submit"><CreditCard size={16}/> Salvar meios das despesas</button>
     </form>
   </article>}
   {isSetup&&<p className="small muted gromma-finance-disclaimer">Os cadastros são exclusivos desta empresa e ficam registrados com auditoria. Nenhuma cobrança, transferência ou liquidação é feita automaticamente.</p>}
 </section>;
}
