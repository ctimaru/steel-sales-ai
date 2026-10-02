import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { InvestorKpiDashboard } from "@/components/investor-kpi-dashboard";
import { ProductBrand } from "@/components/product-brand";
import {
  INVESTOR_BUSINESS_PLAN_COOKIE,
  getInvestorKpiSnapshot,
  parseInvestorBusinessPlanCookie,
} from "@/lib/investor-business-plan";

import { logoutInvestorAccess } from "../../access/[inviteToken]/actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor KPI · Smart Steel Sales",
  description: "Confidential Smart Steel Sales investor KPI dashboard.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export default async function InvestorKpiPage({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  const { inviteToken } = await params;
  const cookieStore = await cookies();
  const parsed = parseInvestorBusinessPlanCookie(
    cookieStore.get(INVESTOR_BUSINESS_PLAN_COOKIE)?.value,
  );

  if (!parsed || parsed.shareToken !== inviteToken) {
    redirect(`/investor/access/${inviteToken}`);
  }

  const access = await getInvestorKpiSnapshot(inviteToken, parsed.sessionToken);
  if (!access.ok) {
    redirect(`/investor/access/${inviteToken}`);
  }

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
          <form action={logoutInvestorAccess}>
            <input type="hidden" name="invite_token" value={inviteToken} />
            <button className="rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#52615b] hover:bg-[#f4f7f5]">
              Close session
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <InvestorKpiDashboard snapshot={access.snapshot} locale="en" investorMode />
      </main>
    </div>
  );
}
