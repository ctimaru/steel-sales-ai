import type { CalculatorSiteLocale } from "@/lib/international-calculator-landing";

export type SchoolReadingEntry = {
  id: string;
  label: string;
};

const titles: Record<CalculatorSiteLocale, { eyebrow: string; hint: string }> = {
  it: { eyebrow: "In questa guida", hint: "Vai direttamente all'argomento" },
  en: { eyebrow: "In this guide", hint: "Jump to a topic" },
  de: { eyebrow: "In diesem Leitfaden", hint: "Direkt zum Thema" },
  fr: { eyebrow: "Dans ce guide", hint: "Accéder à une section" },
  es: { eyebrow: "En esta guía", hint: "Ir a un apartado" },
};

/**
 * Lightweight, keyboard-accessible reading navigation.
 * Each anchor must match a real, rendered section; never synthesize content.
 * No client state, personalisation or private-workspace access.
 */
export function SchoolReadingIndex({
  locale,
  entries,
}: {
  locale: CalculatorSiteLocale;
  entries: SchoolReadingEntry[];
}) {
  if (entries.length < 2) return null;
  const t = titles[locale];
  return (
    <nav
      aria-label={t.eyebrow}
      lang={locale}
      className="rounded-[18px] border border-[#d5e2d9] bg-white px-4 py-3 sm:px-5 sm:py-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#21553f]">{t.eyebrow}</p>
        <p className="text-xs text-[#607267]">{t.hint}</p>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" role="list">
        {entries.map(({ id, label }, index) => (
          <a
            key={id}
            href={`#${id}`}
            role="listitem"
            className="inline-flex min-h-10 max-w-[240px] shrink-0 items-center gap-2 rounded-xl border border-[#d8e6db] bg-[#f5f8f5] px-3 py-2 text-left text-xs font-semibold text-[#224c39] transition hover:border-[#a9ceb8] hover:bg-[#eaf3ec] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]"
          >
            <span aria-hidden="true" className="font-mono text-[10px] text-[#5b826d]">{String(index + 1).padStart(2, "0")}</span>
            <span className="line-clamp-2">{label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
