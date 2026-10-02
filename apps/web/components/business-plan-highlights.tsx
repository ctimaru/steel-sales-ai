import {
  BUSINESS_PLAN_VERSION,
  businessPlanGeneralHighlights,
  businessPlanHighlights,
  businessPlanTimeline,
  investorMarketSizingConclusion,
  investorMilestones,
  marketEvidence,
  marketOpportunityHighlights,
  networkIncomeStreams,
  networkScaleScenarios,
} from "@/lib/business-plan-content";

export function BusinessPlanHighlights({
  investorMode = false,
}: {
  investorMode?: boolean;
}) {
  const featuredEvidence = marketEvidence.slice(0, 4);
  const italy = networkScaleScenarios.find((item) => item.name === "Italy network");
  const europe = networkScaleScenarios.find((item) => item.name === "European network");

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[34px] bg-[#123d34] text-white shadow-[0_26px_90px_rgba(18,61,52,0.2)]">
        <div className="relative px-6 py-9 sm:px-9 sm:py-12 lg:px-12 lg:py-16">
          <div className="absolute inset-y-0 right-0 hidden w-[36%] border-l border-white/10 bg-[radial-gradient(circle_at_35%_35%,rgba(215,164,91,0.18),transparent_44%),linear-gradient(150deg,rgba(255,255,255,0.04),rgba(255,255,255,0))] lg:block" />
          <div className="relative grid gap-10 lg:grid-cols-[1.18fr_0.82fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#dcebe6]">
                  {businessPlanHighlights.eyebrow}
                </span>
                <span className="rounded-full bg-[#d7a45b]/15 px-3 py-1.5 text-[11px] font-bold text-[#f2cf9c] ring-1 ring-[#d7a45b]/30">
                  {BUSINESS_PLAN_VERSION}
                </span>
                {investorMode ? (
                  <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/80">
                    Confidential investor view
                  </span>
                ) : null}
              </div>

              <p className="mt-9 text-xs font-bold uppercase tracking-[0.22em] text-[#9cc5b7]">
                Investment story
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl lg:text-6xl">
                {businessPlanHighlights.headline}
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-7 text-[#d8e5e0] sm:text-lg">
                {businessPlanHighlights.subheadline}
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f2cf9c]">
                  One-line thesis
                </p>
                <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-white">
                  {businessPlanHighlights.oneLine}
                </p>
              </div>
            </div>

            <div className="relative grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {businessPlanHighlights.highlightCards.map((item) => (
                <article key={item.label} className="rounded-2xl border border-white/12 bg-white/[0.07] p-5 backdrop-blur">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-3xl font-semibold tracking-tight text-white">{item.metric}</p>
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#d8e5e0]">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Why investors should care</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              One network. Multiple ways to monetize value.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#66736e]">
              {businessPlanHighlights.investorHook}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {networkIncomeStreams.map((item, index) => (
              <article key={item.stream} className="rounded-2xl bg-[#eef3f0] p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-[#1a5144]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1d2824]">{item.stream}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.11em] text-[#87938e]">
                      {item.timing}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#66736e]">{item.strategicRole}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Target market</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              {investorMarketSizingConclusion.headline}
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#66736e]">
              Italy offers a dense launch wedge inside a much broader European industrial graph. Counts are shown as concentric market layers rather than summed into one inflated TAM.
            </p>
            <ul className="mt-5 space-y-3">
              {investorMarketSizingConclusion.points.slice(0, 3).map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-5 text-[#52615b]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7a45b]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {marketOpportunityHighlights.map((item) => (
              <a
                key={item.geography + "-" + item.label}
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-[#e2e8e5] bg-[#f8faf9] p-5 transition hover:border-[#bfd2ca] hover:bg-[#f3f7f5]"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-3xl font-semibold tracking-tight text-[#173f35]">{item.metric}</p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#66736e] ring-1 ring-[#dce2df]">
                    {item.geography}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[#1d2824]">{item.label}</h3>
                <p className="mt-2 text-xs leading-5 text-[#66736e]">{item.detail}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-[#f8faf9] p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Strategic timeline</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
            From product foundation to industry network
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            The roadmap is driven by evidence gates: utility first, then monetization, liquidity and geographic scale.
          </p>
        </div>

        <div className="relative mt-8 space-y-4 before:absolute before:bottom-6 before:left-[17px] before:top-6 before:w-px before:bg-[#c8d6d1] sm:before:left-[23px]">
          {businessPlanTimeline.map((item, index) => (
            <article key={item.phase} className="relative grid gap-4 pl-12 sm:grid-cols-[130px_1fr_auto] sm:items-start sm:pl-16">
              <span className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-[#f8faf9] bg-[#123d34] text-[10px] font-bold text-white sm:h-12 sm:w-12">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#1a5144]">{item.phase}</p>
                <p className="mt-1 text-xs font-semibold text-[#87938e]">{item.status}</p>
              </div>
              <div className="rounded-2xl border border-[#e1e7e4] bg-white p-5">
                <h3 className="text-lg font-semibold text-[#1d2824]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">{item.description}</p>
                <p className="mt-3 text-xs font-semibold leading-5 text-[#1a5144]">{item.signal}</p>
              </div>
              <div className="hidden sm:block">
                <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#52615b] ring-1 ring-[#dce2df]">
                  {item.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {businessPlanGeneralHighlights.map((item) => (
          <article key={item.title} className="rounded-[26px] border border-[#dce2df] bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">{item.title}</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#1d2824]">{item.value}</h3>
            <p className="mt-3 text-xs leading-5 text-[#66736e]">{item.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[30px] bg-[#1d2824] p-6 text-white sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9cc5b7]">Market signal</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              Start concentrated. Expand through the steel value chain.
            </h2>
            <p className="mt-4 text-sm leading-6 text-[#cfddd8]">
              Existing external evidence supports an Italy-first distribution wedge and a credible European expansion path. These figures are market context, not traction.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {featuredEvidence.map((item) => (
              <a
                key={item.label}
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 transition hover:bg-white/[0.08]"
              >
                <p className="text-2xl font-semibold text-white">{item.metric}</p>
                <p className="mt-1 text-xs font-semibold text-[#d8e5e0]">{item.label}</p>
                <p className="mt-3 text-[11px] leading-5 text-[#9cc5b7]">{item.source}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Scale sensitivity</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              Low ARPA. High network leverage.
            </h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-[#87938e]">
            Internal sensitivity cases only — not forecasts, traction, guidance or market-size claims.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[italy, europe].filter(Boolean).map((item) => (
            <article key={item!.name} className="rounded-2xl bg-[#eef3f0] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">{item!.status}</p>
                  <h3 className="mt-2 text-xl font-semibold text-[#1d2824]">{item!.name}</h3>
                </div>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#345047]">
                  {item!.activatedOrganizations.toLocaleString("en-US")} orgs
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">Total MRR</p>
                  <p className="mt-1 text-2xl font-semibold text-[#173f35]">{item!.totalMrr}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">Annualized</p>
                  <p className="mt-1 text-2xl font-semibold text-[#173f35]">{item!.annualizedRevenue}</p>
                </div>
              </div>
              <p className="mt-4 text-xs leading-5 text-[#66736e]">{item!.interpretation}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Investor milestone ladder</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
            What converts the thesis into evidence
          </h2>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {investorMilestones.map((item, index) => (
            <article key={item.stage} className="rounded-2xl border border-[#e3e8e5] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                Gate {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-2 text-sm font-semibold text-[#1d2824]">{item.stage}</h3>
              <p className="mt-2 text-xs leading-5 text-[#66736e]">{item.evidence}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
