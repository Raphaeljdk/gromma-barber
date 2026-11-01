import type { ProductCommissionCategory, ProductCommissionRule } from "./product-commission-rules";

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
  /** Regras novas de cosméticos e bebidas. Categorias não configuradas preservam legado. */
  productCommissionRules?: Partial<Record<ProductCommissionCategory,ProductCommissionRule>>;
  /** Comissão adicional pela venda inicial de planos, diferente do pote de atendimentos. */
  salesSubscriptionCommissionEnabled?: boolean;
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

/** Verifica horário individual antes de permitir novos agendamentos.
 * Ao não existir escala individual cadastrada, preserva o horário global legado.
 */
export function professionalCanServeAt(profile: ProfessionalProfile|undefined,start:Date,end:Date,serviceIds:string[]=[]): boolean {
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)return false;
  if(profile?.enabledServices && serviceIds.some(id=>!profile.enabledServices!.includes(id)))return false;
  const formatter = new Intl.DateTimeFormat("en-US",{timeZone:"America/Sao_Paulo",
    weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",
    hourCycle:"h23"});
  const parts = (date:Date) => {
    const pieces=Object.fromEntries(formatter.formatToParts(date).map(part=>[part.type,part.value]));
    const day=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(pieces.weekday);
    return {day,date:pieces.year+"-"+pieces.month+"-"+pieces.day,
      minute:Number(pieces.hour)*60+Number(pieces.minute)};
  };
  const from=parts(start),to=parts(end);
  if(from.day<0||to.day!==from.day||from.date!==to.date)return false;
  if(profile?.leaves?.some(item=>item.from<=from.date&&item.to>=from.date))return false;
  if(profile?.workHours){
    const shift=profile.workHours.find(item=>item.day===from.day);
    if(!shift || from.minute<minutes(shift.start)||to.minute>minutes(shift.end))return false;
  }
  if(profile?.breaks?.some(item=>item.day===from.day&&
      from.minute<minutes(item.end)&&to.minute>minutes(item.start)))return false;
  return true;
}

/** Compatibilidade: quem já tinha uma regra de venda configurada continua
 * habilitado até a administração escolher explicitamente a opção na ficha.
 * O pote por produtividade não depende desta configuração.
 */
export function subscriptionSalesEnabled(
  profile: ProfessionalProfile | undefined,
  existingRate = 0,
  configuredTiers: {min:number;max:number|null;percent:number}[] = [],
): boolean {
  if(typeof profile?.salesSubscriptionCommissionEnabled==="boolean")
    return profile.salesSubscriptionCommissionEnabled;
  return existingRate > 0 || configuredTiers.some(tier=>tier.percent>0);
}
