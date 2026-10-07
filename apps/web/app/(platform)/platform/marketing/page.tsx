import Link from "next/link";

import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { InvestorNarrativeLibrary } from "@/components/investor-narrative-library";
import { MarketingPrinciplesView } from "@/components/marketing-principles-view";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function PlatformMarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const locale = resolveBusinessPlanLocale(params.lang, "it");

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface-base)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="platform-kicker">MKT4 · Private Console</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Marketing & Brand
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            {locale === "it"
              ? "Fonte privata per fundraising readiness, evidence pack, one-pager, pitch deck foundation, narrativa investitori e asset governati. Gli investor vedono soltanto ciò che è compatibile con gli scope esplicitamente concessi."
              : "Private source of truth for fundraising readiness, the evidence pack, one-pager, pitch deck foundation, investor narrative and governed assets. Investors see only material allowed by explicitly granted scopes."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <BusinessPlanLanguageToggle baseHref={appRoutes.platform.marketing} locale={locale} />
          <Link
            href={appRoutes.platform.investorAccess}
            className="platform-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-xs font-semibold"
          >
            {locale === "it" ? "Gestisci accessi investor" : "Manage investor access"}
          </Link>
        </div>
      </section>

      <InvestorNarrativeLibrary locale={locale} />
      <MarketingPrinciplesView locale={locale} />
    </div>
  );
}
