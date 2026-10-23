"use client";

import { useActionState } from "react";

import {
  createQuotationRevisionAction,
  declineCounterofferAction,
  issueQuotationAction,
  withdrawQuotationAction,
} from "@/app/app/staff/jobs/quotation-actions";
import { ServiceSubmitButton } from "@/components/services/submit-button";
import { FormMessage, Input } from "@/components/ui/form-controls";

const initialState = { message: "", status: "idle" as const };

export function IssueQuotationForm({ publicReference, quotationId, rowVersion }: { publicReference: string; quotationId: string; rowVersion: number }) {
  const [state, action] = useActionState(issueQuotationAction, initialState);
  return <form action={action} className="space-y-3"><input name="publicReference" type="hidden" value={publicReference} /><input name="quotationId" type="hidden" value={quotationId} /><input name="rowVersion" type="hidden" value={rowVersion} /><FormMessage message={state.message} status={state.status} /><ServiceSubmitButton pendingLabel="Issuing…">Issue quotation</ServiceSubmitButton></form>;
}

export function CreateRevisionForm({ publicReference, quotationId, rowVersion }: { publicReference: string; quotationId: string; rowVersion: number }) {
  const [state, action] = useActionState(createQuotationRevisionAction, initialState);
  return <form action={action} className="space-y-3"><input name="publicReference" type="hidden" value={publicReference} /><input name="quotationId" type="hidden" value={quotationId} /><input name="rowVersion" type="hidden" value={rowVersion} /><FormMessage message={state.message} status={state.status} /><ServiceSubmitButton pendingLabel="Creating revision…">Create revised draft</ServiceSubmitButton></form>;
}

export function WithdrawQuotationForm({ publicReference, quotationId, rowVersion }: { publicReference: string; quotationId: string; rowVersion: number }) {
  const [state, action] = useActionState(withdrawQuotationAction, initialState);
  return <form action={action} className="space-y-3" onSubmit={(event) => { if (!window.confirm("Withdraw this quotation? The customer will no longer be able to accept it.")) event.preventDefault(); }}><input name="publicReference" type="hidden" value={publicReference} /><input name="quotationId" type="hidden" value={quotationId} /><input name="rowVersion" type="hidden" value={rowVersion} /><label className="text-sm font-medium" htmlFor={`withdraw-${quotationId}`}>Withdrawal reason</label><Input id={`withdraw-${quotationId}`} maxLength={500} name="reason" required /><FormMessage message={state.message} status={state.status} /><ServiceSubmitButton pendingLabel="Withdrawing…">Withdraw quotation</ServiceSubmitButton></form>;
}

export function DeclineCounterofferForm({ counterofferId, publicReference }: { counterofferId: string; publicReference: string }) {
  const [state, action] = useActionState(declineCounterofferAction, initialState);
  return <form action={action} className="space-y-2"><input name="counterofferId" type="hidden" value={counterofferId} /><input name="publicReference" type="hidden" value={publicReference} /><FormMessage message={state.message} status={state.status} /><ServiceSubmitButton pendingLabel="Declining…">Decline counteroffer</ServiceSubmitButton></form>;
}
