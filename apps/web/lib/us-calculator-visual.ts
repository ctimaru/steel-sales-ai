/**
 * CALC-USA-UX1 — Shared US calculator surface tokens.
 * Mirrors the EU calculator's split workbench and compact controls while
 * keeping NPS/Schedule, HSS, source provenance and mass engines independent.
 */
export const usCalculatorUi = {
  shell: "min-w-0 overflow-hidden rounded-[1.6rem] border border-[#cddbd6] bg-white shadow-[0_18px_60px_rgba(11,47,39,0.08)]",
  header: "border-b border-[#dce7e3] bg-[linear-gradient(135deg,#f7fbf9_0%,#ffffff_62%,#edf5f2_100%)] px-3 py-3 sm:px-4",
  eyebrow: "text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#376a55]",
  heading: "mt-1 text-lg font-semibold tracking-[-0.025em] text-[#15372f] sm:text-xl",
  headingDescription: "mt-1 text-xs leading-5 text-[#52615b]",
  selector: "grid grid-cols-3 gap-1 rounded-xl border border-[#dce7e1] bg-[#f3f7f5] p-1",
  selectorButton: "min-h-11 min-w-0 rounded-lg px-1.5 py-2 text-center text-[11px] font-bold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146747] sm:px-3 sm:text-xs",
  selectorActive: "bg-[#165544] text-white shadow-sm",
  selectorIdle: "text-[#285442] hover:bg-white",
  columns: "grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(330px,0.92fr)]",
  inputs: "min-w-0 space-y-3 border-b border-[#dce7e3] p-3 sm:p-4 lg:border-b-0 lg:border-r",
  fieldGrid: "grid min-w-0 grid-cols-2 gap-2 sm:gap-3",
  label: "block min-w-0 text-[11px] font-bold leading-5 text-[#52615b]",
  input: "mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-[#c5d7cd] bg-white px-2.5 text-sm font-semibold text-[#123b34] outline-none focus-visible:border-[#166f4b] focus-visible:ring-2 focus-visible:ring-[#96d5b6]",
  miniGroup: "inline-flex max-w-full gap-1 rounded-xl border border-[#dce7e1] bg-[#f3f7f5] p-1",
  miniButton: "min-h-11 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#146747]",
  smallTitle: "text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#52615b]",
  hint: "text-[11px] leading-5 text-[#52615b]",
  results: "min-w-0 bg-[#123b34] p-3 text-white sm:p-4",
  resultTitle: "text-[10px] font-extrabold uppercase tracking-[0.13em] text-white/75",
  resultValue: "mt-1 text-xl font-bold tabular-nums tracking-tight text-white sm:text-2xl",
  resultCard: "min-w-0 rounded-xl border border-white/15 bg-white/10 p-3",
  resultHint: "mt-1 text-[11px] leading-5 text-white/75",
  primaryAction: "inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-[#a4e2bc] bg-[#dcf3e5] px-3 py-3 text-center text-sm font-bold leading-snug text-[#123b34] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40",
  secondaryAction: "inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-white/35 bg-transparent px-3 py-2 text-center text-xs font-bold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-40",
  detail: "mt-3 rounded-xl border border-white/15 bg-white/5",
  detailSummary: "flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-xs font-semibold text-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
} as const;
