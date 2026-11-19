import Link from "next/link";
import {Copy,Gift,KeyRound,ShieldCheck,Users} from "lucide-react";
import {prisma} from "@/lib/prisma";
import {loyaltyBalance} from "@/lib/loyalty";
import type {ErpWorkspace} from "@/lib/erp-workspace";
import {saveLoyaltySettings,disableLoyaltyReward,createCustomerPointsLink,finishLoyaltyReward}
  from "@/app/erp/[tenant]/loyalty-actions";
import {LoyaltyRewardForm} from "@/components/loyalty-reward-form";
import styles from "./loyalty-points-manager.module.css";
export async function LoyaltyPointsManager({tenantCode,shopId,ws,isOwner,query}:{
  tenantCode:string;shopId:string;ws:ErpWorkspace;isOwner:boolean;
  query:Record<string,string|string[]|undefined>;
}){
  const get=(key:string)=>typeof query[key]==="string"?(query[key] as string):"";
  const [customers,services,products]=await Promise.all([
    prisma.customer.findMany({where:{barberShopId:shopId,active:true},
      select:{id:true,name:true,phone:true},orderBy:{name:"asc"},take:1001}),
    prisma.service.findMany({where:{barberShopId:shopId,active:true},
      select:{id:true,name:true},orderBy:{name:"asc"},take:1000}),
    prisma.product.findMany({where:{barberShopId:shopId,active:true},
      select:{id:true,name:true},orderBy:{name:"asc"},take:1000}),
  ]);
  const current=customers.slice(0,1000).map(c=>({...c,balance:loyaltyBalance(ws,c.id)}));
  const withPoints=current.filter(c=>c.balance>0).sort((a,b)=>b.balance-a.balance);
  const pending=ws.loyaltyRedemptions.filter(r=>r.status==="PENDING").slice(-100).reverse();
  const access=get("acesso");
  const customer=get("cliente");
  const link=ws.loyaltyAccess.find(a=>a.customerId===customer);
  const domain="/meu-clube/"+encodeURIComponent(tenantCode)+"/"+encodeURIComponent(access);
  const linkValid=Boolean(access&&link&&link.tokenHash&&/^[A-Za-z0-9_-]{42,44}$/.test(access));
  const linkName=customers.find(c=>c.id===customer)?.name??"cliente";
  return <section className={styles.wrap}>
    <header><div className="eyebrow">Marketing e promoção / Clube do assinante</div><h2>Pontos e recompensas</h2>
      <p>Defina os pontos por serviço, disponibilize recompensas e acompanhe a utilização por cliente.</p>
    </header>
    {get("erro")&&<p className="notice error-notice" role="alert">A operação não foi concluída. Confira o cadastro, o saldo e as permissões.</p>}
    {get("ok")&&<p className="notice success" role="status">Configuração de fidelidade atualizada.</p>}
    {isOwner&&<form action={saveLoyaltySettings} className={styles.settings}>
      <input type="hidden" name="tenantCode" value={tenantCode}/>
      <label className={styles.switch}><input type="checkbox" name="enabled"
        defaultChecked={ws.loyaltySettings.enabled}/> Ativar utilização de pontos pelos clientes</label>
      <label>Pontos por indicação convertida em atendimento pago
        <input className="input" name="referralPoints" type="number" min="0" max="100000"
          step="1" defaultValue={ws.loyaltySettings.referralPoints}/>
      </label>
      <button type="submit" className="btn">Salvar configurações</button>
    </form>}
    <div className={styles.metrics}>
      <div><span>Clientes com pontos</span><strong>{withPoints.length}</strong></div>
      <div><span>Pontos disponíveis</span><strong>{withPoints.reduce((s,c)=>s+c.balance,0).toLocaleString("pt-BR")}</strong></div>
      <div><span>Resgates aguardando entrega</span><strong>{pending.length}</strong></div>
      <div><span>Programa</span><strong>{ws.loyaltySettings.enabled?"Ativo":"Desativado"}</strong></div>
    </div>
    {isOwner&&<section className={styles.panel}>
      <h3><Gift size={16}/> Recompensas personalizadas</h3>
      <p>Ex.: 80 pontos = Coca-Cola; 300 pontos = corte gratuito. As recompensas são solicitadas pelo cliente e confirmadas pela equipe.</p>
      <LoyaltyRewardForm tenantCode={tenantCode} services={services} products={products}/>
      <div className={styles.list}>
        {ws.loyaltyRewards.map(item=><div className={styles.item} key={item.id}>
          <span><b>{item.name}</b> <small>{item.kind==="SERVICE"?"Serviço":"Produto/Bebida"}</small></span>
          <strong>{item.points} pontos</strong>
          <span>{item.active?"Ativa":"Inativa"}</span>
          {item.active&&<form action={disableLoyaltyReward}>
            <input type="hidden" name="tenantCode" value={tenantCode}/>
            <input type="hidden" name="rewardId" value={item.id}/>
            <button type="submit" className="btn secondary">Desativar</button>
          </form>}
        </div>)}
        {!ws.loyaltyRewards.length&&<p>Nenhuma recompensa cadastrada.</p>}
      </div>
    </section>}
    {isOwner&&<section className={styles.panel}>
      <h3><KeyRound size={16}/> Acesso privado dos clientes</h3>
      <p>Gere um link individual para o cliente visualizar seus pontos, trocar recompensas e compartilhar indicações. O link expira em 90 dias; gerar outro invalida o anterior.</p>
      <form action={createCustomerPointsLink} className={styles.linkForm}>
        <input type="hidden" name="tenantCode" value={tenantCode}/>
        <label>Cliente
          <select className="select" name="customerId" defaultValue="" required>
            <option value="" disabled>Selecione o cliente</option>
            {customers.slice(0,1000).map(c=><option value={c.id} key={c.id}>{c.name} · {c.phone??"sem telefone"}</option>)}
          </select>
        </label>
        <button type="submit" className="btn">Gerar link privado</button>
      </form>
      {customers.length>1000&&<p>Exibindo os primeiros 1.000 clientes em ordem alfabética.</p>}
      {linkValid&&<div className={styles.privateLink}>
        <ShieldCheck size={17}/>
        <div><strong>Link criado para {linkName}</strong>
          <p>Compartilhe somente com o cliente. Esse link dá acesso aos pontos e resgates pessoais.</p>
          <code>{domain}</code>
          <Link href={domain}>Abrir área do cliente</Link>
        </div>
      </div>}
    </section>}
    <section className={styles.panel}>
      <h3><Users size={16}/> Clientes com pontos</h3>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Cliente</th><th>Telefone</th><th>Saldo de pontos</th></tr></thead>
        <tbody>{withPoints.map(c=><tr key={c.id}>
          <td><strong>{c.name}</strong></td><td>{c.phone??"—"}</td>
          <td>{c.balance.toLocaleString("pt-BR")}</td>
        </tr>)}
        {!withPoints.length&&<tr><td colSpan={3}>Nenhum cliente com saldo positivo.</td></tr>}
        </tbody>
      </table></div>
    </section>
    <section className={styles.panel}>
      <h3>Resgates pendentes</h3>
      <div className={styles.list}>{pending.map(item=><div className={styles.item} key={item.id}>
        <div><strong>{customers.find(c=>c.id===item.customerId)?.name??"Cliente"}</strong>
          <small>{item.rewardName} · {item.points} pontos</small></div>
        {isOwner&&<div className={styles.actions}>
          <form action={finishLoyaltyReward}>
            <input type="hidden" name="tenantCode" value={tenantCode}/>
            <input type="hidden" name="redemptionId" value={item.id}/>
            <input type="hidden" name="status" value="FULFILLED"/>
            <button type="submit" className="btn">Confirmar entrega</button>
          </form>
          <form action={finishLoyaltyReward}>
            <input type="hidden" name="tenantCode" value={tenantCode}/>
            <input type="hidden" name="redemptionId" value={item.id}/>
            <input type="hidden" name="status" value="CANCELED"/>
            <button type="submit" className="btn secondary">Cancelar e devolver pontos</button>
          </form>
        </div>}
      </div>)}
      {!pending.length&&<p>Não há resgates pendentes de entrega.</p>}</div>
    </section>
    <p className={styles.note}>Pontos só são creditados após pagamento confirmado. O resgate apenas reserva pontos e aguarda confirmação de entrega. Produtos resgatados são retirados do estoque ao confirmar a entrega; serviços exigem confirmação manual.</p>
  </section>;
}
