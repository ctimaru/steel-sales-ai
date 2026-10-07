import Link from "next/link";

import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { VisualEvidenceQa } from "@/components/visual-evidence-qa";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function PlatformVisualEvidenceQaPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const locale = resolveBusinessPlanLocale(params.lang, "it");

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-base)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="platform-kicker">MKT5 · Visual Evidence QA</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Product Visual Approval
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            {locale === "it"
              ? "Registro delle superfici candidate, dei controlli live eseguiti e delle condizioni per poterle usare nel deck."
              : "Register of candidate surfaces, completed live checks and the conditions required before using them in the deck."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BusinessPlanLanguageToggle baseHref={appRoutes.platform.marketingVisualEvidenceQa} locale={locale} />
          <Link
            href={appRoutes.platform.marketingInvestorDeck}
            className="platform-secondary inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-semibold"
          >
            {locale === "it" ? "Apri Investor Deck" : "Open Investor Deck"}
          </Link>
          <Link
            href={appRoutes.platform.marketing}
            className="platform-secondary inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-semibold"
          >
            {locale === "it" ? "Torna a Marketing" : "Back to Marketing"}
          </Link>
        </div>
      </section>

      <VisualEvidenceQa locale={locale} />
    </div>
  );
}
