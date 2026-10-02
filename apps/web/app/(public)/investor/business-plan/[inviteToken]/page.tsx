import type { Metadata } from "next";
import { cookies } from "next/headers";

import { BusinessPlanView } from "@/components/business-plan-view";
import { ProductBrand } from "@/components/product-brand";
import {
  INVESTOR_BUSINESS_PLAN_COOKIE,
  parseInvestorBusinessPlanCookie,
  validateInvestorBusinessPlanSession,
} from "@/lib/investor-business-plan";

import {
  loginInvestorBusinessPlan,
  logoutInvestorBusinessPlan,
} from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor Business Plan · Smart Steel Sales",
  description: "Confidential Smart Steel Sales investor Business Plan.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default async function InvestorBusinessPlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ inviteToken: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { inviteToken } = await params;
  const { error } = await searchParams;
  const cookieStore = await cookies();
  const parsed = parseInvestorBusinessPlanCookie(
    cookieStore.get(INVESTOR_BUSINESS_PLAN_COOKIE)?.value,
  );

  const access =
    parsed?.shareToken === inviteToken
      ? await validateInvestorBusinessPlanSession(
          inviteToken,
          parsed.sessionToken,
        )
      : { ok: false as const };

  if (!access.ok) {
    return (
      <main className="min-h-screen bg-[#edf1ef] px-4 py-8 text-[#1d2824] sm:px-6 sm:py-12">
        <div className="mx-auto max-w-lg">
          <div className="rounded-[30px] border border-[#dce2df] bg-white p-6 shadow-[0_22px_70px_rgba(18,61,52,0.12)] sm:p-8">
            <ProductBrand href="/" />
            <div className="mt-8">
              <span className="rounded-full bg-[#e1ece8] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#173f35]">
                Confidential investor room
              </span>
              <h1 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-[#1d2824]">
                Smart Steel Sales · Business Plan
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#66736e]">
                Questa area è riservata agli investitori invitati. Inserisci la password dedicata ricevuta separatamente dal link.
              </p>
            </div>

            {error ? (
              <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <form action={loginInvestorBusinessPlan} className="mt-6 space-y-4">
              <input type="hidden" name="invite_token" value={inviteToken} />
              <label className="block">
                <span className="text-xs font-semibold text-[#52615b]">Password investor</span>
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-1.5 h-12 w-full rounded-xl border border-[#cfd9d5] bg-white px-4 text-base"
                />
              </label>
              <button className="min-h-12 w-full rounded-xl bg-[#123d34] px-4 text-sm font-semibold text-white hover:bg-[#1a5144]">
                Apri Business Plan
              </button>
            </form>

            <p className="mt-5 text-xs leading-5 text-[#87938e]">
              Sessione temporanea e revocabile. Il link non consente accesso alla Platform Console o ai dati privati delle aziende.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <header className="sticky top-0 z-20 border-b border-[#dce2df] bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <ProductBrand href="/" />
            <span className="hidden rounded-full bg-[#f2f4f3] px-3 py-1 text-[11px] font-semibold text-[#66736e] sm:inline-flex">
              Investor Room · {access.label}
            </span>
          </div>
          <form action={logoutInvestorBusinessPlan}>
            <input type="hidden" name="invite_token" value={inviteToken} />
            <button className="rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#52615b] hover:bg-[#f4f7f5]">
              Chiudi sessione
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <BusinessPlanView investorMode />
        <p className="mx-auto mt-8 max-w-4xl text-center text-xs leading-5 text-[#87938e]">
          Confidential · Smart Steel Sales · Working business-plan material. Figures and hypotheses are explicitly marked until validated.
        </p>
      </main>
    </div>
  );
}
