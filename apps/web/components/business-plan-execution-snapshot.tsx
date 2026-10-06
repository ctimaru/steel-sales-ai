import type { BusinessPlanLocale } from "@/lib/business-plan-locale";

const scaleScenario = [
  { mau: "1K", infra: "~€350", arr: "€36K" },
  { mau: "10K", infra: "~€700", arr: "€360K" },
  { mau: "50K", infra: "~€1.9K", arr: "€1.8M" },
  { mau: "100K", infra: "~€3.3K", arr: "€3.6M" },
  { mau: "500K", infra: "~€13.5K", arr: "€18M" },
] as const;

const builtModules = [
  "Core SaaS",
  "Commercial Memory",
  "Steel Network",
  "Scuola",
  "Identity & RBAC",
  "Marketplace",
  "Pricing utility",
  "RFQ Hub",
] as const;

export function BusinessPlanExecutionSnapshot({
  locale = "it",
}: {
  locale?: BusinessPlanLocale;
}) {
  const italian = locale === "it";

  const metrics = italian
    ? [
        {
          value: "~280–400 h",
          label: "Ore operative AI-assisted",
          detail:
            "Stima del tempo effettivo di costruzione, orchestrazione, test e iterazione.",
        },
        {
          value: "~2.460–3.200 h",
          label: "Engineering tradizionale equivalente",
          detail:
            "Stima delle ore necessarie per ricostruire lo stesso perimetro con sviluppo tradizionale.",
        },
        {
          value: "~2.850 h",
          label: "Valore centrale equivalente",
          detail: "Circa 17–18 mesi/uomo di engineering tradizionale.",
        },
        {
          value: "€250K–€300K",
          label: "Replacement development cost",
          detail:
            "Stima interna del costo di sostituzione del software già sviluppato; non è la valuation.",
        },
        {
          value: "~€3,3K/mese",
          label: "Infra centrale @100K MAU",
          detail:
            "Scenario di pianificazione per core infrastructure + AI con routing efficiente.",
        },
        {
          value: "€3,6M ARR",
          label: "Scenario @100K MAU",
          detail:
            "Forecast con 10% utenti paganti e ARPU medio di €30/mese; non rappresenta traction.",
        },
      ]
    : [
        {
          value: "~280–400 h",
          label: "AI-assisted operating hours",
          detail:
            "Estimated hands-on build, orchestration, testing and iteration effort.",
        },
        {
          value: "~2,460–3,200 h",
          label: "Traditional engineering equivalent",
          detail:
            "Estimated hours required to reproduce the same scope with a traditional software process.",
        },
        {
          value: "~2,850 h",
          label: "Central equivalent estimate",
          detail: "Approximately 17–18 person-months of traditional engineering.",
        },
        {
          value: "€250K–€300K",
          label: "Replacement development cost",
          detail:
            "Internal estimate of the software replacement cost already built; this is not the company valuation.",
        },
        {
          value: "~€3.3K/mo",
          label: "Core infra @100K MAU",
          detail:
            "Planning scenario for core infrastructure + AI with efficient model routing.",
        },
        {
          value: "€3.6M ARR",
          label: "Scenario @100K MAU",
          detail:
            "Forecast at 10% paid conversion and €30 average monthly ARPU; not traction.",
        },
      ];

  return (
    <section className="overflow-hidden rounded-[34px] border border-[#dce2df] bg-white">
      <div className="border-b border-[#e2e8e5] bg-[radial-gradient(circle_at_88%_0%,rgba(215,164,91,0.15),transparent_25rem),linear-gradient(135deg,#f8faf9_0%,#ffffff_62%)] px-6 py-8 sm:px-9 sm:py-10 lg:px-12">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#123d34] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                {italian ? "Dove siamo oggi" : "Where we are today"}
              </span>
              <span className="rounded-full bg-[#f7efe2] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b5d21] ring-1 ring-[#ead5b2]">
                Execution snapshot
              </span>
            </div>
            <h2 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.035em] text-[#1d2824] sm:text-4xl lg:text-5xl">
              {italian
                ? "Da concept a piattaforma verticale: execution già materialmente costruita."
                : "From concept to vertical platform: execution already materially built."}
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#66736e] sm:text-base">
              {italian
                ? "Smart Steel Sales ha già una base SaaS production-oriented con Commercial Memory, Network industriale, utility pubbliche, governance, pricing workflow e RFQ Hub multi-fornitore. Le metriche sotto separano ciò che è stato costruito dalle ipotesi economiche di scala."
                : "Smart Steel Sales already has a production-oriented SaaS foundation spanning Commercial Memory, the industrial Network, public utilities, governance, pricing workflows and a multi-supplier RFQ Hub. The metrics below separate what has been built from scale economics assumptions."}
            </p>
          </div>

          <div className="rounded-2xl border border-[#d8e0dc] bg-white/90 px-4 py-3 lg:max-w-[280px]">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              {italian ? "Principio di lettura" : "How to read"}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-[#66736e]">
              {italian
                ? "Ore, replacement cost e forecast sono stime interne di pianificazione. Non vengono presentate come dati audited o traction."
                : "Hours, replacement cost and forecasts are internal planning estimates. They are not presented as audited figures or traction."}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-8 lg:p-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric, index) => (
            <article
              key={metric.label}
              className="relative overflow-hidden rounded-2xl border border-[#e0e6e3] bg-[#f8faf9] p-5"
            >
              <span className="absolute right-4 top-4 text-[10px] font-bold tabular-nums text-[#a3ada8]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="metric-number pr-9 text-3xl font-semibold tracking-tight text-[#123d34] sm:text-[2rem]">
                {metric.value}
              </p>
              <h3 className="mt-3 text-sm font-semibold text-[#1d2824]">
                {metric.label}
              </h3>
              <p className="mt-2 text-xs leading-5 text-[#66736e]">
                {metric.detail}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="rounded-2xl bg-[#123d34] p-5 text-white sm:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
              {italian ? "Perimetro già costruito" : "Scope already built"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {builtModules.map((module) => (
                <span
                  key={module}
                  className="rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-[#e7f0ed]"
                >
                  {module}
                </span>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-[#d8e5e0]">
              {italian
                ? "Il replacement cost misura solo il costo di ricostruzione software: non incorpora IP verticale, know-how steel, database/network, time-to-market o potenziale di network effect."
                : "Replacement cost measures software reconstruction only: it excludes vertical IP, steel know-how, database/network assets, time-to-market and network-effect potential."}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e0e6e3] bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
                  {italian ? "Scenario di scala" : "Scale scenario"}
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#1d2824]">
                  {italian
                    ? "Costi infrastrutturali vs potenziale ARR"
                    : "Infrastructure cost vs potential ARR"}
                </h3>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#87938e]">
                10% paid · €30 ARPU
              </p>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-5">
              {scaleScenario.map((item) => (
                <div
                  key={item.mau}
                  className={[
                    "rounded-xl border p-3",
                    item.mau === "100K"
                      ? "border-[#b9cec6] bg-[#edf5f2]"
                      : "border-[#e4e9e7] bg-[#fafcfb]",
                  ].join(" ")}
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#68756f]">
                    {item.mau} MAU
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#173f35]">
                    {item.arr}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#7a8781]">ARR</p>
                  <p className="mt-2 text-xs font-medium text-[#52615b]">
                    {item.infra}
                  </p>
                  <p className="text-[10px] text-[#8a9691]">
                    {italian ? "infra/mese" : "infra/month"}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-4 text-[11px] leading-5 text-[#7a8781]">
              {italian
                ? "Forecast prudenziale per visualizzare operating leverage. I costi reali dipenderanno soprattutto da AI usage, document/email ingestion, storage, traffico e concurrency; il pricing definitivo resta da validare."
                : "Conservative forecast to visualize operating leverage. Actual costs will depend mainly on AI usage, document/email ingestion, storage, traffic and concurrency; final pricing remains to be validated."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
