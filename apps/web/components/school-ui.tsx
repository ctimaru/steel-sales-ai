import Link from "next/link";
import type { ReactNode } from "react";

type SchoolHeroProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  badges?: string[];
  compact?: boolean;
  /** Only the public editorial hubs use this photographic variant; detail pages keep their original technical hierarchy. */
  editorial?: boolean;
  action?: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
};

export function SchoolHero({
  eyebrow,
  title,
  description,
  badges = [],
  compact = false,
  editorial = false,
  action,
  secondaryAction,
}: SchoolHeroProps) {
  if (editorial) return (
    <header className="relative isolate overflow-hidden rounded-[24px] bg-[#102921] text-white" aria-label={eyebrow}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-[position:75%_center] opacity-65" style={{backgroundImage:"url('/home-cine1a-steel.webp')"}} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,31,23,.98)_0%,rgba(8,31,23,.92)_43%,rgba(8,31,23,.57)_78%,rgba(8,31,23,.38)_100%)]" />
      <div className="relative flex min-h-[230px] max-w-[790px] flex-col justify-center px-6 py-7 sm:px-9 sm:py-9">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[.17em] text-[#b4deca]">{eyebrow}</span>
          {badges.map((badge) => <span key={badge} className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-[#e6f4eb]">{badge}</span>)}
        </div>
        <h1 className="mt-3 max-w-2xl text-[2rem] font-semibold leading-[1.12] tracking-[-.04em] text-white sm:text-[2.7rem]">{title}</h1>
        <div className="mt-3 max-w-xl text-sm leading-6 text-[#e0eee5] sm:text-[15px]">{description}</div>
        {action || secondaryAction ? <div className="mt-5 flex flex-wrap gap-2">
          {action ? <Link href={action.href} className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold !text-[#153f30] transition hover:bg-[#e7f4eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{action.label}<span aria-hidden="true" className="ml-2">→</span></Link> : null}
          {secondaryAction ? <Link href={secondaryAction.href} className="inline-flex min-h-11 items-center rounded-xl border border-white/40 px-4 py-2.5 text-sm font-semibold !text-white transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{secondaryAction.label}<span aria-hidden="true" className="ml-2">↗</span></Link> : null}
        </div> : null}
      </div>
    </header>
  );
  return (
    <header className="school-hero mvp-focus-header">
      <div className="school-hero-accent" aria-hidden="true" />
      <div className={compact ? "px-0 py-1" : "px-0 py-1"}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="school-eyebrow">{eyebrow}</span>
          {badges.map((badge) => (
            <span key={badge} className="school-badge">
              {badge}
            </span>
          ))}
        </div>
        <h1
          className={
            compact
              ? "mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl"
              : "mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-[2.65rem]"
          }
        >
          {title}
        </h1>
        <div className="mt-3 max-w-2xl text-sm leading-7 text-[#5d6a65] sm:text-base">
          {description}
        </div>
      </div>
    </header>
  );
}

type SchoolActionLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
};

export function SchoolActionLink({
  href,
  children,
  variant = "primary",
  className = "",
}: SchoolActionLinkProps) {
  const variantClass =
    variant === "primary" ? "school-primary-action" : "school-secondary-action";

  return (
    <Link href={href} className={`${variantClass} ${className}`.trim()}>
      {children}
    </Link>
  );
}
