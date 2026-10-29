import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { effectiveClubMember } from "@/lib/club-lifecycle";
import { dateInPeriod, memberStatus, normalizeName, salesRows, SUBSCRIPTION_REPORTS, validPeriod } from "@/lib/subscription-reports";
import { hasStaffPermission } from "@/lib/role-permissions";
import { spreadsheet, pdf } from "@/lib/report-export";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await params;
  const code = decodeURIComponent(tenant).toUpperCase();
  const viewer = await requireTenantAccess(code);
  const shop = await prisma.barberShop.findUnique({ where: { tenantCode: code },
    select: { id: true, status: true, accessReleased: true, enabledFeatures: true } });
  if (!shop || shop.status !== "APPROVED" || !shop.accessReleased ||
      (viewer.type === "TENANT" && (viewer.barberShopId !== shop.id ||
        !hasStaffPermission(viewer.role, readWorkspace(shop.enabledFeatures).rolePermissions, "VIEW_REPORTS"))))
    return new Response("Acesso negado", { status: 403 });
  const q = new URL(request.url).searchParams;
  const report = q.get("report") ?? "assinantes";
  const format = q.get("formato");
  const from = q.get("de") ?? "", to = q.get("ate") ?? "";
  if (!SUBSCRIPTION_REPORTS[report] || !["pdf", "xlsx"].includes(format ?? "") || !validPeriod(from,to))
    return new Response("Filtros inválidos", { status: 400 });
  const workspace = readWorkspace(shop.enabledFeatures);
  const term = normalizeName(q.get("assinaturasQ") ?? "");
  const plan = q.get("assinaturasPlano") ?? "";
  const status = q.get("assinaturasStatus") ?? "";
  const seller = q.get("vendedor") ?? "";
  const ids = [...new Set([...workspace.clubMembers.map(m=>m.customerId), ...workspace.clubEvents.map(e=>e.customerId), ...workspace.clubSales.map(s=>s.customerId)])];
  const [customers, financial] = await Promise.all([
    prisma.customer.findMany({where:{barberShopId:shop.id,id:{in:ids}},select:{id:true,name:true}}),
    prisma.financialEntry.findMany({where:{barberShopId:shop.id,category:"Clube de assinaturas",type:"RECEIVABLE"},orderBy:{createdAt:"desc"}}),
  ]);
  const names = new Map(customers.map(c=>[c.id,c.name]));
  const name = (id:string) => names.get(id) ?? "Cliente indisponível";
  const matches = (id:string) => !term || normalizeName(name(id)).includes(term);
  const plans = new Map(workspace.clubPlans.map(p=>[p.id,p.name]));
  const now = new Date();
  const date = (raw?: Date|string|null) => raw && Number.isFinite(new Date(raw).getTime())
    ? new Date(raw).toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"}) : "—";
  const brl = (v:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
  let rows: string[][] = [];
  if (report === "assinantes") {
    rows = [["Cliente","Tipo de plano","Contratação","Vencimento","Status"],
      ...workspace.clubMembers.map(m=>effectiveClubMember(m,now))
        .filter(m=>matches(m.customerId)&&(!plan||m.planId===plan))
        .map(m=>({...m, reportStatus:memberStatus(m,workspace,financial.map(e=>({...e,amount:Number(e.amount)})),now)}))
        .filter(m=>!status||m.reportStatus===status)
        .map(m=>[name(m.customerId),plans.get(m.planId)??"Plano indisponível",date(m.startedAt),date(m.nextBillingAt),m.reportStatus])];
  } else if (report === "assinaturas-trocas" || report === "assinaturas-cancelados") {
    const kind = report === "assinaturas-trocas" ? "CHANGE" : "CANCEL";
    rows = [["Cliente","Plano anterior","Novo plano","Solicitado em","Vigência","Situação","Motivo","Responsável"],
      ...workspace.clubEvents.filter(e=>e.kind===kind && matches(e.customerId) &&
        (!plan||e.newPlanId===plan||e.previousPlanId===plan) && dateInPeriod(e.at,from,to))
        .map(e=>[name(e.customerId),e.previousPlanName,e.newPlanName??"—",date(e.at),date(e.effectiveAt??e.at),e.status??"Registrado",e.reason??"—",e.actor??"—"])];
  } else if (report === "assinaturas-transacoes") {
    const charges = new Map(workspace.clubCharges.map(c=>[c.entryId,c]));
    rows = [["Cliente","Plano","Data do pagamento","Vencimento","Valor","Status"],
      ...financial.filter(e=>dateInPeriod(e.status==="PAID"?e.paidAt:e.createdAt,from,to) &&
        (!term||normalizeName(name(charges.get(e.id)?.customerId??"")).includes(term)))
        .map(e=>[name(charges.get(e.id)?.customerId??""),charges.get(e.id)?.planName??e.description,
          date(e.paidAt),date(e.dueDate),brl(Number(e.amount)),e.status])];
  } else {
    const sales = salesRows(workspace).filter(s=>dateInPeriod(s.at,from,to)&&matches(s.customerId)&&
      (!plan||s.planId===plan)&&(!seller||(s.sellerId??"unknown")===seller))
      .sort((a,b)=>b.at.localeCompare(a.at));
    rows = report==="assinaturas-origem" ? [["Vendedor","Cliente","Plano","Data da compra","Valor"],
      ...sales.map(s=>[s.sellerName,name(s.customerId),s.planName,date(s.at),s.amount===null?"Não registrado":brl(s.amount)])]
      : [["Cliente","Plano","Data da compra","Valor"],
        ...sales.map(s=>[name(s.customerId),s.planName,date(s.at),s.amount===null?"Não registrado":brl(s.amount)])];
  }
  if (rows.length > 10001) return new Response("Limite de 10.000 registros. Reduza o período.", { status: 413 });
  const body = format === "xlsx" ? spreadsheet(rows) : pdf(rows);
  return new Response(new Uint8Array(body), {headers:{
    "Content-Type":format==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"application/pdf",
    "Content-Disposition":`attachment; filename="gromma-${report}.${format}"`,
    "Cache-Control":"private, no-store",
  }});
}
