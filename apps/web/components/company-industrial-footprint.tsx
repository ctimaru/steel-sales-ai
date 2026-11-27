import type { ManagedNetworkProfileState } from "@/lib/network";

type State = Pick<ManagedNetworkProfileState, "facilities" | "roles">;
type Facility = State["facilities"][number];
type Capability = Facility["capabilities"][number];

// These icons describe the existing taxonomy or declared site type only.
// No photos, machinery, geographic coordinates or production capacity are inferred.
const rolePaths: Record<string, string> = {
  producer: "M3 21V10l6 3V7l6 4V3h5l1 18z M7 17h2 M12 17h2 M17 17h2",
  trader_distributor: "M3 9l9-6 9 6v12H3z M7 21V11h10v10 M7 15h10 M7 18h10",
  processor_service_provider: "M14 4l6 6-9 9-6-6z M6 6l3 3 M4 16l4 4 M16 3l1-1 M21 8l2-1",
  end_user: "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 5 9-5 M12 12v9",
};

const capabilityPaths: Record<string, string> = {
  export_capability: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2c5 5 5 15 0 20 M12 2c-5 5-5 15 0 20",
  jit_delivery: "M3 7h11v10H3z M14 10h4l3 4v3h-7 M7 17v3 M18 17v3 M9 3v3 M6 4l3 2 3-2",
  project_supply: "M4 3h11v18H4z M7 8h5 M7 12h5 M7 16h5 M17 11l4 2v8h-6v-7",
  small_batch: "M3 4h8v8H3z M13 12h8v8h-8z M3 15h5v5H3z",
  bending_forming: "M3 4h18v4H3z M3 20h18v-4H3z M12 8v4 M8 11l4 4 4-4",
  cut_to_length: "M3 4h18v5H3z M3 15h18v5H3z M12 9v6 M8 12h8",
  galvanizing: "M3 10h18v10H3z M3 13h18 M7 5h10v3H7z M9 16h6",
  heat_treatment: "M3 7h18v14H3z M7 18c-2-3 3-5 1-9 5 3 0 5 4 9 4-4 0-7 4-10-1 4 3 6 1 10z",
  laser_cutting: "M9 2h6v7l-3 4-3-4z M12 13v5 M3 21h18 M8 17l-3-2 M16 17l3-2",
  oxy_cutting: "M3 3l12 9-3 3L3 7z M15 12l4 6 M14 18l-1 3 M18 16l3-1",
  painting_coating: "M3 3h12v5H3z M15 6h4v6h-7v9 M4 12h5 M4 16h5",
  pickling_oiling: "M3 9h18v11H3z M3 13c4-3 5 3 9 0s5 3 9 0 M12 2v5",
  plasma_cutting: "M9 2h6v7l-3 4-3-4z M14 13l-4 5h5l-3 4 M3 22h18",
  sawing: "M4 4h10l5 5-8 8-2-2-2 2-2-2-2 2-1-3 8-8 M3 21h18",
  slitting: "M3 4h18v16H3z M9 4v16 M15 4v16 M3 12h18",
  testing_ndt: "M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M15 15l6 6 M7 10l2 2 4-5",
  welding_fabrication: "M3 3l11 11 M3 7l8 8 M12 15l-3 5 M14 14l5-3 M15 17l5 2 M3 21h18",
  stockholding: "M3 4h18v16H3z M3 10h18 M3 15h18 M7 4v16 M17 4v16",
};
const neutral = "M3 7l9-4 9 4v10l-9 4-9-4z M3 7l9 5 9-5 M12 12v9";
function IndustrialIcon({ path }: { path: string }) {
  return <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={path}/></svg>;
}

export function IndustrialRoleMark({ roleKey }: { roleKey: string }) {
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e5f0eb] text-[#1a5144]"><IndustrialIcon path={rolePaths[roleKey] ?? neutral}/></span>;
}

function FacilityMark({ facilityType }: { facilityType: string }) {
  const type = facilityType.toLowerCase().trim();
  const kind = type === "plant" ? "plant" : type === "warehouse" ? "warehouse" : type === "office" ? "office" : "other";
  return (
    <svg viewBox="0 0 184 100" className="h-full w-full" fill="none" aria-hidden="true" focusable="false" data-facility-shape={kind}>
      <path d="M25 82H159" stroke="#c0d4ca" strokeWidth="2"/>
      <g stroke="#3c6257" strokeWidth="1.5" strokeLinejoin="round">
        {kind === "plant" ? <>
          <path d="M35 79V40L61 50V33L87 46V24H115L126 79Z" fill="#a2b9ae"/>
          <path d="M126 79L149 66 138 24 115 24Z" fill="#6c9181"/>
          <path d="M87 24L110 12H138L115 24Z" fill="#dce8e3"/>
          <path d="M44 57h12v12H44z M65 57h12v12H65z M88 57h12v12H88z" fill="#f5faf7"/>
        </> : kind === "warehouse" ? <>
          <path d="M33 40L84 17 142 39 142 79H33Z" fill="#a2b9ae"/>
          <path d="M84 17L105 10 159 31 142 39Z" fill="#dce8e3"/>
          <path d="M142 39L159 31V70L142 79Z" fill="#6c9181"/>
          <path d="M58 79V43H116V79Z M58 54H116 M58 65H116" fill="#f5faf7"/>
        </> : kind === "office" ? <>
          <path d="M53 22H126V79H53Z" fill="#a2b9ae"/>
          <path d="M53 22L73 12H146L126 22Z" fill="#dce8e3"/>
          <path d="M126 22L146 12V68L126 79Z" fill="#6c9181"/>
          <path d="M65 34h15v12H65z M96 34h15v12H96z M65 54h15v12H65z M96 54h15v25H96z" fill="#f5faf7"/>
        </> : <>
          <path d="M47 33L94 13 143 33V79H47Z" fill="#a2b9ae"/>
          <path d="M94 13L110 8 159 28 143 33Z" fill="#dce8e3"/>
          <path d="M143 33L159 28V70L143 79Z" fill="#6c9181"/>
          <path d="M76 79V50H113V79" fill="#f5faf7"/>
        </>}
      </g>
    </svg>
  );
}

function verification(status: string) {
  return status === "verified" ? "Verificato" : status === "pending" ? "Verifica in corso" : "Non verificato";
}
function publication(status: string) {
  return status === "published" ? "Pubblicata" : status === "draft" ? "Bozza" : status === "pending_review" ? "In revisione" : "Non pubblicata";
}
function source(capability: Capability) {
  if (capability.ownership_type === "platform_verified") return "Fonte verificata dalla piattaforma";
  if (capability.ownership_type === "company_managed") return "Dichiarata dall’azienda";
  if (capability.source_type === "public_web") return "Da fonte pubblica";
  return "Curata dalla piattaforma";
}
const manageLink = "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#c5d5ce] px-3 py-2 text-center text-xs font-semibold text-[#1a5144] hover:bg-[#edf4f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]";

export function CompanyIndustrialFootprint({ state }: { state: State }) {
  const count = state.facilities.reduce((total, site) => total + site.capabilities.length, 0);
  const verified = state.facilities.filter((site) => site.verification_status === "verified").length;
  const role = state.roles.find((item) => item.is_primary);
  return (
    <section aria-label="Presenza industriale" data-testid="company-industrial-footprint" className="min-w-0 space-y-4 rounded-2xl border border-[#dce2df] bg-[#f7faf8] p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1a5144]">Presenza industriale</p>
          <h3 className="mt-1 text-lg font-semibold text-[#1d2824]">Sedi e competenze</h3>
          {role ? <p className="mt-1 break-words text-sm text-[#52645b]">Ruolo principale: {role.name}</p> : <p className="mt-1 text-sm text-[#52645b]">Ruolo principale non definito</p>}
        </div>
        <a href="#facilities-add" className="inline-flex min-h-11 items-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]">Aggiungi sede</a>
      </div>
      <dl className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#dce2df] bg-white p-2 text-center" data-testid="company-industrial-counts">
        {([["Sedi", state.facilities.length], ["Lavorazioni", count], ["Sedi verificate", verified]] as const).map(([label, value]) => (
          <div key={label} className="min-w-0 px-1 py-1"><dt className="break-words text-[11px] leading-4 text-[#52645b]">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-[#1d2824]">{value}</dd></div>
        ))}
      </dl>
      {state.facilities.length === 0 ? (
        <div data-testid="company-facilities-empty" className="rounded-xl border border-[#dce2df] bg-white p-4 text-sm leading-6 text-[#43524c]">
          Nessuna sede registrata. Aggiungi una sede reale e associa le lavorazioni o i servizi disponibili. Non vengono attribuiti stabilimenti o attrezzature automaticamente.
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2" data-testid="company-facility-cards">
          {state.facilities.map((site) => {
            const location = [site.city, site.region, site.country_code].filter(Boolean).join(", ");
            return (
              <article key={site.id} data-testid="company-facility-card" className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
                <div className="relative h-28 bg-[#edf4f0] px-4 py-2"><FacilityMark facilityType={site.facility_type}/></div>
                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-semibold text-[#1a5144]">{site.facility_type}</p>
                    <h4 className="mt-1 break-words text-base font-semibold text-[#1d2824]">{site.name}</h4>
                    <p className="mt-1 break-words text-xs text-[#52645b]">{location || "Località non registrata"}</p>
                    {site.address_line_1 && <p className="mt-1 break-words text-xs text-[#52645b]">{[site.address_line_1, site.address_line_2, site.postal_code].filter(Boolean).join(" · ")}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#edf4f0] px-2.5 py-1 text-[11px] font-semibold text-[#43524c]">Visibilità: {publication(site.publication_status)}</span>
                      <span className={"rounded-full px-2.5 py-1 text-[11px] font-semibold " + (site.verification_status === "verified" ? "bg-[#e5f0eb] text-[#1a5144]" : "bg-[#f0f2f0] text-[#52645b]")}>{verification(site.verification_status)}</span>
                    </div>
                  </div>
                  <div className="min-w-0 border-t border-[#e5ebe7] pt-3">
                    <p className="text-xs font-semibold text-[#43524c]">Lavorazioni e servizi · {site.capabilities.length}</p>
                    {site.capabilities.length ? <ul className="mt-2 space-y-2">
                      {site.capabilities.map((item) => (
                        <li key={item.id} data-testid="company-facility-capability" className="flex min-w-0 items-start gap-2 rounded-lg bg-[#f4f7f5] p-2">
                          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-[#1a5144]"><IndustrialIcon path={capabilityPaths[item.key] ?? neutral}/></span>
                          <div className="min-w-0"><p className="break-words text-xs font-semibold text-[#1d2824]">{item.name}</p><p className="mt-0.5 break-words text-[11px] leading-4 text-[#52645b]">{source(item)} · {verification(item.verification_status)}</p></div>
                        </li>
                      ))}
                    </ul> : <p className="mt-2 text-xs text-[#52645b]">Nessuna lavorazione o servizio registrato.</p>}
                  </div>
                  <a href={"#facilities-item-" + site.id} className={"mt-auto " + manageLink}>{site.verification_status === "unverified" ? "Gestisci sede e lavorazioni" : "Consulta sede e lavorazioni"} <span aria-hidden="true" className="ml-1">→</span></a>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="text-xs leading-5 text-[#52645b]">Le illustrazioni descrivono soltanto le tipologie di sede e servizio. Non sono fotografie, prove di capacità produttiva o disponibilità di macchinari. Visibilità e verifica sono stati distinti; le lavorazioni sono conteggiate per sede.</p>
    </section>
  );
}
