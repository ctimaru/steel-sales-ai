import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { InvestorNarrativeLibrary } from "@/components/investor-narrative-library";
import { MarketingPrinciplesView } from "@/components/marketing-principles-view";
import { ProductBrand } from "@/components/product-brand";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import {
  INVESTOR_BUSINESS_PLAN_COOKIE,
  parseInvestorBusinessPlanCookie,
  validateInvestorAccessSession,
} from "@/lib/investor-business-plan";

import { logoutInvestorAccess } from "../../access/[inviteToken]/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marketing & Brand · Smart Steel Sales Investor Room",
  description: "Confidential Smart Steel Sales investor narrative, governed assets and brand principles.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function InvestorMarketingPage({
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
      ? await validateInvestorAccessSession(
          inviteToken,
          parsed.sessionToken,
          "marketing",
        )
      : { ok: false as const };

  if (!access.ok) {
    redirect(`/investor/access/${inviteToken}`);
  }

  const baseHref = `/investor/marketing/${inviteToken}`;

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <ProductBrand href="/" />
            <Link
              href={`/investor/access/${inviteToken}`}
              className="hidden rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:inline-flex"
            >
              Investor Room · {access.label}
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <BusinessPlanLanguageToggle baseHref={baseHref} locale={locale} />
            <form action={logoutInvestorAccess}>
              <input type="hidden" name="invite_token" value={inviteToken} />
              <button className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]">
                {locale === "it" ? "Chiudi sessione" : "Close session"}
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <InvestorNarrativeLibrary
          investorMode
          inviteToken={inviteToken}
          locale={locale}
          scopes={access.scopes}
        />
        <div className="mt-6">
          <MarketingPrinciplesView investorMode locale={locale} />
        </div>
        <p className="mx-auto mt-8 max-w-4xl text-center text-xs leading-5 text-[var(--text-tertiary)]">
          {locale === "it"
            ? "Confidenziale · Smart Steel Sales · Materiale condiviso in sola lettura."
            : "Confidential · Smart Steel Sales · Read-only shared material."}
        </p>
      </main>
    </div>
  );
}
