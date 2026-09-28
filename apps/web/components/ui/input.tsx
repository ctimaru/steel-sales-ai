import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-[#dbe5f1] bg-white px-3 text-sm text-[#1e2b45] outline-none transition placeholder:text-[#9ba8b9] focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]",
        className,
      )}
      {...props}
    />
  );
}
