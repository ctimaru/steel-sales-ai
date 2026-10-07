import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { getPitchDeckSlides, type ClaimStatus } from "@/lib/marketing-fundraising-assets";

function statusLabel(status: ClaimStatus, locale: BusinessPlanLocale) {
  const labels = {
    it: { fact: "FACT", estimate: "ESTIMATE", hypothesis: "HYPOTHESIS", target: "TARGET" },
    en: { fact: "FACT", estimate: "ESTIMATE", hypothesis: "HYPOTHESIS", target: "TARGET" },
  } as const;
  return labels[locale][status];
}

export function PitchDeckFoundation({ locale = "it" }: { locale?: BusinessPlanLocale }) {
  const slides = getPitchDeckSlides(locale);

  return (
    <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-base)] p-6 sm:p-8">
      <div className="max-w-4xl">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--brand-primary-soft)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand-deep)]">
            MKT3 · Pitch Deck Foundation
          </span>
          <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            Internal only
          </span>
        </div>
        <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
          {locale === "it" ? "Struttura deck — una tesi per slide" : "Deck structure — one thesis per slide"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          {locale === "it"
            ? "Questa non è ancora la presentazione finale: è il contratto narrativo e visuale del deck. Ogni slide espone lo status del claim e la sua evidence, così i placeholder non possono diventare accidentalmente numeri investor-facing."
            : "This is not yet the final presentation: it is the narrative and visual contract for the deck. Each slide exposes claim status and evidence so placeholders cannot accidentally become investor-facing numbers."}
        </p>
      </div>

      <div className="mt-7 grid gap-4 lg:grid-cols-2">
        {slides.map((slide) => (
          <article key={slide.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--steel-blue)]">
                  {String(slide.number).padStart(2, "0")} · {slide.title}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{slide.thesis}</h3>
              </div>
              <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-[9px] font-bold tracking-[0.08em] text-[var(--text-secondary)]">
                {statusLabel(slide.status, locale)}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {slide.content.map((item) => (
                <span key={item} className="rounded-lg border border-[var(--border)] bg-[var(--surface-base)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)]">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-[var(--steel-blue-soft)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--steel-blue)]">
                Evidence rule
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{slide.evidence}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
