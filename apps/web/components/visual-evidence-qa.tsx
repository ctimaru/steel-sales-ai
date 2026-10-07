import Link from "next/link";

import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { getFundraisingReadiness } from "@/lib/marketing-fundraising-readiness";

function readinessClass(value: string) {
  if (value === "approved_for_deck") return "bg-[var(--brand-primary-soft)] text-[var(--brand-deep)]";
  if (value === "approved_desktop") return "bg-[var(--steel-blue-soft)] text-[var(--steel-blue)]";
  if (value === "blocked") return "bg-red-50 text-[var(--semantic-error)]";
  return "bg-[var(--surface-muted)] text-[var(--text-secondary)]";
}

export function VisualEvidenceQa({
  locale = "it",
}: {
  locale?: BusinessPlanLocale;
}) {
  const data = getFundraisingReadiness(locale);
  const isIt = locale === "it";
  const approved = data.screenshots.filter((item) => item.readiness === "approved_for_deck").length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Approved</p>
          <p className="mt-2 text-4xl font-semibold text-[var(--brand-deep)]">{approved}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Candidate</p>
          <p className="mt-2 text-4xl font-semibold text-[var(--steel-blue)]">
            {data.screenshots.filter((item) => item.readiness === "candidate").length}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Mobile</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--semantic-warning)]">
            {isIt ? "Non verificato" : "Not verified"}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
        <div className="max-w-4xl">
          <p className="app-kicker">MKT5 · Visual Evidence QA</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {isIt ? "Screenshot reali, non decorativi" : "Real screenshots, not decoration"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {isIt
              ? "Home e Scuola hanno superato il QA live desktop del 7 ottobre 2026. Le superfici private restano candidate finché non vengono verificate in sessione autenticata con dati demo-safe."
              : "Home and School passed live desktop QA on October 7, 2026. Private surfaces remain candidates until verified in an authenticated session with demo-safe data."}
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.screenshots.map((item) => (
            <article key={item.key} className="flex min-h-64 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${readinessClass(item.readiness)}`}>
                  {item.readiness.replaceAll("_", " ")}
                </span>
                <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 font-mono text-[9px] text-[var(--text-secondary)]">
                  {item.surface}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">{item.title}</h3>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{item.gate}</p>
              <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-base)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  {isIt ? "QA note" : "QA note"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{item.qaNote}</p>
              </div>
              <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
                  Slides · {item.slideTargets.join(", ")}
                </p>
                {item.readiness === "approved_for_deck" ? (
                  <Link
                    href={item.surface}
                    className="text-xs font-semibold text-[var(--brand-deep)] underline decoration-[var(--brand-primary-soft)] underline-offset-4"
                  >
                    {isIt ? "Apri live" : "Open live"}
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-900">
          {isIt ? "Limite MKT5" : "MKT5 boundary"}
        </p>
        <p className="mt-2 text-sm leading-6 text-amber-950">
          {isIt
            ? "L'approvazione riguarda il visual desktop e il suo uso nel deck. Mobile resta non verificato e nessuna superficie privata viene promossa sulla base del solo codice."
            : "Approval covers the desktop visual and its use in the deck. Mobile remains unverified and no private surface is promoted based on code inspection alone."}
        </p>
      </section>
    </div>
  );
}
