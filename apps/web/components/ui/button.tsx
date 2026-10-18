import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/**
 * UI-SYSTEM1: visual styling belongs to this shared component contract.
 * Use ActionLink for navigation, Button for in-page actions.
 * Avoid supplying conflicting bg/text classes in className.
 */
export type ActionVariant = "default" | "secondary" | "soft" | "ghost" | "danger";
export type ActionSize = "sm" | "md";

export function actionClasses({
  variant = "default",
  size = "md",
}: { variant?: ActionVariant; size?: ActionSize } = {}) {
  const variants: Record<ActionVariant, string> = {
    default: "ui-action-primary",
    secondary: "ui-action-secondary",
    soft: "ui-action-soft",
    ghost: "ui-action-ghost",
    danger: "ui-action-danger",
  };
  const sizes: Record<ActionSize, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
  };
  return cn("ui-action inline-flex items-center justify-center rounded-xl font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50", variants[variant], sizes[size]);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionVariant;
  size?: ActionSize;
};

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  return <button className={cn(actionClasses({ variant, size }), className)} {...props} />;
}

type ActionLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ActionVariant;
  size?: ActionSize;
};

export function ActionLink({ className, variant = "default", size = "md", ...props }: ActionLinkProps) {
  return <a className={cn(actionClasses({ variant, size }), className)} {...props} />;
}
