import Link from "next/link";
import type { ReactNode } from "react";

type SchoolHeroProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  badges?: string[];
  compact?: boolean;
};

export function SchoolHero({
  eyebrow,
  title,
  description,
  badges = [],
  compact = false,
}: SchoolHeroProps) {
  return (
    <header className="mvp-focus-header">
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
