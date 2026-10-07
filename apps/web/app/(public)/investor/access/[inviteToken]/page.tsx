import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { ProductBrand } from "@/components/product-brand";
import {
  INVESTOR_BUSINESS_PLAN_COOKIE,
  parseInvestorBusinessPlanCookie,
  validateInvestorAccessSession,
} from "@/lib/investor-business-plan";

import { loginInvestorAccess, logoutInvestorAccess } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Investor Room · Smart Steel Sales",
  description: "Confidential Smart Steel Sales investor room.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default async function InvestorAccessPage({
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
      ? await validateInvestorAccessSession(inviteToken, parsed.sessionToken)
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
                Smart Steel Sales · Investor Access
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#66736e]">
                Inserisci la password dedicata ricevuta separatamente dal link.
                Dopo l&apos;accesso vedrai soltanto le sezioni condivise con il tuo invito.
              </p>
            </div>

            {error ? (
              <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <form action={loginInvestorAccess} className="mt-6 space-y-4">
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
              <button className="platform-primary min-h-12 w-full rounded-xl px-4 text-sm font-semibold">
                Apri Investor Room
              </button>
            </form>

            <p className="mt-5 text-xs leading-5 text-[#87938e]">
              Sessione temporanea e revocabile. Il link non consente accesso alla
              Platform Console o ai dati privati delle aziende.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f4f3] text-[#1d2824]">
      <header className="border-b border-[#dce2df] bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <ProductBrand href="/" />
            <span className="hidden rounded-full bg-[#f2f4f3] px-3 py-1 text-[11px] font-semibold text-[#66736e] sm:inline-flex">
              Investor Room · {access.label}
            </span>
          </div>
          <form action={logoutInvestorAccess}>
            <input type="hidden" name="invite_token" value={inviteToken} />
            <button className="rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-xs font-semibold text-[#52615b] hover:bg-[#f4f7f5]">
              Chiudi sessione
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Investor Room</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#1d2824]">
          Smart Steel Sales
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66736e]">
          Seleziona una delle sezioni condivise con questo invito.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {access.scopes.includes("business_plan") ? (
            <Link
              href={`/investor/business-plan/${inviteToken}?lang=en`}
              className="rounded-[26px] border border-[#dce2df] bg-white p-6 transition hover:border-[#b9cec6] hover:shadow-[0_12px_40px_rgba(18,61,52,0.08)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Business Plan</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Highlights + Details</h2>
              <p className="mt-3 text-sm leading-6 text-[#66736e]">
                Network thesis, target market, monetization, economics, risks and milestones.
              </p>
            </Link>
          ) : null}

          {access.scopes.includes("marketing") ? (
            <Link
              href={`/investor/marketing/${inviteToken}/deck?lang=en`}
              className="rounded-[26px] border border-[#b8d2c8] bg-[#123d34] p-6 text-white transition hover:-translate-y-0.5 hover:shadow-[0_16px_44px_rgba(18,61,52,0.18)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">Investor Deck</p>
              <h2 className="mt-2 text-2xl font-semibold">14-slide Investor Release</h2>
              <p className="mt-3 text-sm leading-6 text-[#d8e5e0]">
                Product thesis, market, moat, execution, evidence gates, roadmap and €1M working Seed ask.
              </p>
            </Link>
          ) : null}

          {access.scopes.includes("marketing") ? (
            <Link
              href={`/investor/marketing/${inviteToken}?lang=en`}
              className="rounded-[26px] border border-[#dce2df] bg-white p-6 transition hover:border-[#b9cec6] hover:shadow-[0_12px_40px_rgba(18,61,52,0.08)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">Marketing & Brand</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Brand System + Messaging</h2>
              <p className="mt-3 text-sm leading-6 text-[#66736e]">
                Positioning, accessible color system, communication principles and investor-facing brand rationale.
              </p>
            </Link>
          ) : null}

          {access.scopes.includes("kpi") ? (
            <Link
              href={`/investor/kpi/${inviteToken}`}
              className="rounded-[26px] border border-[#dce2df] bg-white p-6 transition hover:border-[#b9cec6] hover:shadow-[0_12px_40px_rgba(18,61,52,0.08)]"
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">KPI</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#1d2824]">Investor KPI Dashboard</h2>
              <p className="mt-3 text-sm leading-6 text-[#66736e]">
                Pre-launch baseline, network indicators, monetization targets and evidence status.
              </p>
            </Link>
          ) : null}
        </div>
      </main>
    </div>
  );
}
