import {createHash,randomBytes,timingSafeEqual} from "node:crypto";
import type {ErpWorkspace,LoyaltyMovement,LoyaltyReward} from "@/lib/erp-workspace";
export const loyaltyBalance=(ws:Pick<ErpWorkspace,"loyaltyMovements">,customerId:string)=>
  ws.loyaltyMovements.reduce((sum,row)=>sum+(row.customerId===customerId?row.delta:0),0);
export const normalizePhone=(input:string)=>{
  const digits=input.replace(/\D/g,"");
  const plain=digits.startsWith("55")&&digits.length>=12?digits.slice(2):digits;
  return /^[1-9][0-9]{9,10}$/.test(plain)?plain:"";
};
export const tokenHash=(token:string)=>createHash("sha256").update(token).digest("hex");
export function newPrivateLoyaltyToken(){return randomBytes(32).toString("base64url");}
export function newReferralCode(){return randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g,"A").toUpperCase();}
export function validatePrivateToken(ws:ErpWorkspace,token:string){
  if(!/^[A-Za-z0-9_-]{42,44}$/.test(token))return null;
  const hash=tokenHash(token),given=Buffer.from(hash,"hex");
  const record=ws.loyaltyAccess.find(entry=>{
    const digest=Buffer.from(entry.tokenHash,"hex");
    return digest.length===given.length&&timingSafeEqual(digest,given);
  });
  return record&&record.expiresAt>Date.now().toString()&&false?null:
    record&&Date.parse(record.expiresAt)>Date.now()?record:null;
}
export function loyaltyCanAppend(ws:ErpWorkspace,count=1){
  if(ws.loyaltyMovements.length+count>20000)throw Error("Ledger loyalty limit reached; use database migration before more credits");
}
export function appendMovement(ws:ErpWorkspace,item:Omit<LoyaltyMovement,"id"|"createdAt">){
  if(ws.loyaltyMovements.some(row=>row.sourceKey===item.sourceKey))return false;
  loyaltyCanAppend(ws);
  if(!Number.isSafeInteger(item.delta)||!item.delta||Math.abs(item.delta)>1000000)
    throw Error("Invalid loyalty delta");
  ws.loyaltyMovements.push({...item,id:"pts_"+randomBytes(12).toString("hex"),createdAt:new Date().toISOString()});
  return true;
}
export function awardPaidServices(ws:ErpWorkspace,commandId:string,customerId:string|null,
  lines:{id:string;kind:string;quantity:number;serviceId?:string|null;description:string}[]){
  if(!ws.loyaltySettings.enabled||!customerId)return 0;
  let total=0;
  for(const item of lines){
    if(item.kind!=="SERVICE"||!item.serviceId)continue;
    const perService=ws.serviceCatalogSettings[item.serviceId]?.pointsEarned??0;
    if(!Number.isSafeInteger(perService)||perService<=0)continue;
    if(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>100)continue;
    const points=perService*item.quantity;
    if(points>1000000)throw Error("Excessive points");
    const inserted=appendMovement(ws,{
      customerId,kind:"SERVICE",delta:points,
      sourceKey:"paid:"+commandId+":"+item.id,
      description:"Serviço realizado: "+item.description.slice(0,110),
    });
    if(inserted)total+=points;
  }
  return total;
}
export function undoCheckoutRewards(ws:ErpWorkspace,commandId:string){
  const credits=ws.loyaltyMovements.filter(row=>
    row.delta>0&&(row.sourceKey.startsWith("paid:"+commandId+":")||
      row.sourceKey==="refer:"+commandId));
  if(!credits.length)return 0;
  const affected=new Map<string,number>();
  for(const row of credits)affected.set(row.customerId,(affected.get(row.customerId)??0)+row.delta);
  for(const [customerId,amount] of affected){
    if(loyaltyBalance(ws,customerId)<amount)
      throw Error("Pontos vinculados à comanda já utilizados. Cancele resgates antes de reabri-la.");
  }
  loyaltyCanAppend(ws,credits.length);
  for(const row of credits)appendMovement(ws,{
    customerId:row.customerId,kind:"REVERSAL",delta:-row.delta,
    sourceKey:"undo:"+row.id,description:"Reversão de pontos da comanda",
  });
  for(const r of ws.loyaltyReferrals.filter(r=>r.rewardCommandId===commandId)){
    r.status="PENDING";r.rewardCommandId="";
  }
  return credits.reduce((sum,row)=>sum+row.delta,0);
}
export function rewardReferral(ws:ErpWorkspace,args:{
  commandId:string;customerId:string|null;phone:string;customerCreatedAt:Date|null;
}){
  if(!ws.loyaltySettings.enabled||!args.customerId||!ws.loyaltySettings.referralPoints)return 0;
  const phone=normalizePhone(args.phone);
  const eligible=ws.loyaltyReferrals.find(item=>
    item.status==="PENDING"&&item.phone===phone&&item.referrerId!==args.customerId&&
    args.customerCreatedAt&&new Date(item.createdAt)<=args.customerCreatedAt);
  if(!eligible)return 0;
  const points=ws.loyaltySettings.referralPoints;
  if(appendMovement(ws,{
    customerId:eligible.referrerId,kind:"REFERRAL",delta:points,
    sourceKey:"refer:"+args.commandId,description:"Indicação convertida em atendimento pago",
  })){
    eligible.status="REWARDED";eligible.rewardCommandId=args.commandId;
    return points;
  }
  return 0;
}
export function eligibleRewards(ws:ErpWorkspace,balance:number):LoyaltyReward[]{
  return ws.loyaltyRewards.filter(item=>item.active&&item.points<=balance);
}
