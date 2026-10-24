"use client";

import { Button } from "@/components/ui/button";

export function PrintJobLabelButton() {
  return (
    <Button className="print:hidden" onClick={() => window.print()} type="button">
      Print labels
    </Button>
  );
}
