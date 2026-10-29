import type { CashSession, CommandPayment, BookedServices } from "./checkout";
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
  status: "ACTIVE" | "PAST_DUE" | "PAUSED" | "CANCELED";
  startedAt: string;
  nextBillingAt: string;
  canceledAt?: string;
  pendingPlanId?: string;
  pendingPlanRequestedAt?: string;
  cancelRequestedAt?: string;
  cancelEffectiveAt?: string;
};

export type ClubEvent = {
  id: string; memberId: string; customerId: string; at: string;
  kind: "CHANGE" | "CANCEL"; previousPlanId: string; previousPlanName: string;
  previousAmount: number | null; newPlanId?: string; newPlanName?: string; newAmount?: number;
  movement?: "UPGRADE" | "DOWNGRADE" | "CHANGE";
  effectiveAt?: string;
  status?: "SCHEDULED" | "APPLIED";
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
  rolePermissions: StaffPermissions;
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
  deductions: DeductionConfig[];
  waitlist: WaitlistConfig[];
  agendaBlocks: AgendaBlock[];
  cashSessions: CashSession[];
  commandPayments: CommandPayment[];
  bookedServices: BookedServices[];
  productLines: { itemId: string; productId: string }[];
  serviceLines: { itemId: string; serviceId: string }[];
  settings: OperationalSettings;
};

export const DEFAULT_WORKSPACE: ErpWorkspace = {
  rolePermissions: {},
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
  deductions: [],
  waitlist: [],
  agendaBlocks: [],
  cashSessions: [],
  commandPayments: [],
  bookedServices: [],
  productLines: [],
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
    serviceCommissionOverrides: Object.fromEntries(Object.entries(record(operations.serviceCommissionOverrides)).filter(([, amount]) => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && amount <= 100)) as Record<string, number>,
    deductions: array<DeductionConfig>(operations.deductions),
    waitlist: array<WaitlistConfig>(operations.waitlist),
    agendaBlocks: array<AgendaBlock>(operations.agendaBlocks),
    cashSessions: array<CashSession>(operations.cashSessions),
    commandPayments: array<CommandPayment>(operations.commandPayments),
    bookedServices: array<BookedServices>(operations.bookedServices),
    productLines: array<{ itemId: string; productId: string }>(operations.productLines),
    serviceLines: array<{ itemId: string; serviceId: string }>(operations.serviceLines),
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
