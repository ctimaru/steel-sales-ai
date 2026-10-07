import Link from "next/link";

import { productIdentity } from "@/lib/product-identity";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        "inline-flex shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--surface-base)] shadow-[0_1px_2px_rgba(18,59,52,0.08)] " +
        (compact ? "h-7 w-12" : "h-9 w-[62px]")
      }
    >
      <svg viewBox="0 0 58 30" className={compact ? "h-5 w-10" : "h-6 w-[50px]"} fill="none">
        <path
          d="M16 5H8.5C5.3 5 3.5 6.5 3.5 9c0 2.2 1.5 3.4 4.7 4l4.1.8c3 .6 4.5 1.9 4.5 4.5 0 2.8-2.2 4.7-5.5 4.7H3.5"
          stroke="#1F6B5A"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 5H8.5C5.3 5 3.5 6.5 3.5 9c0 2.2 1.5 3.4 4.7 4l4.1.8c3 .6 4.5 1.9 4.5 4.5 0 2.8-2.2 4.7-5.5 4.7H3.5"
          transform="translate(18 0)"
          stroke="#315C74"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 5H8.5C5.3 5 3.5 6.5 3.5 9c0 2.2 1.5 3.4 4.7 4l4.1.8c3 .6 4.5 1.9 4.5 4.5 0 2.8-2.2 4.7-5.5 4.7H3.5"
          transform="translate(36 0)"
          stroke="#123B34"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function ProductBrand({
  href = "/dashboard",
  inverse = false,
  compact = false,
  showDescriptor = true,
}: {
  href?: string;
  inverse?: boolean;
  compact?: boolean;
  showDescriptor?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex min-w-0 items-center gap-2.5">
      <BrandMark compact={compact} />
      <span className="min-w-0">
        <span
          className={
            "block truncate font-semibold tracking-[-0.01em] " +
            (compact ? "text-sm" : "text-[15px]") +
            (inverse ? " text-white" : " text-[var(--text-primary)]")
          }
        >
          {productIdentity.name}
        </span>
        {!compact && showDescriptor ? (
          <span className={"mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.15em] " + (inverse ? "text-white/70" : "text-[var(--text-secondary)]")}>
            {productIdentity.descriptor}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
