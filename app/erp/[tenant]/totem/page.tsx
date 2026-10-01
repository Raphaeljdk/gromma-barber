import Link from "next/link";
import { notFound } from "next/navigation";
import { TotemFlow } from "@/components/totem-flow";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { PLAN_CONFIG } from "@/lib/plans";

export default async function TotemPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const tenantCode = decodeURIComponent(tenant).toUpperCase();
  await requireTenantAccess(tenantCode);

  const shop = await prisma.barberShop.findUnique({
    where: { tenantCode },
    include: {
      customers: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, name: true, phone: true },
      },
      appointments: {
        orderBy: { startsAt: "asc" },
        take: 50,
        include: { service: true },
      },
    },
  });

  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased) notFound();

  const planKey = shop.activePlan ?? shop.requestedPlan;

  if (planKey !== "PRO") {
    const essential = PLAN_CONFIG.ESSENTIAL;
    const pro = PLAN_CONFIG.PRO;

    return (
      <main className="totem-locked-page">
        <section className="card totem-locked-card">
          <div className="eyebrow">Recurso Pro</div>
          <h1>Totem e check-in não estão liberados neste plano.</h1>
          <p>
            O ambiente atual utiliza o plano {essential.name}. O fluxo de Totem,
            check-in/checkout e operação por tablet faz parte da experiência {pro.name}.
          </p>
          <div className="actions">
            <Link className="btn" href={`/erp/${encodeURIComponent(tenantCode)}#plano`}>Voltar ao plano</Link>
            <Link className="btn secondary" href={`/erp/${encodeURIComponent(tenantCode)}`}>Voltar ao ERP</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="totem-page">
      <div className="totem-page-tools">
        <Link href={`/erp/${encodeURIComponent(tenantCode)}`}>← Voltar ao ERP</Link>
        <span>Modo de validação · nenhuma ação deste Totem grava dados ainda</span>
      </div>

      <TotemFlow
        business={shop.tradeName}
        tenantCode={tenantCode}
        customers={shop.customers}
        appointments={shop.appointments.map((appointment) => ({
          customerId: appointment.customerId,
          startsAt: appointment.startsAt.toISOString(),
          status: appointment.status,
          serviceName: appointment.service?.name ?? null,
        }))}
      />
    </main>
  );
}
