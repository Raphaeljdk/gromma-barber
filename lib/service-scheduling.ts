import type {ServiceCatalogMetadata} from "./erp-workspace";

/**
 * Tempo efetivamente reservado no calendário.
 * Encaixes não somam minutos; o atendimento principal mantém seu tempo.
 * O tempo em fichas substitui a duração padrão quando configurado.
 */
export function effectiveServiceMinutes(defaultMinutes:number,meta?:ServiceCatalogMetadata):number{
  if(meta?.walkIn)return 0;
  const duration=meta?.ticketValue;
  return duration!=null&&Number.isSafeInteger(duration)&&duration>=1&&duration<=600
    ?duration:defaultMinutes;
}

export type RepurchaseVisit={
  customerId:string;serviceId:string;serviceName:string;completedAt:Date;
  customerName:string;phone:string|null;
};
export type DueRepurchase={
  customerId:string;serviceId:string;serviceName:string;customerName:string;
  phone:string|null;dueDate:string;lastCompleted:string;
};

/** Sem envios externos: calcula o vencimento do retorno para mostrar ao gestor. */
export function dueServiceRepurchases(
  visits:RepurchaseVisit[],metadata:Record<string,ServiceCatalogMetadata>,
  today:string,timeZone:string,
):DueRepurchase[]{
  const last=new Map<string,RepurchaseVisit>();
  for(const visit of visits){
    const days=metadata[visit.serviceId]?.repurchaseDays;
    if(!days||days<1||!Number.isSafeInteger(days))continue;
    const id=visit.customerId+"::"+visit.serviceId;
    const prior=last.get(id);
    if(!prior||prior.completedAt<visit.completedAt)last.set(id,visit);
  }
  const out:DueRepurchase[]=[];
  for(const visit of last.values()){
    const days=metadata[visit.serviceId]?.repurchaseDays;
    if(!days)continue;
    const dateKey=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(visit.completedAt);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(dateKey))continue;
    const due=new Date(dateKey+"T12:00:00Z");
    due.setUTCDate(due.getUTCDate()+days);
    const dueDate=due.toISOString().slice(0,10);
    if(dueDate>today)continue;
    out.push({
      customerId:visit.customerId,serviceId:visit.serviceId,
      serviceName:visit.serviceName,customerName:visit.customerName,phone:visit.phone,
      dueDate,lastCompleted:dateKey,
    });
  }
  return out.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.customerName.localeCompare(b.customerName,"pt-BR"));
}
