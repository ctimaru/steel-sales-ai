import Link from "next/link";

import {
  NETWORK_COMPANY_ROLES,
  type NetworkCompanyRole,
} from "@/lib/network-experience";
import {
  activeNetworkPersona,
  networkDiscoveryHref,
  networkRoleLabels,
  networkRoleValue,
  suggestedNetworkRoles,
  validNetworkPersona,
} from "@/lib/network-role-discovery";

/** Discovery context is a presentation filter, not an edit to the user's company. */
export function NetworkRoleDiscovery({
  viewerRole, filters,
}:{
  viewerRole: NetworkCompanyRole | null;
  filters: Record<string,string | undefined>;
}) {
  const manualPersona = validNetworkPersona(filters.persona);
  const persona = activeNetworkPersona(filters.persona,viewerRole);
  const priority = suggestedNetworkRoles(persona);
  const currentRole = validNetworkPersona(filters.role);

  return (
    <section id="network-role-discovery" aria-labelledby="network-role-discovery-title"
      className="rounded-3xl border border-[#c8ded2] bg-[#f4f9f6] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.11em] text-[#256a50]">
            Discovery per ruolo
          </p>
          <h2 id="network-role-discovery-title" className="mt-1 text-xl font-semibold text-[#173f35]">
            {persona ? networkRoleValue[persona].title : "Trova le aziende giuste per il tuo business"}
          </h2>
        </div>
        {viewerRole ? (
          <span className="rounded-full border border-[#b9d3c6] bg-white px-3 py-1 text-xs font-medium text-[#315845]">
            Ruolo azienda: {networkRoleLabels[viewerRole]}
          </span>
        ) : null}
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#435a50]">
        {persona
          ? networkRoleValue[persona].description
          : "Scegli una prospettiva commerciale per vedere prima le categorie che ti interessano, senza perdere le altre aziende."}
      </p>
      <nav aria-label="Esplora il Network come" className="mt-4 flex flex-wrap gap-2">
        {NETWORK_COMPANY_ROLES.map((role) => {
          const selected = persona === role;
          return (
            <Link key={role}
              href={networkDiscoveryHref(filters,{persona:role},"#network-role-discovery")}
              aria-current={selected ? "page" : undefined}
              className={"inline-flex min-h-10 items-center rounded-full border px-3.5 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 " +
                (selected ? "border-[#173f35] bg-[#173f35] text-white" :
                  "border-[#b9d3c6] bg-white text-[#173f35] hover:bg-[#e3f0e9]")}>
              {role === "end_user" ? "Sono un utilizzatore" :
               role === "trader_distributor" ? "Sono un commerciante" :
               role === "processor_service_provider" ? "Sono un terzista" :
               "Sono un produttore"}
            </Link>
          );
        })}
        {manualPersona && viewerRole ? (
          <Link href={networkDiscoveryHref(filters,{persona:null},"#network-role-discovery")}
            className="inline-flex min-h-10 items-center rounded-full border border-[#c4d4cb] px-3 text-xs font-semibold text-[#315845]">
            Torna al mio ruolo
          </Link>
        ) : null}
      </nav>
      {manualPersona ? (
        <p className="mt-2 text-xs text-[#52665a]">
          Vista esplorativa: non cambia la classificazione della tua azienda.
        </p>
      ) : null}
      <div className="mt-5 border-t border-[#d4e6da] pt-4">
        <p className="text-xs font-semibold text-[#315845]">
          {persona ? "Categorie suggerite, in ordine di utilità commerciale" : "Sfoglia la filiera"}
        </p>
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Ricerca aziende per categoria">
          <Link href={networkDiscoveryHref(filters,{role:null},"#network-region-results")}
            aria-current={!currentRole ? "page" : undefined}
            className={"inline-flex min-h-10 items-center rounded-xl border px-3 text-xs font-semibold " +
              (!currentRole ? "border-[#173f35] bg-white text-[#173f35]" :
              "border-[#c9ddd1] bg-white/60 text-[#315845] hover:bg-white")}>
            Tutta la filiera
          </Link>
          {priority.map((role,index)=>(
            <Link key={role} href={networkDiscoveryHref(filters,{role},"#network-region-results")}
              aria-current={currentRole === role ? "page" : undefined}
              className={"inline-flex min-h-10 items-center rounded-xl border px-3 text-xs font-semibold " +
                (currentRole===role ? "border-[#173f35] bg-[#173f35] text-white" :
                "border-[#c9ddd1] bg-white text-[#315845] hover:bg-[#e5f2ea]")}>
              {persona && index===0 ? "Prima scelta · " : ""}{networkRoleLabels[role]}
            </Link>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-[#64796a]">
          Le categorie sono suggerimenti, non garanzie di idoneità. La ricerca mantiene disponibili
          tutti i ruoli e mostra soltanto profili Network pubblicati. I filtri geografici
          usano unicamente sedi già pubblicate.
        </p>
      </div>
    </section>
  );
}
