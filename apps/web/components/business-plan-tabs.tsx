import Link from "next/link";

type BusinessPlanTab = "highlights" | "details";

export function BusinessPlanTabs({
  baseHref,
  active,
}: {
  baseHref: string;
  active: BusinessPlanTab;
}) {
  const tabs = [
    {
      key: "highlights" as const,
      label: "Highlights",
      description: "Timeline, thesis e numeri chiave",
      href: baseHref,
    },
    {
      key: "details" as const,
      label: "Details",
      description: "Business Plan completo",
      href: `${baseHref}/details`,
    },
  ];

  return (
    <nav
      aria-label="Business Plan pages"
      className="grid gap-2 rounded-2xl border border-[#dce2df] bg-white p-2 sm:grid-cols-2"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={[
              "rounded-xl px-4 py-3 transition",
              selected
                ? "bg-[#123d34] text-white shadow-sm"
                : "text-[#52615b] hover:bg-[#f4f7f5]",
            ].join(" ")}
          >
            <span className="block text-sm font-semibold">{tab.label}</span>
            <span
              className={[
                "mt-0.5 block text-[11px]",
                selected ? "text-[#cfe0da]" : "text-[#87938e]",
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
