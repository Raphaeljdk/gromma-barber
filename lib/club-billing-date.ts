/** Datas recorrentes do clube: mês civil em São Paulo, com ajuste de 29–31
 * para o último dia de meses curtos. Usamos meio-dia local para evitar virada de data.
 */
const localParts = (date: Date) => {
 const parts = new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",year:"numeric",month:"numeric",day:"numeric"}).formatToParts(date);
 const value=(key:string)=>Number(parts.find(p=>p.type===key)?.value??0);
 return {year:value("year"),month:value("month"),day:value("day")};
};
export function billingDayFromDate(date: Date): number { return localParts(date).day; }
function localBillingDate(year:number,month:number,day:number):Date {
 const first = new Date(Date.UTC(year,month-1,1,12));
 const y=first.getUTCFullYear(),m=first.getUTCMonth()+1;
 const last=new Date(Date.UTC(y,m,0)).getUTCDate();
 return new Date(`${y}-${String(m).padStart(2,"0")}-${String(Math.min(day,last)).padStart(2,"0")}T12:00:00-03:00`);
}
export function nextMonthlyBillingAt(reference:Date, billingDay:number, months=1):Date {
 if(!Number.isFinite(reference.getTime())||!Number.isInteger(billingDay)||billingDay<1||billingDay>31)
   throw new Error("Dia de cobrança inválido");
 const {year,month}=localParts(reference);
 return localBillingDate(year,month+months,billingDay);
}
export function nextBillingDayAfter(now:Date,billingDay:number):Date {
 if(!Number.isInteger(billingDay)||billingDay<1||billingDay>31) throw new Error("Dia inválido");
 const {year,month}=localParts(now);
 const current=localBillingDate(year,month,billingDay);
 return current.getTime()>now.getTime()?current:localBillingDate(year,month+1,billingDay);
}
