import type { UnitOperationsPolicy, ErpWorkspace } from "./erp-workspace";

export const PAYMENT_METHODS = ["PIX","CASH","DEBIT","CREDIT","TRANSFER"] as const;
export const PAYMENT_LABELS:Record<typeof PAYMENT_METHODS[number],string>={
  PIX:"Pix",CASH:"Dinheiro",DEBIT:"Débito",CREDIT:"Crédito",TRANSFER:"Transferência",
};
export const DEFAULT_UNIT_POLICY:UnitOperationsPolicy={
  legalDocument:"",paymentEmail:"",paymentPhone:"",pixKey:"",pixType:"",
  paymentMethods:["PIX","CASH","DEBIT","CREDIT","TRANSFER"],
  debitFeePercent:0,creditFeePercent:0,settlementDays:0,potPercent:null,
  cancellationMinutes:0,noShowBlockHours:0,coverImageUrl:"",welcomeText:"",
};
export function unitPolicy(workspace:ErpWorkspace,unitId:string):UnitOperationsPolicy{
  return {...DEFAULT_UNIT_POLICY,...workspace.unitPolicies[unitId]};
}
export function isValidCnpj(value:string):boolean{
  const digits=value.replace(/\D/g,"");
  if(digits.length!==14||/^(\d)\1{13}$/.test(digits))return false;
  const digit=(len:number)=>{
    const weights=len===12?[5,4,3,2,9,8,7,6,5,4,3,2]:
      [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum=weights.reduce((total,weight,index)=>total+Number(digits[index])*weight,0);
    const r=sum%11;
    return r<2?0:11-r;
  };
  return digit(12)===Number(digits[12])&&digit(13)===Number(digits[13]);
}
export function isValidPixKey(key:string,type:UnitOperationsPolicy["pixType"],unitCnpj:string):boolean{
  const clean=key.trim();
  if(!clean)return type==="";
  switch(type){
    case "CNPJ":return isValidCnpj(clean)&&clean.replace(/\D/g,"")===unitCnpj;
    case "EMAIL":return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)&&clean.length<=150;
    case "PHONE":return /^\+55\d{10,11}$/.test(clean);
    case "EVP":return /^[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$/.test(clean);
    default:return false;
  }
}
export function potPercentForUnit(workspace:ErpWorkspace,unitId:string|null|undefined):number{
  const own=unitId?workspace.unitPolicies?.[unitId]?.potPercent:null;
  return typeof own==="number"&&Number.isFinite(own)&&own>=0&&own<=100
    ?own:workspace.subscriptionPot.percent;
}
export function noShowUntil(lastNoShowAt:Date,hours:number):Date|null{
  if(!Number.isInteger(hours)||hours<=0||hours>720)return null;
  return new Date(lastNoShowAt.getTime()+hours*3600000);
}
export function canCancelOnline(startAt:Date,now:Date,cancellationMinutes:number):boolean{
  return startAt.getTime()-now.getTime()>=Math.max(0,cancellationMinutes)*60000;
}
