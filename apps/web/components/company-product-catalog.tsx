import type { ManagedNetworkProfileState } from "@/lib/network";

// COMPANY-UX2.B.1: illustrations describe a canonical family, never the
// company's actual geometry, inventory, capacity or certified specifications.
type Shape = "tube" | "hollow" | "coil" | "plate" | "sheet" | "beam" | "bar" | "rebar" | "wire" | "flat" | "long" | "generic";
const familyShapes: Record<string, Shape> = {
  flat_products: "flat",
  long_products: "long",
  tubes_pipes: "tube",
  coils: "coil",
  plates: "plate",
  sheets: "sheet",
  bars: "bar",
  beams_sections: "beam",
  rebar: "rebar",
  wire_rod_wire: "wire",
  hollow_sections: "hollow",
};

export function IndustrialFamilyMark({ familyKey }: { familyKey: string }) {
  const shape = familyShapes[familyKey] ?? "generic";
  const steel = "#93a8a2", light = "#dce8e3", edge = "#3c6257", dark = "#37564e";
  return (
    <svg viewBox="0 0 184 104" className="h-full w-full" fill="none" aria-hidden="true" focusable="false" data-family-shape={shape}>
      <path d="M23 80H161M34 88H150" stroke="#c6d7cf" strokeWidth="1" />
      <g stroke={edge} strokeWidth="1.5" strokeLinejoin="round">
        {shape === "tube" ? (
          <>
            <path d="M48 36 121 19Q145 15 153 38L80 68Z" fill={steel}/>
            <path d="M48 36 121 19M80 68 153 38" stroke={edge}/>
            <ellipse cx="64" cy="56" rx="24" ry="23" fill={light}/>
            <ellipse cx="64" cy="56" rx="16" ry="15" fill={dark}/>
            <path d="M51 45Q63 32 76 45" stroke="white" strokeWidth="2"/>
          </>
        ) : shape === "hollow" ? (
          <>
            <path d="M37 37 108 18 147 28 76 48Z" fill={light}/>
            <path d="M76 48 147 28 147 66 76 86Z" fill={steel}/>
            <path d="M37 37H76V86H37ZM46 46V77H67V46Z" fill={light} fillRule="evenodd"/>
            <path d="M46 46H67V77H46Z" fill={dark}/>
            <path d="M83 31 127 19" stroke="#f7fbf9" strokeWidth="2"/>
          </>
        ) : shape === "coil" || shape === "wire" ? (
          <>
            <path d="M47 30 118 20Q145 20 145 48Q145 75 118 75L47 85Z" fill={steel}/>
            <ellipse cx="57" cy="56" rx="28" ry="29" fill={light}/>
            <ellipse cx="57" cy="56" rx="13" ry="14" fill={dark}/>
            <ellipse cx="57" cy="56" rx="22" ry="23" stroke={edge}/>
            {shape === "wire" ? <><ellipse cx="57" cy="56" rx="18" ry="19"/><path d="M86 31 130 25M86 39 139 32M85 49 145 42M85 59 145 52M83 69 140 63M76 78 131 72"/></> : <path d="M83 39 140 30M84 74 135 64" stroke="#f7fbf9"/>}
          </>
        ) : shape === "plate" || shape === "sheet" || shape === "flat" ? (
          <>
            {[0, 1, 2].map((i) => (
              <g key={i} transform={"translate(0 " + (i * -11) + ")"}>
                <path d="M31 65 112 41 151 57 70 81Z" fill={light}/>
                <path d="M31 65 70 81 70 88 31 72Z" fill={steel}/>
                <path d="M70 81 151 57 151 64 70 88Z" fill={dark}/>
                <path d="M44 64 111 44" stroke="#f7fbf9" strokeWidth="2"/>
              </g>
            ))}
          </>
        ) : shape === "beam" || shape === "long" ? (
          <>
            <path d="M33 37 112 18 146 27 67 47Z" fill={light}/>
            <path d="M67 47 146 27 146 35 67 55Z" fill={steel}/>
            <path d="M53 49 132 29 132 65 53 85Z" fill={steel}/>
            <path d="M33 76 112 56 146 66 67 86Z" fill={light}/>
            <path d="M67 86 146 66 146 74 67 94Z" fill={steel}/>
            <path d="M33 37H67V45H54V76H67V84H33V76H46V45H33Z" fill={dark}/>
          </>
        ) : shape === "bar" || shape === "rebar" ? (
          <>
            {[0, 1, 2].map((i) => (
              <g key={i} transform={"translate(" + (i * 11) + " " + (i * -15) + ")"}>
                <path d="M37 61 132 36 136 48 41 73Z" fill={steel}/>
                <ellipse cx="39" cy="67" rx="7" ry="7" fill={light}/>
                {shape === "rebar" ? <path d="M56 57l6 11m10-15 6 11m10-15 6 11m10-15 6 11m10-15 6 11" stroke={edge}/> : <path d="M44 61 130 39" stroke="#f7fbf9"/>}
              </g>
            ))}
          </>
        ) : (
          <>
            <path d="M49 37 94 19 141 37 96 55Z" fill={light}/>
            <path d="M49 37V76L96 94V55Z" fill={steel}/>
            <path d="M96 55 141 37V76L96 94Z" fill={dark}/>
            <path d="M72 28 119 46" stroke="white" strokeWidth="2"/>
          </>
        )}
      </g>
    </svg>
  );
}

type CatalogState = Pick<ManagedNetworkProfileState, "products" | "facilities" | "taxonomy" | "technical_scope">;
type Relation = CatalogState["products"][number];

function relationSource(product: Relation) {
  if (product.ownership_type === "platform_verified") return "Verificato dalla piattaforma";
  if (product.ownership_type === "company_managed") return "Dichiarato dall’azienda";
  if (product.source_type === "public_web") return "Da fonte pubblica";
  return "Curato dalla piattaforma";
}

export function CompanyProductCatalog({ state, relationshipLabels }: { state: CatalogState; relationshipLabels: Record<string, string> }) {
  const families = new Set(state.products.map((product) => product.key));
  const empty = state.products.length === 0;
  const examples = ["tubes_pipes", "hollow_sections", "plates", "beams_sections"]
    .flatMap((key) => state.taxonomy.products.filter((family) => family.key === key));
  return (
    <section className="min-w-0 space-y-4 rounded-2xl border border-[#dce2df] bg-[#f7faf8] p-3 sm:p-5" aria-label="Catalogo industriale" data-testid="company-product-catalog">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1a5144]">Identità industriale</p>
          <h3 className="mt-1 text-lg font-semibold text-[#1d2824]">Il tuo catalogo prodotti</h3>
          <p className="mt-1 text-sm text-[#52645b]">{families.size} famiglie associate · {state.products.length} relazioni industriali</p>
        </div>
        <a href="#products-add" className="inline-flex min-h-11 items-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]">Aggiungi famiglia</a>
      </div>
      {empty ? (
        <div data-testid="company-product-catalog-empty" className="space-y-3">
          <p className="rounded-xl border border-[#dce2df] bg-white p-3 text-sm leading-6 text-[#43524c]">Non hai ancora associato prodotti al profilo. Seleziona le famiglie che l’azienda produce, distribuisce, lavora o utilizza.</p>
          {examples.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-[#52645b]">Esempi dalla tassonomia disponibile · non associati alla tua azienda</p>
              <div className="grid min-w-0 grid-cols-2 gap-2 xl:grid-cols-4">
                {examples.map((family) => (
                  <div key={family.key} className="min-w-0 rounded-xl border border-[#dce2df] bg-white p-2">
                    <div className="h-20 rounded-lg bg-[#edf4f0]"><IndustrialFamilyMark familyKey={family.key}/></div>
                    <p className="mt-2 break-words text-xs font-semibold text-[#43524c]">{family.name}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="company-product-cards">
          {state.products.map((product) => {
            const facility = state.facilities.find((item) => item.id === product.facility_id);
            const standards = state.technical_scope.standard_scopes.filter((scope) => scope.company_product_id === product.id).length;
            const grades = state.technical_scope.grade_scopes.filter((scope) => scope.company_product_id === product.id).length;
            const dimensions = state.technical_scope.dimension_scopes.filter((scope) => scope.company_product_id === product.id).length;
            return (
              <article key={product.id} data-testid="company-product-card" data-product-key={product.key} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
                <div className="h-28 bg-[#edf4f0] px-4 py-2"><IndustrialFamilyMark familyKey={product.key}/></div>
                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#1a5144]">{relationshipLabels[product.relationship_type] ?? product.relationship_type}</p>
                    <h4 className="mt-1 break-words text-base font-semibold text-[#1d2824]">{product.name}</h4>
                    <p className="mt-1 break-words text-xs text-[#52645b]">{facility?.name ?? (product.facility_id ? "Sede non disponibile" : "Intera azienda")}</p>
                    <p className="mt-2 text-xs font-medium text-[#52645b]">{relationSource(product)}</p>
                  </div>
                  <dl className="grid grid-cols-3 gap-1 rounded-xl bg-[#f4f7f5] p-2 text-center">
                    {([["Norme", standards], ["Gradi", grades], ["Range", dimensions]] as const).map(([label, count]) => (
                      <div key={label} className="min-w-0"><dt className="text-[11px] text-[#52645b]">{label}</dt><dd className="mt-0.5 font-semibold tabular-nums text-[#1d2824]">{count}</dd></div>
                    ))}
                  </dl>
                  <a href={"#products-item-" + product.id} className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl border border-[#c5d5ce] px-2 text-center text-xs font-semibold text-[#1a5144] hover:bg-[#edf4f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]">Gestisci specifiche <span aria-hidden="true" className="ml-1">→</span></a>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="text-xs leading-5 text-[#52645b]">Illustrazioni schematiche delle famiglie, non fotografie o specifiche dell’azienda. I conteggi riflettono le relazioni e i dati tecnici registrati nel profilo, non la verifica o la disponibilità a stock.</p>
    </section>
  );
}
