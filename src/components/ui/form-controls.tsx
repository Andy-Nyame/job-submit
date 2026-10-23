import type { ComponentProps } from "react";

import { cn } from "@/lib/class-names";

export const fieldClassName =
  "min-h-11 w-full rounded-lg border border-input-border bg-input px-3 text-base text-foreground outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted/75 hover:border-primary/70 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled-foreground lg:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClassName, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldClassName, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldClassName, "min-h-28 py-3", className)}
      {...props}
    />
  );
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
        status === "error"
          ? "text-destructive"
          : status === "success"
            ? "text-success"
            : "text-muted",
      )}
      role={status === "error" ? "alert" : "status"}
    >
      {message}
    </p>
  );
}
