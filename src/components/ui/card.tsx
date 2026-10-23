import type { ComponentProps } from "react";

import { cn } from "@/lib/class-names";

export function Card({ className, ...props }: ComponentProps<"article">) {
  return (
    <article
      className={cn(
        "rounded-2xl border bg-surface p-6 shadow-[0_16px_44px_-38px_var(--shadow-color)] sm:p-8",
        className,
      )}
      {...props}
    />
  );
}
