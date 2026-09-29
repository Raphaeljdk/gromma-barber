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
      include: { auditLogs: { orderBy: { createdAt: "desc" }, take: 12 } },
    });
  } catch (error) {
    console.error("Failed to load barber shop detail", error);

    return (
      <section>
        <Link className="small muted" href="/admin/barbearias">← Voltar para cadastros</Link>
        <div className="card system-state" style={{ marginTop: 18 }}>
          <div className="state-icon">!</div>
          <div>
            <h2>Não foi possível consultar este cadastro.</h2>
            <p>O painel continua ativo. Tente novamente ou verifique a conexão com o banco.</p>
            <div className="actions">
              <Link className="btn" href={`/admin/barbearias/${id}`}>Tentar novamente</Link>
              <a className="btn secondary" href="/api/health/db" target="_blank" rel="noreferrer">Diagnóstico do banco</a>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!shop) notFound();

  const requested = PLAN_CONFIG[shop.requestedPlan];

  return (
    <section>
      <div className="page-head">
        <div>
          <Link className="small muted" href="/admin/barbearias">← Voltar para cadastros</Link>
          <h2 style={{ marginTop: 10 }}>{shop.tradeName}</h2>
          <div style={{ marginTop: 8 }}><StatusBadge status={shop.status} /></div>
        </div>
      </div>

      {qs.erro === "banco" && (
        <div className="notice error-notice" style={{ marginBottom: 18 }}>
          Não foi possível salvar a ação no banco. Nenhuma alteração parcial foi aplicada.
        </div>
      )}

      <div className="detail-grid">
        <div className="grid">
          <div className="card">
            <div className="eyebrow">Dados enviados</div>
            <div className="kv"><span>Barbearia</span><strong>{shop.tradeName}</strong></div>
            <div className="kv"><span>Razão social</span><span>{shop.legalName || "—"}</span></div>
            <div className="kv"><span>CPF/CNPJ</span><span>{shop.document}</span></div>
            <div className="kv"><span>Responsável</span><span>{shop.ownerName}</span></div>
            <div className="kv"><span>E-mail</span><span>{shop.email}</span></div>
            <div className="kv"><span>Telefone</span><span>{shop.phone}</span></div>
            <div className="kv"><span>WhatsApp</span><span>{shop.whatsapp || "—"}</span></div>
            <div className="kv"><span>Local</span><span>{shop.city}/{shop.state}</span></div>
            <div className="kv"><span>Endereço</span><span>{shop.address || "—"}</span></div>
            <div className="kv"><span>Plano solicitado</span><span>{requested.name} — {requested.subtitle}</span></div>
            <div className="kv"><span>Acesso liberado</span><span>{shop.accessReleased ? "Sim" : "Não"}</span></div>
          </div>

          <div className="card">
            <div className="eyebrow">Condições do plano solicitado</div>
            <div className="kv"><span>{requested.setupLabel}</span><strong>{brl(requested.setupFee)}</strong></div>
            <div className="kv"><span>Mensalidade</span><strong>{brl(requested.monthlyFee)}</strong></div>
            <div className="kv"><span>Unidade adicional</span><strong>{brl(additionalUnitMonthly(shop.requestedPlan))}/mês</strong></div>
            <div className="kv"><span>Limite de unidades</span><strong>{requested.maxUnits ?? "Sem limite"}</strong></div>
            <div className="kv"><span>Marca personalizada</span><strong>{requested.personalizedBrand ? "Sim" : "Não"}</strong></div>
          </div>

          <div className="card">
            <div className="eyebrow">Integrações externas</div>
            <p className="small">Aprovar o cadastro libera os módulos. Estes itens ainda precisam de configuração técnica antes do uso real:</p>
            <div className="grid">
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
          <form action={reviewBarberShop} className="card grid">
            <input type="hidden" name="id" value={shop.id} />
            <div>
              <div className="eyebrow">Decisão do administrador</div>
              <h2 style={{ marginTop: 6 }}>Liberar cadastro</h2>
            </div>

            <label>
              <span className="label">Plano que será liberado</span>
              <select className="select" name="plan" defaultValue={shop.activePlan ?? shop.requestedPlan}>
                <option value="ESSENTIAL">Essencial — {brl(PLAN_CONFIG.ESSENTIAL.monthlyFee)}/mês</option>
                <option value="PRO">Pro — {brl(PLAN_CONFIG.PRO.monthlyFee)}/mês</option>
              </select>
            </label>

            <div>
              <span className="label">Essencial libera</span>
              <div className="feature-list">
                {PLAN_FEATURES.ESSENTIAL.map((feature) => <span className="feature" key={feature}>{feature}</span>)}
              </div>
            </div>

            <div>
              <span className="label">Pro adiciona</span>
              <div className="feature-list">
                {PLAN_FEATURES.PRO.filter((item) => !essentialSet.has(item)).map((feature) => (
                  <span className="feature" key={feature}>{feature}</span>
                ))}
              </div>
            </div>

            <label>
              <span className="label">Observação interna</span>
              <textarea className="textarea" name="adminNotes" defaultValue={shop.adminNotes ?? ""} />
            </label>

            <button className="btn" name="action" value="approve" type="submit">Aprovar e liberar acesso</button>

            <div className="grid grid-2">
              <button className="btn secondary" name="action" value="pending" type="submit">Voltar para pendente</button>
              <button className="btn danger" name="action" value="block" type="submit">Bloquear acesso</button>
            </div>

            <button className="btn danger" name="action" value="reject" type="submit">Rejeitar cadastro</button>
          </form>

          <div className="card">
            <div className="eyebrow">Auditoria</div>
            <div className="grid audit-list">
              {shop.auditLogs.length === 0 ? (
                <span className="muted small">Nenhuma ação administrativa ainda.</span>
              ) : (
                shop.auditLogs.map((log) => (
                  <div key={log.id} className="small">
                    <strong>{log.action}</strong>
                    <div className="muted">
                      {log.adminEmail} · {new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(log.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
