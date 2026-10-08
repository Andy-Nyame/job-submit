"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function CopyInvitationLink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-md border border-accent/45 bg-accent/10 p-4">
      <p className="text-sm font-medium">Secure invitation link ready</p>
      <p className="mt-1 text-sm leading-6 text-muted">
        Copy it now. Only its hash is stored, so this exact link cannot be shown
        again.
      </p>
      <Button className="mt-3" onClick={copyLink} type="button" variant="accent">
        {copied ? "Copied" : "Copy invitation link"}
      </Button>
      <p aria-live="polite" className="mt-2 text-xs text-muted">
        {copied ? "Link copied to clipboard." : ""}
      </p>
    </div>
  );
}
