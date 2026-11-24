import Link from "next/link";

import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { InvestorDeckProduction } from "@/components/investor-deck-production";
import { Mkt9InvestorDeckCandidate } from "@/components/mkt9-investor-deck-candidate";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function PlatformInvestorDeckPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const locale = resolveBusinessPlanLocale(params.lang, "it");

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-base)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 print:hidden">
        <div>
          <p className="platform-kicker">MKT9.A · Investor refresh</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            {locale === "it" ? "Investor Deck — Nuova visione 2027" : "Investor Deck — New 2027 vision"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            {locale === "it"
              ? "Anteprima riservata al fondatore: nuova narrativa, AI, Network e piano di crescita. La versione MKT7 condivisa con gli investitori non cambia."
              : "Founder-only preview: new narrative, AI, Network and growth plan. The MKT7 release shared with investors remains unchanged."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BusinessPlanLanguageToggle baseHref={appRoutes.platform.marketingInvestorDeck} locale={locale} />
          <Link
            href={appRoutes.platform.marketingVisualEvidenceQa}
            className="platform-secondary inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-semibold"
          >
            {locale === "it" ? "Apri Visual QA" : "Open Visual QA"}
          </Link>
          <Link
            href={appRoutes.platform.marketingFundraisingReadiness}
            className="platform-secondary inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-semibold"
          >
            Evidence Pack
          </Link>
        </div>
      </section>

      <Mkt9InvestorDeckCandidate locale={locale} />
      <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] p-4 print:hidden">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">{locale === "it" ? "Versione precedente MKT7 (confronto interno)" : "Previous MKT7 version (internal comparison)"}</summary>
        <div className="mt-4"><InvestorDeckProduction locale={locale} /></div>
      </details>
    </div>
  );
}
