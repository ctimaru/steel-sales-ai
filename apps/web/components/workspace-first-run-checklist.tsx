import Link from "next/link";

import type { WorkspaceFirstRun } from "@/lib/workspace-first-run";

/**
 * HOME-FIRSTRUN1: first-access checklist shown at the top of the Home overview.
 * Server-rendered, presentation-only: every link points to an existing,
 * already-authorized setup surface. No client fetch, no new permissions.
 */
export function WorkspaceFirstRunChecklist({
  state,
  companyNameHint = null,
  compact = false,
}: {
  state: WorkspaceFirstRun;
  /** HOME-FIRSTRUN1B: soft hint when the workspace name equals the registrant's name. */
  companyNameHint?: { href: string } | null;
  /** HOME-FEED1: narrow left-rail variant (single column, CTA only on the next step). */
  compact?: boolean;
}) {
  if (!state.active || !state.nextStep) return null;
  const { steps, nextStep, essentialCompleted, essentialTotal } = state;
  const percentage = essentialTotal > 0 ? Math.round((essentialCompleted / essentialTotal) * 100) : 0;

  return (
    <section
      aria-labelledby="workspace-first-run-heading"
      data-testid="workspace-first-run"
      className={"rounded-2xl border border-[#b9d2c5] bg-white " + (compact ? "p-4" : "px-4 py-4 sm:px-5")}
    >
      <div className={compact ? "flex flex-col gap-3" : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6"}>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#28634f]">Primi passi</p>
          <h2 id="workspace-first-run-heading" className={"mt-1 font-semibold tracking-tight text-[#173f35] " + (compact ? "text-base" : "text-lg sm:text-xl")}>
            Prepara il tuo workspace
          </h2>
          {compact ? null : (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#52645a] sm:text-sm">
              Due passi essenziali per usare la memoria commerciale. Network, Distinta e Scuola sono già disponibili.
            </p>
          )}
        </div>
        <div className={compact ? "w-full" : "w-full shrink-0 sm:w-52"}>
          <div className="flex items-baseline justify-between text-[11px] font-semibold text-[#173f35]">
            <span>Setup essenziale</span>
            <span className="tabular-nums">
              {essentialCompleted}/{essentialTotal}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Avanzamento del setup essenziale"
            aria-valuemin={0}
            aria-valuemax={essentialTotal}
            aria-valuenow={essentialCompleted}
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e3eee8]"
          >
            <div className="h-full rounded-full bg-[#176045]" style={{ width: percentage + "%" }} />
          </div>
        </div>
      </div>

      {companyNameHint ? (
        <p
          role="note"
          data-testid="workspace-company-name-hint"
          className="mt-3 rounded-xl border border-[#e7d4b4] bg-[#fffbf5] px-3 py-2.5 text-xs leading-5 text-[#5c4a2e]"
        >
          Il nome dell’azienda coincide con il tuo nome. Se sei una ditta individuale va bene così; altrimenti inserisci la ragione sociale.{" "}
          <Link
            href={companyNameHint.href}
            className="font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Modifica il nome<span aria-hidden="true">&nbsp;→</span>
          </Link>
        </p>
      ) : null}

      <ol className={compact ? "mt-3 grid gap-1.5" : "mt-4 grid gap-2 sm:grid-cols-2"}>
        {steps.map((step, index) => {
          const isNext = step.id === nextStep.id;
          return (
            <li
              key={step.id}
              className={
                "flex min-w-0 gap-3 rounded-xl border px-3 py-3 " +
                (isNext
                  ? "border-[#7fae97] bg-[#f2f8f4]"
                  : step.done
                    ? "border-[#e1ebe4] bg-[#fafcfb]"
                    : "border-[#e1ebe4] bg-white")
              }
            >
              <span
                aria-hidden="true"
                className={
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold " +
                  (step.done ? "bg-[#176045] text-white" : isNext ? "border-2 border-[#176045] text-[#176045]" : "border border-[#b9d2c5] text-[#53675b]")
                }
              >
                {step.done ? "✓" : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-[#173f35]">
                  <span>{step.label}</span>
                  <span className="sr-only">
                    {step.done ? " · completato" : isNext ? " · prossimo passo" : " · da fare"}
                  </span>
                  {!step.essential ? <span className="text-[10px] font-medium text-[#607268]">Facoltativo</span> : null}
                </p>
                {!compact || isNext ? <p className="mt-0.5 text-xs leading-5 text-[#52615b]">{step.detail}</p> : null}
                {isNext ? (
                  <Link
                    href={step.href}
                    className="mt-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#176045] px-4 text-xs font-semibold !text-white transition hover:bg-[#114b36] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176045]"
                  >
                    Continua setup <span aria-hidden="true">→</span>
                  </Link>
                ) : compact ? null : (
                  <Link
                    href={step.href}
                    className="mt-1 inline-flex min-h-9 items-center text-xs font-semibold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {step.done ? "Rivedi" : "Apri"}
                    <span className="sr-only">: {step.label}</span>
                    <span aria-hidden="true">&nbsp;→</span>
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
