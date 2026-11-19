import {prisma} from "@/lib/prisma";
import Link from "next/link";

export async function NewCustomerReport({tenantCode,shopId}:{
  tenantCode:string;shopId:string;
}) {
  const since=new Date(Date.now()-30*24*60*60*1000);
  const [customers,total]=await Promise.all([
    prisma.customer.findMany({where:{barberShopId:shopId,active:true,createdAt:{gte:since}},
      orderBy:{createdAt:"desc"},take:100,select:{id:true,name:true,createdAt:true,phone:true}}),
    prisma.customer.count({where:{barberShopId:shopId,active:true,createdAt:{gte:since}}}),
  ]);
  return <section className="demo-section">
    <div className="section-head"><div><div className="eyebrow">Relatórios / Clientes</div>
      <h2>Clientes novos</h2></div></div>
    <div className="erp-kpi-row">
      <article><span>Novos clientes nos últimos 30 dias</span><strong>{total}</strong><small>cadastros ativos</small></article>
    </div>
    <article className="card erp-workspace-card">
      <div className="table-wrap"><table className="table"><thead>
        <tr><th>Cliente</th><th>Data de cadastro</th><th>Telefone</th><th>Abrir cadastro</th></tr>
      </thead><tbody>
      {customers.map(customer=><tr key={customer.id}>
        <td>{customer.name}</td>
        <td>{customer.createdAt.toLocaleDateString("pt-BR",{timeZone:"America/Sao_Paulo"})}</td>
        <td>{customer.phone||"Não informado"}</td>
        <td><Link href={"/erp/"+encodeURIComponent(tenantCode)+"/clientes?clientesQ="+encodeURIComponent(customer.name)}>Ver cliente</Link></td>
      </tr>)}
      {!customers.length&&<tr><td colSpan={4} className="muted">Nenhum novo cliente nesse período.</td></tr>}
      </tbody></table></div>
      {total>100&&<p className="small muted">Exibindo os 100 cadastros mais recentes.</p>}
    </article>
  </section>;
}
