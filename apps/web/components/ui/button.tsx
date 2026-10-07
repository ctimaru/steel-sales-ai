import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonProps) {
  const variants = {
    default: "bg-[var(--brand-primary)] text-white shadow-sm hover:bg-[var(--brand-primary-hover)]",
    secondary: "border border-[var(--border)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-subtle)] hover:text-[var(--brand-deep)]",
    ghost: "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]",
    danger: "bg-[var(--semantic-error)] text-white hover:brightness-90",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
