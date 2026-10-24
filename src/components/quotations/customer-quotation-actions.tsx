"use client";

import { useActionState } from "react";

import {
  decideQuotationAction,
  submitCounterofferAction,
} from "@/app/app/jobs/quotation-actions";
import { ServiceSubmitButton } from "@/components/services/submit-button";
import { FormMessage, Input, Textarea } from "@/components/ui/form-controls";

const initialState = { message: "", status: "idle" as const };

export function CustomerQuotationDecisionForm({ publicReference, quotationId, rowVersion }: { publicReference: string; quotationId: string; rowVersion: number }) {
  const [state, action] = useActionState(decideQuotationAction, initialState);
  return <form action={action} className="space-y-3"><input name="publicReference" type="hidden" value={publicReference} /><input name="quotationId" type="hidden" value={quotationId} /><input name="rowVersion" type="hidden" value={rowVersion} /><div className="flex flex-wrap gap-3"><ServiceSubmitButton name="decision" pendingLabel="Saving your choice…" value="ACCEPT">Accept price</ServiceSubmitButton><ServiceSubmitButton className="border-border-strong bg-surface text-foreground hover:bg-surface-hover" name="decision" pendingLabel="Saving your choice…" value="DECLINE">Decline price</ServiceSubmitButton></div><FormMessage message={state.message} status={state.status} /></form>;
}

export function CustomerCounterofferForm({ publicReference, quotationId, rowVersion }: { publicReference: string; quotationId: string; rowVersion: number }) {
  const [state, action] = useActionState(submitCounterofferAction, initialState);
  return <form action={action} className="space-y-4 rounded-xl border bg-surface-muted p-4"><input name="publicReference" type="hidden" value={publicReference} /><input name="quotationId" type="hidden" value={quotationId} /><input name="rowVersion" type="hidden" value={rowVersion} /><div><label className="text-sm font-medium" htmlFor={`counteroffer-${quotationId}`}>Suggest a different price (GH₵)</label><Input id={`counteroffer-${quotationId}`} inputMode="decimal" name="amount" pattern="(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?" required /></div><div><label className="text-sm font-medium" htmlFor={`counteroffer-note-${quotationId}`}>Why? (optional)</label><Textarea id={`counteroffer-note-${quotationId}`} maxLength={1000} name="note" /></div><p className="text-xs leading-5 text-muted">This is only a suggestion. It does not change or approve the price. Management may decline it or send a new price.</p><FormMessage message={state.message} status={state.status} /><ServiceSubmitButton pendingLabel="Sending suggestion…">Send price suggestion</ServiceSubmitButton></form>;
}
