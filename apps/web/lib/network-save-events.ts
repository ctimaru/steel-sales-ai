/**
 * NET-SAVE-INLINE1: browser-side events that keep every Salva control, the
 * toast and the "Salvate" counter in sync without a page reload.
 * Pure helpers, safe to import from client components. Nothing here talks to
 * the server: the server action is the only writer.
 */
export const NETWORK_SAVE_EVENT = "sss:network-saved";
export const NETWORK_SAVE_ERROR_EVENT = "sss:network-save-error";

export type NetworkSaveSurface =
  | "network_directory"
  | "network_company_profile"
  | "network_saved_companies"
  | "home_feed";

export type NetworkSaveEventDetail = {
  companyId: string;
  name: string;
  saved: boolean;
  /** Fresh total of the viewer's saved companies, or null when it could not be read. */
  count: number | null;
  /** "click" shows a toast; "undo" only syncs controls. */
  origin: "click" | "undo";
  surface: NetworkSaveSurface;
};

export type NetworkSaveErrorDetail = {
  companyId: string;
  name: string;
  /** The state the user asked for and did not get. */
  wanted: boolean;
  reason: NetworkSaveFailure;
};

export type NetworkSaveFailure = "invalid" | "forbidden" | "locked" | "unavailable";

export type NetworkSaveResult =
  | { ok: true; saved: boolean; count: number | null }
  | { ok: false; saved: boolean; reason: NetworkSaveFailure };

export function emitNetworkSave(detail: NetworkSaveEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NetworkSaveEventDetail>(NETWORK_SAVE_EVENT, { detail }));
}

export function emitNetworkSaveError(detail: NetworkSaveErrorDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NetworkSaveErrorDetail>(NETWORK_SAVE_ERROR_EVENT, { detail }));
}

export function networkSaveErrorMessage(reason: NetworkSaveFailure, wanted: boolean) {
  if (reason === "locked") return "Salvare le aziende è incluso in Network PRO.";
  if (reason === "forbidden") return "Il tuo ruolo non può modificare le aziende salvate.";
  return wanted
    ? "Non è stato possibile salvare l’azienda. Riprova."
    : "Non è stato possibile rimuovere l’azienda dai salvati. Riprova.";
}
