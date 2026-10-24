"use client";

import { useActionState } from "react";

import {
  initialShopStatusActionState,
  setShopStatusAction,
} from "@/app/app/services/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-controls";

export function ShopStatusForm({ open }: { open: boolean }) {
  const [state, action, pending] = useActionState(
    setShopStatusAction,
    initialShopStatusActionState,
  );
  const nextOpen = !open;

  return (
    <form
      action={action}
      className="mt-5"
      onSubmit={(event) => {
        if (
          open &&
          !window.confirm(
            "Close the shop to new customer jobs? Existing jobs and staff tools will keep working.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="acceptingNewJobs" type="hidden" value={String(nextOpen)} />
      <input name="expectedState" type="hidden" value={String(open)} />
      <p className="text-sm leading-6 text-muted">
        {open
          ? "Customers can submit through services that are separately enabled online."
          : "New customer jobs are paused. Existing jobs, prices, accounts, and staff tools still work."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={pending}
          type="submit"
          variant={open ? "outline" : "primary"}
        >
          {pending
            ? "Saving…"
            : open
              ? "Close shop to new jobs"
              : "Open shop to new jobs"}
        </Button>
        <span className="text-xs leading-5 text-muted">
          {open
            ? "Closing requires this deliberate action."
            : "Opening does not enable any disabled service."}
        </span>
      </div>
      <FormMessage message={state.message} status={state.status} />
    </form>
  );
}
