import {prisma} from "@/lib/prisma";
export async function NewCustomersReport({shopId}:{shopId:string}){
 const since=new Date(Date.now()-30*86400000);
 const [count,customers]=await Promise.all([
  prisma.customer.count({where:{barberShopId:shopId,active:true,createdAt:{gte:since}}}),
  prisma.customer.findMany({where:{barberShopId:shopId,active:true,createdAt:{gte:since}},
    select:{id:true,name:true,createdAt:true,phone:true},orderBy:{createdAt:"desc"},take:200}),
 ]);
 return <section className="demo-section">
  <div className="section-head"><div><div className="eyebrow">Relatórios / Clientes</div>
   <h2>Clientes novos</h2></div></div>
  <div className="erp-kpi-row"><article><span>Clientes novos</span><strong>{count}</strong>
   <small>Cadastros dos últimos 30 dias</small></article></div>
  <div className="table-wrap"><table>
   <thead><tr><th>Cliente</th><th>Telefone</th><th>Data do cadastro</th></tr></thead>
   <tbody>{customers.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.phone??"—"}</td>
    <td>{new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(c.createdAt)}</td></tr>)}
    {!customers.length&&<tr><td colSpan={3}>Nenhum cliente novo nesse período.</td></tr>}
   </tbody>
  </table></div>
  {count>200&&<p className="small muted">Exibindo os 200 registros mais recentes. Total calculado com todos os registros do período.</p>}
 </section>;
}
