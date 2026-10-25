"use server";

import { revalidatePath } from "next/cache";

import { requireCustomer } from "@/server/jobs/authorization";
import {
  decideCustomerQuotation,
  submitCustomerCounteroffer,
} from "@/server/quotations/customer";
import { QuotationOperationError } from "@/server/quotations/errors";

export interface CustomerQuotationActionState {
  message: string;
  status: "error" | "idle" | "success";
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function errorState(error: unknown): CustomerQuotationActionState {
  if (error instanceof QuotationOperationError) {
    const messages: Record<QuotationOperationError["code"], string> = {
      BUSINESS_UNAVAILABLE: "Your price details are unavailable right now.",
      COUNTEROFFER_NOT_ALLOWED:
        "Price changes are not available for this offer.",
      DUPLICATE_OPERATION:
        "Your price suggestion is already waiting for management to review it.",
      EXPIRED: "This price has expired and can no longer be accepted.",
      FIXED_PRICE_JOB: "This job already has confirmed fixed pricing.",
      INVALID_INPUT: "Enter a valid suggested amount and optional note.",
      INVALID_TRANSITION:
        "That action is unavailable while a response is pending.",
      NOT_FOUND: "The price offer was not found for this job.",
      STALE_UPDATE:
        "The price changed. Refresh the page before responding.",
    };
    return { message: messages[error.code], status: "error" };
  }
  return {
    message: "Your response could not be recorded safely. Please try again.",
    status: "error",
  };
}

function revalidate(publicReference: string) {
  revalidatePath("/app/jobs");
  revalidatePath(`/app/jobs/${publicReference}`);
  revalidatePath("/app/staff/jobs");
  revalidatePath(`/app/staff/jobs/${publicReference}`);
}

export async function decideQuotationAction(
  _state: CustomerQuotationActionState,
  formData: FormData,
): Promise<CustomerQuotationActionState> {
  const publicReference = text(formData, "publicReference");
  try {
    const actor = await requireCustomer();
    const decision = text(formData, "decision");
    if (decision !== "ACCEPT" && decision !== "DECLINE") {
      return { message: "Choose accept or decline.", status: "error" };
    }
    await decideCustomerQuotation(actor, {
      decision,
      expectedVersion: Number(text(formData, "rowVersion")),
      quotationId: text(formData, "quotationId"),
    });
    revalidate(publicReference);
    return {
      message:
        decision === "ACCEPT"
          ? "Price accepted. The agreed price is now recorded."
          : "Price declined. The job remains available for management review.",
      status: "success",
    };
  } catch (error) {
    return errorState(error);
  }
}

export async function submitCounterofferAction(
  _state: CustomerQuotationActionState,
  formData: FormData,
): Promise<CustomerQuotationActionState> {
  const publicReference = text(formData, "publicReference");
  try {
    const actor = await requireCustomer();
    await submitCustomerCounteroffer(actor, {
      amount: text(formData, "amount"),
      expectedVersion: Number(text(formData, "rowVersion")),
      note: text(formData, "note"),
      quotationId: text(formData, "quotationId"),
    });
    revalidate(publicReference);
    return {
      message:
        "Price suggestion sent for management review. It is not an approved price.",
      status: "success",
    };
  } catch (error) {
    return errorState(error);
  }
}
