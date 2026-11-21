import type {CouponConfig} from "./erp-workspace";
import type {CommandPayment} from "./checkout";

export type CouponUse=CommandPayment & {customerId?:string;couponId?:string;couponCents?:number;operatorId?:string;paidTotalCents?:number};
export type CouponStats={
 uses:number;
 discountKnownCents:number;
 discountUnknownUses:number;
 salesCents:number;
};
/** Cupom antigo só tem o código; cupons novos também guardam ID para manter vínculo após edição. */
export function couponPayments(coupon:Pick<CouponConfig,"id"|"code">,payments:readonly CouponUse[]):CouponUse[]{
 const code=coupon.code.toUpperCase();
 return payments.filter(payment=>payment.couponId===coupon.id||
  (!payment.couponId&&payment.couponCode?.toUpperCase()===code));
}
export function couponStats(coupon:Pick<CouponConfig,"id"|"code">,payments:readonly CouponUse[]):CouponStats{
 const rows=couponPayments(coupon,payments);
 return {
  uses:rows.length,
  discountKnownCents:rows.reduce((sum,p)=>sum+(Number.isSafeInteger(p.couponCents)&&p.couponCents!>=0?p.couponCents!:0),0),
  discountUnknownUses:rows.filter(p=>!Number.isSafeInteger(p.couponCents)).length,
  salesCents:rows.reduce((sum,p)=>sum+
    (Number.isSafeInteger(p.paidTotalCents)?p.paidTotalCents!:Object.values(p.amounts??{}).reduce((a,b)=>a+(Number.isFinite(b)?b:0),0)),0),
 };
}
export type CouponState="ACTIVE"|"PAUSED"|"EXPIRED"|"EXHAUSTED"|"DELETED";
export function couponState(coupon:CouponConfig,uses:number,todayISO:string):CouponState{
 if(!coupon.active)return "DELETED";
 if(coupon.expiresAt&&coupon.expiresAt<todayISO)return "EXPIRED";
 if(coupon.maxUses&&uses>=coupon.maxUses)return "EXHAUSTED";
 if(coupon.paused)return "PAUSED";
 return "ACTIVE";
}
export function eligibleUseCount(coupon:Pick<CouponConfig,"id"|"code">,payments:readonly CouponUse[],customerId:string){
 return couponPayments(coupon,payments).filter(payment=>payment.customerId===customerId).length;
}
