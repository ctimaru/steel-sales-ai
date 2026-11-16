import { removeSavedNetworkCompany, saveNetworkCompany } from "@/app/(workspace)/network/actions";

/** NET-UX LOT1B — founder decision (2 Nov 2026): each user keeps a private list
 * of Network companies to work on later (Salvate). Server action, no JS needed. */
export function NetworkSaveToggle({
  companyId,
  name,
  saved,
  returnTo,
  compact = false,
}: {
  companyId: string;
  name: string;
  saved: boolean;
  returnTo: string;
  compact?: boolean;
}) {
  return (
    <form action={saved ? removeSavedNetworkCompany : saveNetworkCompany} className="relative z-10 shrink-0">
      <input type="hidden" name="network_company_id" value={companyId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        type="submit"
        data-testid="network-save-toggle"
        aria-pressed={saved}
        aria-label={(saved ? "Rimuovi dalle aziende salvate: " : "Salva nella tua lista privata: ") + name}
        title={saved ? "Salvata nella tua lista privata · clic per rimuovere" : "Salva nella tua lista privata"}
        className={
          // NET-UX-ROWS1: amber star, filled when saved; label visible so "Salva" reads at a glance.
          "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
          (compact ? "px-3 " : "w-full px-4 ") +
          (saved
            ? "border-[#e9c46a] bg-[#fff4d6] text-[#6e4400] hover:bg-[#ffecbd]"
            : "border-[#d5dfd9] bg-white text-[#3f5248] hover:border-[#e9c46a] hover:bg-[#fffaf0] hover:text-[#6e4400]")
        }
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className={"h-[18px] w-[18px] " + (saved ? "text-[#b7790a]" : "")} fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
        <span className={compact ? "hidden xl:inline" : undefined}>{saved ? "Salvata" : compact ? "Salva" : "Salva azienda"}</span>
      </button>
    </form>
  );
}
