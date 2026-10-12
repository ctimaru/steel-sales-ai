import Link from "next/link";

import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { withBusinessPlanLocale } from "@/lib/business-plan-locale";

type BusinessPlanTab = "highlights" | "details" | "market-sizing";

export function BusinessPlanTabs({
  baseHref,
  active,
  locale = "en",
  showPrivateMarketSizing = false,
}: {
  baseHref: string;
  active: BusinessPlanTab;
  locale?: BusinessPlanLocale;
  showPrivateMarketSizing?: boolean;
}) {
  const tabs =
    locale === "it"
      ? [
          {
            key: "highlights" as const,
            label: "Highlights",
            description: "Timeline, tesi e numeri chiave",
            href: withBusinessPlanLocale(baseHref, locale),
          },
          {
            key: "details" as const,
            label: "Dettagli",
            description: "Business Plan investor completo",
            href: withBusinessPlanLocale(`${baseHref}/details`, locale),
          },
        ]
      : [
          {
            key: "highlights" as const,
            label: "Highlights",
            description: "Timeline, thesis and key metrics",
            href: withBusinessPlanLocale(baseHref, locale),
          },
          {
            key: "details" as const,
            label: "Details",
            description: "Complete investor Business Plan",
            href: withBusinessPlanLocale(`${baseHref}/details`, locale),
          },
        ];

  const visibleTabs = showPrivateMarketSizing
    ? [
        ...tabs,
        {
          key: "market-sizing" as const,
          label: locale === "it" ? "TAM · SAM · SOM" : "TAM · SAM · SOM",
          description: locale === "it" ? "Dimensionamento SaaS privato · superadmin" : "Private SaaS market model · superadmin",
          href: withBusinessPlanLocale(`${baseHref}/market-sizing`, locale),
        },
      ]
    : tabs;

  return (
    <nav
      aria-label={locale === "it" ? "Pagine Business Plan" : "Business Plan pages"}
      className={["grid gap-2 rounded-2xl border border-[#dce2df] bg-white p-2", showPrivateMarketSizing ? "sm:grid-cols-3" : "sm:grid-cols-2"].join(" ")}
    >
      {visibleTabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={[
              "rounded-xl px-4 py-3 transition",
              selected
                ? "platform-selected-solid shadow-sm"
                : "text-[#52615b] hover:bg-[#f4f7f5]",
            ].join(" ")}
          >
            <span className="block text-sm font-semibold">{tab.label}</span>
            <span
              className={[
                "mt-0.5 block text-[11px]",
                selected ? "opacity-80" : "text-[#87938e]",
              ].join(" ")}
            >
              {tab.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
