/** Deterministic Monday–Sunday birthday eligibility in the shop's local calendar date. */
export function customerBirthdayThisWeek(birth:Date|null|undefined,todayISO:string):boolean{
 if(!birth||!Number.isFinite(birth.getTime())||!/^\d{4}-\d{2}-\d{2}$/.test(todayISO))return false;
 const now=new Date(todayISO+"T12:00:00.000Z");
 if(Number.isNaN(now.getTime())||now.toISOString().slice(0,10)!==todayISO)return false;
 const offset=(now.getUTCDay()+6)%7;
 const monday=new Date(now);monday.setUTCDate(now.getUTCDate()-offset);
 const sunday=new Date(monday);sunday.setUTCDate(monday.getUTCDate()+6);
 const month=birth.getUTCMonth(),day=birth.getUTCDate();
 for(let year=monday.getUTCFullYear();year<=sunday.getUTCFullYear();year++){
   let actualDay=day;
   if(month===1&&day===29&&new Date(Date.UTC(year,1,29)).getUTCMonth()!==1)actualDay=28;
   const birthday=new Date(Date.UTC(year,month,actualDay,12));
   if(birthday>=monday&&birthday<=sunday)return true;
 }
 return false;
}
export function marketingTodayISO():string{
 return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",
 year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}

export type BirthdayPromotionPeriod="DAY"|"WEEK"|"MONTH";
/** Elegibilidade pela data civil da barbearia, não pela data/hora do nascimento.
 * 29/02 em ano não bissexto é comemorado em 28/02 (mesma regra semanal).
 */
export function customerBirthdayForPeriod(
 birth:Date|null|undefined,todayISO:string,period:BirthdayPromotionPeriod="WEEK",
):boolean{
 if(!birth||!Number.isFinite(birth.getTime())||!/^\d{4}-\d{2}-\d{2}$/.test(todayISO))return false;
 const today=new Date(todayISO+"T12:00:00.000Z");
 if(!Number.isFinite(today.getTime())||today.toISOString().slice(0,10)!==todayISO)return false;
 if(period==="WEEK")return customerBirthdayThisWeek(birth,todayISO);
 if(period!=="DAY"&&period!=="MONTH")return false;
 const month=birth.getUTCMonth(),day=birth.getUTCDate();
 if(period==="MONTH")return month===today.getUTCMonth();
 if(month!==today.getUTCMonth())return false;
 const leap=(new Date(Date.UTC(today.getUTCFullYear(),1,29)).getUTCMonth()===1);
 const observed=month===1&&day===29&&!leap?28:day;
 return today.getUTCDate()===observed;
}
