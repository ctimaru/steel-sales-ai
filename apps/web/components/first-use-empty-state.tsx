import Link from "next/link";

type EmptyStateAction = {
  href: string;
  label: string;
};

export function FirstUseEmptyState({
  eyebrow = "Primo utilizzo",
  title,
  description,
  primaryAction,
  secondaryAction,
  note,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction: EmptyStateAction;
  secondaryAction?: EmptyStateAction | null;
  note?: string | null;
  compact?: boolean;
}) {
  return (
    <section
      className={[
        "rounded-3xl border border-dashed border-[#c8d5d0] bg-white text-center",
        compact ? "p-6" : "p-8 sm:p-10",
      ].join(" ")}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
        {eyebrow}
      </p>
      <h2
        className={[
          "mx-auto mt-2 max-w-2xl font-semibold tracking-[-0.01em] text-[#1d2824]",
          compact ? "text-base" : "text-lg",
        ].join(" ")}
      >
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[#66736e]">
        {description}
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={primaryAction.href}
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#173f35] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#226657]"
        >
          {primaryAction.label}
        </Link>
        {secondaryAction ? (
          <Link
            href={secondaryAction.href}
            className="inline-flex min-h-10 items-center justify-center rounded-xl border border-[#c8d5d0] bg-white px-4 py-2.5 text-sm font-semibold text-[#173f35] transition hover:bg-[#edf5f2]"
          >
            {secondaryAction.label}
          </Link>
        ) : null}
      </div>

      {note ? (
        <p className="mx-auto mt-4 max-w-2xl text-xs leading-5 text-[#87938e]">
          {note}
        </p>
      ) : null}
    </section>
  );
}
