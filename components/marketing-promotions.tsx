import {Trash2} from "lucide-react";
import Link from "next/link";
import {prisma} from "@/lib/prisma";
import {saveCoupon,deleteCoupon,updateCoupon,toggleCouponPause} from "@/app/erp/[tenant]/module-actions";
import {CouponCopyButton,ConfirmCouponDeleteButton} from "@/components/coupon-inline-actions";
import {couponPayments,couponStats,couponState} from "@/lib/coupon-analytics";
import {deleteMarketingPromotion} from "@/app/erp/[tenant]/marketing-offer-actions";
import {MarketingOfferForm} from "@/components/marketing-offer-form";
import {BirthdayPromotionForm} from "@/components/birthday-promotion-form";
import type {ErpWorkspace,CouponConfig} from "@/lib/erp-workspace";
import {resolveStockCategory} from "@/lib/accounting-kardex";
import {customerBirthdayForPeriod,marketingTodayISO} from "@/lib/marketing-birthday";
type View="promocoes"|"marketing-cupons"|"marketing-aniversariantes";
const currency=(cents:number)=>(cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const couponAudience=(a:CouponConfig["audience"])=>
 a==="CLUB"?"Somente clube":a==="NON_CLUB"?"Sem clube":"Todos";
const couponScope=(scope:CouponConfig["appliesTo"])=>
 scope==="SERVICES"?"Serviços":scope==="PRODUCTS"?"Produtos":"Serviços e produtos";
const couponStatusLabel={ACTIVE:"Ativo",PAUSED:"Pausado",EXPIRED:"Expirado",
 EXHAUSTED:"Esgotado",DELETED:"Excluído"};
function CouponAdvancedFields({coupon}:{coupon?:CouponConfig}){
 return <div className="grid erp-coupon-rule-grid">
  <label>Limite total de usos
   <input className="input" name="maxUses" type="number" min={1} max={1000000} step={1}
    placeholder="Ilimitado" defaultValue={coupon?.maxUses??undefined}/>
  </label>
  <label>Limite por cliente
   <input className="input" name="maxUsesPerCustomer" type="number" min={1} max={100000} step={1}
    placeholder="Ilimitado" defaultValue={coupon?.maxUsesPerCustomer??undefined}/>
  </label>
  <label>Valor mínimo da comanda (R$)
   <input className="input" name="minOrder" type="number" min={0} max={1000000} step=".01"
    placeholder="Sem mínimo" defaultValue={coupon?.minOrderCents? (coupon.minOrderCents/100).toFixed(2):undefined}/>
  </label>
  <label>Válido para
   <select className="select" name="appliesTo" defaultValue={coupon?.appliesTo??"BOTH"}>
    <option value="BOTH">Serviços e produtos</option>
    <option value="SERVICES">Somente serviços</option>
    <option value="PRODUCTS">Somente produtos</option>
   </select>
  </label>
 </div>;
}
export async function MarketingPromotions({tenantCode,shopId,ws,view,isOwner,error,ok,couponQuery="",couponStatusFilter="",couponSelectedId=""}:{
 tenantCode:string;shopId:string;ws:ErpWorkspace;view:View;isOwner:boolean;error:string;ok:string;
 couponQuery?:string;couponStatusFilter?:string;couponSelectedId?:string;
}){
 const [services,products,customers,staff]=await Promise.all([
  prisma.service.findMany({where:{barberShopId:shopId,active:true},select:{id:true,name:true},orderBy:{name:"asc"},take:1000}),
  prisma.product.findMany({where:{barberShopId:shopId,active:true},select:{id:true,name:true},orderBy:{name:"asc"},take:1000}),
  view==="marketing-aniversariantes"?prisma.customer.findMany({where:{barberShopId:shopId,active:true,birthDate:{not:null}},
   select:{birthDate:true},take:10000}):Promise.resolve([]),
  view==="marketing-cupons"&&isOwner?prisma.shopUser.findMany({
   where:{barberShopId:shopId},select:{id:true,name:true},take:1000,
  }):Promise.resolve([]),
 ]);
 const today=marketingTodayISO();
 const qualifying=customers.filter(c=>customerBirthdayForPeriod(c.birthDate,today,ws.birthdayPromotion.period)).length;
 const periodLabel=ws.birthdayPromotion.period==="DAY"?"do dia":ws.birthdayPromotion.period==="MONTH"?"do mês":"da semana";
 const offers=ws.marketingOffers.filter(o=>o.active);
 const pastCampaigns=ws.campaigns.filter(c=>c.kind==="PROMOTION"&&c.active);
 const couponRows=ws.coupons.map(c=>{
  const usage=couponPayments(c,ws.commandPayments),stats=couponStats(c,ws.commandPayments);
  return {coupon:c,usage,stats,status:couponState(c,usage.length,today)};
 });
 const filter= couponQuery.toLocaleLowerCase("pt-BR").trim().slice(0,60);
 const allowedStatuses=["ACTIVE","PAUSED","EXPIRED","EXHAUSTED","DELETED"];
 const status=allowedStatuses.includes(couponStatusFilter)?couponStatusFilter:"";
 const filteredCoupons=couponRows.filter(row=>
  (!status||row.status===status)&&(!filter||row.coupon.code.toLocaleLowerCase("pt-BR").includes(filter)));
 const selectedCouponRow=filteredCoupons.find(row=>row.coupon.id===couponSelectedId)||filteredCoupons[0]||null;
 const couponLink=(couponId:string)=>{
  const params=new URLSearchParams();
  if(filter)params.set("cupomQ",couponQuery.slice(0,60));
  if(status)params.set("cupomStatus",status);
  params.set("cupomId",couponId);
  return "/erp/"+encodeURIComponent(tenantCode)+"/marketing-cupons?"+params.toString();
 };
 const recognizedCodes=new Set(ws.coupons.map(c=>c.code.toUpperCase()));
 const recognizedIds=new Set(ws.coupons.map(c=>c.id));
 const redeemed=ws.commandPayments.filter(p=>
  (p.couponId&&recognizedIds.has(p.couponId))||(!p.couponId&&recognizedCodes.has(p.couponCode?.toUpperCase()??"")));
 const usesTotal=redeemed.length;
 const knownDiscountTotal=redeemed.reduce((total,p)=>total+(Number.isSafeInteger(p.couponCents)?p.couponCents??0:0),0);
 const missingDiscountCount=redeemed.filter(p=>!Number.isSafeInteger(p.couponCents)).length;
 const salesTotal=redeemed.reduce((total,p)=>total+
  (Number.isSafeInteger(p.paidTotalCents)?p.paidTotalCents!:
   Object.values(p.amounts).reduce((sum,v)=>sum+(Number.isFinite(v)?v:0),0)),0);
 const staffDirectory=new Map(staff.map(member=>[member.id,member.name]));
 const couponCodeById=new Map(ws.coupons.map(c=>[c.id,c.code]));
 return <section className="demo-section" style={{display:"grid",gap:15}}>
  <div className="section-head"><div><span className="eyebrow">Marketing e promoção</span><h2>{
    view==="marketing-cupons"?"Cupons de desconto":view==="marketing-aniversariantes"?"Aniversariantes "+periodLabel:"Promoções"
   }</h2></div></div>
  {error&&<p className="notice error-notice" role="alert">
   {error==="excluir"?"Não foi possível excluir esta promoção.":view==="marketing-cupons"?"Não foi possível salvar ou excluir o cupom. Confira os campos e as permissões.":"Não foi possível salvar. Confira os campos, o item escolhido e a validade."}
  </p>}
  {ok&&<p className="notice success" role="status">
   {ok==="excluida"?"Promoção excluída da divulgação.":ok==="cupom-excluido"?"Cupom excluído e desativado para novas comandas.":"Registro salvo com sucesso."}
  </p>}
  {view==="promocoes"&&<>
    {isOwner&&<article className="card"><h3>Publicar promoção</h3>
      <MarketingOfferForm tenantCode={tenantCode} services={services}
       products={products.map(p=>({...p,category:resolveStockCategory(ws,p.id)}))}/>
    </article>}
    <article className="card"><h3>Postagens cadastradas</h3>
      <div className="erp-stacked-list">
       {offers.map(o=><div key={o.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div><strong>{o.title}</strong>
         <span>{o.description}</span>
         {!!o.itemNames?.length&&<small>Item: {o.itemNames.join(", ")}</small>}
         <small>{o.offerType==="DRINK"?"Bebida":o.kind==="SERVICE"?"Serviço":"Produto"} · {o.discountPercent}% · Até {o.expiresAt} · Público: {o.audience} · {o.expiresAt<today?"Expirada":"Ativa"}</small>
        </div>
        {isOwner&&<form action={deleteMarketingPromotion} style={{flexShrink:0}}>
         <input type="hidden" name="tenantCode" value={tenantCode}/>
         <input type="hidden" name="promotionId" value={o.id}/>
         <input type="hidden" name="source" value="OFFER"/>
         <button className="btn secondary" type="submit" title={"Excluir promoção "+o.title} aria-label={"Excluir promoção "+o.title}><Trash2 size={16}/></button>
        </form>}
       </div>)}
       {pastCampaigns.map(c=><div key={c.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
        <div><strong>{c.title}</strong><span>{c.message}</span>
         <small>Promoção anterior · Público: {c.audience}</small>
        </div>
        {isOwner&&<form action={deleteMarketingPromotion} style={{flexShrink:0}}>
         <input type="hidden" name="tenantCode" value={tenantCode}/>
         <input type="hidden" name="promotionId" value={c.id}/>
         <input type="hidden" name="source" value="CAMPAIGN"/>
         <button className="btn secondary" type="submit" title={"Excluir promoção "+c.title} aria-label={"Excluir promoção "+c.title}><Trash2 size={16}/></button>
        </form>}
       </div>)}
       {!offers.length&&!pastCampaigns.length&&<p className="small muted">Nenhuma promoção cadastrada para divulgação.</p>}
      </div>
    </article>
  </>}
  {view==="marketing-cupons"&&<article className="card erp-coupons-compact erp-coupons-workspace">
   <div className="erp-coupons-heading">
    <h3>Cupons de desconto</h3>
    <p className="small muted">Cadastre, acompanhe e gerencie cupons com regras aplicadas no fechamento da comanda.</p>
   </div>
   <div className="erp-coupon-kpis" aria-label="Indicadores de cupons reais">
    <div><span>Cupons ativos</span><strong>{couponRows.filter(r=>r.status==="ACTIVE").length}</strong></div>
    <div><span>Utilizações</span><strong>{usesTotal}</strong></div>
    <div><span>Descontos comprovados</span><strong>{currency(knownDiscountTotal)}</strong></div>
    <div><span>Vendas com cupom</span><strong>{currency(salesTotal)}</strong></div>
   </div>
   {!!missingDiscountCount&&<p className="small muted" role="status">
    {missingDiscountCount} utilização(ões) antiga(s) não discriminam o desconto exclusivo do cupom.
    O total de descontos inclui somente valores identificados, sem estimativas.
   </p>}
   <div className="erp-coupon-workspace-grid">
    <div className="erp-coupon-primary-column">
     {isOwner&&<div className="erp-coupon-form-panel">
      <h4>Cadastrar cupom</h4>
      <form action={saveCoupon} className="erp-compact-form erp-coupons-form">
       <input type="hidden" name="tenantCode" value={tenantCode}/>
       <div className="grid erp-coupons-row erp-coupons-row-primary">
        <label>Código <input className="input" name="code" required minLength={3} maxLength={40} placeholder="Ex.: CORTE10"/></label>
        <label>Tipo <select className="select" name="kind" defaultValue="PERCENT">
         <option value="PERCENT">Percentual (%)</option><option value="FIXED">Valor fixo (R$)</option>
        </select></label>
        <label>Valor <input className="input" name="value" required type="number" min=".01" max="1000000" step=".01"/></label>
       </div>
       <div className="grid erp-coupons-row erp-coupons-row-secondary">
        <label>Clientes elegíveis <select className="select" name="audience" defaultValue="ALL">
         <option value="ALL">Todos os clientes</option>
         <option value="CLUB">Somente clientes do clube</option>
         <option value="NON_CLUB">Somente clientes sem clube</option>
        </select></label>
        <label>Data de validade <input className="input" name="expiresAt" required type="date"/></label>
       </div>
       <details className="erp-coupon-rules"><summary>Regras de utilização (opcional)</summary>
        <CouponAdvancedFields/>
       </details>
       <button className="btn" type="submit">Criar cupom</button>
      </form>
     </div>}
     <div className="erp-coupon-directory">
      <h4>Localizar cupons</h4>
      <form action={"/erp/"+encodeURIComponent(tenantCode)+"/marketing-cupons"} method="get" className="erp-coupon-filters">
       <label>Buscar cupom<input className="input" name="cupomQ" type="search"
        defaultValue={couponQuery} maxLength={60} placeholder="Código do cupom"/></label>
       <label>Status<select className="select" name="cupomStatus" defaultValue={status}>
        <option value="">Todos</option>
        {allowedStatuses.map(value=><option key={value} value={value}>
         {couponStatusLabel[value as keyof typeof couponStatusLabel]}
        </option>)}
       </select></label>
       <button className="btn secondary" type="submit">Filtrar</button>
      </form>
     </div>
    </div>
    <aside key={selectedCouponRow?.coupon.id??"empty"} className="erp-coupon-detail-panel" aria-label="Cupom selecionado">
     <div className="erp-coupon-detail-heading">
      <h4>Detalhes do cupom</h4>
      <span className="small muted">Acompanhamento e ações</span>
     </div>
     {selectedCouponRow?<>
      <div className="erp-coupon-selected-identity">
       <strong>{selectedCouponRow.coupon.code}</strong>
       <span className="erp-coupon-status-tag" data-status={selectedCouponRow.status}>
        {couponStatusLabel[selectedCouponRow.status]}
       </span>
      </div>
      <div className="erp-coupon-detail-stats">
       <div><span>Tipo</span><strong>{selectedCouponRow.coupon.kind==="PERCENT"?"Percentual":"Valor fixo"}</strong></div>
       <div><span>Desconto</span><strong>{selectedCouponRow.coupon.kind==="PERCENT"?
        selectedCouponRow.coupon.value+"%":currency(Math.round(selectedCouponRow.coupon.value*100))}</strong></div>
       <div><span>Público</span><strong>{couponAudience(selectedCouponRow.coupon.audience)}</strong></div>
       <div><span>Validade</span><strong>{selectedCouponRow.coupon.expiresAt??"Sem prazo"}</strong></div>
      </div>
      <div className="erp-coupon-side-section">
       <h5>Ações rápidas</h5>
       <div className="erp-coupon-side-actions">
        <CouponCopyButton code={selectedCouponRow.coupon.code}/>
        <a className="btn secondary erp-coupon-inline-button" target="_blank"
         rel="noopener noreferrer"
         href={"https://wa.me/?text="+encodeURIComponent("Cupom "+selectedCouponRow.coupon.code+" da barbearia. Consulte as condições e a validade antes de usar.")}
         aria-label={"Compartilhar cupom "+selectedCouponRow.coupon.code+" no WhatsApp"}
         title="Preparar mensagem no WhatsApp">WhatsApp</a>
        {isOwner&&selectedCouponRow.coupon.active&&<>
         <form action={toggleCouponPause} className="erp-coupon-delete-form">
          <input type="hidden" name="tenantCode" value={tenantCode}/>
          <input type="hidden" name="couponId" value={selectedCouponRow.coupon.id}/>
          <button className="btn secondary erp-coupon-inline-button" type="submit">
           {selectedCouponRow.coupon.paused?"Reativar":"Pausar"}</button>
         </form>
         <form action={deleteCoupon} className="erp-coupon-delete-form">
          <input type="hidden" name="tenantCode" value={tenantCode}/>
          <input type="hidden" name="couponId" value={selectedCouponRow.coupon.id}/>
          <ConfirmCouponDeleteButton code={selectedCouponRow.coupon.code}/>
         </form>
        </>}
       </div>
       {isOwner&&selectedCouponRow.coupon.active&&<details className="erp-coupon-editor">
        <summary>Editar regras do cupom</summary>
        <form action={updateCoupon} className="erp-compact-form erp-coupons-form">
         <input type="hidden" name="tenantCode" value={tenantCode}/>
         <input type="hidden" name="couponId" value={selectedCouponRow.coupon.id}/>
         <div className="grid erp-coupons-row erp-coupons-row-primary">
          <label>Tipo<select className="select" name="kind" defaultValue={selectedCouponRow.coupon.kind}>
           <option value="PERCENT">Percentual (%)</option><option value="FIXED">Valor fixo (R$)</option>
          </select></label>
          <label>Valor<input className="input" name="value" type="number" min=".01" max="1000000"
           step=".01" required defaultValue={selectedCouponRow.coupon.value}/></label>
          <label>Data de validade<input className="input" name="expiresAt" type="date"
           required defaultValue={selectedCouponRow.coupon.expiresAt??""}/></label>
         </div>
         <div className="grid erp-coupons-row erp-coupons-row-secondary">
          <label>Clientes elegíveis<select className="select" name="audience"
           defaultValue={selectedCouponRow.coupon.audience??"ALL"}>
           <option value="ALL">Todos os clientes</option>
           <option value="CLUB">Somente clientes do clube</option>
           <option value="NON_CLUB">Somente clientes sem clube</option>
          </select></label>
         </div>
         <CouponAdvancedFields coupon={selectedCouponRow.coupon}/>
         <button className="btn" type="submit">Salvar alterações</button>
        </form>
       </details>}
      </div>
      <div className="erp-coupon-side-section">
       <h5>Regras de utilização</h5>
       <div className="erp-coupon-rule-summary">
        <span>Aplicável em <strong>{couponScope(selectedCouponRow.coupon.appliesTo)}</strong></span>
        <span>Utilizações <strong>{selectedCouponRow.stats.uses}{selectedCouponRow.coupon.maxUses?
         "/"+selectedCouponRow.coupon.maxUses:" · Sem limite"}</strong></span>
        <span>Por cliente <strong>{selectedCouponRow.coupon.maxUsesPerCustomer??"Sem limite"}</strong></span>
        <span>Valor mínimo <strong>{selectedCouponRow.coupon.minOrderCents?
         currency(selectedCouponRow.coupon.minOrderCents):"Não exigido"}</strong></span>
       </div>
      </div>
      {isOwner&&<div className="erp-coupon-side-section">
       <h5>Histórico recente</h5>
       {selectedCouponRow.usage.length?
        <div className="erp-coupon-recent-list">
         {selectedCouponRow.usage.slice().sort((a,b)=>b.paidAt.localeCompare(a.paidAt)).slice(0,5).map(use=>
          <div key={use.id} className="erp-coupon-recent-use">
           <span><strong>{use.customerName||"Cliente não informado"}</strong>
            <small>{new Date(use.paidAt).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})}
             {" · "}Comanda {use.commandId.slice(-8).toUpperCase()}</small>
           </span>
           <strong>{Number.isSafeInteger(use.couponCents)?
            currency(use.couponCents!):"Não discriminado"}</strong>
          </div>)}
        </div>:
        <p className="small muted">Este cupom ainda não foi utilizado.</p>}
       {!!selectedCouponRow.usage.length&&<p className="small muted">
        Consulte o histórico completo abaixo para conferir os recebimentos.</p>}
      </div>}
     </>:<div className="erp-coupon-detail-empty">
      <p>Nenhum cupom encontrado.</p>
      <span className="small muted">Cadastre um cupom ou limpe os filtros para consultar detalhes e ações.</span>
     </div>}
    </aside>
   </div>
   <div className="erp-coupon-records">
    <div className="erp-coupon-records-heading">
     <h4>Cupons cadastrados</h4>
     <span className="small muted">{filteredCoupons.length} exibido(s) · selecione um para ver os detalhes</span>
    </div>
    <div className="erp-stacked-list erp-coupons-list">
     {filteredCoupons.map(({coupon:c,stats,status:state})=><div key={c.id}
      className="erp-coupon-entry" data-selected={selectedCouponRow?.coupon.id===c.id?"true":"false"}>
      <div className="erp-coupon-info">
       <strong>{c.code}</strong>
       <span>{c.kind==="PERCENT"?c.value+"%":currency(Math.round(c.value*100))}
        {" · "}{couponAudience(c.audience)}{" · "}Até {c.expiresAt??"Sem prazo"}
        {" · "}{stats.uses}{c.maxUses?"/"+c.maxUses:""} uso(s)
       </span>
       <small>{couponStatusLabel[state]} · {couponScope(c.appliesTo)}
        {c.minOrderCents?" · Mínimo "+currency(c.minOrderCents):""}</small>
      </div>
      <Link href={couponLink(c.id)} className="btn secondary erp-coupon-inline-button"
       aria-current={selectedCouponRow?.coupon.id===c.id?"true":undefined}>
       {selectedCouponRow?.coupon.id===c.id?"Selecionado":"Ver detalhes"}
      </Link>
     </div>)}
     {!filteredCoupons.length&&<p className="small muted">Nenhum cupom encontrado para estes filtros.</p>}
    </div>
   </div>
   {isOwner&&<details className="erp-coupon-history">
    <summary>Histórico de utilização · {redeemed.length} registro(s)</summary>
    <div className="table-wrap erp-inner-table"><table>
     <thead><tr><th>Data</th><th>Cupom</th><th>Cliente</th><th>Comanda</th>
      <th>Desconto do cupom</th><th>Venda</th><th>Responsável</th></tr></thead>
     <tbody>
      {redeemed.slice().sort((a,b)=>b.paidAt.localeCompare(a.paidAt)).slice(0,150).map(p=><tr key={p.id}>
       <td>{new Date(p.paidAt).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</td>
       <td>{(p.couponId&&couponCodeById.get(p.couponId))||p.couponCode||"—"}</td>
       <td>{p.customerName}</td><td>{p.commandId.slice(-8).toUpperCase()}</td>
       <td>{Number.isSafeInteger(p.couponCents)?currency(p.couponCents!):"Não discriminado"}</td>
       <td>{currency(Number.isSafeInteger(p.paidTotalCents)?p.paidTotalCents!:
        Object.values(p.amounts).reduce((sum,v)=>sum+(Number.isFinite(v)?v:0),0))}</td>
       <td>{p.operatorId?(staffDirectory.get(p.operatorId)??(p.operatorId==="Administrador"?"Administrador":"Responsável não localizado")):"Não registrado"}</td>
      </tr>)}
      {!redeemed.length&&<tr><td colSpan={7}>Nenhuma utilização registrada.</td></tr>}
     </tbody>
    </table></div>
   </details>}
  </article>}
  {view==="marketing-aniversariantes"&&<>
    <div className="erp-kpi-row"><article><span>ANIVERSARIANTES {periodLabel.toLocaleUpperCase("pt-BR")}</span>
      <strong>{qualifying}</strong><small>Clientes ativos com nascimento no período selecionado</small></article>
    </div>
    {isOwner&&<article className="card">
      <h3>Promoção exclusiva de aniversário</h3>
      <p className="small muted">A promoção será exibida somente no portal dos clientes cujo aniversário corresponde ao período configurado.</p>
      <BirthdayPromotionForm tenantCode={tenantCode} settings={ws.birthdayPromotion}
        services={services} products={products.map(p=>({...p,category:resolveStockCategory(ws,p.id)}))}/>
    </article>}
  </>}

 </section>;
}
