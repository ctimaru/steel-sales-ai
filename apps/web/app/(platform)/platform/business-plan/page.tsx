import { BusinessPlanHighlights } from "@/components/business-plan-highlights";
import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { BusinessPlanTabs } from "@/components/business-plan-tabs";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function PlatformBusinessPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const locale = resolveBusinessPlanLocale(params.lang, "it");

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#dce2df] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="platform-kicker">L27.2 · Business Model</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
            {locale === "it" ? "Business Plan · Investor Room" : "Business Plan · Investor Room"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            {locale === "it"
              ? "Versione investor-ready del Business Plan di Smart Steel Sales. Highlights e Details sono bilingui; evidenze operative, audit e ledger restano allineati in Notion."
              : "Investor-ready Smart Steel Sales Business Plan. Highlights and Details are bilingual; operational evidence, audit and ledgers remain aligned in Notion."}
          </p>
        </div>
        <BusinessPlanLanguageToggle
          baseHref={appRoutes.platform.businessPlan}
          locale={locale}
        />
      </section>

      <BusinessPlanTabs
        baseHref={appRoutes.platform.businessPlan}
        active="highlights"
        locale={locale}
      />

      <BusinessPlanHighlights locale={locale} />
    </div>
  );
}
