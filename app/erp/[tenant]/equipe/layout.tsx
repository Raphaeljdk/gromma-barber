import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { ErpSidebar } from "@/components/erp-sidebar";
import { logoutTenant } from "@/app/cliente/actions";
import { PLAN_CONFIG, brl } from "@/lib/plans";

export default async function TeamLayout({children,params}:{children:ReactNode;params:Promise<{tenant:string}>}) {
  const {tenant}=await params;
  const code=tenant.toUpperCase();
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},select:{
    id:true,tradeName:true,tenantCode:true,city:true,state:true,status:true,accessReleased:true,
    activePlan:true,requestedPlan:true,
    units:{select:{id:true}},users:{select:{id:true}}
  }});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    (viewer.type==="TENANT"&&viewer.barberShopId!==shop.id))notFound();
  const planKey=shop.activePlan??shop.requestedPlan;
  const plan=PLAN_CONFIG[planKey];
  const isOwner=viewer.type==="ADMIN"||viewer.role==="OWNER";
  const supportHref="mailto:suporte@gromma.app?subject="+encodeURIComponent("Suporte GROMMA - "+shop.tradeName);
  return <div className="demo-shell tenant-erp">
    <ErpSidebar business={shop.tradeName} tenantCode={code} city={shop.city} state={shop.state}
      units={shop.units.length} users={shop.users.length} planKey={planKey}
      planName={plan.name} planPrice={brl(plan.monthlyFee)} email={viewer.email}
      viewerType={viewer.type} canManage={isOwner||viewer.role==="MANAGER"}
      isOwner={isOwner} notificationCount={0} supportHref={supportHref}
      logoutAction={viewer.type==="TENANT"?logoutTenant:undefined}/>
    <section className="demo-main erp-main" style={{minWidth:0,width:"100%",maxWidth:"100%",boxSizing:"border-box"}}>
      {children}
    </section>
  </div>;
}
