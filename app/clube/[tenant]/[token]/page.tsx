import { prisma } from '@/lib/prisma';
import { readWorkspace } from '@/lib/erp-workspace';
import { findValidInvite, inviteHash } from '@/lib/club-invite';
import { brl } from '@/lib/plans';
import { purchaseClubPlan } from './actions';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contratar assinatura | GROMMA', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function ClubPurchase({ params, searchParams }: { params: Promise<{ tenant: string; token: string }>; searchParams: Promise<Record<string,string|undefined>> }) {
  const { tenant, token } = await params;
  const qs = await searchParams;
  const shop = await prisma.barberShop.findUnique({ where: { tenantCode: tenant.toUpperCase() } });
  const workspace = readWorkspace(shop?.enabledFeatures ?? null);
  const invite = findValidInvite(workspace.clubInvites, token);
  const valid = shop?.status === 'APPROVED' && shop.accessReleased && invite;
  if (!valid) return <main className="container" style={{ maxWidth: 680, padding: 32 }}><article className="card"><h1>Clube de assinaturas</h1><p>{qs.ok === 'contratado' && workspace.clubInvites.some(i => i.hash === inviteHash(token) && i.usedAt) ? 'Contratação recebida. Procure a barbearia para efetuar o pagamento. Nenhum débito automático foi realizado.' : 'Este link expirou, já foi utilizado ou não está disponível. Solicite um novo link à barbearia.'}</p></article></main>;
  const [customer, sellers] = await Promise.all([
    prisma.customer.findFirst({ where: { id: invite.customerId, barberShopId: shop.id, active: true }, select: { name: true } }),
    prisma.shopUser.findMany({ where: { barberShopId: shop.id, active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!customer) return <main className="container"><p>Cadastro indisponível. Entre em contato com a barbearia.</p></main>;
  const plans = workspace.clubPlans.filter(p => p.active);
  const branding = workspace.branding;
  return <main className="container" style={{ maxWidth: 680, padding: 32 }}><article className="card erp-workspace-card">
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18,flexWrap:"wrap"}}>
      {branding.logoUrl && <img src={branding.logoUrl} width={76} height={76}
        style={{width:76,height:76,objectFit:"contain",borderRadius:12,border:"1px solid #ddd",padding:6}}
        alt={"Logotipo de "+shop.tradeName}/>}
      <div><span className="eyebrow">{shop.tradeName}</span>
        <h1 style={{margin:"6px 0 0",borderLeft:"4px solid "+branding.accentColor,paddingLeft:12}}>
          {branding.clubTitle || "Clube de assinaturas"}</h1></div>
    </div>
    {branding.clubDescription && <p>{branding.clubDescription}</p>}
    <p>Olá, {customer.name}. Confira os planos e indique quem realizou sua venda.</p>
    {qs.erro && <p role="alert">Não foi possível contratar. Verifique os campos; se você já possui assinatura, fale com a barbearia.</p>}
    <div className="erp-stacked-list">{plans.map(p => <div key={p.id}><div><strong>{p.name} · {brl(p.monthlyAmount)}/mês</strong><span>{p.visitsPerMonth ? `${p.visitsPerMonth} usos/mês` : 'Uso ilimitado'} · {p.benefits}</span></div></div>)}</div>
    <form action={purchaseClubPlan.bind(null, tenant, token)} className="erp-compact-form">
      <label><span className="label">Plano</span><select className="select" name="planId" required defaultValue=""><option value="" disabled>Selecione</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name} · {brl(p.monthlyAmount)}/mês</option>)}</select></label>
      <label><span className="label">Quem vendeu a assinatura para você?</span><select className="select" name="sellerId" defaultValue=""><option value="">Sem indicação</option>{sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <p>A contratação gera uma cobrança interna. O pagamento será combinado com a barbearia; este formulário não debita cartão ou conta.</p>
      <label className="erp-check-row"><input name="accept" type="checkbox" required/><span>Confirmo a contratação do plano selecionado e seu valor mensal.</span></label>
      <button className="btn" type="submit" disabled={!plans.length}>Contratar plano</button>
    </form>
  </article></main>;
}
