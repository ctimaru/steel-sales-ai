import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessPlanInvestorDetails } from "@/components/business-plan-investor-details";
import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { BusinessPlanTabs } from "@/components/business-plan-tabs";
import { ProductBrand } from "@/components/product-brand";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import {
  INVESTOR_BUSINESS_PLAN_COOKIE,
  parseInvestorBusinessPlanCookie,
  validateInvestorBusinessPlanSession,
} from "@/lib/investor-business-plan";

import { logoutInvestorAccess } from "../../../access/[inviteToken]/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor Business Plan Details · Smart Steel Sales",
  description: "Confidential Smart Steel Sales investor Business Plan details.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function InvestorBusinessPlanDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ inviteToken: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const { inviteToken } = await params;
  const query = await searchParams;
  const locale = resolveBusinessPlanLocale(query.lang, "en");
  const cookieStore = await cookies();
  const parsed = parseInvestorBusinessPlanCookie(
    cookieStore.get(INVESTOR_BUSINESS_PLAN_COOKIE)?.value,
  );

  const access =
    parsed?.shareToken === inviteToken
      ? await validateInvestorBusinessPlanSession(inviteToken, parsed.sessionToken)
      : { ok: false as const };

  if (!access.ok) {
    redirect(`/investor/access/${inviteToken}`);
  }

  const baseHref = `/investor/business-plan/${inviteToken}`;

  return (
    <div className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <header className="sticky top-0 z-20 border-b border-[#dce2df] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <ProductBrand href="/" />
            <Link
              href={`/investor/access/${inviteToken}`}
              className="hidden rounded-full bg-[#f2f4f3] px-3 py-1 text-[11px] font-semibold text-[#66736e] sm:inline-flex"
            >
              Investor Room · {access.label}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <BusinessPlanLanguageToggle
              baseHref={`${baseHref}/details`}
              locale={locale}
            />
            <form action={logoutInvestorAccess}>
              <input type="hidden" name="invite_token" value={inviteToken} />
              <button className="rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#52615b] hover:bg-[#f4f7f5]">
                {locale === "it" ? "Chiudi sessione" : "Close session"}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <BusinessPlanTabs baseHref={baseHref} active="details" locale={locale} />
        <div className="mt-8">
          <BusinessPlanInvestorDetails locale={locale} />
        </div>
        <p className="mx-auto mt-8 max-w-4xl text-center text-xs leading-5 text-[#87938e]">
          {locale === "it"
            ? "Confidenziale · Smart Steel Sales · L'appendice operativa e le fonti complete restano governate in Notion."
            : "Confidential · Smart Steel Sales · Operational appendix and full evidence sources remain governed in Notion."}
        </p>
      </main>
    </div>
  );
}
