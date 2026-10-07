import Link from "next/link";

import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { InvestorOnePager } from "@/components/investor-one-pager";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function PlatformInvestorOnePagerPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const locale = resolveBusinessPlanLocale(params.lang, "it");

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-base)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 print:hidden">
        <div>
          <p className="platform-kicker">MKT3 · Approved asset</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Investor One-pager
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            {locale === "it"
              ? "Versione governata e investor-visible. Ogni sezione espone lo status del claim e la relativa evidence."
              : "Governed investor-visible version. Every section exposes claim status and its supporting evidence."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BusinessPlanLanguageToggle baseHref={appRoutes.platform.marketingOnePager} locale={locale} />
          <Link
            href={appRoutes.platform.marketing}
            className="platform-secondary inline-flex min-h-10 items-center rounded-xl px-4 text-xs font-semibold"
          >
            {locale === "it" ? "Torna a Marketing" : "Back to Marketing"}
          </Link>
        </div>
      </section>

      <InvestorOnePager locale={locale} />
    </div>
  );
}
