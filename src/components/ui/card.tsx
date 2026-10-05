import type { ComponentProps } from "react";

import { cn } from "@/lib/class-names";

export function Card({ className, ...props }: ComponentProps<"article">) {
  return (
    <article
      className={cn(
        "rounded-xl border bg-surface p-6 sm:p-8",
        className,
      )}
      {...props}
    />
  );
}
