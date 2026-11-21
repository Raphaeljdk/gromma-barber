/** Identidade visual do plano; o status operacional tem seu próprio indicador. */
const normalizePlan=(text:string)=>text.trim().normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"").toLowerCase();
function defaultPlanColor(clean:string):string|null{
 if(/\bpremium\b|\bpremio\b/.test(clean))return "#945de8";
 if(/\bstart\b/.test(clean))return "#329cfa";
 if(/\bbasic\b|\bbasico\b/.test(clean))return "#21b580";
 return null;
}
/** Paleta complementar sem repetir as cores reservadas para Premium, Start e Basic. */
const EXTRA_COLORS=[
 "#d96aa2","#20aaa6","#ca865f","#9b8ee4","#56a6cf",
 "#d68361","#8b9ccc","#b59a53","#cc75a3","#54afa3",
 "#7e80c3","#c67380",
];
/** O catálogo ativo fixa cores distintas mesmo quando existem seis ou mais planos. */
export function planColor(name:string|null|undefined, availableNames:readonly string[]=[]):string{
 if(!name?.trim())return "#8793a3";
 const clean=normalizePlan(name);
 const fixed=defaultPlanColor(clean);
 if(fixed)return fixed;
 const others=[...new Set(availableNames.map(normalizePlan).filter(n=>n&&!defaultPlanColor(n)))].sort();
 const index=others.indexOf(clean);
 if(index>=0)return EXTRA_COLORS[index%EXTRA_COLORS.length];
 // Fallback determinístico se o plano não estiver no catálogo de planos ativos.
 let hash=0;
 for(const char of clean)hash=(hash*31+char.charCodeAt(0))>>>0;
 return EXTRA_COLORS[hash%EXTRA_COLORS.length];
}
export function planLabel(name:string|null|undefined):string{return name?.trim()||"Sem plano";}
