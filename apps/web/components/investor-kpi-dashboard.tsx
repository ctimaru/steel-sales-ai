import type {
  InvestorKpiMetric,
  InvestorKpiSnapshot,
} from "@/lib/investor-business-plan";

function statusLabel(status: InvestorKpiMetric["status"], locale: "it" | "en") {
  if (status === "measured_prelaunch") {
    return locale === "it" ? "Misurato · pre-lancio" : "Measured · pre-launch";
  }
  if (status === "target") {
    return locale === "it" ? "Target" : "Target";
  }
  return locale === "it" ? "Ipotesi" : "Hypothesis";
}

function metricLabel(metric: InvestorKpiMetric, locale: "it" | "en") {
  const translations: Record<string, string> = {
    network_profiles: "Profili Network seeded/discovered",
    published_network_profiles: "Profili Network pubblicati",
    approved_claims: "Company claim approvati",
    verified_companies: "Aziende verificate correnti",
    marketplace_requests: "Richieste Marketplace",
    marketplace_responses: "Risposte Marketplace",
    marketplace_pilot_participants: "Partecipanti pilot Marketplace",
    network_activity_events: "Eventi canonici Network",
    activated_orgs: "Aziende attivate",
    self_service_payers: "Aziende paganti self-service",
    retained_60d: "Paganti retained a 60 giorni",
    paid_attach: "Activated-to-paid attach",
    free_cost: "Costo variabile azienda free",
    blended_variable_cost: "Costo variabile blended",
  };
  return locale === "it" ? translations[metric.key] ?? metric.label : metric.label;
}

function MetricCard({
  metric,
  locale,
}: {
  metric: InvestorKpiMetric;
  locale: "it" | "en";
}) {
  const measured = metric.status === "measured_prelaunch";
  const hypothesis = metric.status === "hypothesis";

  return (
    <article className="rounded-2xl border border-[#e0e6e3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className={[
            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
            measured
              ? "bg-[#e1ece8] text-[#173f35]"
              : hypothesis
                ? "bg-amber-50 text-amber-800"
                : "bg-[#f2f4f3] text-[#596761]",
          ].join(" ")}
        >
          {statusLabel(metric.status, locale)}
        </span>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-[#173f35]">
        {metric.value}
      </p>
      <h3 className="mt-2 text-sm font-semibold text-[#1d2824]">
        {metricLabel(metric, locale)}
      </h3>
      <p className="mt-3 text-xs leading-5 text-[#66736e]">{metric.note}</p>
    </article>
  );
}

export function InvestorKpiDashboard({
  snapshot,
  locale = "it",
  investorMode = false,
}: {
  snapshot: InvestorKpiSnapshot;
  locale?: "it" | "en";
  investorMode?: boolean;
}) {
  const asOf = new Date(snapshot.as_of).toLocaleString(
    locale === "it" ? "it-IT" : "en-GB",
    { dateStyle: "medium", timeStyle: "short" },
  );

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] bg-[#123d34] p-6 text-white sm:p-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#dcebe6]">
                Smart Steel Sales · KPI
              </span>
              <span className="rounded-full bg-[#d7a45b]/15 px-3 py-1.5 text-[11px] font-bold text-[#f2cf9c] ring-1 ring-[#d7a45b]/30">
                {locale === "it" ? "Pre-lancio" : "Pre-launch"}
              </span>
              {investorMode ? (
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80">
                  {locale === "it" ? "Vista investor" : "Investor view"}
                </span>
              ) : null}
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              {locale === "it" ? "Investor KPI Dashboard" : "Investor KPI Dashboard"}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d8e5e0]">
              {locale === "it"
                ? "Baseline operativa, target product-led e ipotesi economiche sono separati per evitare di confondere attività di pre-lancio con traction."
                : "Operational baseline, product-led targets and economic hypotheses are separated so pre-launch activity is never presented as traction."}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs text-[#d8e5e0]">
            <span className="block font-bold uppercase tracking-[0.1em] text-[#9cc5b7]">
              {locale === "it" ? "Aggiornato" : "As of"}
            </span>
            <span className="mt-1 block font-semibold text-white">{asOf}</span>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-[#f8faf9] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#1a5144]">
          {locale === "it" ? "Baseline misurata" : "Measured baseline"}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
          {locale === "it"
            ? "Cosa esiste oggi nella piattaforma"
            : "What currently exists in the platform"}
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66736e]">
          {locale === "it"
            ? "Sono metriche reali del database di pre-lancio, ma non rappresentano ancora utenti attivi, clienti o product-market fit."
            : "These are real pre-launch database metrics, but they do not yet represent active users, customers or product-market fit."}
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {snapshot.measured.map((metric) => (
            <MetricCard key={metric.key} metric={metric} locale={locale} />
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#1a5144]">
          {locale === "it" ? "Gate Launch 2027" : "Launch 2027 gates"}
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
          {locale === "it"
            ? "Target e ipotesi da trasformare in evidenza"
            : "Targets and hypotheses to convert into evidence"}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {snapshot.targets.map((metric) => (
            <MetricCard key={metric.key} metric={metric} locale={locale} />
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-dashed border-[#b8d2c8] bg-[#edf5f2] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
          {locale === "it" ? "Regola investor" : "Investor rule"}
        </p>
        <p className="mt-2 text-sm leading-6 text-[#52615b]">
          {locale === "it"
            ? "MAO, MAU, paid attach, retention e revenue/MAO verranno mostrati come Measured soltanto quando la relativa telemetria di produzione sarà disponibile. Nessun target viene promosso automaticamente a traction."
            : "MAO, MAU, paid attach, retention and revenue/MAO become Measured only when the corresponding production telemetry exists. No target is automatically promoted to traction."}
        </p>
      </section>
    </div>
  );
}
