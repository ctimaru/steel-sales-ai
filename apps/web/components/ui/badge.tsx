import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "blue" | "green" | "amber" | "red" | "violet";
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    blue: "bg-[#eef5f6] text-[#1b4c5d]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    red: "bg-red-50 text-red-700",
    violet: "bg-[#fbf0e9] text-[#9a4e22]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
