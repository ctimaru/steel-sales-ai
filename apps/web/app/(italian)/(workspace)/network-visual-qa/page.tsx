import {notFound} from "next/navigation";
import {NetworkCompactExperience} from "@/components/network-compact-experience";
import { NetworkProfileInventory } from "@/components/network-profile-inventory";
import { NetworkProfileOverview, NetworkProfileTopBar } from "@/components/network-profile-overview";
import { NetworkInventoryManager } from "@/components/network-inventory-manager";
import type { NetworkInventoryItem } from "@/lib/network-stock";
import {getWorkspaceContext} from "@/lib/workspace-context";
import type {CompactNetworkFilters,CompactNetworkPage} from "@/lib/network-compact-directory";

/**
 * NET-UX-FILTERS1: visual-only local fixture to exercise the *real* compact
 * Network layout even when synthetic GoTrue accounts land on the legacy
 * discovery fallback. Never reachable in production or on hosted previews.
 * All companies are fictional labels; no real contacts, claims or RFQs.
 */
export const dynamic="force-dynamic";

const filters:CompactNetworkFilters={country:"IT"};
const directory:CompactNetworkPage={
  items:[
    {
      id:"00000000-0000-0000-0000-000000000091",
      legal_name:"DEMO Tubi Strutturali",
      trading_name:null,
      country_code:"IT",
      website_url:null,
      verification_status:"unverified",
      claimed_status:"unclaimed",
      roles:[{key:"producer",name:"Produttore",is_primary:true}],
      products:["Tubi"],
      location:{city:"Milano",region:"Lombardia"},
    },
    {
      id:"00000000-0000-0000-0000-000000000092",
      legal_name:"DEMO Carpenteria Tecnica",
      trading_name:null,
      country_code:"IT",
      website_url:null,
      verification_status:"unverified",
      claimed_status:"unclaimed",
      roles:[{key:"processor_service_provider",name:"Terzista",is_primary:true}],
      products:["Profilati cavi"],
      location:{city:"Bergamo",region:"Lombardia"},
    },
  ],
  total:2,published:2,discovered:0,
  page:1,pages:1,first:1,last:2,discoveryUnavailable:false,
};

/** Only for the gated localhost visual route. Never stored or published to a real company. */
const stockVisualFixture: NetworkInventoryItem[] = [
  {
    id: "00000000-0000-0000-0000-0000000000a1",
    company_id: "00000000-0000-0000-0000-000000000091",
    kind: "stock", product_name: "Tubo strutturale tondo",
    standard: "EN 10219", grade: "S355J2H",
    dimensions: "Ø 323,9 × 6,3 mm · 12 m",
    quantity: 12.75, unit: "t", location: "Milano",
    available_on: null, updated_at: "2026-11-11T12:00:00Z",
    provenance: "company_declared", publication_status: "published",
  },
  {
    id: "00000000-0000-0000-0000-0000000000a2",
    company_id: "00000000-0000-0000-0000-000000000091",
    kind: "incoming", product_name: "Profilato cavo rettangolare",
    standard: "EN 10219", grade: "S355J2H", dimensions: "200 × 100 × 8 mm",
    quantity: 18, unit: "t", location: "Bergamo",
    available_on: "2026-12-01", updated_at: "2026-11-11T12:00:00Z",
    provenance: "company_declared", publication_status: "published",
  },
  {
    id: "00000000-0000-0000-0000-0000000000a3",
    company_id: "00000000-0000-0000-0000-000000000091",
    kind: "production", product_name: "Tubo tondo saldato",
    standard: "EN 10219", grade: "S235JR", dimensions: "Ø 355,6 × 6,3 mm",
    quantity: 24, unit: "t", location: "Brescia",
    available_on: "2027-01-15", updated_at: "2026-11-11T12:00:00Z",
    provenance: "company_declared", publication_status: "published",
  },
];

export default async function NetworkVisualQaPage(){
  if(process.env.NODE_ENV!=="development"||
     process.env.FLOW1_LOCAL_PROVIDER!=="true"||
     process.env.NETWORK_VISUAL_FIXTURE!=="true")notFound();
  const {organizationId,userId}=await getWorkspaceContext();
  return (
    <div className="space-y-5">
      <NetworkCompactExperience
        accessMode="pro" directory={directory} filters={filters}
        organizationId={organizationId} userId={userId} canCompose={false}
        additionalFilters={{
          products:[{canonical_key:"tubes_pipes",display_name:"Tubi"},{canonical_key:"hollow_sections",display_name:"Profilati cavi"}],
          capabilities:[{canonical_key:"welding_fabrication",display_name:"Saldatura e carpenteria"}],
          markets:[{canonical_key:"construction_infrastructure",display_name:"Edilizia e infrastrutture"}],
        }}
      />
      <div className="mx-auto max-w-6xl space-y-4 px-3 pb-10">
        <p className="text-xs font-semibold text-[#52665a]">Solo QA locale: aziende, stock e quantità sintetici</p>
        <NetworkProfileTopBar />
        <NetworkProfileOverview
          name="DEMO Tubi Strutturali"
          legalName="DEMO Tubi Strutturali S.r.l."
          countryCode="IT"
          location="Bergamo, Lombardia"
          primaryRole="Produttore"
          roles={["Produttore", "Trasformatore"]}
          description="Produzione di tubi saldati e profilati cavi per carpenterie, strutture industriali e costruzioni meccaniche. Le informazioni di questa scheda sono esclusivamente sintetiche per test UI."
          evidenceSourceUrl="https://example.org/company/facts"
          products={["Tubi tondi saldati", "Profilati cavi rettangolari", "Profilati cavi quadrati"]}
          services={["Taglio a misura", "Lavorazioni meccaniche"]}
          email="contatti@example.invalid"
          stockCount={stockVisualFixture.length}
          stockContent={<NetworkProfileInventory items={stockVisualFixture} />}
          connectionsAvailable={true}
          actions={<a href="#attivita" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white">Esplora attività ↗</a>}
        />
        <div data-testid="network-profile-sparse-fixture" className="pt-2">
          <NetworkProfileOverview
            name="DEMO Acciai S.p.A."
            countryCode="IT"
            primaryRole="Commerciante"
            roles={["Commerciante"]}
            website="https://example.org"
            connectionsAvailable={true}
            actions={<a href="#contatti" className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[#cbded0] bg-white px-4 text-sm font-semibold text-[#23553c]">Esplora i contatti</a>}
          />
        </div>
        <NetworkInventoryManager
          organizationId={organizationId}
          companyId={stockVisualFixture[0].company_id}
          canPublish={true}
          inventory={{ready:true,items:[
            ...stockVisualFixture,
            {...stockVisualFixture[0],id:"00000000-0000-0000-0000-0000000000a4",
              product_name:"Tubo quadro",dimensions:"120 × 120 × 6 mm",
              publication_status:"draft" as const},
          ]}}
        />
      </div>
    </div>
  );
}
