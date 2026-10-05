import type { ComponentProps } from "react";

import { cn } from "@/lib/class-names";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-accent/45 bg-accent/12 px-3 py-1 font-mono text-xs font-medium uppercase tracking-[0.12em] text-foreground",
        className,
      )}
      {...props}
    />
  );
}
