"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  importRfqh8MarketplaceResponse,
  prepareRfqh8MarketplaceBridge,
  publishRfqh8MarketplaceBridge,
} from "@/app/(workspace)/marketplace/rfq-hub/[rfqId]/marketplace-actions";
import { addSupplierToBuyerRfq } from "@/app/(workspace)/marketplace/rfq-hub/actions";
import { appRoutes } from "@/lib/routes";

type Suggestion = {
  supplier_network_company_id: string;
  supplier_network_contact_id: string | null;
  supplier_organization_id: string | null;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  country_code: string | null;
  delivery_channel: "email" | "platform" | "both";
  match_score: number;
  match_band: string;
  matched_line_count: number;
  total_line_count: number;
  line_matches: unknown;
  claimed_status: string;
  verification_status: string;
  direct_invite_ready: boolean;
};

export type Rfqh8SourcePreviewLine = {
  id: string;
  line_position: number;
  description: string | null;
  standard_code: string | null;
  grade_code: string | null;
  finish_code: string | null;
  line_tonnes: number | null;
};

type MarketplaceResponse = {
  response_id: string;
  supplier_organization_id: string;
  supplier_name: string;
  response_kind: "interest" | "quote";
  status: string;
  message: string | null;
  valid_until: string | null;
  submitted_at: string | null;
  priced_line_count: number;
  line_count: number;
  imported: boolean;
  imported_quote_id: string | null;
  imported_at: string | null;
};

export type Rfqh8BridgeState = {
  contract?: string;
  rfq_id?: string;
  bridge_ready: boolean;
  bridge?: {
    bridge_id: string;
    marketplace_request_id: string;
    bridge_status: string;
    marketplace_status: string;
    product_family_key: string;
    visibility_mode: "named" | "anonymous";
    delivery_country_code: string;
    delivery_region: string | null;
    published_at: string | null;
    closes_at: string | null;
  };
  suggestions?: {
    network_enabled?: boolean;
    candidates?: Suggestion[];
  };
  match_summary?: {
    total_matches?: number;
    contactable_matches?: number;
    notifications_created?: number;
    bands?: { strong?: number; good?: number; broad?: number };
  };
  responses?: MarketplaceResponse[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function channelLabel(channel: Suggestion["delivery_channel"]) {
  if (channel === "both") return "Email + piattaforma";
  if (channel === "platform") return "Piattaforma";
  return "Email";
}

export function RfqMarketplaceBridgePanel({
  rfqId,
  campaignStatus,
  state,
  sourceLines,
  canExecute = false,
}: {
  rfqId: string;
  campaignStatus: string;
  state: Rfqh8BridgeState | null;
  sourceLines: Rfqh8SourcePreviewLine[];
  canExecute?: boolean;
}) {
  const router = useRouter();
  const [productFamilyKey, setProductFamilyKey] = useState("tubes_pipes");
  const [visibilityMode, setVisibilityMode] =
    useState<"named" | "anonymous">("named");
  const [countryCode, setCountryCode] = useState("IT");
  const [region, setRegion] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [publishConsent, setPublishConsent] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const bridgeReady = state?.bridge_ready === true;
  const bridge = state?.bridge;
  const suggestions = state?.suggestions?.candidates ?? [];
  const responses = state?.responses ?? [];
  const readOnly = !canExecute || ["awarded", "closed", "cancelled"].includes(campaignStatus);
  const canDirectInvite = ["draft", "ready"].includes(campaignStatus);

  function prepare() {
    setFeedback(null);
    setBusyKey("prepare");
    startTransition(async () => {
      const result = await prepareRfqh8MarketplaceBridge({
        rfqId,
        productFamilyKey,
        visibilityMode,
        countryCode,
        region,
      });
      setBusyKey(null);
      if (!result.ok) {
        setFeedback(result.error ?? "Preparazione non riuscita.");
        return;
      }
      setFeedback("Bridge preparato. Nulla è stato pubblicato.");
      router.refresh();
    });
  }

  function publish() {
    if (!publishConsent || readOnly || !bridgeReady || bridge?.marketplace_status === "published") return;
    if (!window.confirm("Confermi la pubblicazione volontaria dei dati elencati nell’anteprima? La ricerca sarà visibile nel Marketplace.")) return;

    setFeedback(null);
    setBusyKey("publish");
    startTransition(async () => {
      const result = await publishRfqh8MarketplaceBridge({
        rfqId,
        durationDays,
        acknowledged: publishConsent,
      });
      setBusyKey(null);
      if (!result.ok) {
        setFeedback(result.error ?? "Pubblicazione non riuscita.");
        return;
      }
      setPublishConsent(false);
      setFeedback("Domanda pubblicata nel Marketplace e matching aggiornato.");
      router.refresh();
    });
  }

  function addSuggestion(candidate: Suggestion) {
    setFeedback(null);
    setBusyKey("supplier:" + candidate.supplier_network_company_id);
    startTransition(async () => {
      const result = await addSupplierToBuyerRfq({
        rfqId,
        identitySource: candidate.supplier_network_contact_id
          ? "network_contact"
          : "network_company",
        supplierName: candidate.company_name,
        supplierEmail: candidate.email,
        supplierNetworkCompanyId: candidate.supplier_network_company_id,
        supplierNetworkContactId: candidate.supplier_network_contact_id,
        supplierOrganizationId: candidate.supplier_organization_id,
      });
      setBusyKey(null);

      if (!result.ok) {
        setFeedback(result.error ?? "Aggiunta supplier non riuscita.");
        return;
      }

      setFeedback(candidate.company_name + " aggiunto alla RFQ privata.");
      router.refresh();
    });
  }

  function importResponse(responseId: string) {
    setFeedback(null);
    setBusyKey("response:" + responseId);
    startTransition(async () => {
      const result = await importRfqh8MarketplaceResponse({
        rfqId,
        responseId,
      });
      setBusyKey(null);

      if (!result.ok) {
        setFeedback(result.error ?? "Import risposta non riuscito.");
        return;
      }

      setFeedback("Risposta Marketplace importata nel confronto RFQH5.");
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-[#cddbd6] bg-white">
      <div className="border-b border-[#e3eae7] bg-[#f5f9f7] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              RFQ Hub · Pubblicazione Marketplace
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Amplia la ricerca senza perdere il controllo della RFQ
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Usa il matching del Network per trovare supplier pertinenti e, solo se lo decidi,
              pubblica volontariamente una versione selezionata della domanda nel Marketplace.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#173f35]">
            Target buyer sempre privato
          </span>
        </div>
      </div>

      {!bridgeReady ? (
        <div className="p-5 sm:p-6">
          <div className="rounded-2xl border border-[#dce2df] bg-[#fbfcfb] p-4">
            <p className="text-sm font-semibold text-[#1d2824]">
              Prepara il bridge
            </p>
            <p className="mt-1 text-xs leading-5 text-[#718078]">
              Questa operazione crea solo una bozza Marketplace e il mapping delle righe.
              Non pubblica nulla e non copia Target €/t, Target €/m o Target totale.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-semibold text-[#52615b]">
                Famiglia prodotto
                <select
                  value={productFamilyKey}
                  onChange={(event) => setProductFamilyKey(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs"
                >
                  <option value="tubes_pipes">Tubes &amp; pipes</option>
                  <option value="hollow_sections">Hollow sections</option>
                  <option value="long_products">Long products</option>
                  <option value="flat_products">Flat products</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-[#52615b]">
                Visibilità buyer
                <select
                  value={visibilityMode}
                  onChange={(event) =>
                    setVisibilityMode(event.target.value as "named" | "anonymous")
                  }
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs"
                >
                  <option value="named">Azienda visibile</option>
                  <option value="anonymous">Anonima</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-[#52615b]">
                Paese consegna
                <input
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
                  maxLength={2}
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs uppercase"
                />
              </label>

              <label className="text-xs font-semibold text-[#52615b]">
                Regione / area
                <input
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  placeholder="Es. Lombardia"
                  className="mt-1.5 h-10 w-full rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={prepare}
              disabled={pending || readOnly || countryCode.trim().length !== 2}
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busyKey === "prepare" ? "Preparo…" : "Prepara Network + Marketplace"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-[#f7f9f8] p-4">
              <p className="text-[10px] font-bold uppercase text-[#718078]">
                Marketplace
              </p>
              <p className="mt-1 text-base font-semibold text-[#1d2824]">
                {bridge?.marketplace_status === "published" ? "Pubblicato" : "Bozza privata"}
              </p>
            </div>
            <div className="rounded-2xl bg-[#f7f9f8] p-4">
              <p className="text-[10px] font-bold uppercase text-[#718078]">
                Match Network
              </p>
              <p className="mt-1 text-base font-semibold text-[#1d2824]">
                {state?.match_summary?.total_matches ?? suggestions.length}
              </p>
            </div>
            <div className="rounded-2xl bg-[#f7f9f8] p-4">
              <p className="text-[10px] font-bold uppercase text-[#718078]">
                Invitabili direttamente
              </p>
              <p className="mt-1 text-base font-semibold text-[#1d2824]">
                {state?.match_summary?.contactable_matches ??
                  suggestions.filter((item) => item.direct_invite_ready).length}
              </p>
            </div>
            <div className="rounded-2xl bg-[#f7f9f8] p-4">
              <p className="text-[10px] font-bold uppercase text-[#718078]">
                Risposte Marketplace
              </p>
              <p className="mt-1 text-base font-semibold text-[#1d2824]">
                {responses.length}
              </p>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
                  Supplier suggeriti
                </p>
                <p className="mt-1 text-xs leading-5 text-[#718078]">
                  Ranking trasparente del motore Marketplace P5.5. Non è un award automatico.
                </p>
              </div>
            </div>

            {suggestions.length ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {suggestions.map((candidate) => (
                  <article
                    key={candidate.supplier_network_company_id}
                    className="rounded-2xl border border-[#dce2df] bg-[#fbfcfb] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1d2824]">
                          {candidate.company_name}
                        </p>
                        <p className="mt-1 text-xs text-[#718078]">
                          {candidate.contact_name || candidate.email || channelLabel(candidate.delivery_channel)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-bold text-[#173f35]">
                        {candidate.match_score}/100 · {candidate.match_band}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                      <span className="rounded-full bg-white px-2 py-1 ring-1 ring-inset ring-[#dce2df]">
                        {candidate.matched_line_count}/{candidate.total_line_count} righe
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 ring-1 ring-inset ring-[#dce2df]">
                        {channelLabel(candidate.delivery_channel)}
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 ring-1 ring-inset ring-[#dce2df]">
                        {candidate.verification_status}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {canDirectInvite && candidate.direct_invite_ready && !readOnly ? (
                        <button
                          type="button"
                          onClick={() => addSuggestion(candidate)}
                          disabled={pending}
                          className="inline-flex min-h-9 items-center rounded-xl border border-[#b8d2c8] bg-white px-3 text-xs font-bold text-[#173f35] disabled:opacity-50"
                        >
                          {busyKey === "supplier:" + candidate.supplier_network_company_id
                            ? "Aggiungo…"
                            : "Aggiungi alla RFQ privata"}
                        </button>
                      ) : (
                        <span className="text-[10px] font-semibold text-[#718078]">
                          {candidate.direct_invite_ready
                            ? "RFQ già avviata: disponibile via Marketplace."
                            : "Raggiungibile via Marketplace."}
                        </span>
                      )}
                      <Link
                        href={appRoutes.network.company(candidate.supplier_network_company_id)}
                        className="text-xs font-semibold text-[#52615b] underline underline-offset-4"
                      >
                        Profilo Network
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-[#d6dedb] px-4 py-4 text-xs text-[#718078]">
                Nessun match Network disponibile con le evidenze correnti.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#dce2df] bg-[#fbfcfb] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
                  Pubblicazione Marketplace
                </p>
                <p className="mt-1 text-xs leading-5 text-[#718078]">
                  Mirror: {bridge?.visibility_mode === "anonymous" ? "buyer anonimo" : "azienda visibile"} · {bridge?.product_family_key}.
                  Il Target RFQ non viene mai pubblicato.
                </p>
              </div>

              {bridge?.marketplace_status === "published" && bridge.marketplace_request_id ? (
                <Link
                  href={appRoutes.marketplace.request(bridge.marketplace_request_id)}
                  className="text-xs font-bold text-[#173f35] underline underline-offset-4"
                >
                  Apri richiesta Marketplace
                </Link>
              ) : null}
            </div>

            {bridge?.marketplace_status !== "published" ? (
              <div className="mt-4 space-y-3 rounded-xl border border-[#cbdcd4] bg-white p-3 sm:p-4" aria-label="Anteprima pubblicazione Marketplace">
                <div>
                  <p className="text-sm font-bold text-[#173f35]">Controlla prima di pubblicare</p>
                  <p className="mt-1 text-xs leading-5 text-[#52615b]">
                    Saranno visibili titolo della ricerca, famiglia prodotto, norme, gradi, descrizioni degli articoli,
                    quantità e zona di consegna. Identità buyer: {bridge?.visibility_mode === "anonymous" ? "anonima" : "azienda visibile"}.
                    Nessun prezzo target, offerta ricevuta, email dei fornitori o nota privata verrà copiato dal motore RFQ.
                    Verifica che anche le descrizioni non contengano dettagli riservati.
                  </p>
                </div>
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <p><strong>Consegna:</strong> {bridge?.delivery_country_code || "—"} {bridge?.delivery_region || ""}</p>
                  <p><strong>Famiglia:</strong> {bridge?.product_family_key || "—"}</p>
                </div>
                <div className="max-h-52 divide-y divide-[#e7ece9] overflow-y-auto rounded-lg border border-[#e7ece9]">
                  {sourceLines.map((line) => (
                    <div key={line.id} className="px-3 py-2 text-xs">
                      <strong className="text-[#1d2824]">{line.line_position}. {line.description || "Articolo"}</strong>
                      <p className="mt-0.5 text-[#66736e]">
                        {[line.standard_code, line.grade_code, line.finish_code].filter(Boolean).join(" · ")}
                        {" · "}{Number(line.line_tonnes ?? 0).toLocaleString("it-IT", { maximumFractionDigits: 3 })} t
                      </p>
                    </div>
                  ))}
                </div>
                {canExecute && !readOnly ? (
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-[#f4f8f6] p-3 text-xs leading-5 text-[#173f35]">
                    <input type="checkbox" checked={publishConsent} onChange={(event) => setPublishConsent(event.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 accent-[#1a5144]" />
                    Ho verificato descrizioni, quantità, identità e luogo di consegna e autorizzo espressamente la pubblicazione nel Marketplace.
                  </label>
                ) : null}
              </div>
            ) : null}

            {bridge?.marketplace_status !== "published" && !readOnly ? (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-xs font-semibold text-[#52615b]">
                  Durata pubblicazione
                  <select
                    value={durationDays}
                    onChange={(event) => setDurationDays(Number(event.target.value))}
                    className="ml-2 h-10 rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs"
                  >
                    <option value={1}>1 giorno</option>
                    <option value={3}>3 giorni</option>
                    <option value={7}>7 giorni</option>
                    <option value={14}>14 giorni</option>
                    <option value={30}>30 giorni</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={publish}
                  disabled={pending || !publishConsent || !canExecute}
                  className="inline-flex min-h-11 items-center rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busyKey === "publish" ? "Pubblico…" : "Pubblica nel Marketplace"}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs font-semibold text-[#52615b]">
                {bridge?.marketplace_status === "published"
                  ? "Attiva fino a " + formatDate(bridge.closes_at)
                  : "Pubblicazione non disponibile nello stato corrente."}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
              Risposte dal Marketplace
            </p>
            <p className="mt-1 text-xs leading-5 text-[#718078]">
              Le quotazioni importate diventano revisioni RFQ strutturate e confluiscono subito nel confronto RFQH5.
            </p>

            {responses.length ? (
              <div className="mt-3 space-y-2">
                {responses.map((response) => (
                  <article
                    key={response.response_id}
                    className="flex flex-col gap-3 rounded-2xl border border-[#dce2df] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#1d2824]">
                          {response.supplier_name}
                        </p>
                        <span className="rounded-full bg-[#edf5f2] px-2 py-0.5 text-[9px] font-bold uppercase text-[#173f35]">
                          {response.response_kind}
                        </span>
                        <span className="rounded-full bg-[#f2f4f3] px-2 py-0.5 text-[9px] font-semibold text-[#66736e]">
                          {response.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#718078]">
                        {response.priced_line_count}/{response.line_count} righe prezzate · {formatDate(response.submitted_at)}
                      </p>
                      {response.message ? (
                        <p className="mt-1 max-w-2xl text-xs text-[#66736e]">{response.message}</p>
                      ) : null}
                    </div>

                    {response.imported ? (
                      <span className="text-xs font-bold text-[#17634c]">
                        Importata in RFQH5 ✓
                      </span>
                    ) : response.response_kind === "quote" && !readOnly ? (
                      <button
                        type="button"
                        onClick={() => importResponse(response.response_id)}
                        disabled={pending}
                        className="inline-flex min-h-10 shrink-0 items-center rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 text-xs font-bold text-[#173f35] disabled:opacity-50"
                      >
                        {busyKey === "response:" + response.response_id
                          ? "Importo…"
                          : "Importa nel confronto RFQ"}
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold text-[#718078]">
                        {response.response_kind === "interest"
                          ? "Manifestazione di interesse: non è ancora una quote."
                          : "RFQ chiusa all'import."}
                      </span>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-[#d6dedb] px-4 py-4 text-xs text-[#718078]">
                Nessuna risposta Marketplace collegata a questa RFQ.
              </p>
            )}
          </div>
        </div>
      )}

      {feedback ? (
        <div className="border-t border-[#e7ece9] px-5 py-3 text-xs font-semibold text-[#52615b] sm:px-6">
          {feedback}
        </div>
      ) : null}
    </section>
  );
}
