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
        {activation !== null ? (
          <div className="mt-5 border-t border-[#e0e8e3] pt-4">
            <h3 className="text-sm font-bold text-[#173f35]">Priorità operative · acquisizione → attivazione</h3>
            <p className="mt-1 text-xs leading-5 text-[#66736e]">
              Indicazioni basate sulla coda attuale, non su attribuzione utenti o tassi di conversione fra sistemi.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#dfe8e2] bg-[#f8faf9] p-4">
                <p className="text-sm font-bold text-[#174b37]">
                  {activation.ready > 0 ? "Attivazioni da completare" : "Nessuna attivazione in attesa"}
                </p>
                <p className="mt-1 text-xs text-[#52615b]">
                  {activation.ready > 0
                    ? `${activation.ready} pratiche pronte richiedono un intervento operativo.`
                    : "La coda non segnala pratiche pronte per l'attivazione."}
                </p>
                <Link href="/platform/registrations?status=approved"
                  className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-[#176647] underline underline-offset-4">
                  Apri pratiche approvate →
                </Link>
              </div>
              <div className="rounded-xl border border-[#dfe8e2] bg-[#f8faf9] p-4">
                <p className="text-sm font-bold text-[#174b37]">Monitoraggio acquisizione</p>
                <p className="mt-1 text-xs text-[#52615b]">
                  {snapshot.calculatorFunnelQuality.state === "unavailable"
                    ? "I dati Web Analytics non sono affidabili: verifica la raccolta prima di dedurre tendenze."
                    : snapshot.calculatorFunnelQuality.state === "awaiting_events"
                      ? "Nessun evento del nuovo funnel rilevato nel periodo: controlla consenso, traffico e rilascio."
                      : "Eventi del calcolatore osservati. Confronta i trend nel tempo; registrazioni e attivazioni restano indipendenti."}
                </p>
                <Link href="/platform/registrations"
                  className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-[#176647] underline underline-offset-4">
                  Apri tutte le registrazioni →
                </Link>
              </div>
            </div>
            <p className="mt-3 text-xs text-[#718078]">
              Le pratiche totali includono anche bozze e rifiuti; le approvate e le attivate sono stati distinti.
              Non dividere attivazioni per visite o clic: periodi e popolazioni non coincidono.
            </p>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-[#718078]">
          Fonte: RPC di governance già autorizzate per la piattaforma. L'attivazione indica lo stato della pratica,
          non prova di utilizzo continuativo del prodotto; nessun dato identificativo viene mostrato.
        </p>
      </section>
    </div>
  );
}
