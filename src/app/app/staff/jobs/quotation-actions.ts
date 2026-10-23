"use server";

import { revalidatePath } from "next/cache";

import { requireQuotationManager } from "@/server/quotations/authorization";
import { QuotationOperationError } from "@/server/quotations/errors";
import {
  createQuotationRevision,
  declineCounteroffer,
  issueQuotation,
  saveQuotationDraft,
  withdrawQuotation,
} from "@/server/quotations/management";

export interface QuotationActionState {
  message: string;
  status: "error" | "idle" | "success";
}

export const INITIAL_QUOTATION_ACTION_STATE: QuotationActionState = {
  message: "",
  status: "idle",
};

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function strings(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string");
}

function positiveInteger(formData: FormData, name: string) {
  const value = Number(text(formData, name));
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function errorState(error: unknown): QuotationActionState {
  if (error instanceof QuotationOperationError) {
    const messages: Record<QuotationOperationError["code"], string> = {
      BUSINESS_UNAVAILABLE:
        "Costing is unavailable while the account or business is inactive.",
      COUNTEROFFER_NOT_ALLOWED:
        "This quotation does not permit customer counteroffers.",
      DUPLICATE_OPERATION:
        "An active draft or pending response already exists. Refresh before continuing.",
      EXPIRED:
        "This quotation has expired. Create a new revision before issuing it.",
      FIXED_PRICE_JOB:
        "Fixed-price jobs use their confirmed submission snapshot and cannot enter manual quotation.",
      INVALID_INPUT:
        "Check the item descriptions, amounts, validity period, and notes.",
      INVALID_TRANSITION:
        "That quotation action is no longer available in its current state.",
      NOT_FOUND: "The quotation or job was not found in this business.",
      STALE_UPDATE:
        "The quotation changed in another session. Refresh before trying again.",
    };
    return { message: messages[error.code], status: "error" };
  }
  return {
    message: "The quotation could not be updated safely. Please try again.",
    status: "error",
  };
}

function revalidateQuotationPages(publicReference: string) {
  revalidatePath("/app/staff/jobs");
  revalidatePath(`/app/staff/jobs/${publicReference}`);
  revalidatePath("/app/jobs");
  revalidatePath(`/app/jobs/${publicReference}`);
}

export async function saveQuotationDraftAction(
  _state: QuotationActionState,
  formData: FormData,
): Promise<QuotationActionState> {
  const publicReference = text(formData, "publicReference");
  try {
    const actor = await requireQuotationManager();
    const descriptions = strings(formData, "itemDescription");
    const amounts = strings(formData, "itemAmount");
    const kinds = strings(formData, "itemKind");
    if (descriptions.length !== amounts.length || amounts.length !== kinds.length) {
      return { message: "Every charge needs a description and amount.", status: "error" };
    }
    const expectedVersion = positiveInteger(formData, "rowVersion") ?? undefined;
    const quotationId = text(formData, "quotationId") || undefined;
    await saveQuotationDraft(actor, {
      customerNote: text(formData, "customerNote"),
      expectedVersion,
      items: descriptions.map((description, index) => ({
        amount: amounts[index] ?? "",
        description,
        kind: kinds[index] ?? "",
      })),
      publicReference,
      quotationId,
      validityDays: Number(text(formData, "validityDays")),
    });
    revalidateQuotationPages(publicReference);
    return { message: quotationId ? "Draft saved." : "Draft quotation created.", status: "success" };
  } catch (error) {
    return errorState(error);
  }
}

async function quotationMutation(
  formData: FormData,
  work: (actor: Awaited<ReturnType<typeof requireQuotationManager>>, input: {
    expectedVersion: number;
    quotationId: string;
  }) => Promise<unknown>,
  successMessage: string,
) {
  const publicReference = text(formData, "publicReference");
  try {
    const actor = await requireQuotationManager();
    const expectedVersion = positiveInteger(formData, "rowVersion");
    const quotationId = text(formData, "quotationId");
    if (!expectedVersion || !quotationId) {
      return { message: "Invalid quotation version.", status: "error" } satisfies QuotationActionState;
    }
    await work(actor, { expectedVersion, quotationId });
    revalidateQuotationPages(publicReference);
    return { message: successMessage, status: "success" } satisfies QuotationActionState;
  } catch (error) {
    return errorState(error);
  }
}

export async function issueQuotationAction(
  _state: QuotationActionState,
  formData: FormData,
): Promise<QuotationActionState> {
  return await quotationMutation(formData, issueQuotation, "Quotation issued to the customer.");
}

export async function createQuotationRevisionAction(
  _state: QuotationActionState,
  formData: FormData,
): Promise<QuotationActionState> {
  return await quotationMutation(formData, createQuotationRevision, "A new draft revision was created.");
}

export async function withdrawQuotationAction(
  _state: QuotationActionState,
  formData: FormData,
): Promise<QuotationActionState> {
  const publicReference = text(formData, "publicReference");
  try {
    const actor = await requireQuotationManager();
    const expectedVersion = positiveInteger(formData, "rowVersion");
    const quotationId = text(formData, "quotationId");
    if (!expectedVersion || !quotationId) {
      return { message: "Invalid quotation version.", status: "error" };
    }
    await withdrawQuotation(actor, {
      expectedVersion,
      quotationId,
      reason: text(formData, "reason"),
    });
    revalidateQuotationPages(publicReference);
    return { message: "Quotation withdrawn safely.", status: "success" };
  } catch (error) {
    return errorState(error);
  }
}

export async function declineCounterofferAction(
  _state: QuotationActionState,
  formData: FormData,
): Promise<QuotationActionState> {
  const publicReference = text(formData, "publicReference");
  try {
    const actor = await requireQuotationManager();
    await declineCounteroffer(actor, {
      counterofferId: text(formData, "counterofferId"),
    });
    revalidateQuotationPages(publicReference);
    return { message: "Counteroffer declined. The issued quotation remains available.", status: "success" };
  } catch (error) {
    return errorState(error);
  }
}
