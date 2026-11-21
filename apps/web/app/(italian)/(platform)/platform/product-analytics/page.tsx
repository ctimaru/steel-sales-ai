import Link from "next/link";
import { appRoutes } from "@/lib/routes";

import { ProductAnalyticsDashboard } from "@/components/product-analytics-dashboard";
import { getPlatformAnalyticsSnapshot } from "@/lib/platform-product-analytics";
import { getRegistrationQueue, requirePlatformSuperadmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

export default async function PlatformProductAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requirePlatformSuperadmin();
  const { range } = await searchParams;
  const [snapshot, activation] = await Promise.all([
    getPlatformAnalyticsSnapshot(range),
    Promise.all([
      getRegistrationQueue(null, null),
      getRegistrationQueue("approved", null),
      getRegistrationQueue("activated", null),
    ]).then(([all, approved, activated]) => ({
      total: all.total,
      approved: approved.total,
      activated: activated.total,
      last7d: all.summary.activated_last_7d,
      ready: all.summary.ready_activation,
    })).catch(() => null),
  ]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-wrap justify-end">
        <Link href="/platform/acquisition" className="inline-flex min-h-11 items-center rounded-xl border border-[#c7d8ce] bg-white px-4 text-sm font-semibold text-[#175640] hover:bg-[#f1f7f3] focus-visible:outline-2 focus-visible:outline-offset-2">
          Acquisizione Google e funnel →
        </Link>
        <Link href={appRoutes.platform.feedInsights} className="inline-flex min-h-11 items-center rounded-xl border border-[#c7d8ce] bg-white px-4 text-sm font-semibold text-[#175640] hover:bg-[#f1f7f3] focus-visible:outline-2 focus-visible:outline-offset-2">
          DASH-FEED7 · Engagement e retention →
        </Link>
      </div>
      <ProductAnalyticsDashboard snapshot={snapshot} />
      <section aria-labelledby="real-company-activation" className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">CALC-UX3.7 · Fonte canonica Supabase</p>
        <h2 id="real-company-activation" className="mt-2 text-xl font-semibold text-[#173f35]">Registrazioni e attivazioni aziendali reali</h2>
        <p className="mt-2 text-xs leading-5 text-[#52615b]">
          Conteggi dello stato attuale delle pratiche aziendali, indipendenti dai clic Analytics e dal periodo 24h/7g/30g.
          Le attivazioni degli ultimi 7 giorni sono una misura distinta. Nessuna attribuzione individuale al calcolatore.
        </p>
        {activation === null ? (
          <p role="status" className="mt-4 rounded-xl bg-[#fff5ec] p-4 text-sm text-[#865320]">
            Stato registrazioni non disponibile: impossibile leggere la coda canonica. Nessun valore zero viene ipotizzato.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {([
              ["Pratiche totali", activation.total],
              ["Approvate, non attivate", activation.approved],
              ["Attivate totali", activation.activated],
              ["Attivate negli ultimi 7 giorni", activation.last7d],
              ["Da attivare", activation.ready],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[#dfe8e2] bg-[#f8faf9] p-4">
                <p className="text-2xl font-bold tabular-nums text-[#174b37]">{value.toLocaleString("it-IT")}</p>
                <p className="mt-1 text-xs font-semibold text-[#52615b]">{label}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-[#718078]">
          Fonte: RPC di governance già autorizzate per la piattaforma. L'attivazione indica lo stato della pratica,
          non prova di utilizzo continuativo del prodotto; nessun dato identificativo viene mostrato.
        </p>
      </section>
    </div>
  );
}
