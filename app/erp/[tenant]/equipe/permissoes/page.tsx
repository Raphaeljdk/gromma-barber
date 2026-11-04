import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/tenant-auth";
import { readWorkspace } from "@/lib/erp-workspace";
import { saveRolePermissions } from "../../module-actions";
import {
  STAFF_PERMISSION_ROLES, STAFF_PERMISSION_KEYS, STAFF_PERMISSION_LABELS,
  permissionsForRole,
} from "@/lib/role-permissions";

export const dynamic="force-dynamic";

const ROLE_LABELS={
  MANAGER:"Gestor",RECEPTIONIST:"Recepção",BARBER:"Barbeiro",ACCOUNTANT:"Contabilidade",
} as const;

export default async function TeamAccessGroups({params,searchParams}:{
  params:Promise<{tenant:string}>;
  searchParams:Promise<Record<string,string|undefined>>;
}){
  const {tenant}=await params,qs=await searchParams;
  const code=tenant.toUpperCase();
  const viewer=await requireTenantAccess(code);
  const shop=await prisma.barberShop.findUnique({where:{tenantCode:code},
    select:{id:true,tradeName:true,status:true,accessReleased:true,enabledFeatures:true}});
  if(!shop||shop.status!=="APPROVED"||!shop.accessReleased||
    (viewer.type==="TENANT"&&(viewer.barberShopId!==shop.id||viewer.role!=="OWNER")))
    notFound();
  const workspace=readWorkspace(shop.enabledFeatures);
  return <main className="professional-registration-page" style={{
    width:"100%",minWidth:0,maxWidth:"100%",padding:"14px clamp(12px,1.5vw,24px) 60px",
    boxSizing:"border-box"}}>
    <header className="section-head">
      <div><span className="eyebrow">Empresa / Profissionais / Grupos de acesso</span>
        <h1>Permissões por função</h1>
        <p className="muted">{shop.tradeName}</p></div>
      <Link className="btn secondary" href={"/erp/"+encodeURIComponent(code)+"/equipe"}>Voltar à equipe</Link>
    </header>
    {qs.ok&&<p className="notice success" role="status">Permissões do grupo atualizadas com auditoria.</p>}
    {qs.erro&&<p className="notice error-notice" role="alert">Não foi possível salvar o grupo. Verifique seu acesso e tente novamente.</p>}
    <p className="small muted">As permissões aqui são aplicadas a todos os profissionais desta função.
      O proprietário mantém acesso administrativo. Ajustes individuais são feitos na ficha do profissional.
      Dados pessoais completos dos clientes nunca são liberados no aplicativo do barbeiro por estas opções.</p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,330px),1fr))",gap:12,marginTop:16}}>
      {STAFF_PERMISSION_ROLES.map(role=><section key={role} className="card" style={{padding:16}}>
        <h2 style={{fontSize:18,margin:"0 0 6px"}}>{ROLE_LABELS[role]}</h2>
        <form action={saveRolePermissions} className="erp-compact-form">
          <input type="hidden" name="tenantCode" value={code}/>
          <input type="hidden" name="role" value={role}/>
          <div style={{display:"grid",gap:9,margin:"12px 0 16px"}}>
            {STAFF_PERMISSION_KEYS.map(permission=><label key={permission} style={{display:"flex",alignItems:"center",gap:10}}>
              <input type="checkbox" name="permissions" value={permission}
                defaultChecked={permissionsForRole(role,workspace.rolePermissions).includes(permission)}/>
              {STAFF_PERMISSION_LABELS[permission]}
            </label>)}
          </div>
          <button className="btn" type="submit">Salvar grupo {ROLE_LABELS[role]}</button>
        </form>
      </section>)}
    </div>
  </main>;
}
