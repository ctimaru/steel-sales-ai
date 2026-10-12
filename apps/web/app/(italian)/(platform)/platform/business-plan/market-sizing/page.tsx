import type { Metadata } from "next";

import { PrivateBusinessPlanMarketSizing } from "@/components/private-business-plan-market-sizing";
import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { BusinessPlanTabs } from "@/components/business-plan-tabs";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "TAM SAM SOM · Business Plan privato · Smart Steel Sales",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function PlatformPrivateMarketSizingPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  // Explicit server-side, sole-platform-owner check. Never use investor share
  // token auth for this unpublished planning model.
  await requirePlatformSuperadmin();
  const query = await searchParams;
  const locale = resolveBusinessPlanLocale(query.lang, "it");

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#dce2df] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="platform-kicker">BP-MKT1 · Investor strategy · Owner only</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
            {locale === "it" ? "Business Plan · Dimensionamento SaaS" : "Business Plan · SaaS market sizing"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            {locale === "it"
              ? "Modello finanziario riservato al superadmin, con evidenze, ipotesi, scenari SOM e percorso di validazione. Non incluso nel portale condiviso con gli investitori."
              : "Superadmin-only market model with sources, hypotheses, SOM sensitivities and validation roadmap. Not included in the shareable Investor Room."}
          </p>
        </div>
        <BusinessPlanLanguageToggle baseHref={appRoutes.platform.businessPlanMarketSizing} locale={locale} />
      </section>

      <BusinessPlanTabs
        baseHref={appRoutes.platform.businessPlan}
        active="market-sizing"
        locale={locale}
        showPrivateMarketSizing
      />
      <PrivateBusinessPlanMarketSizing locale={locale} />
    </div>
  );
}
