/** Banking checks: no syntax-only operation can prove bank-account ownership. */
import {isValidCnpj} from "./unit-operations-policy";

export type PixRegistrationType="PHONE"|"CPF"|"CNPJ"|"EMAIL"|"EVP";
export type BankProofRequest={
  bankCode:string;ispb:string;agency:string;account:string;
  ownerCnpj:string;pixKey:string;pixType:PixRegistrationType;
};
export type BankProofResult={verified:true;provider:string;verifiedAt:string};
export const bankDigits=(value:string)=>value.replace(/\D/g,"");
const normalizeAccount=(value:string)=>value.toUpperCase().replace(/[^A-Z0-9]/g,"");

export function isValidCpf(value:string){
  const d=bankDigits(value);
  if(d.length!==11||/^(\d)\1{10}$/.test(d))return false;
  const digit=(length:number)=>{
    const total=[...d.slice(0,length)].reduce((acc,char,i)=>acc+Number(char)*(length+1-i),0);
    return (total*10%11)%10;
  };
  return Number(d[9])===digit(9)&&Number(d[10])===digit(10);
}

export function validPixKey(value:string,type:PixRegistrationType,ownerCnpj:string){
  const key=value.trim();
  switch(type){
    case "CNPJ":return isValidCnpj(key)&&bankDigits(key)===ownerCnpj;
    case "CPF":return isValidCpf(key);
    case "PHONE":return /^\+55\d{10,11}$/.test(key);
    case "EMAIL":return key.length<=150&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key);
    case "EVP":return /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(key);
  }
}

export function validatedOwnerCnpj(companyDocument:string,branchDocument:string,legalName:string){
  const company=bankDigits(companyDocument),branch=bankDigits(branchDocument);
  if(!legalName.trim()||!isValidCnpj(company)||!isValidCnpj(branch))
    throw Error("Preencha o CNPJ e a razão social em Dados e o CNPJ no cadastro da filial.");
  if(company.slice(0,8)!==branch.slice(0,8))
    throw Error("O CNPJ da filial deve pertencer à mesma raiz do CNPJ da empresa contratante.");
  return branch;
}
export function isBankVerifierConfigured(){
  try{
    const raw=process.env.BANK_ACCOUNT_VERIFIER_URL;
    const token=process.env.BANK_ACCOUNT_VERIFIER_TOKEN;
    return Boolean(raw&&token&&new URL(raw).protocol==="https:");
  }catch{return false;}
}
/** Fail-closed: unauthenticated or unconfirmed responses never create an active account. */
export async function verifyBankAccountOwnership(input:BankProofRequest):Promise<BankProofResult|null>{
  if(!isBankVerifierConfigured())return null;
  const endpoint=process.env.BANK_ACCOUNT_VERIFIER_URL!;
  const token=process.env.BANK_ACCOUNT_VERIFIER_TOKEN!;
  try{
    const response=await fetch(endpoint,{
      method:"POST",redirect:"error",cache:"no-store",
      headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify(input),signal:AbortSignal.timeout(8500),
    });
    if(!response.ok)return null;
    const raw:unknown=await response.json();
    if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
    const result=raw as Record<string,unknown>;
    if(result.verified!==true||result.pixOwnershipVerified!==true)return null;
    if(bankDigits(String(result.ownerCnpj??""))!==input.ownerCnpj)return null;
    if(bankDigits(String(result.bankCode??"")).padStart(3,"0")!==input.bankCode||
       bankDigits(String(result.ispb??"")).padStart(8,"0")!==input.ispb||
       String(result.pixType??"")!==input.pixType)return null;
    if(normalizeAccount(String(result.agency??""))!==normalizeAccount(input.agency)||
       normalizeAccount(String(result.account??""))!==normalizeAccount(input.account))return null;
    if(String(result.pixKey??"").trim().toLowerCase()!==input.pixKey.trim().toLowerCase())return null;
    if(!result.reference||typeof result.reference!=="string")return null;
    return {verified:true,provider:String(result.reference).slice(0,80),verifiedAt:new Date().toISOString()};
  }catch{return null;}
}
