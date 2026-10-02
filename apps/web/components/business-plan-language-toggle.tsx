"use client";

import Link from "next/link";

import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { withBusinessPlanLocale } from "@/lib/business-plan-locale";

export function BusinessPlanLanguageToggle({
  baseHref,
  locale,
}: {
  baseHref: string;
  locale: BusinessPlanLocale;
}) {
  return (
    <div
      className="inline-flex rounded-xl border border-[#d7dfdb] bg-white p-1 shadow-sm"
      aria-label="Business Plan language"
    >
      {(["it", "en"] as const).map((item) => {
        const selected = item === locale;
        return (
          <Link
            key={item}
            href={withBusinessPlanLocale(baseHref, item)}
            aria-current={selected ? "page" : undefined}
            className={[
              "rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition",
              selected
                ? "platform-selected-solid"
                : "text-[#596761] hover:bg-[#f2f4f3] hover:text-[#1d2824]",
            ].join(" ")}
          >
            {item}
          </Link>
        );
      })}
    </div>
  );
}
