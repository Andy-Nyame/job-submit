"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-controls";

export function ShopStatusForm({ open }: { open: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ message: string; status: "error" | "idle" | "success" }>({ message: "", status: "idle" });
  const [pending, setPending] = useState(false);
  const nextOpen = !open;

  return (
    <form
      className="mt-5"
      onSubmit={async (event) => {
        event.preventDefault();
        if (
          open &&
          !window.confirm(
            "Close the shop to new customer jobs? Existing jobs and staff tools will keep working.",
          )
        ) {
          return;
        }
        setPending(true);
        setState({ message: "", status: "idle" });
        try {
          const response = await fetch("/api/management/shop", {
            body: JSON.stringify({ acceptingNewJobs: nextOpen, expectedState: open }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          });
          const result = await response.json() as { message?: string };
          setState({ message: result.message ?? "The shop status could not be saved.", status: response.ok ? "success" : "error" });
          if (response.ok) router.refresh();
        } catch {
          setState({ message: "The shop status could not be saved. Check your connection and try again.", status: "error" });
        } finally {
          setPending(false);
        }
      }}
    >
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
