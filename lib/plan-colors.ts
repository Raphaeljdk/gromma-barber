/** Cores estáveis por plano, separadas das cores de status do atendimento. */
export function planColor(name:string|null|undefined):string{
 if(!name)return "#8793a3";
 const clean=name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(/\bpremium\b|\bpremio\b/.test(clean))return "#945de8";
 if(/\bstart\b/.test(clean))return "#329cfa";
 if(/\bbasic\b|\bbasico\b/.test(clean))return "#21b580";
 // Planos adicionais têm cores persistentes por nome, mesmo após atualizar a tela.
 const palette=["#e4a048","#d96aa2","#20aaa6","#ca865f","#9b8ee4","#56a6cf"];
 let hash=0;
 for(const char of clean)hash=(hash*31+char.charCodeAt(0))>>>0;
 return palette[hash%palette.length];
}
export function planLabel(name:string|null|undefined):string{return name?.trim()||"Sem plano";}
