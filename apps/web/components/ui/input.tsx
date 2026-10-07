import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-base)] px-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-tertiary)] focus:border-[var(--steel-blue)] focus:ring-4 focus:ring-[var(--steel-blue-soft)]",
        className,
      )}
      {...props}
    />
  );
}
