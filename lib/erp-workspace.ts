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
  /** Descontos do plano; definidos pelo proprietário. Não alteram cobranças já emitidas. */
  subscriberDiscountPercent?: number;
  subscriberDiscountAppliesTo?: "SERVICES"|"PRODUCTS"|"BOTH";
  partnerName?: string;
  partnerDiscountPercent?: number;
  partners?: {id:string;name:string;discountPercent:number}[];
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
export type ClubPriceAdjustment = { id: string; planId: string; newAmount: number; effectiveDate: string; createdAt: string; status: "SCHEDULED" | "APPLIED" | "CANCELED"; appliedAt?: string };
export type ClubWithdrawalRequest = { id: string; amount: number; reason: string; requestedAt: string; requestedBy: string; status: "REQUESTED" | "CANCELED"; };

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
  targetType?: "SERVICE" | "PRODUCT" | "BIRTHDAY";
  targetIds?: string[];
  discountKind?: "PERCENT" | "FIXED";
  discountValue?: number;
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
  source?: "STAFF" | "CUSTOMER_LINK";
  customerId?: string;
  appointmentId?: string;
  verifiedAt?: string;
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
  /** Dados administrativos da filial. */
  postalCode: string;
  complement: string;
  bankCountry: "BR"|"INT";
  bankCode: string;
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  bankSwift: string;
  verifiedBankAccountId: string;
  paymentConfigurations: Record<string,{feePercent:number;settlementDays:number;autoMarkPaid:boolean}>;
  paymentEmail: string;
  paymentPhone: string;
  pixKey: string;
  pixType: "CNPJ" | "CPF" | "EMAIL" | "PHONE" | "EVP" | "";
  paymentMethods: ("PIX"|"CASH"|"DEBIT"|"CREDIT"|"TRANSFER")[];
  customPaymentMethods: string[];
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
  carouselImages: string[];
  carouselCaptions: {title:string;subtitle:string}[];
  secondaryTitle: string;
  secondaryDescription: string;
  heroTitle: string;
  heroDescription: string;
  coverImageUrl: string;
  logoUrl: string;
  accentColor: string;
  secondaryColor: string;
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

export type ServiceCatalogMetadata={
  ticketValue:number|null;
  repurchaseDays:number|null;
  category:string;
  startingFrom:boolean;
  hidden:boolean;
  walkIn:boolean;
};
/** Keep tenant timezone validation safe in isolated workspace replays as well as runtime. */
function isValidBusinessTimeZone(value:string):boolean{
  if(!value||value.length>80||!/^[A-Za-z0-9_+-]+$/.test(value.replaceAll("/","_")))return false;
  try {new Intl.DateTimeFormat("en",{timeZone:value}).format(new Date());return true;}
  catch {return false;}
}

export type FinancialCategoryConfig={
  id:string;name:string;subcategory:string;
  type:"RECEIVABLE"|"PAYABLE"|"BOTH";
  classification:"REVENUE_FIXED"|"REVENUE_VARIABLE"|"EXPENSE_FIXED"|"EXPENSE_OPERATIONAL"|"EXPENSE_COMMISSION"|"GENERAL";
};
export type FinancialBankAccountConfig={
  id:string;name:string;bankCode:string;bankName:string;agency:string;account:string;active:boolean;
  unitId:string;ownerCnpj:string;pixType:"PHONE"|"CPF"|"CNPJ"|"EMAIL"|"EVP"|"";
  pixKey:string;verifiedAt:string;verificationReference:string;
};
export type FinancialBankRequest={
  id:string;name:string;bankCode:string;bankName:string;agency:string;account:string;
  unitId:string;ownerCnpj:string;pixType:"PHONE"|"CPF"|"CNPJ"|"EMAIL"|"EVP";
  pixKey:string;requestedAt:string;
};
export type FinancialCustomPaymentMethod={
  id:string;name:string;type:"PIX"|"CASH"|"DEBIT"|"CREDIT"|"TRANSFER";active:boolean;
};
export type FinancialEntryMetadata={
  bankAccountId:string;paymentMethod:"PIX"|"CASH"|"DEBIT"|"CREDIT"|"TRANSFER"|"";
  customPaymentMethodId?:string;
  subcategory?:string;discountPercent?:number;interestPercent?:number;
  feeAmount?:number;principalAmount?:number;notes?:string;
  paymentCondition?:"ONCE"|"RECURRENT";
  recurrenceIndex?:number;recurrenceCount?:number;recurrenceGroupId?:string;
  recurrenceEvery?:number;recurrenceFrequency?:"DAYS"|"WEEKS"|"MONTHS"|"YEARS";
};
export type ClubPartner={
  id:string;name:string;cnpj:string;address:string;phone:string;instagramUrl:string;
  category:"ESPORTE"|"GASTRONOMIA"|"LAZER"|"SAUDE_ESTETICA"|"SERVICOS"|"VESTUARIO";
  discountPercent:number;logoUrl:string;promoCode:string;promoDescription:string;
  expiresAt:string;active:boolean;createdAt:string;
};
export type AccountingXmlDocument={
  id:string;fileName:string;accessKey:string;number:string;issueDate:string;
  issuerCnpj:string;amount:number;hash:string;importedAt:string;xmlBase64:string;
};
export type BillingRegularizationRequest={
  month:string;requestedAt:string;requesterEmail:string;
};
export type ErpWorkspace = {
  branding: BrandingSettings;
  hasBranches: boolean;
  businessContactEmail: string;
  businessTimeZone: string;
  bookingRules: {cancellationMinutes:number;noShowBlockHours:number;mode:"STANDARD"|"CUSTOM";customExplanation:string};
  unitPolicies: Record<string,UnitOperationsPolicy>;
  featuredProfessionalIds: string[];
  rolePermissions: StaffPermissions;
  professionalProfiles: Record<string, ProfessionalProfile>;
  clubEvents: ClubEvent[];
  clubSales: ClubSale[];
  clubCharges: ClubCharge[];
  clubRefunds: ClubRefund[];
  clubPriceAdjustments: ClubPriceAdjustment[];
  clubWithdrawalRequests: ClubWithdrawalRequest[];
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
  serviceCatalogSettings: Record<string,ServiceCatalogMetadata>;
  billingRegularizationRequests: BillingRegularizationRequest[];
  financialCategories: FinancialCategoryConfig[];
  financialBankAccounts: FinancialBankAccountConfig[];
  financialBankRequests: FinancialBankRequest[];
  customPaymentMethods: FinancialCustomPaymentMethod[];
  financialExpenseMethods: FinancialEntryMetadata["paymentMethod"][];
  financialExpenseCustomMethods:string[];
  stockCategories:string[];
  stockCategoryOverrides:Record<string,string>;
  accountingXmlDocuments:AccountingXmlDocument[];
  clubPartners:ClubPartner[];
  financialEntryMetadata: Record<string,FinancialEntryMetadata>;
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
  hasBranches: false,
  businessContactEmail: "",
  businessTimeZone: "America/Sao_Paulo",
  bookingRules: {cancellationMinutes:0,noShowBlockHours:0,mode:"STANDARD",customExplanation:""},
  branding: { logoUrl: "", accentColor: "#c69a49", secondaryColor: "#202124", clubTitle: "Clube de assinaturas", clubDescription: "",
    heroTitle: "", heroDescription: "", coverImageUrl: "",
    carouselImages: [], carouselCaptions: [], secondaryTitle: "", secondaryDescription: "" },
  unitPolicies: {},
  featuredProfessionalIds: [],
  serviceCatalogSettings: {},
  billingRegularizationRequests: [],
  financialCategories: [],
  financialBankAccounts: [],
  financialBankRequests: [],
  customPaymentMethods: [],
  financialExpenseMethods: ["PIX","CASH","DEBIT","CREDIT","TRANSFER"],
  financialExpenseCustomMethods:[],
  stockCategories:["Produtos","Bebidas"],
  stockCategoryOverrides:{},
  accountingXmlDocuments:[],
  clubPartners:[],
  financialEntryMetadata: {},
  rolePermissions: {},
  professionalProfiles: {},
  clubEvents: [],
  clubSales: [],
  clubCharges: [],
  clubRefunds: [],
  clubPriceAdjustments: [],
  clubWithdrawalRequests: [],
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
    hasBranches: operations.hasBranches === true,
    businessContactEmail: typeof operations.businessContactEmail==="string" ? operations.businessContactEmail.slice(0,180) : "",
    businessTimeZone: isValidBusinessTimeZone(String(operations.businessTimeZone??"")) ? String(operations.businessTimeZone) : "America/Sao_Paulo",
    rolePermissions,
    bookingRules: (()=>{
      const policy=record(operations.bookingRules);
      const validInt=(value:unknown,max:number,defaultValue:number)=>typeof value==="number"&&Number.isSafeInteger(value)&&value>=0&&value<=max?value:defaultValue;
      return {cancellationMinutes:validInt(policy.cancellationMinutes,10080,0),
        noShowBlockHours:validInt(policy.noShowBlockHours,720,0),
        mode:policy.mode==="CUSTOM"?"CUSTOM" as const:"STANDARD" as const,
        customExplanation:typeof policy.customExplanation==="string"?policy.customExplanation.slice(0,500):""};
    })(),
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
          postalCode:typeof p.postalCode==="string"?p.postalCode.slice(0,9):"",
          complement:typeof p.complement==="string"?p.complement.slice(0,120):"",
          bankCountry:p.bankCountry==="INT"?"INT":"BR",
          bankCode:typeof p.bankCode==="string"?p.bankCode.slice(0,8):"",
          bankName:typeof p.bankName==="string"?p.bankName.slice(0,150):"",
          bankAgency:typeof p.bankAgency==="string"?p.bankAgency.slice(0,30):"",
          bankAccount:typeof p.bankAccount==="string"?p.bankAccount.slice(0,35):"",
          verifiedBankAccountId:typeof p.verifiedBankAccountId==="string"?p.verifiedBankAccountId.slice(0,100):"",
          bankSwift:typeof p.bankSwift==="string"?p.bankSwift.slice(0,11):"",
          paymentConfigurations:Object.fromEntries(Object.entries(record(p.paymentConfigurations))
            .filter(([key])=>methods.includes(key as typeof methods[number])||/^fpay_[a-z0-9_]{6,80}$/.test(key))
            .map(([key,value])=>{const cfg=record(value);return [key,{
              feePercent:percent(cfg.feePercent,100,0),
              settlementDays:percent(cfg.settlementDays,90,0),
              autoMarkPaid:cfg.autoMarkPaid===true,
            }]})),
          paymentEmail:typeof p.paymentEmail==="string"?p.paymentEmail.slice(0,180):"",
          paymentPhone:typeof p.paymentPhone==="string"?p.paymentPhone.slice(0,24):"",
          pixKey:typeof p.pixKey==="string"?p.pixKey.slice(0,150):"",
          pixType:["CNPJ","CPF","EMAIL","PHONE","EVP"].includes(String(p.pixType))?p.pixType:"",
          paymentMethods:list,
          customPaymentMethods:Array.isArray(p.customPaymentMethods)?
            p.customPaymentMethods.filter((id):id is string=>typeof id==="string"&&/^fpay_[a-z0-9_]{6,80}$/.test(id)).slice(0,60):[],
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
    financialCategories:array<unknown>(operations.financialCategories).flatMap(item=>{
      const entry=record(item);
      if(typeof entry.id!=="string"||typeof entry.name!=="string"||
        !["RECEIVABLE","PAYABLE","BOTH"].includes(String(entry.type)))return [];
      const classification=String(entry.classification??"GENERAL");
      return [{id:entry.id.slice(0,100),name:entry.name.slice(0,80),
        subcategory:typeof entry.subcategory==="string"?entry.subcategory.slice(0,80):"",
        type:entry.type as FinancialCategoryConfig["type"],
        classification:(["REVENUE_FIXED","REVENUE_VARIABLE","EXPENSE_FIXED","EXPENSE_OPERATIONAL",
          "EXPENSE_COMMISSION","GENERAL"].includes(classification)?classification:"GENERAL") as FinancialCategoryConfig["classification"]}];
    }).slice(0,250),
    financialBankAccounts:array<unknown>(operations.financialBankAccounts).flatMap(item=>{
      const entry=record(item);
      if(typeof entry.id!=="string"||typeof entry.name!=="string")return [];
      const verified=typeof entry.verifiedAt==="string"&&Number.isFinite(Date.parse(entry.verifiedAt))&&
        typeof entry.verificationReference==="string"&&Boolean(entry.verificationReference);
      return [{id:entry.id.slice(0,100),name:entry.name.slice(0,90),
        bankCode:typeof entry.bankCode==="string"?entry.bankCode.slice(0,12):"",
        bankName:typeof entry.bankName==="string"?entry.bankName.slice(0,100):"",
        agency:typeof entry.agency==="string"?entry.agency.slice(0,25):"",
        account:typeof entry.account==="string"?entry.account.slice(0,35):"",
        unitId:typeof entry.unitId==="string"?entry.unitId.slice(0,100):"",
        ownerCnpj:typeof entry.ownerCnpj==="string"?entry.ownerCnpj.slice(0,14):"",
        pixType:(["PHONE","CPF","CNPJ","EMAIL","EVP"].includes(String(entry.pixType))?entry.pixType:"") as FinancialBankAccountConfig["pixType"],
        pixKey:typeof entry.pixKey==="string"?entry.pixKey.slice(0,150):"",
        verifiedAt:verified?String(entry.verifiedAt):"",
        verificationReference:verified?String(entry.verificationReference).slice(0,80):"",
        active:verified&&entry.active!==false}];
    }).slice(0,100),
    financialBankRequests:array<unknown>(operations.financialBankRequests).flatMap(item=>{
      const p=record(item);
      if(typeof p.id!=="string"||typeof p.name!=="string"||typeof p.unitId!=="string")return [];
      return [{id:p.id.slice(0,100),name:p.name.slice(0,90),
        bankCode:String(p.bankCode??"").slice(0,12),bankName:String(p.bankName??"").slice(0,100),
        agency:String(p.agency??"").slice(0,25),account:String(p.account??"").slice(0,35),
        unitId:p.unitId.slice(0,100),ownerCnpj:String(p.ownerCnpj??"").slice(0,14),
        pixType:(["PHONE","CPF","CNPJ","EMAIL","EVP"].includes(String(p.pixType))?p.pixType:"CNPJ") as FinancialBankRequest["pixType"],
        pixKey:String(p.pixKey??"").slice(0,150),requestedAt:String(p.requestedAt??"").slice(0,35)}];
    }).slice(0,50),
    customPaymentMethods:array<unknown>(operations.customPaymentMethods).flatMap(item=>{
      const p=record(item);
      if(typeof p.id!=="string"||!/^fpay_[a-z0-9_]{6,80}$/.test(p.id)||
        typeof p.name!=="string"||!["PIX","CASH","DEBIT","CREDIT","TRANSFER"].includes(String(p.type)))return [];
      return [{id:p.id,name:p.name.slice(0,80),type:p.type as FinancialCustomPaymentMethod["type"],active:p.active!==false}];
    }).slice(0,60),
    financialExpenseMethods:(()=>{
      const methods=["PIX","CASH","DEBIT","CREDIT","TRANSFER"] as const;
      const raw=operations.financialExpenseMethods;
      return Array.isArray(raw)?raw.filter((method):method is typeof methods[number]=>
        typeof method==="string"&&(methods as readonly string[]).includes(method)): [...methods];
    })(),
    financialExpenseCustomMethods:array<unknown>(operations.financialExpenseCustomMethods)
      .filter((id):id is string=>typeof id==="string"&&/^fpay_[a-z0-9_]{6,80}$/.test(id)).slice(0,60),
    stockCategories:[...new Set(["Produtos","Bebidas",
      ...array<unknown>(operations.stockCategories).filter((v):v is string=>
        typeof v==="string"&&v.trim().length>=2&&v.length<=60).slice(0,60)])],
    stockCategoryOverrides:Object.fromEntries(Object.entries(record(operations.stockCategoryOverrides))
      .filter(([key,value])=>key.length<=100&&typeof value==="string"&&value.length<=60).slice(-5000)) as Record<string,string>,
    accountingXmlDocuments:array<unknown>(operations.accountingXmlDocuments).flatMap(item=>{
      const p=record(item);
      if(typeof p.id!=="string"||typeof p.accessKey!=="string"||!/^\d{44}$/.test(p.accessKey)||
        typeof p.xmlBase64!=="string"||p.xmlBase64.length>180000)return [];
      return [{
        id:p.id.slice(0,100),fileName:String(p.fileName??"").slice(0,120),
        accessKey:p.accessKey,number:String(p.number??"").slice(0,20),
        issueDate:String(p.issueDate??"").slice(0,35),issuerCnpj:String(p.issuerCnpj??"").slice(0,14),
        amount:Number.isFinite(p.amount)?Math.max(0,Number(p.amount)):0,
        hash:String(p.hash??"").slice(0,64),importedAt:String(p.importedAt??"").slice(0,35),
        xmlBase64:p.xmlBase64,
      }];
    }).slice(-20) as AccountingXmlDocument[],
    clubPartners:array<unknown>(operations.clubPartners).flatMap(item=>{
      const p=record(item);
      const cat=String(p.category??"");
      if(typeof p.id!=="string"||typeof p.name!=="string"||
        !["ESPORTE","GASTRONOMIA","LAZER","SAUDE_ESTETICA","SERVICOS","VESTUARIO"].includes(cat))return [];
      const discount=Number(p.discountPercent);
      return [{
        id:p.id.slice(0,100),name:p.name.slice(0,120),cnpj:String(p.cnpj??"").slice(0,14),
        address:String(p.address??"").slice(0,240),phone:String(p.phone??"").slice(0,24),
        instagramUrl:typeof p.instagramUrl==="string"&&/^https:\/\/(www\.)?instagram\.com\//i.test(p.instagramUrl)
          ?p.instagramUrl.slice(0,240):"",
        category:cat as ClubPartner["category"],
        discountPercent:Number.isFinite(discount)&&discount>=0&&discount<=100?discount:0,
        logoUrl:typeof p.logoUrl==="string"&&/^https:\/\//.test(p.logoUrl)?p.logoUrl.slice(0,800):"",
        promoCode:String(p.promoCode??"").slice(0,40),promoDescription:String(p.promoDescription??"").slice(0,400),
        expiresAt:String(p.expiresAt??"").slice(0,10),active:p.active===true,
        createdAt:String(p.createdAt??"").slice(0,35),
      }];
    }).slice(0,100) as ClubPartner[],
    financialEntryMetadata:Object.fromEntries(Object.entries(record(operations.financialEntryMetadata))
      .filter(([id])=>id.length<=100).slice(-5000).map(([id,raw])=>{
        const entry=record(raw);const method=String(entry.paymentMethod??"");
        const nonnegative=(value:unknown,max:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=max?value:0;
        const frequency=String(entry.recurrenceFrequency??"");
        return [id,{bankAccountId:typeof entry.bankAccountId==="string"?entry.bankAccountId.slice(0,100):"",
          paymentMethod:["PIX","CASH","DEBIT","CREDIT","TRANSFER"].includes(method)?
          method as FinancialEntryMetadata["paymentMethod"]:"",
          customPaymentMethodId:typeof entry.customPaymentMethodId==="string"&&/^fpay_[a-z0-9_]{6,80}$/.test(entry.customPaymentMethodId)?entry.customPaymentMethodId:"",
          subcategory:typeof entry.subcategory==="string"?entry.subcategory.slice(0,80):"",
          notes:typeof entry.notes==="string"?entry.notes.slice(0,500):"",
          discountPercent:nonnegative(entry.discountPercent,100),
          interestPercent:nonnegative(entry.interestPercent,100),
          feeAmount:nonnegative(entry.feeAmount,99999999),
          principalAmount:nonnegative(entry.principalAmount,99999999),
          paymentCondition:entry.paymentCondition==="RECURRENT"?"RECURRENT":"ONCE",
          recurrenceGroupId:typeof entry.recurrenceGroupId==="string"?entry.recurrenceGroupId.slice(0,100):"",
          recurrenceIndex:nonnegative(entry.recurrenceIndex,60),
          recurrenceCount:nonnegative(entry.recurrenceCount,60),
          recurrenceEvery:nonnegative(entry.recurrenceEvery,120),
          recurrenceFrequency:["DAYS","WEEKS","MONTHS","YEARS"].includes(frequency)?
            frequency as FinancialEntryMetadata["recurrenceFrequency"]:"MONTHS",
        }];
      })) as Record<string,FinancialEntryMetadata>,
    billingRegularizationRequests:array<unknown>(operations.billingRegularizationRequests)
      .filter((item):item is BillingRegularizationRequest=>{
        if(!item||typeof item!=="object"||Array.isArray(item))return false;
        const recordItem=item as Record<string,unknown>;
        return typeof recordItem.month==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(recordItem.month)&&
          typeof recordItem.requestedAt==="string"&&
          typeof recordItem.requesterEmail==="string";
      }).slice(-100),
    serviceCatalogSettings:Object.fromEntries(Object.entries(record(operations.serviceCatalogSettings))
      .filter(([id])=>id.length<=100).slice(0,2000).map(([id,raw])=>{
        const meta=record(raw);
        const optionalNumber=(value:unknown,max:number)=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=max?value:null;
        return [id,{
          ticketValue:optionalNumber(meta.ticketValue,1000000),
          repurchaseDays:optionalNumber(meta.repurchaseDays,3650),
          category:typeof meta.category==="string"?meta.category.slice(0,80):"",
          startingFrom:meta.startingFrom===true,
          hidden:meta.hidden===true,
          walkIn:meta.walkIn===true,
        }];
      })) as Record<string,ServiceCatalogMetadata>,
    featuredProfessionalIds: array<unknown>(operations.featuredProfessionalIds).filter(
      (id):id is string => typeof id==="string"&&id.length<=100).slice(0,50),
    professionalProfiles: Object.fromEntries(Object.entries(record(operations.professionalProfiles))
      .map(([id, raw])=>[id, record(raw) as ProfessionalProfile])) as Record<string, ProfessionalProfile>,
    clubEvents: array<ClubEvent>(operations.clubEvents),
    clubSales: array<ClubSale>(operations.clubSales),
    clubCharges: array<ClubCharge>(operations.clubCharges),
    clubRefunds: array<ClubRefund>(operations.clubRefunds),
    clubPriceAdjustments: array<ClubPriceAdjustment>(operations.clubPriceAdjustments),
    clubWithdrawalRequests: array<ClubWithdrawalRequest>(operations.clubWithdrawalRequests),
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
      const secondaryColor = typeof source.secondaryColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(source.secondaryColor)
        ? source.secondaryColor : DEFAULT_WORKSPACE.branding.secondaryColor;
      return {
        logoUrl: logo, accentColor: accent, secondaryColor,
        heroTitle: typeof source.heroTitle==="string"?source.heroTitle.slice(0,110):"",
        heroDescription: typeof source.heroDescription==="string"?source.heroDescription.slice(0,600):"",
        carouselCaptions: (Array.isArray(source.carouselCaptions)?source.carouselCaptions:[])
          .slice(0,3).map(item=>{const entry=record(item);return {
            title:typeof entry.title==="string"?entry.title.slice(0,110):"",
            subtitle:typeof entry.subtitle==="string"?entry.subtitle.slice(0,240):"",
          };}),
        carouselImages: (Array.isArray(source.carouselImages)?source.carouselImages:[])
          .filter((url): url is string=>typeof url==="string" && /^https:\/\//i.test(url))
          .slice(0,3).map(url=>url.slice(0,700)),
        secondaryTitle: typeof source.secondaryTitle==="string"?source.secondaryTitle.slice(0,110):"",
        secondaryDescription: typeof source.secondaryDescription==="string"?source.secondaryDescription.slice(0,600):"",
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
