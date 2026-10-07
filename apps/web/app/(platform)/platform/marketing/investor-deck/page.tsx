import Link from "next/link";

import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { InvestorDeckProduction } from "@/components/investor-deck-production";
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
          <p className="platform-kicker">MKT7 · Investor release candidate</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Investor Deck — MKT7 Release Candidate
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            {locale === "it"
              ? "Deck visuale evidence-aware. La versione investor-safe è ora rilasciabile tramite scope Marketing; gli asset interni MKT4–MKT6 restano separati."
              : "Evidence-aware visual deck. The investor-safe version can now be released through the Marketing scope; internal MKT4–MKT6 assets remain separate."}
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

      <InvestorDeckProduction locale={locale} />
    </div>
  );
}
