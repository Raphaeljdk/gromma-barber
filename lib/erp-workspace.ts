import type { CashSession, CommandPayment, BookedServices } from "./checkout";
import type { ProfessionalProfile } from "./professional-profile";
import type { ProductCommissionCategory } from "./product-commission-rules";
import type { Prisma } from "@prisma/client";
import { STAFF_PERMISSION_KEYS, STAFF_PERMISSION_ROLES, type StaffPermissions, type StaffPermissionRole, type StaffPermission } from "./role-permissions";

export type ClubPlanConfig = {
  id: string;
  name: string;
  monthlyAmount: number;
  visitsPerMonth: number | null;
  benefits: string;
  active: boolean;
  createdAt: string;
};

export type ClubMemberConfig = {
  id: string;
  customerId: string;
  planId: string;
  unitId?: string | null;
  status: "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELED";
  startedAt: string;
  nextBillingAt: string;
  billingDay?: number;
  brokenAt?: string;
  canceledAt?: string;
  pendingPlanId?: string;
  pendingPlanRequestedAt?: string;
  cancelRequestedAt?: string;
  cancelEffectiveAt?: string;
};

export type ClubEvent = {
  id: string; memberId: string; customerId: string; at: string;
  kind: "CHANGE" | "CANCEL" | "BILLING_DAY" | "BREAK"; previousPlanId: string; previousPlanName: string;
  previousAmount: number | null; newPlanId?: string; newPlanName?: string; newAmount?: number;
  movement?: "UPGRADE" | "DOWNGRADE" | "CHANGE";
  effectiveAt?: string;
  status?: "SCHEDULED" | "APPLIED" | "SUPERSEDED";
  actor?: string;
  reason?: string;
};
export type ClubSale = {
  id: string; memberId: string; customerId: string; planId: string; planName: string;
  amount: number; at: string; sellerId: string | null; sellerName: string;
  source: "STAFF" | "CUSTOMER";
};
export type ClubCharge = {
  entryId: string; memberId: string; customerId: string; planId: string; planName: string;
  startedAt: string; periodStart: string; periodEnd: string;
};
export type ClubRefund = {
  id: string; entryId: string; requestedAt: string; reason: string;
  status: "REQUESTED" | "COMPLETED"; completedAt?: string; expenseId?: string;
};
export type ClubInvite = {
  hash: string; customerId: string; expiresAt: string; usedAt?: string;
};

export type AudienceRule = "ALL" | "INACTIVE_30" | "INACTIVE_60" | "INACTIVE_90" | "BIRTHDAY" | "CLUB";

export type CustomerGroupConfig = {
  id: string;
  name: string;
  rule: AudienceRule;
  active: boolean;
  createdAt: string;
};

export type CampaignConfig = {
  id: string;
  kind?: "MESSAGE" | "PROMOTION";
  title: string;
  audience: AudienceRule;
  groupId?: string;
  message: string;
  active: boolean;
  createdAt: string;
};

export type CouponConfig = {
  id: string;
  code: string;
  kind: "PERCENT" | "FIXED";
  value: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
};

export type DocumentConfig = {
  id: string;
  category: "CUSTOMER" | "PROFESSIONAL" | "UNIT" | "GENERAL";
  title: string;
  url: string;
  reference: string | null;
  createdAt: string;
};

export type ReviewConfig = {
  id: string;
  customerName: string;
  professionalName: string;
  score: number;
  comment: string;
  createdAt: string;
};

export type TrainingConfig = {
  id: string;
  kind: "VIDEO" | "COURSE" | "MEDIA";
  title: string;
  url: string;
  description: string;
  active: boolean;
  createdAt: string;
};

export type CommissionRuleConfig = {
  userId: string;
  percent: number;
};

export type DeductionConfig = {
  id: string;
  userId: string;
  description: string;
  amount: number;
  createdAt: string;
};

export type WaitlistConfig = {
  id: string;
  customerName: string;
  phone: string;
  serviceId: string | null;
  requestedDate: string;
  barberId?: string | null;
  unitId?: string | null;
  notes: string;
  createdAt: string;
};

export type AgendaBlock = {
  id: string;
  /** "*" means a shop-wide block for this branch, instead of a single professional. */
  barberId: string;
  unitId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  /** OPEN displays an informative opening period; CLOSED prevents appointments. */
  status?: "OPEN" | "CLOSED";
};

export type UnitOperationsPolicy = {
  legalDocument: string;
  paymentEmail: string;
  paymentPhone: string;
  pixKey: string;
  pixType: "CNPJ" | "EMAIL" | "PHONE" | "EVP" | "";
  paymentMethods: ("PIX"|"CASH"|"DEBIT"|"CREDIT"|"TRANSFER")[];
  debitFeePercent: number;
  creditFeePercent: number;
  settlementDays: number;
  potPercent: number | null;
  cancellationMinutes: number;
  noShowBlockHours: number;
  coverImageUrl: string;
  welcomeText: string;
};

export type BrandingSettings = {
  heroTitle: string;
  heroDescription: string;
  coverImageUrl: string;
  logoUrl: string;
  accentColor: string;
  clubTitle: string;
  clubDescription: string;
};

export type OperationalSettings = {
  openHour: number;
  closeHour: number;
  slotMinutes: number;
  rotationEnabled: boolean;
  autoConfirm: boolean;
  defaultCommissionPercent: number;
  whatsappNumber: string;
  invoiceProvider: string;
  amenities: string;
};

export type ErpWorkspace = {
  branding: BrandingSettings;
  unitPolicies: Record<string,UnitOperationsPolicy>;
  featuredProfessionalIds: string[];
  rolePermissions: StaffPermissions;
  professionalProfiles: Record<string, ProfessionalProfile>;
  clubEvents: ClubEvent[];
  clubSales: ClubSale[];
  clubCharges: ClubCharge[];
  clubRefunds: ClubRefund[];
  clubInvites: ClubInvite[];
  clubPlans: ClubPlanConfig[];
  clubMembers: ClubMemberConfig[];
  campaigns: CampaignConfig[];
  customerGroups: CustomerGroupConfig[];
  coupons: CouponConfig[];
  documents: DocumentConfig[];
  reviews: ReviewConfig[];
  training: TrainingConfig[];
  commissionRules: CommissionRuleConfig[];
  serviceCommissionOverrides: Record<string, number>;
  professionalExtraRates: Record<string, { subscriptionPercent: number; productPercent: number }>;
  subscriptionCommissionTiers: Record<string, { min: number; max: number | null; percent: number }[]>;
  /** Regras de rateio do pote. Nunca armazena nem permite editar o valor arrecadado. */
  subscriptionPot: { percent: number; shares: Record<string, number> };
  deductions: DeductionConfig[];
  waitlist: WaitlistConfig[];
  agendaBlocks: AgendaBlock[];
  cashSessions: CashSession[];
  commandPayments: CommandPayment[];
  bookedServices: BookedServices[];
  productLines: { itemId: string; productId: string }[];
  productCategoryAssignments: Record<string,ProductCommissionCategory>;
  productSellerAssignments: { itemId: string; userId: string; recordedAt: string }[];
  serviceLines: { itemId: string; serviceId: string }[];
  settings: OperationalSettings;
};

export const DEFAULT_WORKSPACE: ErpWorkspace = {
  branding: { logoUrl: "", accentColor: "#c69a49", clubTitle: "Clube de assinaturas", clubDescription: "",
    heroTitle: "", heroDescription: "", coverImageUrl: "" },
  unitPolicies: {},
  featuredProfessionalIds: [],
  rolePermissions: {},
  professionalProfiles: {},
  clubEvents: [],
  clubSales: [],
  clubCharges: [],
  clubRefunds: [],
  clubInvites: [],
  clubPlans: [],
  clubMembers: [],
  campaigns: [],
  customerGroups: [],
  coupons: [],
  documents: [],
  reviews: [],
  training: [],
  commissionRules: [],
  serviceCommissionOverrides: {},
  professionalExtraRates: {},
  subscriptionCommissionTiers: {},
  subscriptionPot: { percent: 0, shares: {} },
  deductions: [],
  waitlist: [],
  agendaBlocks: [],
  cashSessions: [],
  commandPayments: [],
  bookedServices: [],
  productLines: [],
  productCategoryAssignments: {},
  productSellerAssignments: [],
  serviceLines: [],
  settings: {
    openHour: 8,
    closeHour: 20,
    slotMinutes: 30,
    rotationEnabled: false,
    autoConfirm: false,
    defaultCommissionPercent: 40,
    whatsappNumber: "",
    invoiceProvider: "",
    amenities: "",
  },
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function readWorkspace(value: Prisma.JsonValue | null | undefined): ErpWorkspace {
  const root = record(value);
  const operations = record(root.operations);
  const settings = record(operations.settings);

  const rawPermissions = record(operations.rolePermissions);
  const rolePermissions = Object.fromEntries(STAFF_PERMISSION_ROLES.filter(role => Array.isArray(rawPermissions[role])).map(role => [role, (rawPermissions[role] as unknown[]).filter((permission): permission is StaffPermission => typeof permission === "string" && (STAFF_PERMISSION_KEYS as readonly string[]).includes(permission))])) as Partial<Record<StaffPermissionRole, StaffPermission[]>>;
  return {
    rolePermissions,
    unitPolicies: Object.fromEntries(Object.entries(record(operations.unitPolicies))
      .filter(([id])=>id.length <= 100)
      .map(([id,raw])=>{
        const p=record(raw);
        const percent=(v:unknown,max:number,otherwise:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max?v:otherwise;
        const methods=["PIX","CASH","DEBIT","CREDIT","TRANSFER"] as const;
        const list=Array.isArray(p.paymentMethods)?p.paymentMethods.filter((x): x is typeof methods[number] =>
          typeof x==="string"&&(methods as readonly string[]).includes(x)):[];
        const pot=p.potPercent;
        return [id,{
          legalDocument:typeof p.legalDocument==="string"?p.legalDocument.slice(0,14):"",
          paymentEmail:typeof p.paymentEmail==="string"?p.paymentEmail.slice(0,180):"",
          paymentPhone:typeof p.paymentPhone==="string"?p.paymentPhone.slice(0,24):"",
          pixKey:typeof p.pixKey==="string"?p.pixKey.slice(0,150):"",
          pixType:["CNPJ","EMAIL","PHONE","EVP"].includes(String(p.pixType))?p.pixType:"",
          paymentMethods:list,
          debitFeePercent:percent(p.debitFeePercent,100,0),
          creditFeePercent:percent(p.creditFeePercent,100,0),
          settlementDays:percent(p.settlementDays,90,0),
          potPercent:pot===null?null:percent(pot,100,-1)===-1?null:pot as number,
          cancellationMinutes:percent(p.cancellationMinutes,10080,0),
          noShowBlockHours:percent(p.noShowBlockHours,720,0),
          coverImageUrl:typeof p.coverImageUrl==="string"&&/^https:\/\//i.test(p.coverImageUrl)?p.coverImageUrl.slice(0,700):"",
          welcomeText:typeof p.welcomeText==="string"?p.welcomeText.slice(0,280):"",
        }];
      })) as Record<string,UnitOperationsPolicy>,
    featuredProfessionalIds: array<unknown>(operations.featuredProfessionalIds).filter(
      (id):id is string => typeof id==="string"&&id.length<=100).slice(0,50),
    professionalProfiles: Object.fromEntries(Object.entries(record(operations.professionalProfiles))
      .map(([id, raw])=>[id, record(raw) as ProfessionalProfile])) as Record<string, ProfessionalProfile>,
    clubEvents: array<ClubEvent>(operations.clubEvents),
    clubSales: array<ClubSale>(operations.clubSales),
    clubCharges: array<ClubCharge>(operations.clubCharges),
    clubRefunds: array<ClubRefund>(operations.clubRefunds),
    clubInvites: array<ClubInvite>(operations.clubInvites),
    clubPlans: array<ClubPlanConfig>(operations.clubPlans),
    clubMembers: array<ClubMemberConfig>(operations.clubMembers),
    campaigns: array<CampaignConfig>(operations.campaigns),
    customerGroups: array<CustomerGroupConfig>(operations.customerGroups),
    coupons: array<CouponConfig>(operations.coupons),
    documents: array<DocumentConfig>(operations.documents),
    reviews: array<ReviewConfig>(operations.reviews),
    training: array<TrainingConfig>(operations.training),
    commissionRules: array<CommissionRuleConfig>(operations.commissionRules),
    professionalExtraRates: Object.fromEntries(Object.entries(record(operations.professionalExtraRates)).map(([id, raw]) => { const item = record(raw); const sub = Number(item.subscriptionPercent); const prod = Number(item.productPercent); return [id, { subscriptionPercent: Number.isFinite(sub) && sub >= 0 && sub <= 100 ? sub : 0, productPercent: Number.isFinite(prod) && prod >= 0 && prod <= 100 ? prod : 30 }]; })) as Record<string, { subscriptionPercent: number; productPercent: number }>,
    subscriptionCommissionTiers: Object.fromEntries(Object.entries(record(operations.subscriptionCommissionTiers)).map(([userId, raw]) => [userId,
      (Array.isArray(raw) ? raw : []).filter((t): t is { min: number; max: number | null; percent: number } =>
        !!t && typeof t === "object" && typeof t.min === "number" && t.min >= 0 && (t.max === null || (typeof t.max === "number" && t.max > t.min)) &&
        typeof t.percent === "number" && t.percent >= 0 && t.percent <= 100)
    ])) as Record<string, { min: number; max: number | null; percent: number }[]>,
    subscriptionPot: (() => {
      const source = record(operations.subscriptionPot);
      const rawPercent = Number(source.percent);
      const percent = Number.isFinite(rawPercent) && rawPercent >= 0 && rawPercent <= 100 ? rawPercent : 0;
      const shares = Object.fromEntries(Object.entries(record(source.shares))
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100)
        .map(([id, v]) => [id, Number(v)])) as Record<string, number>;
      return { percent, shares };
    })(),
    serviceCommissionOverrides: Object.fromEntries(Object.entries(record(operations.serviceCommissionOverrides)).filter(([, amount]) => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 100)) as Record<string, number>,
    deductions: array<DeductionConfig>(operations.deductions),
    waitlist: array<WaitlistConfig>(operations.waitlist),
    agendaBlocks: array<AgendaBlock>(operations.agendaBlocks),
    cashSessions: array<CashSession>(operations.cashSessions),
    commandPayments: array<CommandPayment>(operations.commandPayments),
    bookedServices: array<BookedServices>(operations.bookedServices),
    productLines: array<{ itemId: string; productId: string }>(operations.productLines),
    productCategoryAssignments: Object.fromEntries(Object.entries(record(operations.productCategoryAssignments))
      .filter(([,value])=>value==="COSMETICS"||value==="DRINKS")) as Record<string,ProductCommissionCategory>,
    productSellerAssignments: array<{ itemId: string; userId: string; recordedAt: string }>(operations.productSellerAssignments),
    serviceLines: array<{ itemId: string; serviceId: string }>(operations.serviceLines),
    branding: (() => {
      const source = record(operations.branding);
      const logo = typeof source.logoUrl === "string" && /^https:\/\//i.test(source.logoUrl) ? source.logoUrl.slice(0,700) : "";
      const accent = typeof source.accentColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(source.accentColor)
        ? source.accentColor : DEFAULT_WORKSPACE.branding.accentColor;
      return {
        logoUrl: logo, accentColor: accent,
        heroTitle: typeof source.heroTitle==="string"?source.heroTitle.slice(0,110):"",
        heroDescription: typeof source.heroDescription==="string"?source.heroDescription.slice(0,600):"",
        coverImageUrl: typeof source.coverImageUrl==="string" && /^https:\/\//i.test(source.coverImageUrl)
          ? source.coverImageUrl.slice(0,700) : "",
        clubTitle: typeof source.clubTitle === "string" ? source.clubTitle.slice(0,90) : DEFAULT_WORKSPACE.branding.clubTitle,
        clubDescription: typeof source.clubDescription === "string" ? source.clubDescription.slice(0,500) : "",
      };
    })(),
    settings: {
      openHour: Number(settings.openHour ?? DEFAULT_WORKSPACE.settings.openHour),
      closeHour: Number(settings.closeHour ?? DEFAULT_WORKSPACE.settings.closeHour),
      slotMinutes: Number(settings.slotMinutes ?? DEFAULT_WORKSPACE.settings.slotMinutes),
      rotationEnabled: Boolean(settings.rotationEnabled ?? DEFAULT_WORKSPACE.settings.rotationEnabled),
      autoConfirm: Boolean(settings.autoConfirm ?? DEFAULT_WORKSPACE.settings.autoConfirm),
      defaultCommissionPercent: Number(
        settings.defaultCommissionPercent ?? DEFAULT_WORKSPACE.settings.defaultCommissionPercent,
      ),
      whatsappNumber: String(settings.whatsappNumber ?? ""),
      invoiceProvider: String(settings.invoiceProvider ?? ""),
      amenities: String(settings.amenities ?? ""),
    },
  };
}

export function writeWorkspace(
  current: Prisma.JsonValue | null | undefined,
  workspace: ErpWorkspace,
): Prisma.InputJsonValue {
  const root = record(current);

  return {
    ...root,
    operations: workspace,
  } as Prisma.InputJsonValue;
}

export function workspaceId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
