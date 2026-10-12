import { InvestorKpiDashboard } from "@/components/investor-kpi-dashboard";
import { getOwnerInvestorKpiSnapshot } from "@/lib/investor-business-plan";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function PlatformInvestorKpiPage() {
  await requirePlatformSuperadmin();
  const snapshot = await getOwnerInvestorKpiSnapshot();

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="platform-kicker">Strategy & Investors</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
          KPI
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
          Dashboard KPI governata per Platform Owner e investitori autorizzati.
          Le metriche di pre-lancio vengono separate da target e ipotesi, così
          nessun dato di seed o test viene presentato come traction.
        </p>
      </section>

      <InvestorKpiDashboard snapshot={snapshot} locale="it" />
    </div>
  );
}
