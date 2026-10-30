import { appRoutes } from "@/lib/routes";

/**
 * Pure server-rendered GET search. Keep the header search entirely outside
 * the hydrated workspace navigation client module: it has no state or event
 * listeners and therefore should not participate in React hydration.
 */
export function WorkspaceSearchBar() {
  return (
    <form
      action={appRoutes.commercial.search}
      method="get"
      className="relative min-w-0 flex-1 sm:max-w-sm lg:w-[280px] lg:flex-none"
    >
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8782]"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        aria-hidden="true"
      >
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m15 15 5 5" />
      </svg>
      <input
        name="q"
        type="search"
        aria-label="Cerca nello storico commerciale"
        placeholder="Cerca nello storico..."
        minLength={2}
        maxLength={160}
        required
        className="h-10 w-full rounded-xl border border-[#cfd8d4] bg-[#f7f9f8] pl-9 pr-4 text-sm text-[#1d2824] outline-none transition placeholder:text-[#5d6a65] focus:border-[#86a99e] focus:bg-white focus:ring-4 focus:ring-[#e1ece8]"
      />
    </form>
  );
}
