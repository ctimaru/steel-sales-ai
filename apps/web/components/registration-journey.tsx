type RegistrationJourneyProps = {
  current: 1 | 2 | 3 | 4;
  compact?: boolean;
};

const STEPS = [
  { id: 1, label: "Account", description: "Crea e verifica l’accesso" },
  { id: 2, label: "Azienda", description: "Inserisci i dati essenziali" },
  { id: 3, label: "Revisione", description: "Controlliamo la richiesta" },
  { id: 4, label: "Attivazione", description: "Apriamo il workspace" },
] as const;

export function RegistrationJourney({
  current,
  compact = false,
}: RegistrationJourneyProps) {
  return (
    <ol
      aria-label="Percorso di registrazione"
      className={compact ? "grid gap-2 sm:grid-cols-4" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"}
    >
      {STEPS.map((step) => {
        const active = step.id === current;
        const completed = step.id < current;

        return (
          <li
            key={step.id}
            aria-current={active ? "step" : undefined}
            className={[
              "rounded-2xl border px-4 py-3",
              active
                ? "border-[#b8d2c8] bg-white shadow-sm"
                : completed
                  ? "border-[#d9e8e2] bg-[#edf5f2]"
                  : "border-[#e2e7e4] bg-[#f7f9f8]",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <span
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  active || completed
                    ? "bg-[#1a5144] text-white"
                    : "bg-[#e7ece9] text-[#7b8782]",
                ].join(" ")}
              >
                {completed ? "✓" : step.id}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#1d2824]">
                  {step.label}
                </span>
                {!compact ? (
                  <span className="mt-0.5 block text-[11px] leading-4 text-[#7b8782]">
                    {step.description}
                  </span>
                ) : null}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
