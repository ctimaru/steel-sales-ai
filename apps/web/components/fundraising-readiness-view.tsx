import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import {
  getFundraisingReadiness,
  type EvidenceReadiness,
  type ScreenshotReadiness,
} from "@/lib/marketing-fundraising-readiness";

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function readinessClass(value: EvidenceReadiness) {
  if (value === "ready") return "bg-[var(--brand-primary-soft)] text-[var(--brand-deep)]";
  if (value === "partial") return "bg-[var(--steel-blue-soft)] text-[var(--steel-blue)]";
  return "bg-red-50 text-[var(--semantic-error)]";
}

function screenshotClass(value: ScreenshotReadiness) {
  if (value === "approved_for_deck") return "bg-[var(--brand-primary-soft)] text-[var(--brand-deep)]";
  if (value === "candidate") return "bg-[var(--steel-blue-soft)] text-[var(--steel-blue)]";
  return "bg-red-50 text-[var(--semantic-error)]";
}

export function FundraisingReadinessView({
  locale = "it",
}: {
  locale?: BusinessPlanLocale;
}) {
  const data = getFundraisingReadiness(locale);
  const isIt = locale === "it";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] bg-[var(--brand-deep)] text-white">
        <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/85">
                MKT4 · Fundraising Readiness
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
                {isIt ? "Working recommendation" : "Working recommendation"}
              </span>
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-white/60">
              {isIt ? "Seed target" : "Seed target"}
            </p>
            <h1 className="mt-2 text-5xl font-semibold tracking-[-0.055em] sm:text-6xl">
              €1,0M
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/80">
              {isIt
                ? "Target centrale coerente con il modello interno da 24 mesi. Range operativo €0,8M–€1,2M; lead/co-lead target €400k–€700k."
                : "Central target aligned with the internal 24-month model. Operating corridor €0.8M–€1.2M; lead/co-lead target €400k–€700k."}
            </p>
          </div>
          <div className="grid gap-3 self-end sm:grid-cols-2">
            {[
              [isIt ? "Runway target" : "Runway target", `${data.ask.runwayMonths}m`],
              [isIt ? "Core team" : "Core team", String(data.ask.teamSize)],
              [isIt ? "Core burn medio" : "Average core burn", `€${(data.ask.coreBurnMonthly / 1000).toFixed(1)}k/m`],
              [isIt ? "Runway reserve" : "Runway reserve", euro(data.ask.reserve)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{label}</p>
                <p className="mt-2 text-xl font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <article className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
          <p className="app-kicker">{isIt ? "Razionale" : "Rationale"}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {isIt ? "Perché €1M è il working ask" : "Why €1M is the working ask"}
          </h2>
          <ul className="mt-5 space-y-3">
            {data.ask.rationale.map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-6 text-[var(--text-secondary)]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-primary)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-[26px] border border-[var(--border)] bg-[var(--steel-blue-soft)] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--steel-blue)]">
            {isIt ? "Benchmark esterno" : "External benchmark"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {isIt ? "Contesto, non target automatico" : "Context, not an automatic target"}
          </h2>
          <ul className="mt-5 space-y-3">
            {data.ask.benchmarkNotes.map((item) => (
              <li key={item} className="text-sm leading-6 text-[var(--text-secondary)]">• {item}</li>
            ))}
          </ul>
          <p className="mt-5 text-xs leading-5 text-[var(--text-tertiary)]">
            {isIt
              ? "Le mediane non sostituiscono il budget bottom-up. Servono solo a verificare che l'ask non sia fuori mercato."
              : "Medians do not replace a bottom-up budget. They only help verify that the ask is not off-market."}
          </p>
        </article>
      </section>

      <section className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <p className="app-kicker">{isIt ? "Use of funds" : "Use of funds"}</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
          {isIt ? "€1M deve comprare evidence" : "€1M should buy evidence"}
        </h2>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.useOfFunds.map((item) => (
            <article key={item.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{item.label}</p>
                <p className="text-lg font-semibold text-[var(--brand-deep)]">{item.percent}%</p>
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{euro(item.amount)}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.purpose}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <p className="app-kicker">{isIt ? "Milestone contract" : "Milestone contract"}</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
          {isIt ? "Cosa il round deve dimostrare" : "What the round must prove"}
        </h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {data.milestonePhases.map((phase) => (
            <article key={phase.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--steel-blue)]">{phase.window}</p>
              <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{phase.title}</h3>
              <ul className="mt-4 space-y-2">
                {phase.targets.map((target) => (
                  <li key={target} className="text-sm leading-6 text-[var(--text-secondary)]">• {target}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-kicker">Evidence Pack</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {isIt ? "Readiness slide-by-slide" : "Slide-by-slide readiness"}
            </h2>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            {isIt ? "Ready ≠ traction: significa solo evidence sufficiente per quella tesi." : "Ready ≠ traction: it only means sufficient evidence for that thesis."}
          </p>
        </div>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="min-w-[980px] w-full border-collapse text-left">
            <thead className="bg-[var(--surface-muted)]">
              <tr className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                <th className="px-4 py-3">Slide</th>
                <th className="px-4 py-3">Readiness</th>
                <th className="px-4 py-3">Claim</th>
                <th className="px-4 py-3">Evidence</th>
                <th className="px-4 py-3">Gap / next</th>
              </tr>
            </thead>
            <tbody>
              {data.evidencePack.map((item) => (
                <tr key={item.key} className="border-t border-[var(--border)] align-top">
                  <td className="px-4 py-4">
                    <p className="text-xs font-bold text-[var(--steel-blue)]">{String(item.slide).padStart(2, "0")}</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{item.title}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${readinessClass(item.readiness)}`}>
                      {item.readiness}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold uppercase text-[var(--text-secondary)]">{item.claimStatus}</td>
                  <td className="px-4 py-4 text-xs leading-5 text-[var(--text-secondary)]">
                    {item.evidence.map((e) => <div key={e}>• {e}</div>)}
                  </td>
                  <td className="px-4 py-4 text-xs leading-5 text-[var(--text-secondary)]">
                    <p>{item.gap}</p>
                    <p className="mt-2 font-semibold text-[var(--text-primary)]">→ {item.nextAction}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[26px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <p className="app-kicker">{isIt ? "Screenshot Approval Matrix" : "Screenshot Approval Matrix"}</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
          {isIt ? "Nessuno screenshot viene approvato alla cieca" : "No screenshot is approved blindly"}
        </h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--text-secondary)]">
          {isIt
            ? "MKT4 definisce i candidati e il gate. L'approvazione per il deck richiede visual QA desktop/mobile e dataset demo non sensibili."
            : "MKT4 defines the candidates and the gate. Deck approval requires desktop/mobile visual QA and non-sensitive demo data."}
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.screenshots.map((item) => (
            <article key={item.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${screenshotClass(item.readiness)}`}>
                  {item.readiness.replaceAll("_", " ")}
                </span>
                <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 font-mono text-[9px] text-[var(--text-secondary)]">
                  {item.surface}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{item.title}</h3>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.gate}</p>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                Slides · {item.slideTargets.join(", ")}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[26px] border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-900">
          {isIt ? "Fundraising boundary" : "Fundraising boundary"}
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-950">
          {isIt
            ? "€1M è una working recommendation approvata per la readiness, non un termine finanziario firmato. Valuation, dilution, security type, liquidation preference e closing structure restano fuori da MKT4."
            : "€1M is an approved working recommendation for readiness, not a signed financing term. Valuation, dilution, security type, liquidation preference and closing structure remain outside MKT4."}
        </p>
      </section>
    </div>
  );
}
