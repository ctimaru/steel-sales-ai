import { BusinessPlanTabs } from "@/components/business-plan-tabs";
import { BusinessPlanView } from "@/components/business-plan-view";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function PlatformBusinessPlanDetailsPage() {
  await requirePlatformSuperadmin();

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="platform-kicker">L27.2D · Business Plan v2</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
          Business Plan · Details
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
          Documento analitico completo: ICP, evidenze, packaging, freemium, network economics,
          income streams, unit economics, sensitivity cases e milestone di validazione.
        </p>
      </section>

      <BusinessPlanTabs baseHref={appRoutes.platform.businessPlan} active="details" />

      <BusinessPlanView />
    </div>
  );
}
