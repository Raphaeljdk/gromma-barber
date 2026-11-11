/**
 * Diretório de instituições nacionais (BrasilAPI, espelho do cadastro brasileiro).
 * O código/ISPB é uma identificação, não uma prova de titularidade da conta.
 * Bancos internacionais são informados por nome e BIC/SWIFT; não existe código
 * numérico universal equivalente ao número-código brasileiro.
 */
export type BankOption={code:string;ispb:string;name:string};

const fallback:BankOption[]=[
  {code:"001",ispb:"00000000",name:"Banco do Brasil"},
  {code:"033",ispb:"90400888",name:"Santander Brasil"},
  {code:"041",ispb:"92702067",name:"Banrisul"},
  {code:"070",ispb:"00000208",name:"BRB"},
  {code:"077",ispb:"00416968",name:"Banco Inter"},
  {code:"104",ispb:"00360305",name:"Caixa Econômica Federal"},
  {code:"212",ispb:"92874270",name:"Banco Original"},
  {code:"237",ispb:"60746948",name:"Bradesco"},
  {code:"260",ispb:"18236120",name:"Nu Pagamentos (Nubank)"},
  {code:"290",ispb:"08561701",name:"PagSeguro"},
  {code:"323",ispb:"10573521",name:"Mercado Pago"},
  {code:"336",ispb:"31872495",name:"C6 Bank"},
  {code:"341",ispb:"60701190",name:"Itaú Unibanco"},
  {code:"380",ispb:"22896431",name:"PicPay"},
  {code:"748",ispb:"01181521",name:"Sicredi"},
  {code:"756",ispb:"02038232",name:"Sicoob"},
];
export async function getBrazilBankDirectory():Promise<BankOption[]>{
  try{
    const response=await fetch("https://brasilapi.com.br/api/banks/v1",{
      next:{revalidate:86400},signal:AbortSignal.timeout(6000),
    });
    if(!response.ok)throw Error("Diretório indisponível");
    const data:unknown=await response.json();
    if(!Array.isArray(data))throw Error("Diretório inválido");
    const banks:BankOption[]=data.flatMap((item:unknown)=>{
      if(!item||typeof item!=="object")return [];
      const bank=item as Record<string,unknown>;
      const id=Number(bank.code);
      const name=String(bank.fullName??bank.name??"").trim().slice(0,150);
      const ispb=String(bank.ispb??"").replace(/\D/g,"");
      if(!Number.isInteger(id)||id<0||id>999||!name)return [];
      return [{code:String(id).padStart(3,"0"),ispb:ispb.padStart(8,"0"),name}];
    });
    return banks.length>40?banks.sort((a,b)=>a.code.localeCompare(b.code)):fallback;
  }catch{return fallback;}
}
