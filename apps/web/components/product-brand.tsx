import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        "relative inline-flex shrink-0 items-center justify-center rounded-full border-2 border-[#6e9eab] bg-[#122630] shadow-[inset_0_0_0_3px_#0b171e] " +
        (compact ? "h-7 w-7" : "h-9 w-9")
      }
    >
      <span
        className={
          "rounded-full border border-[#d5e4e8]/80 bg-[#0b171e] " +
          (compact ? "h-3 w-3" : "h-4 w-4")
        }
      />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-sm bg-[#c36e32] shadow-[0_0_0_2px_#0b171e]" />
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
          Steel Sales AI
        </span>
        {!compact ? (
          <span className={"mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.15em] " + (inverse ? "text-[#7fa8b3]" : "text-slate-400")}>
            Steel intelligence workspace
          </span>
        ) : null}
      </span>
    </Link>
  );
}
