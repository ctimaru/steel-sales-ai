import Link from "next/link";

import { productIdentity } from "@/lib/product-identity";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        "relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-[#4f7d70] bg-white shadow-[inset_0_0_0_3px_#dce9e4] " +
        (compact ? "h-7 w-7" : "h-9 w-9")
      }
    >
      <span
        className={
          "rounded-full border border-[#86a99e] bg-[#173f35] " +
          (compact ? "h-3 w-3" : "h-4 w-4")
        }
      />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-sm bg-[#b86b42] shadow-[0_0_0_2px_#ffffff]" />
    </span>
  );
}

export function ProductBrand({
  href = "/dashboard",
  inverse = false,
  compact = false,
}: {
  href?: string;
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex min-w-0 items-center gap-3">
      <BrandMark compact={compact} />
      <span className="min-w-0">
        <span
          className={
            "block truncate font-semibold tracking-[-0.01em] " +
            (compact ? "text-sm" : "text-[15px]") +
            (inverse ? " text-white" : " text-slate-950")
          }
        >
          {productIdentity.name}
        </span>
        {!compact ? (
          <span className={"mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.15em] " + (inverse ? "text-[#9fb9b0]" : "text-[#7b8782]")}>
            {productIdentity.descriptor}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
