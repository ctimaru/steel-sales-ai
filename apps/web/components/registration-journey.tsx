type RegistrationJourneyProps = {
  /** 4 = every step completed (workspace active). */
  current: 1 | 2 | 3 | 4;
  compact?: boolean;
  locale?: "it" | "en";
};

// ONBOARDING-SELF1: three steps. Activation is automatic when the company data passes the
// checks; otherwise it happens after a staff check. The verified badge comes later and is
// not a registration step.
const STEPS = [
  { id: 1, label: "Account", description: "Crea e verifica l’accesso" },
  { id: 2, label: "Azienda", description: "Inserisci i dati essenziali" },
  { id: 3, label: "Attivazione", description: "Automatica se i dati sono completi" },
] as const;

const STEPS_EN = [
  { id: 1, label: "Account", description: "Create and verify your email" },
  { id: 2, label: "Company", description: "Provide essential details" },
  { id: 3, label: "Activation", description: "Automatic when details are complete" },
] as const;

export function RegistrationJourney({
  current,
  compact = false,
  locale = "it",
}: RegistrationJourneyProps) {
  const items = locale === "en" ? STEPS_EN : STEPS;

  return (
    <ol
      aria-label={locale === "en" ? "Registration progress" : "Percorso di registrazione"}
      className={
        compact
          ? "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
          : "grid gap-2 sm:grid-cols-3"
      }
    >
      {items.map((step, index) => {
        const active = step.id === current;
        const completed = step.id < current;
        const badge = (
          <span
            className={[
              "flex shrink-0 items-center justify-center rounded-full font-bold",
              compact ? "h-6 w-6 text-[11px]" : "h-7 w-7 text-xs",
              active || completed ? "bg-[#1a5144] text-white" : "bg-[#e7ece9] text-[#52615b]",
            ].join(" ")}
          >
            {completed ? "✓" : step.id}
          </span>
        );

        if (compact) {
          return (
            <li
              key={step.id}
              aria-current={active ? "step" : undefined}
              className="flex min-w-0 items-center gap-2"
            >
              {badge}
              <span
                className={[
                  "text-sm",
                  active ? "font-semibold text-[#1d2824]" : "text-[#5d6a65]",
                ].join(" ")}
              >
                {step.label}
              </span>
              {index < items.length - 1 ? (
                <span aria-hidden="true" className="mx-1 h-px w-6 bg-[#cbd8d2] sm:w-10" />
              ) : null}
            </li>
          );
        }

        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={[
              "rounded-xl border px-3 py-2.5",
              active
                ? "border-[#b8d2c8] bg-white shadow-sm"
                : completed
                  ? "border-[#d9e8e2] bg-[#edf5f2]"
                  : "border-[#e2e7e4] bg-[#f7f9f8]",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              {badge}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#1d2824]">{step.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-[#5d6a65]">
                  {step.description}
                </span>
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
