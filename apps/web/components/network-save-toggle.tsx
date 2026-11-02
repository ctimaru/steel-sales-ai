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
          "ui-action inline-flex min-h-10 items-center justify-center gap-1 rounded-lg text-xs font-semibold " +
          (compact ? "min-w-10 px-2.5 " : "w-full px-4 ") +
          (saved ? "ui-action-primary" : "ui-action-secondary")
        }
      >
        <span aria-hidden="true">{saved ? "★" : "☆"}</span>
        {compact ? null : <span>{saved ? "Salvata" : "Salva azienda"}</span>}
      </button>
    </form>
  );
}
