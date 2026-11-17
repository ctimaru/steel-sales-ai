// DISTINTA-ONE1 (founder decision, 17 Nov 2026): one address to create a
// request, /rfq-hub/distinta. Chat and Distinta on the same screen; the
// calculator is the «Aggiungi una misura» panel. Every entry point (Commerciale,
// dashboard, Network, RFQ Hub, Marketplace, search) builds its link here.

const BASE = "/rfq-hub/distinta";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type NewRequestOptions = {
  /** Open «Aggiungi una misura» (manual entry instead of describing in the chat). */
  measure?: boolean;
  /** Network company the request starts from: shown as provenance, never auto-added as recipient. */
  network?: string | null;
  /** Arrival from the Network chat bridge (reviewed lines waiting in this tab). */
  fromNetwork?: boolean;
};

export function newRequestHref(options: NewRequestOptions = {}): string {
  const params = new URLSearchParams();
  if (options.measure) params.set("aggiungi", "misura");
  if (options.network && UUID.test(options.network)) params.set("network", options.network);
  if (options.fromNetwork) params.set("source", "network");
  const query = params.toString();
  return BASE + (query ? "?" + query : "");
}

/** Old /commercial?compose=1… links (bookmarks, emails, other agents) → the single screen. */
export function legacyComposeRedirect(params: { method?: string; network?: string; source?: string }): string {
  return newRequestHref({
    measure: params.method !== "ai",
    network: params.network ?? null,
    fromNetwork: params.source === "network",
  });
}
