"use client";

import { useActionState, useId, useRef, useState } from "react";

import { saveQuotationDraftAction } from "@/app/app/staff/jobs/quotation-actions";
import { ServiceSubmitButton } from "@/components/services/submit-button";
import { FormMessage, Input, Select, Textarea } from "@/components/ui/form-controls";
import {
  DEFAULT_QUOTATION_VALIDITY_DAYS,
  MAX_QUOTATION_CUSTOMER_NOTE,
  MAX_QUOTATION_ITEM_DESCRIPTION,
  MAX_QUOTATION_LINE_ITEMS,
  MAX_QUOTATION_VALIDITY_DAYS,
  type QuotationLineItemKind,
} from "@/domain/quotation-policy";

interface DraftItem {
  amount: string;
  description: string;
  id: string;
  kind: QuotationLineItemKind;
}

function newItem(formId: string, index: number): DraftItem {
  return {
    amount: "",
    description: "",
    id: `${formId}-item-${index}`,
    kind: index === 0 ? "BASE" : "ADDITIONAL",
  };
}

export function QuotationDraftForm({
  initialCustomerNote = "",
  initialItems = [],
  initialValidityDays = DEFAULT_QUOTATION_VALIDITY_DAYS,
  priority,
  publicReference,
  quotationId,
  rowVersion,
}: {
  initialCustomerNote?: string;
  initialItems?: Array<Omit<DraftItem, "id">>;
  initialValidityDays?: number;
  priority: "REGULAR" | "EXPRESS";
  publicReference: string;
  quotationId?: string;
  rowVersion?: number;
}) {
  const formId = useId();
  const nextItemId = useRef(Math.max(1, initialItems.length));
  const [state, action] = useActionState(saveQuotationDraftAction, {
    message: "",
    status: "idle" as const,
  });
  const [items, setItems] = useState<DraftItem[]>(
    initialItems.length > 0
      ? initialItems.map((item, index) => ({ ...item, id: `saved-${index}` }))
      : [newItem(formId, 0)],
  );

  return (
    <form action={action} className="space-y-5">
      <input name="publicReference" type="hidden" value={publicReference} />
      {quotationId ? <input name="quotationId" type="hidden" value={quotationId} /> : null}
      {rowVersion ? <input name="rowVersion" type="hidden" value={rowVersion} /> : null}

      <div className="space-y-3">
        {items.map((item, index) => (
          <fieldset className="rounded-xl border bg-surface-muted p-4" key={item.id}>
            <legend className="px-1 text-sm font-semibold">Charge {index + 1}</legend>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)]">
              <div>
                <label className="text-sm font-medium" htmlFor={`${item.id}-description`}>Description</label>
                <Input id={`${item.id}-description`} maxLength={MAX_QUOTATION_ITEM_DESCRIPTION} name="itemDescription" onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, description: event.target.value } : entry))} required value={item.description} />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor={`${item.id}-kind`}>Charge type</label>
                <Select id={`${item.id}-kind`} name="itemKind" onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, kind: event.target.value as QuotationLineItemKind } : entry))} value={item.kind}>
                  <option value="BASE">Base work</option>
                  <option value="ADDITIONAL">Additional charge</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor={`${item.id}-amount`}>Amount (GH₵)</label>
                <Input id={`${item.id}-amount`} inputMode="decimal" name="itemAmount" onChange={(event) => setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, amount: event.target.value } : entry))} pattern="(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?" required value={item.amount} />
              </div>
            </div>
            {items.length > 1 ? <button className="mt-3 rounded-md border px-3 py-2 text-xs font-semibold outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} type="button">Remove charge</button> : null}
          </fieldset>
        ))}
      </div>

      <button className="min-h-11 rounded-lg border border-border-strong px-4 text-sm font-semibold outline-none hover:bg-primary-surface focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60" disabled={items.length >= MAX_QUOTATION_LINE_ITEMS} onClick={() => { const itemId = nextItemId.current; nextItemId.current += 1; setItems((current) => [...current, newItem(formId, itemId)]); }} type="button">Add itemized charge</button>

      <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div>
          <label className="text-sm font-medium" htmlFor="quotation-validity">Valid for (days)</label>
          <Input defaultValue={initialValidityDays} id="quotation-validity" max={MAX_QUOTATION_VALIDITY_DAYS} min={1} name="validityDays" required type="number" />
        </div>
        <div>
          <label className="text-sm font-medium" htmlFor="quotation-note">Customer-facing note (optional)</label>
          <Textarea defaultValue={initialCustomerNote} id="quotation-note" maxLength={MAX_QUOTATION_CUSTOMER_NOTE} name="customerNote" placeholder="Explain what is included without exposing internal costing or margins." />
        </div>
      </div>

      <p className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs leading-5 text-muted">
        {priority === "EXPRESS" ? "The server adds the 40% Express / Urgent surcharge once to the itemized subtotal. Do not add it as a separate charge." : "Regular priority has no Express surcharge."} Saving keeps this quotation private as a draft.
      </p>
      <FormMessage message={state.message} status={state.status} />
      <ServiceSubmitButton pendingLabel="Saving quotation…">{quotationId ? "Save draft" : "Create draft quotation"}</ServiceSubmitButton>
    </form>
  );
}
