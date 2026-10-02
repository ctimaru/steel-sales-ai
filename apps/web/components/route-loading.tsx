type RouteLoadingProps = {
  label: string;
  variant?: "workspace" | "platform";
};

function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={["animate-pulse rounded-full bg-[#e3e8e5]", className].join(" ")}
    />
  );
}

export function RouteLoading({
  label,
  variant = "workspace",
}: RouteLoadingProps) {
  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-6"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>

      <section
        className={[
          "rounded-3xl p-6 sm:p-8",
          variant === "platform"
            ? "platform-surface"
            : "border border-[#dce2df] bg-white",
        ].join(" ")}
      >
        <Bar className="h-3 w-28" />
        <Bar className="mt-4 h-8 w-full max-w-xl" />
        <Bar className="mt-4 h-4 w-full max-w-3xl" />
        <Bar className="mt-2 h-4 w-4/5 max-w-2xl" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[#dce2df] bg-white p-5"
          >
            <Bar className="h-7 w-16" />
            <Bar className="mt-3 h-3 w-28" />
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-7">
        <Bar className="h-4 w-40" />
        <Bar className="mt-4 h-5 w-2/3 max-w-md" />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-[#f6f8f7] p-5">
            <Bar className="h-4 w-1/2" />
            <Bar className="mt-3 h-3 w-full" />
            <Bar className="mt-2 h-3 w-3/4" />
          </div>
          <div className="rounded-2xl bg-[#f6f8f7] p-5">
            <Bar className="h-4 w-1/2" />
            <Bar className="mt-3 h-3 w-full" />
            <Bar className="mt-2 h-3 w-3/4" />
          </div>
        </div>
      </section>
    </div>
  );
}
