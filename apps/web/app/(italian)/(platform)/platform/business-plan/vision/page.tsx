import type { Metadata } from "next";

import { BusinessPlanVision } from "@/components/business-plan-vision";
import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { BusinessPlanTabs } from "@/components/business-plan-tabs";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  title: "AI · Visual · Super Steel Buyer | Masterplan 2027 | Smart Steel Sales",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function BusinessPlanVisionPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  // Founder-only plan: do not reuse investor invitation sessions or tenant user checks.
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const locale = resolveBusinessPlanLocale(params.lang, "it");

  return (
    <div className="mx-auto max-w-[1500px] space-y-7">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#dce2df] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="platform-kicker">BP-VISION1 · Masterplan 2027 · Owner only</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
            {locale === "it" ? "Business Plan · Nuova visione" : "Business Plan · New vision"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            {locale === "it"
              ? "Audit e masterplan approfondito per AI, interfaccia visuale e Super Steel Buyer, con roadmap, costi e gate decisionali. Riservato al Platform Owner."
              : "Audited, detailed AI, visual interaction and Super Steel Buyer masterplan with milestones, economics and launch gates. Platform Owner only."}
          </p>
        </div>
        <BusinessPlanLanguageToggle baseHref={appRoutes.platform.businessPlanVision} locale={locale} />
      </section>
      <BusinessPlanTabs
        baseHref={appRoutes.platform.businessPlan}
        active="vision"
        locale={locale}
        showPrivateMarketSizing
      />
      <BusinessPlanVision locale={locale} />
    </div>
  );
}
