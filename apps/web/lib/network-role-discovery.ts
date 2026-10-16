import {
  NETWORK_COMPANY_ROLES,
  recommendedNetworkRoles,
  type NetworkCompanyRole,
} from "@/lib/network-experience";

export const networkRoleLabels: Record<NetworkCompanyRole,string> = {
  producer: "Produttori",
  trader_distributor: "Commercianti",
  processor_service_provider: "Terzisti",
  end_user: "Utilizzatori",
};

export const networkRoleValue: Record<NetworkCompanyRole,{
  title: string;
  description: string;
}> = {
  producer: {
    title: "Sviluppa nuovi canali e clienti",
    description: "Parti da commercianti e utilizzatori per ampliare la distribuzione; esplora i terzisti per lavorazioni e partnership.",
  },
  trader_distributor: {
    title: "Trova clienti e partner di lavorazione",
    description: "Cerca utilizzatori per nuove opportunità, terzisti per completare l'offerta e produttori per ampliare le fonti.",
  },
  processor_service_provider: {
    title: "Fai incontrare capacità produttiva e domanda",
    description: "Esplora commercianti, utilizzatori e produttori a cui proporre lavorazioni o con cui collaborare.",
  },
  end_user: {
    title: "Scopri fornitori e terzisti",
    description: "Individua commercianti per l'approvvigionamento, terzisti per le lavorazioni e produttori per alternative di fornitura.",
  },
};

export function validNetworkPersona(value: string | null | undefined): NetworkCompanyRole | null {
  return NETWORK_COMPANY_ROLES.includes(value as NetworkCompanyRole) ? value as NetworkCompanyRole : null;
}

export function activeNetworkPersona(
  selected: string | null | undefined,
  viewerRole: NetworkCompanyRole | null | undefined,
): NetworkCompanyRole | null {
  return validNetworkPersona(selected) ?? validNetworkPersona(viewerRole);
}

const allowedQueryKeys = [
  "q", "role", "product", "capability", "country",
  "market", "region", "province", "city", "persona",
] as const;

/** UI-only persona. It never grants access, changes company roles or affects RLS. */
export function networkDiscoveryHref(
  filters: Record<string,string | undefined>,
  changes: { persona?: NetworkCompanyRole | null; role?: NetworkCompanyRole | null } = {},
  hash = "",
) {
  const q = new URLSearchParams();
  for (const key of allowedQueryKeys) {
    const raw = filters[key];
    if (key === "persona") {
      const v = validNetworkPersona(raw);
      if (v) q.set(key,v);
    } else if (key === "role") {
      const v = validNetworkPersona(raw);
      if (v) q.set(key,v);
    } else if (raw?.trim()) q.set(key,raw.trim());
  }
  if (changes.persona !== undefined) {
    q.delete("role"); // selecting a new perspective must not retain an old persona's role filter
    if (changes.persona) q.set("persona",changes.persona);
    else q.delete("persona");
  }
  if (changes.role !== undefined) {
    if (changes.role) q.set("role",changes.role);
    else q.delete("role");
  }
  const serialized = q.toString();
  return "/network" + (serialized ? "?" + serialized : "") + hash;
}

export function suggestedNetworkRoles(viewerRole: NetworkCompanyRole | null) {
  return recommendedNetworkRoles(viewerRole);
}

export function networkRoleReason(
  roles: readonly {key:string}[],
  persona: NetworkCompanyRole | null,
): string | null {
  if (!persona) return null;
  const suggested = recommendedNetworkRoles(persona).slice(0,2);
  const relevant = suggested.find(role=>roles.some(r=>r.key===role));
  return relevant ? networkRoleLabels[relevant] + " · categoria suggerita" : null;
}
