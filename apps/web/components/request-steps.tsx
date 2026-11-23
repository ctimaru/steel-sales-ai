/**
 * DISTINTA-SMART2 (founder request, 23 Nov 2026): one high-contrast step header
 * for the three phases of a request (/rfq-hub/distinta, step 2 and step 3).
 * Server-safe: no hooks, no client state.
 */
export const requestStepNames = ["Cosa ti serve", "A chi lo chiedi", "Invia"] as const;

export function RequestSteps({ current, testId }: { current: 0 | 1 | 2; testId?: string }) {
  return (
    <ol aria-label="Passaggi della richiesta" data-testid={testId}
      className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
      {requestStepNames.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} aria-current={active ? "step" : undefined}
            className={"flex items-center gap-2 " + (active ? "font-bold text-[#0f2e23]" : done ? "font-semibold text-[#175640]" : "text-[#3f564a]")}>
            <span aria-hidden="true" className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold " +
              (active ? "bg-[#175640] text-white ring-4 ring-[#175640]/15"
                : done ? "border-2 border-[#175640] bg-white text-[#175640]"
                  : "border-2 border-[#7a9585] bg-white text-[#3f564a]")}>
              {done ? "✓" : index + 1}
            </span>
            <span className={active ? "border-b-2 border-[#175640] pb-px" : ""}>{step}</span>
            {done ? <span className="sr-only">(completato)</span> : null}
            {index < requestStepNames.length - 1 ? (
              <span aria-hidden="true" className={"ml-1 h-0.5 w-6 rounded-full " + (done ? "bg-[#175640]" : "bg-[#9fb4a7]")} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
