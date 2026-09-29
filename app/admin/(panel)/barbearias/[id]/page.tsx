import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  additionalUnitMonthly,
  brl,
  EXTERNAL_INTEGRATIONS,
  PLAN_CONFIG,
  PLAN_FEATURES,
} from "@/lib/plans";
import { StatusBadge } from "@/components/status-badge";
import { reviewBarberShop } from "../../actions";

const essentialSet = new Set<string>(PLAN_FEATURES.ESSENTIAL);

export default async function BarberShopDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const qs = await searchParams;

  let shop;

  try {
    shop = await prisma.barberShop.findUnique({
      where: { id },
      include: {
        auditLogs: { orderBy: { createdAt: "desc" }, take: 12 },
        units: { orderBy: { createdAt: "asc" } },
        subscriptions: { orderBy: { createdAt: "desc" }, take: 3 },
        _count: {
          select: {
            users: true,
            customers: true,
            services: true,
            appointments: true,
            commands: true,
            products: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to load tenant detail", error);
    return (
      <section>
        <Link className="small muted" href="/admin/barbearias">← Voltar para cadastros</Link>
        <div className="card system-state" style={{ marginTop: 18 }}>
          <div className="state-icon">!</div>
          <div>
            <h2>Não foi possível consultar este tenant.</h2>
            <p>O painel continua ativo. Tente novamente ou verifique a conexão com o banco.</p>
            <div className="actions">
              <Link className="btn" href={`/admin/barbearias/${id}`}>Tentar novamente</Link>
              <a className="btn secondary" href="/api/health/db" target="_blank" rel="noreferrer">Diagnóstico</a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!shop) notFound();

  const planKey = shop.activePlan ?? shop.requestedPlan;
  const plan = PLAN_CONFIG[planKey];
  const demoSlug = planKey === "PRO" ? "pro" : "essential";
  const currentSubscription = shop.subscriptions.find((item) => item.status === "ACTIVE") ?? shop.subscriptions[0];

  return (
    <section>
      <div className="page-head">
        <div>
          <Link className="small muted" href="/admin/barbearias">← Voltar para cadastros</Link>
          <div className="tenant-name" style={{ marginTop: 10 }}>
            <h2>{shop.tradeName}</h2>
            {shop.isDemo && <span className="demo-tag">DEMO</span>}
          </div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <StatusBadge status={shop.status} />
            {shop.tenantCode && <span className="badge">{shop.tenantCode}</span>}
          </div>
        </div>
        {shop.isDemo && <Link className="btn" href={`/demo/${demoSlug}`}>Abrir ERP de demonstração</Link>}
      </div>

      {qs.erro === "banco" && <div className="notice error-notice" style={{ marginBottom: 18 }}>Não foi possível salvar a ação no banco. Nenhuma alteração parcial foi aplicada.</div>}
      {qs.erro === "demo" && <div className="notice" style={{ marginBottom: 18 }}>Este cadastro é protegido porque faz parte da demonstração comercial.</div>}

      <div className="detail-grid">
        <div className="grid">
          <div className="card">
            <div className="eyebrow">Cadastro / Tenant</div>
            <div className="kv"><span>Barbearia</span><strong>{shop.tradeName}</strong></div>
            <div className="kv"><span>Razão social</span><span>{shop.legalName || "—"}</span></div>
            <div className="kv"><span>CPF/CNPJ</span><span>{shop.document}</span></div>
            <div className="kv"><span>Responsável</span><span>{shop.ownerName}</span></div>
            <div className="kv"><span>E-mail</span><span>{shop.email}</span></div>
            <div className="kv"><span>Local</span><span>{shop.city}/{shop.state}</span></div>
            <div className="kv"><span>Tenant</span><strong>{shop.tenantCode || "Será criado na aprovação"}</strong></div>
            <div className="kv"><span>Onboarding</span><span>{shop.onboardingStage}</span></div>
            <div className="kv"><span>Plano</span><span>{plan.name} — {plan.subtitle}</span></div>
          </div>

          <div className="card">
            <div className="eyebrow">Estrutura ERP</div>
            <div className="erp-count-grid">
              <div><span>Unidades</span><strong>{shop.units.length}</strong></div>
              <div><span>Usuários</span><strong>{shop._count.users}</strong></div>
              <div><span>Clientes</span><strong>{shop._count.customers}</strong></div>
              <div><span>Serviços</span><strong>{shop._count.services}</strong></div>
              <div><span>Agendamentos</span><strong>{shop._count.appointments}</strong></div>
              <div><span>Comandas</span><strong>{shop._count.commands}</strong></div>
              <div><span>Produtos</span><strong>{shop._count.products}</strong></div>
            </div>
            {shop.units.length > 0 && (
              <div className="grid" style={{ marginTop: 16 }}>
                {shop.units.map((unit) => (
                  <div className="integration-row" key={unit.id}>
                    <strong>{unit.name}</strong>
                    <span className="small muted">{unit.code} · {unit.city}/{unit.state} · {unit.active ? "Ativa" : "Inativa"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="eyebrow">Assinatura GROMMA</div>
            {currentSubscription ? (
              <>
                <div className="kv"><span>Status</span><strong>{currentSubscription.status}</strong></div>
                <div className="kv"><span>Plano</span><strong>{currentSubscription.plan}</strong></div>
                <div className="kv"><span>Mensalidade</span><strong>{brl(Number(currentSubscription.monthlyAmount))}</strong></div>
                <div className="kv"><span>Implementação</span><strong>{brl(Number(currentSubscription.setupAmount))}</strong></div>
              </>
            ) : <p className="small">A assinatura será criada automaticamente quando o cadastro for aprovado.</p>}
          </div>

          <div className="card">
            <div className="eyebrow">Integrações externas</div>
            <div className="grid" style={{ marginTop: 12 }}>
              {EXTERNAL_INTEGRATIONS.map((item) => (
                <div className="integration-row" key={item.name}>
                  <strong>{item.name}</strong>
                  <span className="small muted">{item.description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid">
          {shop.isDemo ? (
            <div className="card">
              <div className="eyebrow">Cadastro protegido</div>
              <h2 style={{ marginTop: 8 }}>Ambiente de demonstração</h2>
              <p>Este tenant é recriado/atualizado automaticamente para apresentações e não pode ser bloqueado ou rejeitado pelo painel.</p>
              <Link className="btn full" href={`/demo/${demoSlug}`}>Entrar no ERP fictício</Link>
            </div>
          ) : (
            <form action={reviewBarberShop} className="card grid">
              <input type="hidden" name="id" value={shop.id} />
              <div><div className="eyebrow">Onboarding</div><h2 style={{ marginTop: 6 }}>Liberar e provisionar ERP</h2></div>

              <label>
                <span className="label">Plano</span>
                <select className="select" name="plan" defaultValue={planKey}>
                  <option value="ESSENTIAL">Essencial — {brl(PLAN_CONFIG.ESSENTIAL.monthlyFee)}/mês</option>
                  <option value="PRO">Pro — {brl(PLAN_CONFIG.PRO.monthlyFee)}/mês</option>
                </select>
              </label>

              <div className="notice">
                Ao aprovar, o sistema cria automaticamente o tenant, a unidade Matriz, o usuário OWNER e a assinatura da plataforma.
              </div>

              <div>
                <span className="label">Essencial libera</span>
                <div className="feature-list">{PLAN_FEATURES.ESSENTIAL.map((feature) => <span className="feature" key={feature}>{feature}</span>)}</div>
              </div>

              <div>
                <span className="label">Pro adiciona</span>
                <div className="feature-list">{PLAN_FEATURES.PRO.filter((item) => !essentialSet.has(item)).map((feature) => <span className="feature" key={feature}>{feature}</span>)}</div>
              </div>

              <label><span className="label">Observação interna</span><textarea className="textarea" name="adminNotes" defaultValue={shop.adminNotes ?? ""} /></label>
              <button className="btn" name="action" value="approve" type="submit">Aprovar e provisionar ERP</button>
              <div className="grid grid-2">
                <button className="btn secondary" name="action" value="pending" type="submit">Voltar para pendente</button>
                <button className="btn danger" name="action" value="block" type="submit">Bloquear acesso</button>
              </div>
              <button className="btn danger" name="action" value="reject" type="submit">Rejeitar cadastro</button>
            </form>
          )}

          <div className="card">
            <div className="eyebrow">Auditoria</div>
            <div className="grid audit-list">
              {shop.auditLogs.length === 0 ? <span className="muted small">Nenhuma ação administrativa ainda.</span> : shop.auditLogs.map((log) => (
                <div key={log.id} className="small">
                  <strong>{log.action}</strong>
                  <div className="muted">{log.adminEmail} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(log.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
