import type { ManagedNetworkProfileState, ManagedProfileRelationMeta } from "@/lib/network";
import { networkLabelIt } from "@/lib/network-taxonomy-it";
import {
  certificationValidityLabels,
  certificationValidityState,
  certificationVerification,
  formatCertificationDate,
} from "@/lib/company-certification-display";

type MarketState = Pick<ManagedNetworkProfileState, "markets">;
type CertificationState = Pick<ManagedNetworkProfileState, "certifications" | "facilities">;

// Schematic sector icons describe the canonical taxonomy, not customers,
// geographic coverage, endorsements or company-owned imagery.
const marketPaths: Record<string, string> = {
  automotive: "M4 10l2-5h12l2 5 M3 10h18v8H3z M6 18v3 M18 18v3 M6 14h2 M16 14h2",
  construction_infrastructure: "M3 21h18 M5 21V7h7v14 M12 12h7v9 M5 7l7-4v4 M8 10v2 M8 15v2 M15 15h1",
  energy: "M13 2L5 13h6l-1 9 9-12h-7z",
  hvac: "M3 4h18v7H3z M6 8h12 M7 14v5l-2-2 M12 14v7 M17 14v5l2-2",
  mechanical_engineering_market: "M3 21h18 M5 18V5h8v4H9v9 M13 7h7v9h-7z M13 12h7 M17 16v4",
  agri_machinery: "M3 14h10V5h5v9h3v4h-3 M13 9h5 M3 14V9h7v5 M8 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M21 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  appliances: "M4 3h16v18H4z M4 7h16 M7 5h1 M11 5h1 M16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  marine: "M3 14l9-3 9 3-3 5H6z M7 12V6h10v6 M10 6V3h4v3 M2 22c2-2 3 2 5 0s3 2 5 0 3 2 5 0 3 2 5 0",
};
const neutralMarketPath = "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z";
const documentPath = "M6 2h9l5 5v15H6z M15 2v6h5 M9 12h8 M9 16h8 M9 19h5";
const panelClass = "min-w-0 space-y-4 rounded-2xl border border-[#dce2df] bg-[#f7faf8] p-3 sm:p-5";
const addLink = "inline-flex min-h-11 max-w-full items-center justify-center rounded-xl bg-[#1a5144] px-4 py-2 text-center text-sm font-semibold text-white hover:bg-[#226657] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]";
const manageLink = "inline-flex min-h-11 items-center justify-center rounded-xl border border-[#c5d5ce] px-3 py-2 text-center text-xs font-semibold text-[#1a5144] hover:bg-[#edf4f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]";
const badgeClass = "inline-block max-w-full break-words rounded-full px-2.5 py-1 text-[11px] font-semibold leading-4";

function Mark({ path }: { path: string }) {
  return (
    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e5f0eb] text-[#1a5144]">
      <svg viewBox="0 0 24 24" className="h-6 w-6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={path} /></svg>
    </span>
  );
}

export function companyRelationSource(item: Pick<ManagedProfileRelationMeta, "ownership_type" | "source_type">) {
  if (item.ownership_type === "company_managed") return "Dichiarazione aziendale";
  if (item.source_type === "public_web") return "Fonte pubblica";
  if (["platform_curated", "platform_verified"].includes(item.ownership_type) || item.source_type === "platform_curated") return "Fonte della piattaforma";
  if (item.ownership_type === "system_derived" || item.source_type === "system_derived") return "Dato derivato dal sistema";
  return "Provenienza non indicata";
}

export function CertificationVerificationBadge({ status }: { status: string }) {
  const display = certificationVerification(status);
  const tone = display.tone === "confirmed" ? "bg-[#e5f0eb] text-[#1a5144]"
    : display.tone === "pending" ? "bg-amber-50 text-amber-800"
    : display.tone === "attention" ? "bg-rose-50 text-rose-800"
    : "bg-[#ecefed] text-[#52645b]";
  return <span data-testid="company-certification-verification" data-verification-status={status} className={badgeClass + " " + tone}>{display.label}</span>;
}

export function CompanyMarkets({ state }: { state: MarketState }) {
  return (
    <section aria-label="Settori serviti" data-testid="company-markets-overview" className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1a5144]">Presenza nei mercati</p>
          <h3 className="mt-1 text-lg font-semibold text-[#1d2824]">I tuoi settori di riferimento</h3>
          <p className="mt-1 text-sm text-[#52645b]">{state.markets.length} {state.markets.length === 1 ? "settore registrato" : "settori registrati"}</p>
        </div>
        <a href="#markets-add" className={addLink}>Aggiungi settore</a>
      </div>
      {state.markets.length === 0 ? (
        <div data-testid="company-markets-empty" className="rounded-xl border border-[#dce2df] bg-white p-4 text-sm leading-6 text-[#43524c]">
          Nessun settore registrato. Aggiungi i settori nei quali opera la tua azienda per descrivere il suo posizionamento industriale.
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {state.markets.map((market) => (
            <article key={market.id} data-testid="company-market-card" data-market-key={market.key} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#dce2df] bg-white p-4">
              <div className="flex min-w-0 items-start gap-3">
                <Mark path={marketPaths[market.key] ?? neutralMarketPath} />
                <div className="min-w-0">
                  <h4 className="break-words text-base font-semibold text-[#1d2824]">{networkLabelIt(market.key, market.name)}</h4>
                  <p data-testid="company-market-provenance" className="mt-2 break-words text-xs leading-5 text-[#52645b]">{companyRelationSource(market)}</p>
                  {market.ownership_type === "platform_verified" ? <span data-testid="company-market-verification" className={"mt-2 " + badgeClass + " bg-[#e5f0eb] text-[#1a5144]"}>Dato verificato dalla piattaforma</span> : null}
                </div>
              </div>
              <a href={"#markets-item-" + market.id} className={"mt-auto " + manageLink}>{market.ownership_type === "platform_verified" ? "Consulta settore" : "Gestisci settore"}<span aria-hidden="true" className="ml-1">→</span></a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function CompanyCertifications({ state }: { state: CertificationState }) {
  // Evaluate SQL calendar dates against one UTC day for this server render,
  // never independently during browser hydration.
  const today = new Date().toISOString().slice(0, 10);
  const verified = state.certifications.filter((item) => item.verification_status === "verified").length;
  const withEvidence = state.certifications.filter((item) => item.evidence_reference?.trim()).length;
  return (
    <section aria-label="Certificazioni e riferimenti" data-testid="company-certification-overview" className={panelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1a5144]">Documenti e qualifiche</p>
          <h3 className="mt-1 text-lg font-semibold text-[#1d2824]">Le tue certificazioni</h3>
          <p className="mt-1 text-sm text-[#52645b]">Ente, ambito e date riportati nel profilo.</p>
        </div>
        <a href="#certifications-add" className={addLink}>Aggiungi certificazione</a>
      </div>
      <dl className="grid grid-cols-3 gap-1.5 rounded-xl border border-[#dce2df] bg-white p-2 text-center" data-testid="company-certification-counts">
        {([["Registrate", state.certifications.length], ["Verifica registrata", verified], ["Riferimento presente", withEvidence]] as const).map(([label, value]) => (
          <div key={label} className="min-w-0 px-1 py-1"><dt className="break-words text-[11px] leading-4 text-[#52645b]">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-[#1d2824]">{value}</dd></div>
        ))}
      </dl>
      {state.certifications.length === 0 ? (
        <div data-testid="company-certifications-empty" className="rounded-xl border border-[#dce2df] bg-white p-4 text-sm leading-6 text-[#43524c]">
          Nessuna certificazione registrata. Aggiungi le certificazioni effettivamente disponibili, indicando ente, ambito e date conosciute.
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 xl:grid-cols-2">
          {state.certifications.map((item) => {
            const validity = certificationValidityState(item, today);
            const facilityName = item.facility_id ? state.facilities.find((site) => site.id === item.facility_id)?.name ?? "Sede collegata non disponibile" : "Intera azienda";
            const evidence = item.evidence_reference?.trim();
            return (
              <article key={item.id} data-testid="company-certification-card" data-certification-id={item.id} data-validity-state={validity} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#dce2df] bg-white p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Mark path={documentPath} />
                  <div className="min-w-0">
                    <h4 className="break-words text-base font-semibold text-[#1d2824]">{item.name}</h4>
                    <p className="mt-1 break-words text-xs leading-5 text-[#52645b]">{item.issuer || "Ente non indicato"}</p>
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap gap-1.5">
                  <span data-testid="company-certification-validity" className={badgeClass + (validity === "expired" ? " bg-rose-50 text-rose-800" : validity === "not_yet_valid" ? " bg-amber-50 text-amber-800" : " bg-[#ecefed] text-[#43524c]")}>{certificationValidityLabels[validity]}</span>
                  <CertificationVerificationBadge status={item.verification_status} />
                </div>
                <dl className="grid min-w-0 gap-3 text-xs sm:grid-cols-2">
                  <div className="min-w-0"><dt className="font-semibold text-[#43524c]">Identificativo</dt><dd className="mt-1 break-words leading-5 text-[#52645b] [overflow-wrap:anywhere]">{item.certificate_identifier || "Non indicato"}</dd></div>
                  <div className="min-w-0"><dt className="font-semibold text-[#43524c]">Azienda / sede</dt><dd className="mt-1 break-words leading-5 text-[#52645b]">{facilityName}</dd></div>
                  <div className="min-w-0"><dt className="font-semibold text-[#43524c]">Valida dal</dt><dd className="mt-1 leading-5 text-[#52645b]">{item.valid_from ? formatCertificationDate(item.valid_from) : "Data iniziale non indicata"}</dd></div>
                  <div className="min-w-0"><dt className="font-semibold text-[#43524c]">Scadenza</dt><dd className="mt-1 leading-5 text-[#52645b]">{item.valid_to ? formatCertificationDate(item.valid_to) : "Scadenza non indicata"}</dd></div>
                  <div className="min-w-0 sm:col-span-2"><dt className="font-semibold text-[#43524c]">Provenienza</dt><dd data-testid="company-certification-provenance" className="mt-1 break-words leading-5 text-[#52645b]">{companyRelationSource(item)}</dd></div>
                  <div className="min-w-0 sm:col-span-2"><dt className="font-semibold text-[#43524c]">Ambito di applicazione</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-5 text-[#52645b] [overflow-wrap:anywhere]">{item.scope_text || "Ambito di applicazione non indicato"}</dd></div>
                  <div className="min-w-0 sm:col-span-2"><dt className="font-semibold text-[#43524c]">Riferimento documentale</dt><dd data-testid="company-certification-evidence" className="mt-1 whitespace-pre-wrap break-words leading-5 text-[#52645b] [overflow-wrap:anywhere]">{evidence || "Nessun riferimento indicato"}</dd></div>
                </dl>
                <a href={"#certifications-item-" + item.id} className={"mt-auto " + manageLink}>{item.verification_status === "unverified" ? "Gestisci certificazione" : "Consulta certificazione"}<span aria-hidden="true" className="ml-1">→</span></a>
              </article>
            );
          })}
        </div>
      )}
      <p className="text-xs leading-5 text-[#52645b]">Periodo indicato, verifica della piattaforma e provenienza sono informazioni distinte. La presenza di un riferimento documentale non equivale a una verifica.</p>
    </section>
  );
}
