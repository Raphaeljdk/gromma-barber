import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";

const allowedStatuses = ["PENDING", "APPROVED", "BLOCKED", "REJECTED"] as const;

export default async function BarberiasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const qs = await searchParams;
  const status = qs.status && allowedStatuses.includes(qs.status as (typeof allowedStatuses)[number])
    ? (qs.status as (typeof allowedStatuses)[number])
    : undefined;

  const search = (qs.q ?? "").trim();
  const shops = await prisma.barberShop.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { tradeName: { contains: search, mode: "insensitive" } },
          { ownerName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { document: { contains: search.replace(/\D/g, "") } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const grouped = await prisma.barberShop.groupBy({ by: ["status"], _count: { _all: true } });
  const counts = Object.fromEntries(grouped.map((x) => [x.status, x._count._all])) as Record<string, number>;

  return (
    <section>
      <div className="page-head">
        <div>
          <div className="eyebrow">Controle central</div>
          <h2>Cadastros de barbearias</h2>
          <p className="small">Aprove, bloqueie ou rejeite cadastros. Nenhum outro módulo do negócio aparece neste perfil.</p>
        </div>
      </div>

      <form className="card" style={{ display: "flex", gap: 10, alignItems: "end", marginBottom: 14 }} action="/admin/barbearias" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <label style={{ flex: 1 }}><span className="label">Buscar cadastro</span><input className="input" name="q" defaultValue={search} placeholder="Barbearia, responsável, e-mail ou CPF/CNPJ" /></label>
        <button className="btn secondary" type="submit">Buscar</button>
      </form>

      <div className="stats">
        <Link className="stat" href="/admin/barbearias?status=PENDING"><span className="muted small">Pendentes</span><strong>{counts.PENDING ?? 0}</strong></Link>
        <Link className="stat" href="/admin/barbearias?status=APPROVED"><span className="muted small">Liberadas</span><strong>{counts.APPROVED ?? 0}</strong></Link>
        <Link className="stat" href="/admin/barbearias?status=BLOCKED"><span className="muted small">Bloqueadas</span><strong>{counts.BLOCKED ?? 0}</strong></Link>
        <Link className="stat" href="/admin/barbearias"><span className="muted small">Total</span><strong>{Object.values(counts).reduce((a, b) => a + b, 0)}</strong></Link>
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Barbearia</th><th>Responsável</th><th>Local</th><th>Plano</th><th>Status</th><th>Cadastro</th><th></th></tr></thead>
          <tbody>
            {shops.length === 0 ? (
              <tr><td colSpan={7} className="muted">Nenhum cadastro encontrado.</td></tr>
            ) : shops.map((shop) => (
              <tr key={shop.id}>
                <td><strong>{shop.tradeName}</strong><div className="small muted">{shop.document}</div></td>
                <td>{shop.ownerName}<div className="small muted">{shop.email}</div></td>
                <td>{shop.city}/{shop.state}</td>
                <td>{shop.requestedPlan === "PRO" ? "Pro" : "Essencial"}</td>
                <td><StatusBadge status={shop.status} /></td>
                <td>{new Intl.DateTimeFormat("pt-BR").format(shop.createdAt)}</td>
                <td><Link className="btn secondary" href={`/admin/barbearias/${shop.id}`}>Analisar</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
