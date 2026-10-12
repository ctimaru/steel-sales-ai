import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BusinessPlanLanguageToggle } from "@/components/business-plan-language-toggle";
import { InvestorDeckProduction } from "@/components/investor-deck-production";
import { ProductBrand } from "@/components/product-brand";
import { resolveBusinessPlanLocale } from "@/lib/business-plan-locale";
import {
  INVESTOR_BUSINESS_PLAN_COOKIE,
  parseInvestorBusinessPlanCookie,
  validateInvestorAccessSession,
} from "@/lib/investor-business-plan";
import { investorDeckRelease } from "@/lib/marketing-investor-deck-release";

import { logoutInvestorAccess } from "../../../access/[inviteToken]/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor Deck · Smart Steel Sales",
  description: "Confidential Smart Steel Sales investor deck.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function InvestorDeckPage({
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
          investorDeckRelease.requiredScope,
        )
      : { ok: false as const };

  if (!access.ok) {
    redirect(`/investor/access/${inviteToken}`);
  }

  const baseHref = `/investor/marketing/${inviteToken}/deck`;

  return (
    <div className="min-h-screen bg-[var(--surface-canvas)] text-[var(--text-primary)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-white/95 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <ProductBrand href="/" />
            <Link
              href={`/investor/access/${inviteToken}`}
              className="hidden rounded-full bg-[var(--surface-muted)] px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)] sm:inline-flex"
            >
              Investor Room · {access.label}
            </Link>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)] lg:inline">
              {investorDeckRelease.version}
            </span>
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

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 print:p-0">
        <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[var(--steel-blue-soft)] px-4 py-3 text-xs leading-5 text-[var(--text-secondary)] print:hidden">
          {locale === "it"
            ? "Confidenziale · Release investor-safe. I dati di traction restano pre-lancio e gli screenshot privati MKT6 non sono inclusi finché non superano il Visual QA."
            : "Confidential · Investor-safe release. Traction remains pre-launch and private MKT6 screenshots are excluded until they pass Visual QA."}
        </div>
        <InvestorDeckProduction investorMode locale={locale} />
      </main>
    </div>
  );
}
