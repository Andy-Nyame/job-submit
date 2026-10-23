import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

type ButtonVariant = "primary" | "outline" | "accent";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-primary-foreground shadow-[0_8px_22px_-16px_var(--shadow-color)] hover:border-primary-hover hover:bg-primary-hover",
  outline: "border-border-strong bg-surface text-foreground hover:border-primary/45 hover:bg-primary-surface hover:text-primary-surface-foreground",
  accent: "border-accent bg-accent text-accent-foreground hover:bg-accent-hover",
};

export function Button({
  className,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-lg border px-5 text-sm font-semibold transition-[color,background-color,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:border-disabled disabled:bg-disabled disabled:text-disabled-foreground disabled:shadow-none",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
