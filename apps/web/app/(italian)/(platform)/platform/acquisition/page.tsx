import { notFound } from "next/navigation";
import { AcquisitionFunnelDashboard } from "@/components/acquisition-funnel-dashboard";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import type { FunnelDataset } from "@/lib/seo-growth1c2-funnel-model";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acquisizione organica · Smart Steel Sales", robots: { index: false, follow: false } };

/**
 * Private owner-only workspace. Never supply made-up totals or send GSC/GA4 keys
 * to the browser. Wire server-side aggregate ingestion only after credentials
 * and a verified access policy are provisioned.
 */
export default async function PlatformAcquisitionPage() {
  const context = await requirePlatformConsoleContext();
  if (!context.is_platform_owner) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const dataset: FunnelDataset = {
    startDate: "—", endDate: today, pagePath: "/en/knowledge/tubes",
    gsc: null, ga4: null, events: null,
  };
  return (
    <main className="mx-auto w-full max-w-[1320px] space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#173c32]">Acquisizione e conversioni</h1>
        <p className="mt-1 text-sm text-[#526d5f]">
          Console riservata al proprietario della piattaforma · SEO-GROWTH1C
        </p>
      </div>
      <div role="status" className="rounded-xl border border-[#e2d8b0] bg-[#fffaf0] p-3 text-sm text-[#64542e]">
        Sorgente aggregata non ancora configurata sul server. I valori mancanti non equivalgono a zero.
        Il tracciamento GA4 richiede una verifica live prima dell'uso operativo.
      </div>
      <AcquisitionFunnelDashboard dataset={dataset} />
    </main>
  );
}
