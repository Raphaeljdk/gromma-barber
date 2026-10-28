/** Integer cents and hundredths of a percent; half-up rounding. */
export function commissionCents(base: number, rate: number) {
  if (!Number.isSafeInteger(base) || base < 0 || !Number.isInteger(rate) || rate < 0 || rate > 10000) throw new Error("Base ou percentual inválido.");
  return Number((BigInt(base) * BigInt(rate) + BigInt(5000)) / BigInt(10000));
}
export function rateHundredths(raw: string) {
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(raw)) throw new Error("Percentual inválido.");
  const [a,b=""] = raw.replace(",", ".").split(".");
  const n = Number(a)*100 + Number(b.padEnd(2,"0"));
  if (n>10000) throw new Error("O percentual máximo é 100%.");
  return n;
}
export function commissionTotals(lines: {kind:string; amount:unknown}[]) {
  const totals = { SERVICE:0, SUBSCRIPTION:0, PRODUCT:0, BONUS:0, DEDUCTION:0 };
  for (const line of lines) {
    if (!(line.kind in totals)) throw new Error("Tipo de comissão inválido.");
    const n=Math.round(Number(line.amount)*100);
    if (!Number.isSafeInteger(n)||n<0) throw new Error("Valor inválido.");
    totals[line.kind as keyof typeof totals]+=n;
  }
  const gross=totals.SERVICE+totals.SUBSCRIPTION+totals.PRODUCT+totals.BONUS;
  return {...totals,gross,net:gross-totals.DEDUCTION};
}
export function commissionPeriod(start:string,end:string) {
  const date=(s:string)=> { if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Período inválido."); const d=new Date(s+"T00:00:00-03:00"); if(!Number.isFinite(+d)||new Date(+d-10800000).toISOString().slice(0,10)!==s) throw new Error("Data inválida."); return d; };
  const from=date(start), last=date(end), to=new Date(+last+86400000);
  if(from>last || +to-+from>366*86400000) throw new Error("Selecione até 366 dias, em ordem cronológica.");
  return {from,to};
}
export type ProfessionalAvailability={days:number[];start:string;end:string;breaks:{start:string;end:string}[];serviceIds:string[]};
export function professionalAvailable(a:ProfessionalAvailability|null,start:Date,end:Date,serviceIds:string[]) {
  if(!a) return true;
  const local=new Date(+start-10800000), finish=new Date(+end-10800000);
  const minutes=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
  const x=local.getUTCHours()*60+local.getUTCMinutes(), y=finish.getUTCHours()*60+finish.getUTCMinutes();
  return local.toISOString().slice(0,10)===finish.toISOString().slice(0,10) && a.days.includes(local.getUTCDay()) && x>=minutes(a.start)&&y<=minutes(a.end)&&x<y && serviceIds.every(id=>a.serviceIds.includes(id))&&!a.breaks.some(b=>x<minutes(b.end)&&y>minutes(b.start));
}
