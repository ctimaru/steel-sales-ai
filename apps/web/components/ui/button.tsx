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
    default: "bg-[#1b4c5d] text-white shadow-[0_1px_1px_rgba(11,23,30,0.12)] hover:bg-[#153542]",
    secondary: "border border-[#d9e0e4] bg-white text-[#273640] hover:border-[#bcd3da] hover:bg-[#f7fafb]",
    ghost: "text-[#66737d] hover:bg-[#edf1f3] hover:text-[#17232d]",
    danger: "bg-red-600 text-white hover:bg-red-700",
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
