import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { mkt9DeckSlides } from "@/lib/mkt9-investor-deck-candidate";

const labels = {
  it: { fact: "Fatto", hypothesis: "Ipotesi", target: "Obiettivo", candidate: "Anteprima riservata · non pubblicata", progress: "Avanzamento verso l'obiettivo Italia" },
  en: { fact: "Fact", hypothesis: "Hypothesis", target: "Target", candidate: "Private preview · not released", progress: "Progress towards the Italian target" },
} as const;

const allocation = [58.5, 10, 9.5, 4.5, 2, 2.5, 13] as const;

/** Owner preview only. No tenant data, external calls, invite tokens or internal evidence pack. */
export function Mkt9InvestorDeckCandidate({ locale }: { locale: BusinessPlanLocale }) {
  const label = labels[locale];
  return (
    <div className="space-y-6 print:space-y-0" data-testid="mkt9-investor-deck-candidate">
      {mkt9DeckSlides.map((slide) => {
        const copy = slide[locale];
        const dark = slide.layout === "hero" || slide.layout === "funding";
        return (
          <section
            key={slide.number}
            aria-labelledby={`mkt9-slide-${slide.number}`}
            data-slide={slide.number}
            data-claim-status={slide.status}
            className={`relative isolate flex w-full min-w-0 flex-col gap-5 overflow-hidden rounded-2xl border p-4 sm:gap-6 sm:p-8 lg:min-h-[min(50vw,680px)] lg:p-10 print:break-after-page print:rounded-none ${dark ? "border-[var(--brand-deep)] bg-[var(--brand-deep)] text-white" : "border-[var(--border)] bg-[var(--surface-base)] text-[var(--text-primary)]"}`}
          >
            {slide.layout === "hero" ? (
              <svg aria-hidden="true" viewBox="0 0 400 220" className="pointer-events-none absolute right-0 top-0 -z-10 w-2/3 opacity-20" fill="none" stroke="currentColor" strokeWidth="1">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                  <g key={i} transform={`translate(${i * 44} ${i % 2 * 34})`}>
                    <path d="M10 125 L95 76 L95 23 L10 72 Z M10 72 L40 89 L125 40 L95 23 M40 89 L40 142 L125 93 L125 40 M10 125 L40 142" />
                    <path d="M19 77 L31 84 L31 123 L19 116 Z" />
                  </g>
                ))}
              </svg>
            ) : null}
            <header className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`text-xs font-semibold uppercase tracking-widest ${dark ? "text-white" : "text-[var(--brand-deep)]"}`}>
                  SSS / {String(slide.number).padStart(2, "0")} — 14
                </p>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${dark ? "border-white/40 text-white" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>{label[slide.status]}</span>
              </div>
              <h2 id={`mkt9-slide-${slide.number}`} className="mt-4 max-w-5xl break-words text-2xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{copy.title}</h2>
              <p className={`mt-3 max-w-4xl text-sm leading-relaxed sm:text-base ${dark ? "text-white" : "text-[var(--text-secondary)]"}`}>{copy.lead}</p>
            </header>

            <div className="flex flex-1 flex-col justify-center gap-4">
              {slide.layout === "coverage" ? (
                <div className="space-y-4 rounded-xl border border-[var(--border)] p-4 sm:p-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {copy.cards.map((card) => (
                      <div key={card.title}>
                        <p className="text-3xl font-semibold tracking-tight text-[var(--brand-deep)] sm:text-5xl">{card.title}</p>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">{card.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                    <span>{label.progress}</span><span>{locale === "it" ? "18,1%" : "18.1%"}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="progressbar" aria-label={label.progress} aria-valuemin={0} aria-valuemax={15000} aria-valuenow={2718}>
                    <div className="h-full w-[18.12%] rounded-full bg-[var(--brand-deep)]" />
                  </div>
                </div>
              ) : slide.layout === "funding" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {copy.cards.map((card, i) => (
                    <div key={card.title} className="rounded-xl border border-white/25 bg-white/[0.06] p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-medium">{card.title}</span><strong>{card.body}</strong>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
                        <div className="h-full rounded-full bg-white" style={{ width: `${allocation[i]}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`grid min-w-0 gap-3 ${copy.cards.length === 6 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-3"}`}>
                  {copy.cards.map((card, i) => (
                    <div key={card.title} className={`min-w-0 rounded-xl border p-4 sm:p-5 ${dark ? "border-white/30 bg-white/[0.08]" : "border-[var(--border)] bg-[var(--surface-subtle)]"}`}>
                      {slide.layout === "flow" || slide.layout === "hero" ? (
                        <p aria-hidden="true" className={`mb-3 text-xs font-semibold tracking-widest ${dark ? "text-white" : "text-[var(--brand-deep)]"}`}>{String(i + 1).padStart(2, "0")}</p>
                      ) : null}
                      <h3 className="break-words text-base font-semibold sm:text-lg">{card.title}</h3>
                      <p className={`mt-2 break-words text-sm leading-relaxed ${dark ? "text-white" : "text-[var(--text-secondary)]"}`}>{card.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <footer className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-t pt-3 text-xs leading-relaxed ${dark ? "border-white/30 text-white" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>
              <span className="font-semibold">MKT9.A · {label.candidate}</span>
              <span className="min-w-0 break-words">{copy.footer}</span>
            </footer>
          </section>
        );
      })}
    </div>
  );
}
