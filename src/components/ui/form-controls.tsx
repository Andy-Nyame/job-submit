import type { ComponentProps } from "react";

import { cn } from "@/lib/class-names";

export const fieldClassName =
  "min-h-11 w-full rounded-md border bg-background px-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted/75 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClassName, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClassName, className)} {...props} />;
}

export function FormMessage({
  message,
  status,
}: {
  message?: string;
  status: "idle" | "error" | "success";
}) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "min-h-5 text-sm",
        status === "error" ? "text-destructive" : "text-muted",
      )}
      role={status === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
