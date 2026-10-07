import Link from "next/link";
import type { ReactNode } from "react";

export function FocusPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["mvp-focus-page mx-auto w-full max-w-[1180px] space-y-7", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

export function FocusHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mvp-focus-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? <p className="app-kicker">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-[var(--text-primary)] sm:text-[2.15rem]">
          {title}
        </h1>
        {description ? (
          <div className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">{actions}</div> : null}
    </header>
  );
}


export function FocusSectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="app-section-header mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="app-kicker">{eyebrow}</p> : null}
        <h2 className="mt-1 text-xl font-semibold tracking-[-0.015em] text-[var(--text-primary)]">{title}</h2>
        {description ? (
          <div className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">{description}</div>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function FocusPanel({
  children,
  className = "",
  muted = false,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section
      className={[
        "rounded-2xl border p-5 sm:p-6",
        muted ? "border-[var(--border)] bg-[var(--surface-subtle)]" : "border-[var(--border)] bg-[var(--surface-base)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

export function FocusLink({
  href,
  title,
  description,
  meta,
  primary = false,
}: {
  href: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "group flex items-start justify-between gap-4 rounded-xl border px-4 py-3.5 transition",
        primary
          ? "border-[var(--brand-primary-soft)] bg-[var(--brand-primary-soft)] hover:border-[var(--brand-primary)] hover:bg-[#d2eee4]"
          : "border-[var(--border)] bg-[var(--surface-base)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-subtle)]",
      ].join(" ")}
    >
      <div className="min-w-0">
        {meta ? <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-secondary)]">{meta}</div> : null}
        <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
        {description ? <div className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{description}</div> : null}
      </div>
      <span className="mt-0.5 shrink-0 text-sm font-semibold text-[var(--brand-deep)]" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
