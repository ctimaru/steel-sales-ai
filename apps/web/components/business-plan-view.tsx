import {
  BUSINESS_PLAN_VERSION,
  businessPlanRoadmap,
  businessPlanSnapshot,
  buyerPersonas,
  differentiation,
  evidenceLedger,
  icpSegments,
  jobsToBeDone,
  productPillars,
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
