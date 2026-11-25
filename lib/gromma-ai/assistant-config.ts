export const assistantPermissions = [
  "book", "reschedule", "cancel", "prices", "plans", "promotions", "handoff",
] as const;
type Permission = typeof assistantPermissions[number];
export type AssistantConfig = {
  name: string;
  tone: "professional" | "friendly" | "casual" | "direct";
  greeting: string;
  instructions: string;
  permissions: Record<Permission, boolean>;
};
export const defaultAssistantConfig: AssistantConfig = {
  name: "Gromma",
  tone: "friendly",
  greeting: "Olá! Sou a assistente virtual da barbearia. Como posso ajudar?",
  instructions: "",
  permissions: { book: false, reschedule: false, cancel: false, prices: true, plans: false, promotions: false, handoff: true },
};
export function parseAssistantConfig(input: unknown): AssistantConfig {
  if (!input || typeof input !== "object") throw new Error("INVALID_ASSISTANT_CONFIG");
  const x = input as Record<string, unknown>;
  function field(key: string, limit: number, required = false): string {
    const value = x[key];
    if (typeof value !== "string" || value.length > limit || (required && !value.trim())) throw new Error("INVALID_" + key);
    return value.trim();
  }
  const tone = x.tone;
  if (tone !== "professional" && tone !== "friendly" && tone !== "casual" && tone !== "direct") throw new Error("INVALID_TONE");
  if (!x.permissions || typeof x.permissions !== "object") throw new Error("INVALID_PERMISSIONS");
  const permissions = {} as Record<Permission, boolean>;
  for (const key of assistantPermissions) {
    const value = (x.permissions as Record<string, unknown>)[key];
    if (typeof value !== "boolean") throw new Error("INVALID_PERMISSION");
    permissions[key] = value;
  }
  return { name: field("name", 80, true), tone, greeting: field("greeting", 1000, true), instructions: field("instructions", 6000), permissions };
}
// Settings are preferences only. Backend authorization, verified tenant context,
// availability, customer identity and explicit confirmation must still be enforced.
