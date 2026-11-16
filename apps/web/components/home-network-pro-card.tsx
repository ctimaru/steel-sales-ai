import Link from "next/link";

import { appRoutes } from "@/lib/routes";

/**
 * HOME-NETPRO1 (founder request, 16 Nov 2026): the Home right rail sells access
 * to the Network instead of listing "Aziende da conoscere".
 *
 * Presentation only. Access is decided server-side by the existing entitlement
 * (pa1_3_network_access_state); this card never grants anything. The chat bubble
 * is a labelled example request, the blurred rows are skeletons (no company
 * names, no invented matches) and the only number shown is the real count of
 * Italian companies published in the Network, when available.
 */
export function HomeNetworkProCard({
  entitled,
  italyPublished,
}: {
  entitled: boolean;
  italyPublished: number | null;
}) {
  const count = typeof italyPublished === "number" && Number.isSafeInteger(italyPublished) && italyPublished > 0
    ? italyPublished.toLocaleString("it-IT")
    : null;

  return (
    <section
      aria-labelledby="home-netpro-heading"
      data-testid="home-network-pro-card"
      data-state={entitled ? "entitled" : "locked"}
      className="overflow-hidden rounded-2xl border border-[#d5dad5] bg-white"
    >
      <div aria-hidden="true" className="h-1.5 bg-[#175640]" />
      <div className="space-y-3.5 p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#175640]">
          {entitled ? "Network PRO · attivo" : "Network PRO · assistente"}
        </p>
        <h2 id="home-netpro-heading" className="text-[19px] font-extrabold leading-6 tracking-tight text-[#17201c]">
          Dimmi norma, grado e misura. Ti dico chi ce l’ha.
        </h2>

        <div className="space-y-2.5 rounded-xl bg-[#f2f4f1] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5b6660]">Esempio di richiesta</p>
          <p className="ml-auto w-fit max-w-[90%] rounded-xl rounded-br-sm bg-[#175640] px-3 py-2 text-[13px] leading-5 text-white">
            Tubo EN 10216-2 P265GH, 168,3 × 7,1 mm, 12 t
          </p>
          <div className="w-[94%] space-y-2.5 rounded-xl rounded-bl-sm border border-[#e1e5e1] bg-white px-3 py-2.5">
            <p className="text-[13px] leading-5 text-[#17201c]">
              {count ? (
                <>Nel Network ci sono <strong>{count} aziende italiane</strong> della filiera. </>
              ) : (
                <>Il Network raccoglie le aziende della filiera dell’acciaio. </>
              )}
              {entitled
                ? "Filtrale per norma, grado e misura e invita in RFQ quelle giuste."
                : "Con Network PRO le filtri per norma, grado e misura e vedi chi ce l’ha."}
            </p>
            {entitled ? null : (
              <div aria-hidden="true" className="space-y-2">
                {[78, 62].map((width) => (
                  <div key={width} className="flex items-center gap-2">
                    <span className="h-7 w-7 shrink-0 rounded-lg bg-[#e6f1ec]" />
                    <span className="h-3 rounded-full bg-[#d9e2dc] blur-[1.5px]" style={{ width: width + "%" }} />
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9a5c00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto shrink-0">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="text-[13px] leading-5 text-[#4a5550]">
          {entitled
            ? "Il tuo accesso è attivo: cerca i fornitori e portali nella tua RFQ."
            : "Una domanda, la risposta con i nomi. Poi li inviti nella tua RFQ."}
        </p>

        <Link
          href={entitled ? appRoutes.network.directory : appRoutes.network.pro}
          data-testid="home-network-pro-cta"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#175640] px-3 text-[15px] font-bold text-white hover:bg-[#124535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"
        >
          {entitled ? "Cerca nel Network" : "Sblocca il Network"}
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        </Link>
        {entitled ? null : (
          <p className="text-center text-[11px] leading-4 text-[#5b6660]">
            Moduli e prezzi nella pagina Network PRO. Il profilo della tua azienda resta gratuito.
          </p>
        )}
      </div>
    </section>
  );
}
