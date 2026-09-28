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
    default: "bg-[#1a5144] text-white shadow-sm hover:bg-[#226657]",
    secondary: "border border-[#d7dfdb] bg-white text-[#43524c] hover:border-[#b8d2c8] hover:bg-[#f0f4f2] hover:text-[#1a5144]",
    ghost: "text-[#66736e] hover:bg-[#e9eeeb] hover:text-[#1d2824]",
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
