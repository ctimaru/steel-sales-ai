import {
  BUSINESS_PLAN_VERSION,
} from "@/lib/business-plan-content";
import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { getBusinessPlanInvestorCopy } from "@/lib/business-plan-investor-copy";

export function BusinessPlanHighlights({
  investorMode = false,
  locale = "en",
}: {
  investorMode?: boolean;
  locale?: BusinessPlanLocale;
}) {
  const copy = getBusinessPlanInvestorCopy(locale);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[34px] bg-[#123d34] text-white shadow-[0_26px_90px_rgba(18,61,52,0.2)]">
        <div className="relative px-6 py-9 sm:px-9 sm:py-12 lg:px-12 lg:py-16">
          <div className="absolute inset-y-0 right-0 hidden w-[36%] border-l border-white/10 bg-[radial-gradient(circle_at_35%_35%,rgba(215,164,91,0.18),transparent_44%),linear-gradient(150deg,rgba(255,255,255,0.04),rgba(255,255,255,0))] lg:block" />
          <div className="relative grid gap-10 lg:grid-cols-[1.18fr_0.82fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#dcebe6]">
                  {copy.hero.eyebrow}
                </span>
                <span className="rounded-full bg-[#d7a45b]/15 px-3 py-1.5 text-[11px] font-bold text-[#f2cf9c] ring-1 ring-[#d7a45b]/30">
                  {BUSINESS_PLAN_VERSION}
                </span>
                {investorMode ? (
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80">
                    {locale === "it" ? "Vista investor confidenziale" : "Confidential investor view"}
                  </span>
                ) : null}
              </div>

              <p className="mt-9 text-xs font-bold uppercase tracking-[0.22em] text-[#9cc5b7]">
                {locale === "it" ? "Investment story" : "Investment story"}
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                {copy.hero.headline}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-[#d8e5e0] sm:text-lg">
                {copy.hero.subheadline}
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f2cf9c]">
                  {locale === "it" ? "Tesi in una frase" : "One-line thesis"}
                </p>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white">
                  {copy.hero.oneLine}
                </p>
              </div>
            </div>

            <div className="relative grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {copy.highlightCards.map(([metric, label, detail]) => (
                <article key={label} className="rounded-2xl border border-white/12 bg-white/[0.07] p-5 backdrop-blur">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-3xl font-semibold tracking-tight text-white">{metric}</p>
                    <span className="text-right text-[10px] font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
                      {label}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#d8e5e0]">{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">
              {copy.sections.whyCare}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              {copy.sections.oneNetwork}
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#66736e]">
              {copy.hero.investorHook}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {copy.incomeStreams.map(([stream, timing, role], index) => (
              <article key={stream} className="rounded-2xl bg-[#eef3f0] p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-[#1a5144]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1d2824]">{stream}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.11em] text-[#87938e]">
                      {timing}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#66736e]">{role}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">
              {copy.sections.targetMarket}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              {copy.sections.targetMarketTitle}
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#66736e]">
              {copy.sections.targetMarketSubtitle}
            </p>
            <ul className="mt-5 space-y-3">
              {copy.marketPoints.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-5 text-[#52615b]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7a45b]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {copy.marketCards.map(([metric, label, detail, geography]) => (
              <article
                key={label}
                className="rounded-2xl border border-[#e2e8e5] bg-[#f8faf9] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-3xl font-semibold tracking-tight text-[#173f35]">{metric}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#66736e] ring-1 ring-[#dce2df]">
                    {geography}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[#1d2824]">{label}</h3>
                <p className="mt-2 text-xs leading-5 text-[#66736e]">{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-[#f8faf9] p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">
            {copy.sections.timeline}
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
            {copy.sections.timelineTitle}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            {copy.sections.timelineSubtitle}
          </p>
        </div>

        <div className="relative mt-8 space-y-4 before:absolute before:bottom-6 before:left-[17px] before:top-6 before:w-px before:bg-[#c8d6d1] sm:before:left-[23px]">
          {copy.timeline.map(([phase, title, status, description, signal], index) => (
            <article key={phase} className="relative grid gap-4 pl-12 sm:grid-cols-[130px_1fr_auto] sm:items-start sm:pl-16">
              <span className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-[#f8faf9] bg-[#123d34] text-[10px] font-bold text-white sm:h-12 sm:w-12">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1a5144]">{phase}</p>
                <p className="mt-1 text-xs font-semibold text-[#87938e]">{status}</p>
              </div>
              <div className="rounded-2xl border border-[#e1e7e4] bg-white p-5">
                <h3 className="text-lg font-semibold text-[#1d2824]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">{description}</p>
                <p className="mt-3 text-xs font-semibold leading-5 text-[#1a5144]">{signal}</p>
              </div>
              <div className="hidden sm:block">
                <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#52615b] ring-1 ring-[#dce2df]">
                  {status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {copy.general.map(([title, value, detail]) => (
          <article key={title} className="rounded-[26px] border border-[#dce2df] bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">{title}</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#1d2824]">{value}</h3>
            <p className="mt-3 text-xs leading-5 text-[#66736e]">{detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">{copy.sections.scale}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              {copy.sections.scaleTitle}
            </h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-[#87938e]">{copy.sections.scaleDisclaimer}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {copy.scaleCards.map(([name, orgs, mrr, annualized, interpretation]) => (
            <article key={name} className="rounded-2xl bg-[#eef3f0] p-5">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-semibold text-[#1d2824]">{name}</h3>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#345047]">
                  {orgs}
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">MRR</p>
                  <p className="mt-1 text-2xl font-semibold text-[#173f35]">{mrr}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">
                    {locale === "it" ? "Annualizzato" : "Annualized"}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[#173f35]">{annualized}</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-[#66736e]">{interpretation}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">{copy.sections.milestones}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
            {copy.sections.milestonesTitle}
          </h2>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {copy.milestoneItems.map(([stage, evidence], index) => (
            <article key={stage} className="rounded-2xl border border-[#e3e8e5] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                {locale === "it" ? "Gate" : "Gate"} {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-sm font-semibold text-[#1d2824]">{stage}</h3>
              <p className="mt-2 text-xs leading-5 text-[#66736e]">{evidence}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
