/** Categorias comerciais de produto. Serviços são comissionados no módulo
 * de serviços e não entram como categoria de produtos. */
export const PRODUCT_COMMISSION_CATEGORIES = [
  { id: "COSMETICS", label: "Cosméticos" },
  { id: "DRINKS", label: "Bebidas" },
] as const;
export type ProductCommissionCategory = typeof PRODUCT_COMMISSION_CATEGORIES[number]["id"];
export type ProductCommissionMode = "FIXED" | "SCALED";
export type ProductCommissionRule = {
  mode: ProductCommissionMode;
  fixedPercent: number;
  tiers: { min: number; percent: number }[];
};
export function isProductCommissionCategory(value: string): value is ProductCommissionCategory {
  return PRODUCT_COMMISSION_CATEGORIES.some(c => c.id===value);
}
export function categoryName(value: string | undefined): string {
  return PRODUCT_COMMISSION_CATEGORIES.find(c=>c.id===value)?.label ?? "Sem categoria";
}
/** Para escalonamento, a faixa considera o total de vendas de produto daquela
 * categoria pelo profissional no período, não cada item isoladamente. */
export function resolveProductCommissionRate(
  rule: ProductCommissionRule | undefined, categorySales: number, legacyPercent: number,
): number {
  if(!rule)return legacyPercent;
  if(rule.mode==="FIXED")return rule.fixedPercent;
  const tier=[...rule.tiers].filter(t=>t.min<=categorySales).sort((a,b)=>b.min-a.min)[0];
  return tier?.percent ?? 0;
}
