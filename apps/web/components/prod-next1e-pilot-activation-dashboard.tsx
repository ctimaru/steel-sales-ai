import Link from "next/link";

import {
  PILOT_2027_METRICS,
  PILOT_2027_REAL_METRICS_ENABLED,
  type PilotAdmissionCheck,
} from "@/lib/prod-next1e-pilot-readiness";

export type PilotActivationCandidate = {
  label: string;
  role: string;
  status: string;
  admitted: boolean;
  checks: PilotAdmissionCheck[];
};

export function ProdNext1ePilotActivationDashboard({
  companies,
}: {
  companies: PilotActivationCandidate[];
}) {
  const admitted = companies.filter(company => company.admitted).length;
  const blocked = companies.filter(company => !company.admitted).length;

  return (
    <section
      aria-labelledby="prod-next1e-title"
      data-testid="prod-next1e-readiness-dashboard"
      className="rounded-3xl border border-[#cdded5] bg-white p-5 shadow-[0_8px_32px_rgba(19,68,49,0.06)] sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#28604d]">
            PROD-NEXT1.E · Launch 2027
          </p>
          <h2 id="prod-next1e-title" className="mt-1 text-xl font-semibold tracking-tight text-[#173f35] sm:text-2xl">
            Pilot Activation Readiness
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#55675e]">
            Ammissione aziendale, consenso e sicurezza sono distinti dalla readiness
            tecnica. Il consenso per le misure commerciali è separato dai cookie pubblici:
            finché non è registrato e verificabile per utente, nessun evento reale viene raccolto.
          </p>
        </div>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
          Real activation: NON ABILITATA
        </span>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {([
          ["Aziende in valutazione", companies.length],
          ["Ammissioni approvate", admitted],
          ["Con blocchi di ammissione", blocked],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#dce8e0] bg-[#f7faf8] px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-[#1a5144]">{value.toLocaleString("it-IT")}</p>
            <p className="mt-0.5 text-xs text-[#617268]">{label}</p>
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-semibold text-[#173f35]">Cinque metriche commerciali · pilot opt-in</h3>
      <p className="mt-1 text-xs leading-5 text-[#5e6f65]">
        Nessun valore zero inventato: il motore di misurazione delle conversioni reali
        non è attivo. Le prove Chrome sintetiche restano nei report GitHub separati.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {PILOT_2027_METRICS.map(metric => (
          <div key={metric.key} className="rounded-2xl border border-[#dbe5df] bg-white p-3.5">
            <p className="text-[11px] font-semibold leading-4 text-[#2c5243]">{metric.label}</p>
            <p className="mt-3 text-xl font-medium tabular-nums text-[#6e8176]" aria-label="Non misurato">
              —
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-[#7c8b82]">NON MISURATO</p>
            <p className="mt-2 text-xs leading-5 text-[#62736a]">{metric.detail}</p>
          </div>
        ))}
      </div>

      {PILOT_2027_REAL_METRICS_ENABLED ? null : (
        <p role="status" className="mt-3 rounded-xl border border-[#d6e3d9] bg-[#f4f8f5] px-3 py-2 text-xs text-[#315745]">
          Raccolta eventi reali disattivata nel codice. Cookie consent o GA4 non
          autorizzano automaticamente il tracciamento delle azioni private.
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold text-[#173f35]">Gate di ammissione per azienda</h3>
      {companies.length === 0 ? (
        <p className="mt-2 rounded-xl border border-[#e0e8e2] bg-[#f7faf8] p-4 text-sm text-[#617268]">
          Nessuna azienda selezionata. Il pilot rimane inattivo.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {companies.map(company => (
            <div key={company.label} className="rounded-2xl border border-[#dfe8e1] p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[#173f35]">{company.label}</p>
                  <p className="text-xs text-[#6c7c72]">{company.role} · {company.status}</p>
                </div>
                <span className={company.admitted
                  ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
                  : "rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"}>
                  {company.admitted ? "Ammissione OK" : "NO-GO"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {company.checks.map(check => (
                  <span key={check.key} title={check.label} className={check.passed
                    ? "rounded-md bg-[#edf5f0] px-2 py-1 text-[11px] text-[#1d6045]"
                    : "rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-[11px] text-[#82571d]"}>
                    {check.passed ? "✓ " : "· "}{check.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2eae5] pt-4 text-xs text-[#69796f]">
        <p>Le approvazioni vanno documentate e devono scadere. La pausa e la rimozione rimangono disponibili durante il NO-GO.</p>
        <Link href="/platform/product-analytics" className="font-semibold text-[#1a5144] underline-offset-4 hover:underline">
          Analytics generali (separati)
        </Link>
      </div>
    </section>
  );
}
