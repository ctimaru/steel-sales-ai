import {
  BUSINESS_PLAN_VERSION,
  beachheadProfile,
  businessPlanRoadmap,
  businessPlanSnapshot,
  buyerPersonas,
  competitiveAlternatives,
  differentiation,
  evidenceLedger,
  icpDecisionCriteria,
  icpScorecard,
  icpSegments,
  icpValidationGate,
  interviewCohortPlan,
  interviewEvidenceTemplate,
  interviewFitBands,
  interviewPrinciples,
  interviewScoreDimensions,
  interviewScript,
  jobsToBeDone,
  marketEvidence,
  packagingBoundaryDecision,
  packagingBoundaryValidationGate,
  pricingArchitectureDecision,
  pricingDecisionRules,
  pricingExperimentBands,
  pricingHypotheses,
  pricingMarketAnchors,
  productPillars,
  valueMetricAlternatives,
  valueMetricDecision,
  syntheticInterviewSimulation,
} from "@/lib/business-plan-content";

function StatusPill({ status }: { status: string }) {
  const className =
    status === "Completed"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : status === "Active" || status === "In progress"
        ? "bg-[#e1ece8] text-[#173f35] ring-1 ring-[#c7ddd5]"
        : status === "Pre-launch"
          ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
          : "bg-[#f2f4f3] text-[#596761] ring-1 ring-[#dce2df]";

  return (
    <span className={["rounded-full px-2.5 py-1 text-[11px] font-bold", className].join(" ")}>
      {status}
    </span>
  );
}

export function BusinessPlanView({
  investorMode = false,
}: {
  investorMode?: boolean;
}) {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] bg-[#123d34] text-white shadow-[0_24px_80px_rgba(18,61,52,0.18)]">
        <div className="grid gap-10 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[1.25fr_0.75fr] lg:px-12 lg:py-14">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#dcebe6]">
                Smart Steel Sales
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

            <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#9cc5b7]">
              Investment thesis
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              The commercial operating system for steel &amp; tube.
            </h1>
            <p className="mt-6 max-w-3xl text-base leading-7 text-[#d8e5e0] sm:text-lg">
              {businessPlanSnapshot.thesis}
            </p>
          </div>

          <div className="grid content-start gap-3">
            {[
              ["Stage", businessPlanSnapshot.stage],
              ["Current focus", businessPlanSnapshot.currentFocus],
              ["Launch", businessPlanSnapshot.launchWindow],
              ["Core wedge", "Commercial Memory → Network → Marketplace"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9cc5b7]">
                  {label}
                </p>
                <p className="mt-2 text-sm font-semibold leading-5 text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {productPillars.map((pillar, index) => (
          <article key={pillar.key} className="rounded-3xl border border-[#dce2df] bg-white p-5 shadow-[0_10px_34px_rgba(18,61,52,0.04)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[#1a5144]">0{index + 1}</span>
              <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                {pillar.label}
              </span>
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight text-[#1d2824]">{pillar.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">{pillar.description}</p>
            <p className="mt-4 border-t border-[#edf0ee] pt-4 text-sm font-medium leading-6 text-[#345047]">
              {pillar.value}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">L27.2A.1 · Market evidence</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              Why distribution is the first wedge
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e]">
              External evidence is used to validate market structure and digital readiness. Strategic implications remain internal hypotheses until customer interviews and pilot behaviour confirm them.
            </p>
          </div>
          <span className="rounded-full bg-[#e1ece8] px-3 py-1.5 text-xs font-semibold text-[#173f35] ring-1 ring-[#c7ddd5]">
            Evidence-backed segmentation
          </span>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {marketEvidence.map((item) => (
            <article key={item.label} className="rounded-2xl border border-[#e0e6e3] bg-[#f8faf9] p-5">
              <p className="text-3xl font-semibold tracking-tight text-[#173f35]">{item.metric}</p>
              <h3 className="mt-2 text-sm font-semibold text-[#1d2824]">{item.label}</h3>
              <p className="mt-3 text-xs leading-5 text-[#66736e]">{item.detail}</p>
              <p className="mt-4 border-t border-[#e5ebe8] pt-4 text-xs font-medium leading-5 text-[#345047]">
                {item.implication}
              </p>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex text-[11px] font-semibold text-[#1a5144] underline decoration-[#9bbeb2] underline-offset-4"
              >
                Source · {item.source}
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">L27.2A · ICP</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              Initial customer prioritization
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e]">
              These are working hypotheses, not traction claims. The goal is to decide where the product has the strongest paid wedge before pre-launch validation.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            Evidence status · hypothesis
          </span>
        </div>

        <div className="mt-7 grid gap-4 xl:grid-cols-2">
          {icpSegments.map((segment) => (
            <article key={segment.segment} className="rounded-2xl border border-[#e0e6e3] bg-[#f8faf9] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#173f35] text-sm font-bold text-white">
                    {segment.rank}
                  </span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">{segment.fit}</p>
                    <h3 className="mt-0.5 text-base font-semibold text-[#1d2824]">{segment.segment}</h3>
                  </div>
                </div>
                <StatusPill status={segment.validationStatus} />
              </div>

              <p className="mt-4 text-sm leading-6 text-[#52615b]">{segment.whyNow}</p>

              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">Core jobs</p>
                <ul className="mt-2 space-y-2 text-sm text-[#52615b]">
                  {segment.coreJobs.map((job) => (
                    <li key={job} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5b8f7f]" />
                      <span>{job}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 rounded-xl border border-[#cfe0d9] bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">Value proposition</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#26463c]">{segment.valueProposition}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Decision rubric</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">Weighted ICP scorecard</h2>
            </div>
            <span className="text-xs text-[#87938e]">Internal score · 1–5</span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {icpDecisionCriteria.map((criterion) => (
              <span key={criterion.key} className="rounded-full bg-[#f2f4f3] px-3 py-1.5 text-[11px] font-semibold text-[#596761]">
                {criterion.label} · {criterion.weight}
              </span>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            {icpScorecard.map((item) => (
              <article key={item.segment} className="rounded-2xl border border-[#e2e8e5] p-4">
                <div className="flex items-start gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#173f35] text-sm font-bold text-white">
                    {item.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-[#1d2824]">{item.segment}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-semibold text-[#173f35]">{item.score.toFixed(1)}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87938e]">/5</span>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-[#87938e]">Evidence confidence · {item.confidence}</p>
                    <p className="mt-3 text-sm leading-6 text-[#52615b]">{item.decision}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {icpDecisionCriteria.map((criterion) => (
                        <div key={criterion.key} className="rounded-lg bg-[#f7f9f8] px-2 py-2 text-center">
                          <p className="text-[9px] uppercase tracking-[0.08em] text-[#8b9692]">{criterion.label}</p>
                          <p className="mt-1 text-xs font-bold text-[#345047]">
                            {item.scores[criterion.key as keyof typeof item.scores]}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#123d34] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9cc5b7]">Beachhead profile</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">{beachheadProfile.name}</h2>
          <span className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-[#d8e5e0]">
            {beachheadProfile.status}
          </span>

          {[
            ["Must have", beachheadProfile.mustHave],
            ["Positive signals", beachheadProfile.positiveSignals],
            ["Deprioritise", beachheadProfile.deprioritise],
          ].map(([label, items]) => (
            <div key={label as string} className="mt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">{label as string}</p>
              <ul className="mt-3 space-y-2">
                {(items as readonly string[]).map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-[#d8e5e0]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7a45b]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Competitive alternatives</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
          The real competitive set
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e]">
          Smart Steel Sales should not position itself as a replacement for every ERP or CRM. The initial wedge is the commercial intelligence layer between existing systems, industry relationships and demand activation.
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {competitiveAlternatives.map((item) => (
            <article key={item.category} className="rounded-2xl border border-[#e2e8e5] bg-[#f9fbfa] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">{item.category}</p>
              <h3 className="mt-2 text-sm font-semibold text-[#1d2824]">{item.examples}</h3>
              <div className="mt-4 space-y-3 text-xs leading-5">
                <p><span className="font-semibold text-[#345047]">Strength:</span> <span className="text-[#66736e]">{item.strength}</span></p>
                <p><span className="font-semibold text-[#345047]">Gap:</span> <span className="text-[#66736e]">{item.gap}</span></p>
                <p className="rounded-xl bg-white p-3 font-medium text-[#345047]">{item.implication}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">L27.2A.2 · Primary validation</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              Interview &amp; validation framework
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#66736e]">
              A pre-committed discovery protocol converts the distributor-first thesis from evidence-supported to validated, needs-evidence or rejected. The sample is directional, not statistically representative.
            </p>
          </div>
          <div className="rounded-2xl bg-[#123d34] px-5 py-4 text-white">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">Planned cohort</p>
            <p className="mt-1 text-3xl font-semibold">{interviewCohortPlan.totalInterviews}</p>
            <p className="mt-1 text-xs text-[#d8e5e0]">customer-discovery interviews</p>
          </div>
        </div>

        <div className="mt-7 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl bg-[#f7f9f8] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">Primary gate</p>
            <h3 className="mt-2 text-lg font-semibold text-[#1d2824]">{interviewCohortPlan.primaryGate.segment}</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-4">
                <p className="text-2xl font-semibold text-[#173f35]">{interviewCohortPlan.primaryGate.interviews}</p>
                <p className="mt-1 text-[11px] text-[#66736e]">interviews</p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-2xl font-semibold text-[#173f35]">≥{interviewCohortPlan.primaryGate.minimumCompanies}</p>
                <p className="mt-1 text-[11px] text-[#66736e]">distinct companies</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {interviewCohortPlan.primaryGate.roleMix.map((item) => (
                <div key={item} className="flex gap-2 text-xs leading-5 text-[#52615b]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5b8f7f]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">Comparison cohort</p>
            <div className="mt-3 space-y-2">
              {interviewCohortPlan.comparisonCohort.map((item) => (
                <div key={item.segment} className="flex items-center justify-between rounded-xl bg-white px-3 py-3 text-xs">
                  <span className="font-semibold text-[#345047]">{item.segment}</span>
                  <span className="text-[#66736e]">{item.interviews} interviews · ≥{item.minimumCompanies} companies</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e2e8e5] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">Anti-bias rules</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {interviewPrinciples.map((item, index) => (
                <div key={item} className="rounded-xl bg-[#f8faf9] p-4">
                  <p className="text-xs font-bold text-[#173f35]">{String(index + 1).padStart(2, "0")}</p>
                  <p className="mt-2 text-xs leading-5 text-[#52615b]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">Interview flow · ~35–45 min</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {interviewScript.map((phase) => (
              <article key={phase.phase} className="rounded-2xl border border-[#e2e8e5] p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#1d2824]">{phase.phase}</h3>
                  <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">{phase.minutes} min</span>
                </div>
                <p className="mt-2 text-xs font-medium leading-5 text-[#345047]">{phase.objective}</p>
                <ul className="mt-3 space-y-2">
                  {phase.questions.map((question) => (
                    <li key={question} className="text-xs leading-5 text-[#66736e]">• {question}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Per-interview evidence</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">6 dimensions · 12-point fit score</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {interviewScoreDimensions.map((item) => (
              <article key={item.key} className="rounded-2xl bg-[#f8faf9] p-4">
                <h3 className="text-sm font-semibold text-[#1d2824]">{item.label}</h3>
                <div className="mt-3 space-y-2 text-[11px] leading-5">
                  <p><span className="font-bold text-rose-700">0</span> · <span className="text-[#66736e]">{item.zero}</span></p>
                  <p><span className="font-bold text-amber-700">1</span> · <span className="text-[#66736e]">{item.one}</span></p>
                  <p><span className="font-bold text-emerald-700">2</span> · <span className="text-[#66736e]">{item.two}</span></p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {interviewFitBands.map((item) => (
              <div key={item.band} className="rounded-2xl border border-[#e2e8e5] p-4">
                <p className="text-sm font-semibold text-[#1d2824]">{item.band}</p>
                <p className="mt-1 text-xl font-semibold text-[#173f35]">{item.score}</p>
                <p className="mt-2 text-[11px] leading-5 text-[#66736e]">{item.rule}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] bg-[#1d2824] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9cc5b7]">Decision gate</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">Pre-committed validation thresholds</h2>

          <div className="mt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9cc5b7]">Validate signals</p>
            <ul className="mt-3 space-y-2">
              {icpValidationGate.validateThresholds.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-5 text-[#d8e5e0]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#e9b7ad]">Disconfirm signals</p>
            <ul className="mt-3 space-y-2">
              {icpValidationGate.disconfirmThresholds.map((item) => (
                <li key={item} className="flex gap-2 text-xs leading-5 text-[#d8e5e0]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 space-y-3">
            {icpValidationGate.decisionLogic.map((item) => (
              <div key={item.status} className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
                <p className="text-sm font-semibold text-white">{item.status}</p>
                <p className="mt-2 text-xs leading-5 text-[#cfddd8]">{item.rule}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-dashed border-[#b8d2c8] bg-[#edf5f2] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Interview evidence record</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">One standard record per interview</h2>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {interviewEvidenceTemplate.map((item, index) => (
            <div key={item} className="rounded-xl bg-white px-3 py-3 text-xs leading-5 text-[#52615b]">
              <span className="mr-2 font-bold text-[#1a5144]">{String(index + 1).padStart(2, "0")}</span>
              {item}
            </div>
          ))}
        </div>
      </section>

      {!investorMode ? (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50/50 p-6 sm:p-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Synthetic scenario · internal only</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">What the first 10 interviews could realistically look like</h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66736e]">{syntheticInterviewSimulation.disclaimer}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              Not customer evidence
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {syntheticInterviewSimulation.sentimentMix.map((item) => (
              <div key={item.label} className="rounded-2xl bg-white p-4">
                <p className="text-3xl font-semibold text-[#173f35]">{item.count}</p>
                <p className="mt-1 text-xs font-semibold text-[#52615b]">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {syntheticInterviewSimulation.aggregate.map((item) => (
              <div key={item.label} className="rounded-2xl border border-amber-100 bg-white p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-[#1d2824]">{item.label}</p>
                  <p className="text-xl font-semibold text-[#173f35]">{item.value}</p>
                </div>
                <p className="mt-2 text-[11px] text-[#87938e]">Gate {item.gate} · {item.result}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">Likely positive signals</p>
              <ul className="mt-3 space-y-2">
                {syntheticInterviewSimulation.likelyPositiveSignals.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-[#52615b]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8b5d23]">Likely objections</p>
              <ul className="mt-3 space-y-2">
                {syntheticInterviewSimulation.likelyObjections.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-[#52615b]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-medium leading-6 text-[#345047]">
            {syntheticInterviewSimulation.implication}
          </p>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">L27.2B · Packaging & pricing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">Working pricing architecture</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66736e]">
              These are testable pricing hypotheses, not validated willingness-to-pay. The current model favours an organization subscription with included users because company memory creates shared organizational value.
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">Hypothesis only</span>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {pricingMarketAnchors.map((item) => (
            <article key={item.vendor} className="rounded-2xl bg-[#f8faf9] p-5">
              <p className="text-sm font-semibold text-[#1d2824]">{item.vendor}</p>
              <p className="mt-2 text-lg font-semibold text-[#173f35]">{item.anchor}</p>
              <p className="mt-3 text-xs leading-5 text-[#66736e]">{item.implication}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-[11px] font-semibold text-[#1a5144] underline underline-offset-4">
                Official pricing · {item.asOf}
              </a>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-2xl bg-[#123d34] p-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">Preferred monetization model</p>
          <h3 className="mt-2 text-xl font-semibold">{pricingArchitectureDecision.preferredModel}</h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {pricingArchitectureDecision.rationale.map((item) => (
              <div key={item} className="rounded-xl bg-white/[0.06] p-3 text-xs leading-5 text-[#d8e5e0]">{item}</div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-[28px] border border-[#b8d2c8] bg-[#f7faf8] p-5 sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">
                L27.2B.1 · Packaging boundary &amp; value metric
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
                Charge for private company memory, not for every action
              </h3>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66736e]">
                {packagingBoundaryDecision.principle}
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
              {packagingBoundaryDecision.status}
            </span>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-2xl bg-[#123d34] p-5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
                Primary value metric
              </p>
              <h4 className="mt-2 text-xl font-semibold">{valueMetricDecision.primaryMetric}</h4>
              <p className="mt-3 text-sm leading-6 text-[#d8e5e0]">{valueMetricDecision.why}</p>
              <p className="mt-4 text-[11px] font-semibold text-[#f2cf9c]">{valueMetricDecision.status}</p>

              <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
                Do not meter normal value creation
              </p>
              <ul className="mt-3 space-y-2">
                {valueMetricDecision.doNotMeter.map((item) => (
                  <li key={item} className="flex gap-2 text-xs leading-5 text-[#d8e5e0]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7a45b]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {valueMetricDecision.secondaryLevers.map((item) => (
                <article key={item.metric} className="rounded-2xl border border-[#e2e8e5] bg-white p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">{item.role}</p>
                  <h4 className="mt-2 text-sm font-semibold text-[#1d2824]">{item.metric}</h4>
                  <p className="mt-2 text-xs leading-5 text-[#66736e]">{item.rule}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {packagingBoundaryDecision.boundaries.map((boundary) => (
              <article key={boundary.transition} className="rounded-2xl border border-[#e2e8e5] bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">{boundary.transition}</p>
                <h4 className="mt-2 text-base font-semibold text-[#1d2824]">{boundary.trigger}</h4>
                <p className="mt-3 text-xs leading-5 text-[#345047]">
                  <span className="font-semibold">Paid value:</span> {boundary.paidValue}
                </p>
                <p className="mt-3 text-xs leading-5 text-[#66736e]">
                  <span className="font-semibold text-[#52615b]">Boundary guard:</span> {boundary.staysOutside}
                </p>
                <p className="mt-3 border-t border-[#edf0ee] pt-3 text-[11px] leading-5 text-[#87938e]">
                  {boundary.reason}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {valueMetricAlternatives.map((item) => (
              <article key={item.candidate} className="rounded-2xl bg-[#eef3f0] p-4">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-semibold text-[#1d2824]">{item.candidate}</h4>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#345047]">
                    {item.decision}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-[#66736e]">{item.valueAlignment}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-[#b8d2c8] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Directional validation gate
            </p>
            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">Pass signals</p>
                <ul className="mt-3 space-y-2">
                  {packagingBoundaryValidationGate.directionalPassSignals.map((item) => (
                    <li key={item} className="text-xs leading-5 text-[#52615b]">• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-700">Disconfirm signals</p>
                <ul className="mt-3 space-y-2">
                  {packagingBoundaryValidationGate.disconfirmSignals.map((item) => (
                    <li key={item} className="text-xs leading-5 text-[#52615b]">• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 rounded-xl bg-[#f7f9f8] px-4 py-3 text-xs font-medium leading-5 text-[#345047]">
              {packagingBoundaryValidationGate.decisionRule}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pricingHypotheses.map((tier) => (
            <article key={tier.name} className="rounded-2xl border border-[#e2e8e5] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">{tier.status}</p>
              <h3 className="mt-2 text-xl font-semibold text-[#1d2824]">{tier.name}</h3>
              <p className="mt-2 text-sm font-semibold text-[#173f35]">{tier.price}</p>
              <p className="mt-1 text-xs text-[#87938e]">{tier.audience}</p>
              <p className="mt-4 text-xs font-semibold text-[#52615b]">{tier.purpose}</p>
              <ul className="mt-3 space-y-2">
                {tier.includes.map((item) => <li key={item} className="text-xs leading-5 text-[#66736e]">• {item}</li>)}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {pricingExperimentBands.map((item) => (
            <article key={item.test} className="rounded-2xl bg-[#eef3f0] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">{item.test}</p>
              <p className="mt-2 text-lg font-semibold text-[#1d2824]">{item.offer}</p>
              <p className="mt-3 text-xs leading-5 text-[#52615b]">{item.goal}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-[#b8d2c8] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">Decision rules</p>
          <ul className="mt-3 grid gap-2 lg:grid-cols-2">
            {pricingDecisionRules.map((item) => (
              <li key={item} className="text-xs leading-5 text-[#52615b]">• {item}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[28px] bg-[#eef3f0] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Buyer personas</p>
          <div className="mt-5 space-y-4">
            {buyerPersonas.map((item) => (
              <div key={item.persona} className="rounded-2xl bg-white p-5">
                <h3 className="font-semibold text-[#1d2824]">{item.persona}</h3>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">{item.pain}</p>
                <p className="mt-3 text-sm font-medium leading-6 text-[#345047]">{item.outcome}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Jobs to be done</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
            The moments that create willingness to pay
          </h2>
          <div className="mt-6 space-y-3">
            {jobsToBeDone.map((job, index) => (
              <div key={job} className="flex gap-4 rounded-2xl border border-[#e7ece9] p-4">
                <span className="text-sm font-bold text-[#1a5144]">{String(index + 1).padStart(2, "0")}</span>
                <p className="text-sm leading-6 text-[#52615b]">{job}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-[#1d2824] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9cc5b7]">Why this can compound</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Product moat &amp; distribution flywheel</h2>
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {differentiation.map((item) => (
            <article key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.05] p-5">
              <h3 className="font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#cfddd8]">{item.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#d8e5e0]">
          {["Scuola", "→", "Network discovery", "→", "Commercial Memory", "→", "Marketplace demand", "→", "More industry data"].map((item, index) => (
            <span
              key={index}
              className={item === "→" ? "text-[#8eb9aa]" : "rounded-full bg-white/10 px-3 py-1.5"}
            >
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Evidence ledger</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
            What is proven vs. what is still a hypothesis
          </h2>
          <div className="mt-6 space-y-3">
            {evidenceLedger.map((item) => (
              <div key={item.label} className="rounded-2xl border border-[#e4e9e6] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#1d2824]">{item.label}</p>
                  <StatusPill status={item.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">Business model build</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
            From ICP to investor-ready plan
          </h2>
          <div className="mt-6 space-y-3">
            {businessPlanRoadmap.map((item) => (
              <div key={item.code} className="flex items-center gap-4 rounded-2xl bg-[#f7f9f8] p-4">
                <span className="min-w-16 text-xs font-bold text-[#1a5144]">{item.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#1d2824]">{item.title}</p>
                </div>
                <StatusPill status={item.status} />
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-dashed border-[#b8d2c8] bg-[#edf5f2] p-5">
            <p className="text-sm font-semibold text-[#173f35]">Not fabricated yet</p>
            <p className="mt-2 text-sm leading-6 text-[#52615b]">
              TAM/SAM/SOM, pricing, revenue scenarios and unit economics will be added only after the corresponding L27.2 research blocks. The investor view distinguishes facts, working hypotheses and future evidence.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
