import type { ComponentProps } from "react";

import { cn } from "@/lib/class-names";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-accent/55 bg-accent/14 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-foreground",
        className,
      )}
      {...props}
    />
  );
}
