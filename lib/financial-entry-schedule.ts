/** Regras de lançamentos financeiros: centavos inteiros e recorrência sem deriva no fim do mês. */
export type FinancialFrequency = "DAYS"|"WEEKS"|"MONTHS"|"YEARS";
export type FinancialCondition = "ONCE"|"RECURRENT";
const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

function parts(iso:string){
  if(!isoPattern.test(iso))throw Error("Data inválida");
  const [year,month,day]=iso.split("-").map(Number);
  const d=new Date(Date.UTC(year,month-1,day,15));
  if(d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw Error("Data inexistente");
  return {year,month,day};
}

function lastDay(year:number, month:number){return new Date(Date.UTC(year,month,0)).getUTCDate();}
export function financialDueDates(first:string, count:number, every:number, frequency:FinancialFrequency):string[]{
  const start=parts(first);
  if(!Number.isSafeInteger(count)||count<1||count>60||
    !Number.isSafeInteger(every)||every<1||every>120||
    !["DAYS","WEEKS","MONTHS","YEARS"].includes(frequency))
    throw Error("Recorrência inválida");
  const result:string[]=[];
  for(let i=0;i<count;i++){
    const step=i*every;
    let d:Date;
    if(frequency==="MONTHS"||frequency==="YEARS"){
      const idx=start.year*12+(start.month-1)+step*(frequency==="YEARS"?12:1);
      const year=Math.floor(idx/12),month=idx%12+1;
      const day=Math.min(start.day,lastDay(year,month));
      d=new Date(Date.UTC(year,month-1,day,15));
    }else{
      d=new Date(Date.UTC(start.year,start.month-1,start.day+step*(frequency==="WEEKS"?7:1),15));
    }
    if(d.getUTCFullYear()>9999||d.getUTCFullYear()>start.year+10)throw Error("Período maior que dez anos");
    result.push(d.toISOString().slice(0,10));
  }
  return result;
}

export function calculateFinancialAmount(principal:number,discountPercent:number,interestPercent:number,fee:number){
  if(![principal,discountPercent,interestPercent,fee].every(Number.isFinite)||
    principal<=0||principal>99999999||
    discountPercent<0||discountPercent>100||interestPercent<0||interestPercent>100||
    fee<0||fee>99999999)
      throw Error("Valor ou taxa inválida");
  const principalCents=Math.round(principal*100);
  const discountCents=Math.round(principalCents*discountPercent/100);
  const interestCents=Math.round(principalCents*interestPercent/100);
  const feeCents=Math.round(fee*100);
  const totalCents=principalCents-discountCents+interestCents+feeCents;
  if(totalCents<1||totalCents>9999999900)throw Error("Total inválido");
  return {principalCents,discountCents,interestCents,feeCents,totalCents};
}
