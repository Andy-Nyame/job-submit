import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/class-names";

type ButtonVariant = "primary" | "outline" | "accent";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border-primary bg-primary text-primary-foreground hover:opacity-90",
  outline: "border-border bg-surface text-foreground hover:bg-surface-muted",
  accent: "border-accent bg-accent text-accent-foreground hover:brightness-95",
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
        "inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm font-medium transition-[color,background-color,border-color,opacity,filter] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
