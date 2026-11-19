import type {AudienceRule} from "@/lib/erp-workspace";

export type CampaignCustomer={
  id:string;
  birthDate:Date|null;
  lastAppointmentAt:Date|null;
};

/**
 * Segmentação antes de preparar qualquer mensagem.
 * Quem nunca teve atendimento concluído não é "inativo".
 * Cadastro de nascimento é data civil: utiliza o mês UTC registrado, sem
 * deslocar a data para o dia anterior por causa do fuso horário brasileiro.
 */
export function eligibleForCampaign<T extends CampaignCustomer>(
 customer:T,audience:AudienceRule,now:Date,clubCustomerIds:ReadonlySet<string>,
 timeZone="America/Sao_Paulo",
):boolean{
 if(audience==="ALL")return true;
 if(audience==="CLUB")return clubCustomerIds.has(customer.id);
 if(audience==="BIRTHDAY"){
   if(!customer.birthDate||!Number.isFinite(customer.birthDate.getTime()))return false;
   const month=new Intl.DateTimeFormat("en-US",{timeZone,month:"2-digit"}).format(now);
   return customer.birthDate.toISOString().slice(5,7)===month;
 }
 const threshold=audience==="INACTIVE_90"?90:audience==="INACTIVE_60"?60:
   audience==="INACTIVE_30"?30:0;
 if(!threshold||!customer.lastAppointmentAt||!Number.isFinite(customer.lastAppointmentAt.getTime()))return false;
 const difference=now.getTime()-customer.lastAppointmentAt.getTime();
 return difference>=threshold*86400000;
}
