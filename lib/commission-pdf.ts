import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
export type CommissionDocument={id:string;shopName:string;shopDocument:string;shopAddress?:string|null;professionalName:string;periodStart:Date;periodEnd:Date;status:string;paidAt?:Date|null;paymentMethod?:string|null;createdBy?:string;gross:unknown;deductions:unknown;net:unknown;lines:{description:string;kind:string;baseAmount:unknown;percent:unknown;amount:unknown;occurredAt:Date}[]};
export async function commissionPdf(data:CommissionDocument) {
  const pdf=await PDFDocument.create(),regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const clean=(s:string)=>s.replace(/[^\x20-\x7E\xA0-\xFF]/g," ");
  const money=(n:unknown)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n));
  const day=(d:Date)=>new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo"}).format(d);
  let page=pdf.addPage([595.28,841.89]),y=790;
  const text=(s:string,size=10,strong=false,x=42)=>page.drawText(clean(s),{x,y,size,font:strong?bold:regular,color:rgb(.13,.14,.16)});
  const next=()=>{page=pdf.addPage([595.28,841.89]);y=790;};
  const line=(s:string,size=10,strong=false)=>{if(y<70)next();const words=clean(s).split(/\s+/);let row="";for(const w of words){if((strong?bold:regular).widthOfTextAtSize(row+" "+w,size)>510){text(row,size,strong);y-=size+6;row=w;}else row+=(row?" ":"")+w;}text(row,size,strong);y-=size+8;};
  page.drawRectangle({x:42,y:752,width:40,height:40,color:rgb(.12,.13,.15)});page.drawText("G",{x:52,y:761,size:27,font:bold,color:rgb(.78,.64,.35)});
  text("GROMMA BARBER",17,true,94);y-=24;text("DEMONSTRATIVO DE COMISSÕES",11,true,94);y-=44;
  line(data.shopName,14,true);line(`Identificação: ${data.shopDocument}`);if(data.shopAddress)line(data.shopAddress);
  line(`Profissional: ${data.professionalName}`,12,true);line(`Apuração: ${day(data.periodStart)} a ${day(new Date(+data.periodEnd-1))}`);
  line(`Status: ${data.status==="PAID"?"PAGO":"PRÉVIA - A RECEBER"}`,11,true);line(`Identificador: ${data.id}`,8);y-=10;
  const labels:Record<string,string>={SERVICE:"Serviço",PRODUCT:"Produto",SUBSCRIPTION:"Assinatura",BONUS:"Bonificação",DEDUCTION:"Desconto"};
  for(const l of data.lines){if(y<130)next();line(`${day(l.occurredAt)} | ${labels[l.kind]??l.kind} | ${l.description}`,10,true);line(`Base: ${money(l.baseAmount)}   Percentual: ${Number(l.percent)}%   Valor: ${money(l.amount)}`,10);y-=5;}
  y-=12;if(y<190)next();line(`Total bruto: ${money(data.gross)}`,12,true);line(`Descontos: ${money(data.deductions)}`,12);line(`Total líquido: ${money(data.net)}`,15,true);
  if(data.paidAt){line(`Pagamento: ${day(data.paidAt)} | ${({PIX:"Pix",CASH:"Dinheiro",TRANSFER:"Transferência",CREDIT:"Crédito",DEBIT:"Débito",OTHER:"Outra"} as Record<string,string>)[data.paymentMethod??""]??data.paymentMethod}`);line(`Registrado por: ${data.createdBy??"Gestão"}`);}
  line(data.status==="PAID"?"Quitação administrativa registrada. Este documento não é comprovante de transferência bancária.":"Prévia sujeita a alterações até a confirmação da quitação.",8);
  pdf.getPages().forEach((p,i)=>p.drawText(`${i+1} / ${pdf.getPageCount()}  |  ${clean(data.id)}`,{x:42,y:30,size:8,font:regular}));
  return pdf.save();
}
