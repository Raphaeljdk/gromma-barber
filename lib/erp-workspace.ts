import type { Prisma } from "@prisma/client";

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
};

export type CampaignConfig = {
  id: string;
  kind?: "MESSAGE" | "PROMOTION";
  title: string;
  audience: "ALL" | "INACTIVE_30" | "INACTIVE_60" | "INACTIVE_90" | "BIRTHDAY";
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
  notes: string;
  createdAt: string;
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
};

export type ErpWorkspace = {
  clubPlans: ClubPlanConfig[];
  clubMembers: ClubMemberConfig[];
  campaigns: CampaignConfig[];
  coupons: CouponConfig[];
  documents: DocumentConfig[];
  reviews: ReviewConfig[];
  training: TrainingConfig[];
  commissionRules: CommissionRuleConfig[];
  deductions: DeductionConfig[];
  waitlist: WaitlistConfig[];
  settings: OperationalSettings;
};

export const DEFAULT_WORKSPACE: ErpWorkspace = {
  clubPlans: [],
  clubMembers: [],
  campaigns: [],
  coupons: [],
  documents: [],
  reviews: [],
  training: [],
  commissionRules: [],
  deductions: [],
  waitlist: [],
  settings: {
    openHour: 8,
    closeHour: 20,
    slotMinutes: 30,
    rotationEnabled: false,
    autoConfirm: false,
    defaultCommissionPercent: 40,
    whatsappNumber: "",
    invoiceProvider: "",
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

  return {
    clubPlans: array<ClubPlanConfig>(operations.clubPlans),
    clubMembers: array<ClubMemberConfig>(operations.clubMembers),
    campaigns: array<CampaignConfig>(operations.campaigns),
    coupons: array<CouponConfig>(operations.coupons),
    documents: array<DocumentConfig>(operations.documents),
    reviews: array<ReviewConfig>(operations.reviews),
    training: array<TrainingConfig>(operations.training),
    commissionRules: array<CommissionRuleConfig>(operations.commissionRules),
    deductions: array<DeductionConfig>(operations.deductions),
    waitlist: array<WaitlistConfig>(operations.waitlist),
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
