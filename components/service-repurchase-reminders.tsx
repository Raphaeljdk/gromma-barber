import {CalendarClock} from "lucide-react";
import type {DueRepurchase} from "@/lib/service-scheduling";

function brazilDate(date:string){
  const [year,month,day]=date.split("-");
  return day+"/"+month+"/"+year;
}
function whatsappPhone(raw:string|null){
  const digits=(raw??"").replace(/\D/g,"");
  if(digits.length===11||digits.length===10)return "55"+digits;
  if(digits.length>=12&&digits.length<=15)return digits;
  return "";
}
export function ServiceRepurchaseReminders({reminders}:{reminders:DueRepurchase[]}){
  return <section className="gromma-repurchase-reminders" aria-label="Lembretes de recompra vencidos">
    <div className="gromma-repurchase-heading">
      <CalendarClock size={21} aria-hidden="true"/>
      <div><h3>Retorno programado por serviço</h3>
        <p>Clientes cujo prazo de retorno chegou. Envio pelo WhatsApp é assistido até conectar uma API autorizada.</p></div>
      <strong>{reminders.length} pendente(s)</strong>
    </div>
    {reminders.length?<div className="gromma-repurchase-list">
      {reminders.slice(0,30).map(item=>{
        const phone=whatsappPhone(item.phone);
        const msg=`Olá, ${item.customerName}! Tudo bem? O prazo de retorno para ${item.serviceName} chegou em ${brazilDate(item.dueDate)}. Gostaria de agendar novamente?`;
        return <div key={item.customerId+":"+item.serviceId} className="gromma-repurchase-row">
          <div><strong>{item.customerName}</strong><span>{item.serviceName} · retorno em {brazilDate(item.dueDate)}</span></div>
          {phone?<a className="btn secondary" target="_blank" rel="noopener noreferrer"
            href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}>Preparar lembrete</a>:
            <span className="small muted">Sem WhatsApp válido</span>}
        </div>;
      })}
    </div>:<p className="small muted">Nenhum retorno vencido entre os atendimentos concluídos consultados.</p>}
    {reminders.length>30&&<p className="small muted">Exibindo os 30 retornos mais antigos. Revise os demais na próxima consulta.</p>}
  </section>;
}
