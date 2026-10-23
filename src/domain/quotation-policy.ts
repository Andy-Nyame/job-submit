import type { ApplicationRole } from "./auth-policy";
import {
  calculateExpressPrice,
  EXPRESS_SURCHARGE_BASIS_POINTS,
} from "./job-rules";
import { parseGhanaCediToMinor } from "./service-pricing";

export const QUOTATION_MANAGER_ROLES = ["OWNER", "ADMIN"] as const;
export const QUOTATION_STATUSES = [
  "DRAFT",
  "ISSUED",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "SUPERSEDED",
  "WITHDRAWN",
] as const;
export const COUNTEROFFER_STATUSES = [
  "PENDING",
  "DECLINED",
  "SUPERSEDED",
] as const;
export const QUOTATION_LINE_ITEM_KINDS = ["BASE", "ADDITIONAL"] as const;
export const DEFAULT_QUOTATION_VALIDITY_DAYS = 7;
export const MAX_QUOTATION_VALIDITY_DAYS = 90;
export const MAX_QUOTATION_LINE_ITEMS = 20;
export const MAX_QUOTATION_ITEM_DESCRIPTION = 160;
export const MAX_QUOTATION_CUSTOMER_NOTE = 2_000;
export const MAX_COUNTEROFFER_NOTE = 1_000;
export const MAX_WITHDRAWAL_REASON = 500;
export const MAX_QUOTATION_TOTAL_MINOR = 2_000_000_000n;

export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export type CounterofferStatus = (typeof COUNTEROFFER_STATUSES)[number];
export type QuotationLineItemKind = (typeof QUOTATION_LINE_ITEM_KINDS)[number];

export interface QuotationLineItem {
  amountMinor: string;
  description: string;
  kind: QuotationLineItemKind;
}

export interface QuotationLineItemInput {
  amount: string;
  description: string;
  kind: string;
}

export interface QuotationTerms {
  expressSurchargeBasisPoints: number;
  expressSurchargeMinor: bigint;
  lineItems: QuotationLineItem[];
  subtotalMinor: bigint;
  totalMinor: bigint;
}

export class QuotationPolicyError extends Error {
  constructor(
    public readonly code:
      | "CUSTOMER_NOTE_INVALID"
      | "EXPIRY_INVALID"
      | "INVALID_COUNTEROFFER"
      | "INVALID_LINE_ITEMS"
      | "INVALID_TRANSITION"
      | "MANAGER_REQUIRED"
      | "WITHDRAWAL_REASON_INVALID",
  ) {
    super(code);
    this.name = "QuotationPolicyError";
  }
}

function hasUnsafeControls(value: string) {
  return Array.from(value).some((character) => {
    const point = character.codePointAt(0) ?? 0;
    return (point < 32 && character !== "\n" && character !== "\t") || point === 127;
  });
}

function normalizeText(value: unknown, maximum: number, required: boolean) {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").replace(/\r\n?/gu, "\n").trim();
  if (
    (required && !normalized) ||
    normalized.length > maximum ||
    hasUnsafeControls(normalized)
  ) {
    return null;
  }
  return normalized || null;
}

export function canManageQuotations(role: ApplicationRole | null | undefined) {
  return QUOTATION_MANAGER_ROLES.some((allowed) => allowed === role);
}

export function assertCanManageQuotations(role: ApplicationRole) {
  if (!canManageQuotations(role)) {
    throw new QuotationPolicyError("MANAGER_REQUIRED");
  }
}

export function validateQuotationTerms(
  items: readonly QuotationLineItemInput[],
  priority: "REGULAR" | "EXPRESS",
): QuotationTerms {
  if (items.length < 1 || items.length > MAX_QUOTATION_LINE_ITEMS) {
    throw new QuotationPolicyError("INVALID_LINE_ITEMS");
  }

  const lineItems = items.map((item) => {
    const description = normalizeText(
      item.description,
      MAX_QUOTATION_ITEM_DESCRIPTION,
      true,
    );
    const amountMinor = parseGhanaCediToMinor(item.amount);
    if (
      !description ||
      amountMinor === null ||
      amountMinor <= 0n ||
      !QUOTATION_LINE_ITEM_KINDS.includes(item.kind as QuotationLineItemKind)
    ) {
      throw new QuotationPolicyError("INVALID_LINE_ITEMS");
    }
    return {
      amountMinor: amountMinor.toString(),
      description,
      kind: item.kind as QuotationLineItemKind,
    };
  });

  const subtotalMinor = lineItems.reduce(
    (total, item) => total + BigInt(item.amountMinor),
    0n,
  );
  if (subtotalMinor <= 0n || subtotalMinor > MAX_QUOTATION_TOTAL_MINOR) {
    throw new QuotationPolicyError("INVALID_LINE_ITEMS");
  }

  const calculated =
    priority === "EXPRESS"
      ? calculateExpressPrice(subtotalMinor)
      : {
          surchargeBasisPoints: 0n,
          surchargeMinor: 0n,
          totalMinor: subtotalMinor,
        };
  if (calculated.totalMinor > MAX_QUOTATION_TOTAL_MINOR) {
    throw new QuotationPolicyError("INVALID_LINE_ITEMS");
  }

  return {
    expressSurchargeBasisPoints: Number(calculated.surchargeBasisPoints),
    expressSurchargeMinor: calculated.surchargeMinor,
    lineItems,
    subtotalMinor,
    totalMinor: calculated.totalMinor,
  };
}

export function readQuotationLineItems(value: unknown): QuotationLineItem[] {
  if (!Array.isArray(value)) return [];
  const items: QuotationLineItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.amountMinor !== "string" ||
      !/^\d+$/u.test(record.amountMinor) ||
      typeof record.description !== "string" ||
      !QUOTATION_LINE_ITEM_KINDS.includes(record.kind as QuotationLineItemKind)
    ) {
      return [];
    }
    items.push({
      amountMinor: record.amountMinor,
      description: record.description,
      kind: record.kind as QuotationLineItemKind,
    });
  }
  return items;
}

export function normalizeQuotationCustomerNote(value: unknown) {
  const normalized = normalizeText(value, MAX_QUOTATION_CUSTOMER_NOTE, false);
  if (value !== undefined && value !== null && normalized === null && String(value).trim()) {
    throw new QuotationPolicyError("CUSTOMER_NOTE_INVALID");
  }
  return normalized;
}

export function normalizeWithdrawalReason(value: unknown) {
  const normalized = normalizeText(value, MAX_WITHDRAWAL_REASON, true);
  if (!normalized) {
    throw new QuotationPolicyError("WITHDRAWAL_REASON_INVALID");
  }
  return normalized;
}

export function quotationExpiryFromDays(
  days: number,
  now = new Date(),
) {
  if (
    !Number.isSafeInteger(days) ||
    days < 1 ||
    days > MAX_QUOTATION_VALIDITY_DAYS
  ) {
    throw new QuotationPolicyError("EXPIRY_INVALID");
  }
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1_000);
}

export function effectiveQuotationStatus(
  status: QuotationStatus,
  expiresAt: Date,
  now = new Date(),
): QuotationStatus {
  return status === "ISSUED" && expiresAt.getTime() <= now.getTime()
    ? "EXPIRED"
    : status;
}

export function assertQuotationTransition(
  from: QuotationStatus,
  to: QuotationStatus,
) {
  const allowed =
    (from === "DRAFT" && (to === "ISSUED" || to === "WITHDRAWN")) ||
    (from === "ISSUED" &&
      ["ACCEPTED", "DECLINED", "EXPIRED", "SUPERSEDED", "WITHDRAWN"].includes(
        to,
      ));
  if (!allowed) throw new QuotationPolicyError("INVALID_TRANSITION");
}

export function validateCounteroffer(amount: unknown, note: unknown) {
  const amountMinor =
    typeof amount === "string" ? parseGhanaCediToMinor(amount) : null;
  const customerNote = normalizeText(note, MAX_COUNTEROFFER_NOTE, false);
  if (
    amountMinor === null ||
    amountMinor <= 0n ||
    amountMinor > MAX_QUOTATION_TOTAL_MINOR ||
    (note !== undefined && note !== null && customerNote === null && String(note).trim())
  ) {
    throw new QuotationPolicyError("INVALID_COUNTEROFFER");
  }
  return { amountMinor, customerNote };
}

export function expressSurchargeLabel(basisPoints: number) {
  return basisPoints === Number(EXPRESS_SURCHARGE_BASIS_POINTS)
    ? "Express / Urgent surcharge (40%)"
    : "Priority surcharge";
}

export const QUOTATION_AUDIT_ACTIONS = {
  COUNTEROFFER_DECLINED: "quotation.counteroffer_declined",
  COUNTEROFFER_SUBMITTED: "quotation.counteroffer_submitted",
  CUSTOMER_ACCEPTED: "quotation.customer_accepted",
  CUSTOMER_DECLINED: "quotation.customer_declined",
  DRAFT_CREATED: "quotation.draft_created",
  DRAFT_UPDATED: "quotation.draft_updated",
  EXPIRED: "quotation.expired",
  ISSUED: "quotation.issued",
  SUPERSEDED: "quotation.superseded",
  WITHDRAWN: "quotation.withdrawn",
} as const;
