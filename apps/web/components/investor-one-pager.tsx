import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { getOnePagerCopy, type ClaimStatus } from "@/lib/marketing-fundraising-assets";

function statusLabel(status: ClaimStatus, locale: BusinessPlanLocale) {
  if (locale === "it") {
    return status === "fact"
      ? "Fatto"
      : status === "estimate"
        ? "Stima"
        : status === "hypothesis"
          ? "Ipotesi"
          : "Obiettivo";
  }
  return status === "fact"
    ? "Fact"
    : status === "estimate"
      ? "Estimate"
      : status === "hypothesis"
        ? "Hypothesis"
        : "Target";
}

function statusClass(status: ClaimStatus) {
  if (status === "fact") return "bg-[var(--brand-primary-soft)] text-[var(--brand-deep)]";
  if (status === "estimate") return "bg-[var(--steel-blue-soft)] text-[var(--steel-blue)]";
  if (status === "hypothesis") return "bg-amber-50 text-amber-800";
  return "bg-[var(--surface-muted)] text-[var(--text-secondary)]";
}

export function InvestorOnePager({
  locale = "it",
  investorMode = false,
}: {
  locale?: BusinessPlanLocale;
  investorMode?: boolean;
}) {
  const copy = getOnePagerCopy(locale);

  return (
    <article className="mx-auto max-w-[1180px] overflow-hidden rounded-[30px] border border-[var(--border)] bg-[var(--surface-base)] shadow-[0_20px_70px_rgba(15,23,32,0.08)] print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="bg-[var(--brand-deep)] px-6 py-8 text-white sm:px-8 sm:py-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">
            {copy.eyebrow}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
            {locale === "it" ? "Pre-launch · Pilot readiness" : "Pre-launch · Pilot readiness"}
          </span>
          {investorMode ? (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
              {locale === "it" ? "Investor copy" : "Investor copy"}
            </span>
          ) : null}
        </div>
        <h1 className="mt-6 max-w-4xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-5 max-w-4xl text-base leading-7 text-white/80">{copy.subtitle}</p>
      </header>

      <div className="p-6 sm:p-8 lg:p-10">
        <div className="grid gap-4 md:grid-cols-2">
          {copy.blocks.map((block) => (
            <section key={block.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--steel-blue)]">
                  {block.label}
                </p>
                <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${statusClass(block.status)}`}>
                  {statusLabel(block.status, locale)}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">{block.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{block.body}</p>
              <p className="mt-4 border-t border-[var(--border)] pt-3 text-[11px] leading-5 text-[var(--text-tertiary)]">
                {block.evidence}
              </p>
            </section>
          ))}
        </div>

        <section className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--steel-blue-soft)] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--steel-blue)]">
            {locale === "it" ? "Validation gaps" : "Validation gaps"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
            {locale === "it" ? "Cosa deve ancora essere dimostrato" : "What still needs to be proven"}
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {copy.gaps.map((gap) => (
              <div key={gap} className="rounded-xl bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">
                • {gap}
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-6 flex flex-col gap-2 border-t border-[var(--border)] pt-5 text-xs text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between">
          <span>Smart Steel Sales · smartsteelsales.com</span>
          <span>
            {locale === "it"
              ? "Feature costruite ≠ traction · Replacement cost ≠ valuation"
              : "Shipped features ≠ traction · Replacement cost ≠ valuation"}
          </span>
        </footer>
      </div>
    </article>
  );
}
