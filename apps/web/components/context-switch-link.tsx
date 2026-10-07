import Link from "next/link";

export function ContextSwitchLink({
  href,
  label,
  compact = false,
  className = "",
}: {
  href: string;
  label: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={[
        "items-center justify-between border border-[#d7dfdb] bg-white font-semibold text-[#46534e] shadow-[0_1px_2px_rgba(30,43,69,0.025)] transition hover:border-[#b9cfc7] hover:bg-[#f0f4f2] hover:text-[#173f35]",
        compact
          ? "inline-flex rounded-full px-3 py-2 text-xs"
          : "flex rounded-xl px-3 py-2.5 text-sm",
        className,
      ].join(" ")}
    >
      <span>{label}</span>
      <span className={compact ? "ml-2 text-[#7b8882]" : "ml-3 text-[#7b8882]"} aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}
