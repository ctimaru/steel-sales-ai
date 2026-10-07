import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { InvestorOnePager } from "@/components/investor-one-pager";
import { ProductBrand } from "@/components/product-brand";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import {
  INVESTOR_BUSINESS_PLAN_COOKIE,
  parseInvestorBusinessPlanCookie,
  validateInvestorAccessSession,
} from "@/lib/investor-business-plan";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor One-pager · Smart Steel Sales",
  description: "Confidential Smart Steel Sales investor one-pager.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function InvestorOnePagerPage({
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
      ? await validateInvestorAccessSession(inviteToken, parsed.sessionToken, "marketing")
      : { ok: false as const };

  if (!access.ok) {
    redirect(`/investor/access/${inviteToken}`);
  }

  const baseHref = `/investor/marketing/${inviteToken}/one-pager`;

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/95 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex min-h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <ProductBrand href="/" />
            <Link
              href={`/investor/marketing/${inviteToken}`}
              className="hidden rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:inline-flex"
            >
              Investor Room · {access.label}
            </Link>
          </div>
          <BusinessPlanLanguageToggle baseHref={baseHref} locale={locale} />
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 print:p-0">
        <InvestorOnePager investorMode locale={locale} />
      </main>
    </div>
  );
}
