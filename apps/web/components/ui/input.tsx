import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none transition placeholder:text-[#8b9792] focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]",
        className,
      )}
      {...props}
    />
  );
}
