import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-[#d9e0e4] bg-white px-3 text-sm text-[#17232d] outline-none transition placeholder:text-[#9aa8ae] focus:border-[#6e9eab] focus:ring-4 focus:ring-[#eef5f6]",
        className,
      )}
      {...props}
    />
  );
}
