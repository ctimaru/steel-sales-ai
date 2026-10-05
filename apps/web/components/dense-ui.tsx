import type { ReactNode } from "react";

export function DenseDisclosure({
  title,
  description,
  children,
  badge,
  defaultOpen = false,
  tone = "default",
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50/40"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50/40"
        : "border-[#dce2df] bg-white";

  return (
    <details className={`uxf2-disclosure rounded-2xl border ${toneClass}`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 marker:hidden">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#1d2824]">{title}</div>
          {description ? <div className="mt-1 text-xs leading-5 text-[#66736e]">{description}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge}
          <span className="uxf2-disclosure-chevron text-sm font-semibold text-[#718078]" aria-hidden="true">
            ↓
          </span>
        </div>
      </summary>
      <div className="border-t border-[#e7ece9] p-4 sm:p-5">{children}</div>
    </details>
  );
}

export function DenseStatStrip({
  items,
}: {
  items: Array<{ label: ReactNode; value: ReactNode; detail?: ReactNode }>;
}) {
  return (
    <dl className="uxf2-stat-strip grid gap-px overflow-hidden rounded-2xl border border-[#dce2df] bg-[#dce2df] sm:grid-flow-col sm:auto-cols-fr">
      {items.map((item, index) => (
        <div key={index} className="min-w-0 bg-white px-4 py-3">
          <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#87938e]">{item.label}</dt>
          <dd className="mt-1 truncate text-lg font-semibold text-[#1d2824]">{item.value}</dd>
          {item.detail ? <div className="mt-0.5 truncate text-[11px] text-[#718078]">{item.detail}</div> : null}
        </div>
      ))}
    </dl>
  );
}

export function DenseTableFrame({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <div className="uxf2-table-frame overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
      {label ? (
        <div className="border-b border-[#e7ece9] bg-[#f8faf9] px-4 py-2.5 text-xs font-semibold text-[#66736e]">
          {label}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function DenseActionBar({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="uxf2-action-bar flex flex-col gap-3 rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-4 sm:flex-row sm:items-center sm:justify-between">
      {hint ? <div className="max-w-2xl text-xs leading-5 text-[#66736e]">{hint}</div> : <span />}
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
