/** Cadastro de colaboradores por unidade. Mantemos campos opcionais para preservar
 * empregados existentes e para que a implantação não exija migrações destrutivas.
 * Somente o dono da empresa pode consultar/alterar dados pessoais desta ficha.
 */
export const PROFESSIONAL_PERMISSION_OPTIONS = [
  { id: "CREATE_APPOINTMENT", label: "Criar agendamentos" },
  { id: "EDIT_APPOINTMENT", label: "Editar agendamentos" },
  { id: "ADD_PRODUCT", label: "Adicionar produtos à comanda" },
  { id: "ADD_SERVICE", label: "Adicionar serviços à comanda" },
  { id: "BLOCK_SCHEDULE", label: "Criar bloqueios de agenda" },
  { id: "MANAGE_LEAVE", label: "Gerenciar folgas" },
  { id: "EDIT_NOTES", label: "Editar observações dos atendimentos" },
] as const;
export type ProfessionalPermission = typeof PROFESSIONAL_PERMISSION_OPTIONS[number]["id"];
export const PROFESSIONAL_PERMISSION_IDS = PROFESSIONAL_PERMISSION_OPTIONS.map(x=>x.id) as ProfessionalPermission[];

export const WEEK_DAYS = [
  { id: 0, label: "Domingo" }, { id: 1, label: "Segunda" },
  { id: 2, label: "Terça" }, { id: 3, label: "Quarta" },
  { id: 4, label: "Quinta" }, { id: 5, label: "Sexta" },
  { id: 6, label: "Sábado" },
] as const;
export const PRODUCT_CATEGORIES = [
  "Pomadas e modeladores", "Shampoo e condicionador",
  "Barba e cuidados", "Cosméticos", "Outros produtos",
] as const;

export type ProfessionalContact = {
  id: string; name: string; relation: string; phone: string; email?: string;
};
export type ProfessionalContract = {
  id: string; label: string; url: string; validFrom?: string; notes?: string;
};
export type ProfessionalShift = { day: number; start: string; end: string };
export type ProfessionalBreak = { id: string; day: number; start: string; end: string };
export type ProfessionalLeave = { id: string; from: string; to: string; reason: string };
export type ProfessionalProductTier = {
  id: string; category: string; minimum: number; percent: number;
};
export type ProfessionalProfile = {
  nickname?: string;
  cpf?: string;
  cnpj?: string;
  birthDate?: string;
  whatsapp?: string;
  cadenceDays?: number;
  accessToOtherUnits?: boolean;
  zipCode?: string; street?: string; district?: string; city?: string;
  state?: string; streetNumber?: string; complement?: string;
  photoUrl?: string;
  contacts?: ProfessionalContact[];
  contracts?: ProfessionalContract[];
  /** Quando não configuradas, preservamos o acesso tradicional do perfil. */
  permissions?: ProfessionalPermission[];
  services?: Record<string, number>;
  /** Serviço autorizado a este profissional; undefined preserva catálogo completo. */
  enabledServices?: string[];
  workHours?: ProfessionalShift[];
  breaks?: ProfessionalBreak[];
  leaves?: ProfessionalLeave[];
  productTiers?: ProfessionalProductTier[];
  potBonusPercent?: number;
  potDifferentPercent?: number;
};

export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value+"T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===value;
}
export function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
export function minutes(value: string): number {
  const [h,m]=value.split(":").map(Number);
  return h*60+m;
}
export function validInterval(start: string,end: string): boolean {
  return isTime(start)&&isTime(end)&&minutes(start)<minutes(end);
}
export function profileFor(
  profiles: Record<string,ProfessionalProfile>,userId: string
): ProfessionalProfile {
  return profiles[userId] ?? {};
}
export function hasProfessionalPermission(profile: ProfessionalProfile|undefined, permission: ProfessionalPermission): boolean {
  return !profile?.permissions || profile.permissions.includes(permission);
}
