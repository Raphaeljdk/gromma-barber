/** Existing CommandItem supports SERVICE and PRODUCT; drink purchases are
 *  identified from product descriptions until products acquire explicit categories.
 *  Keep predicates and the Prisma search terms aligned.
 */
export type PurchaseCategory = "SERVICE" | "PRODUCT" | "BEVERAGE";
export const PURCHASE_CATEGORIES: readonly PurchaseCategory[] = ["SERVICE", "PRODUCT", "BEVERAGE"];
export const BEVERAGE_TERMS = [
  "água", "agua ", "refrigerante", "cerveja", "heineken", "brahma", "skol ",
  "spaten", "amstel", "itaipava", "budweiser", "eisenbahn", "guaraná",
  "guarana", "coca-cola", "coca cola", "pepsi", "sprite", "fanta ",
  "suco ", "café", "cafe ", "chá ", "cha ", "energético", "energetico",
  "monster", "red bull", "whisky", "whiskey", "vodka", "drink ",
  "bebida ", "tônica", "tonica", "isotônico", "isotonico", "soda ",
] as const;

export function purchaseCategory(kind: string, description: string): PurchaseCategory {
  if (kind === "SERVICE") return "SERVICE";
  const normalized = description.normalize("NFC").toLocaleLowerCase("pt-BR");
  return BEVERAGE_TERMS.some(term => normalized.includes(term)) ? "BEVERAGE" : "PRODUCT";
}

export function purchaseCategoryLabel(category: PurchaseCategory): string {
  return category === "SERVICE" ? "Serviço" : category === "BEVERAGE" ? "Bebida" : "Produto";
}
