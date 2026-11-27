"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { descriptionSourceUrl } from "@/lib/company-description-assistant";
import {
  industrialGroup,
  industrialTargetHref,
  type IndustrialActionState,
  type IndustrialKind,
  type IndustrialProposal,
  type IndustrialReview,
  type IndustrialSelection,
} from "@/lib/company-industrial-assistant";
import type { ManagedNetworkProfileState } from "@/lib/network";
import { networkLabelIt } from "@/lib/network-taxonomy-it";

type Props = {
  companyId: string;
  kind: IndustrialKind;
  review: IndustrialReview;
  state: ManagedNetworkProfileState;
  action: (previous: IndustrialActionState, formData: FormData) => Promise<IndustrialActionState>;
};
type Draft = { key: string; keyLabel: string; relationship: string; facility: string; facilityLabel: string };
type ExistingTarget = { id: string; anchorId: string; label: string };
type Resolution = { status: "confirmed" | "ignored" | "already_present"; targetId: string | null; selection: IndustrialSelection | null; decidedAt?: string };

const initialState: IndustrialActionState = { status: "idle", message: "" };
const emptyDraft: Draft = { key: "", keyLabel: "", relationship: "", facility: "", facilityLabel: "" };
const primaryButton = "inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl bg-[#1a5144] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#226657] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-[#c5d5ce] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#1a5144] hover:bg-[#edf4f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144] disabled:cursor-not-allowed disabled:opacity-60";
const quietButton = "inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-[#52645b] underline decoration-[#b7c9bf] underline-offset-4 hover:bg-[#edf4f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144] disabled:cursor-not-allowed disabled:opacity-60";
const selectClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-[#d7dfdb] bg-white px-3 py-2 text-sm text-[#2d3934] focus:border-[#86a99e] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[#1a5144] disabled:bg-[#f4f7f5] disabled:text-[#52645b]";
const textClass = "break-words text-sm leading-6 text-[#52645b] [overflow-wrap:anywhere]";
const relationships: Record<string, string> = { produces: "Produce", distributes: "Distribuisce", stocks: "Tiene a stock", processes: "Lavora / trasforma", uses: "Utilizza" };
const copy: Record<IndustrialKind, { title: string; field: string; confirm: string; manual: string; href: string; implication: string }> = {
  product: { title: "Prodotti da rivedere", field: "Famiglia prodotto", confirm: "Conferma prodotto", manual: "Aggiungi prodotto manualmente", href: "#products-add", implication: "Conferma aggiunge questa relazione al profilo come dichiarazione dell’azienda." },
  capability: { title: "Lavorazioni da rivedere", field: "Lavorazione o servizio", confirm: "Conferma lavorazione", manual: "Gestisci sedi e lavorazioni", href: "#facilities", implication: "Conferma associa questa lavorazione alla sede scelta come dichiarazione dell’azienda." },
  market: { title: "Settori da rivedere", field: "Settore", confirm: "Conferma settore", manual: "Aggiungi settore manualmente", href: "#markets-add", implication: "Conferma aggiunge questo settore al profilo come dichiarazione dell’azienda." },
  certification: { title: "Certificazioni da rivedere", field: "Tipo di certificazione", confirm: "Conferma certificazione", manual: "Aggiungi certificazione manualmente", href: "#certifications-add", implication: "Conferma registra tipo e ambito come dichiarazione non verificata. Potrai completare ente, identificativo, date e riferimento documentale nella gestione della certificazione." },
};

function displayDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? {
    iso: date.toISOString(),
    label: new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome" }).format(date),
  } : null;
}

function ResearchSources({ proposal }: { proposal: IndustrialProposal }) {
  const urls = [...new Set(proposal.sourceUrls.flatMap(value => {
    const safe = descriptionSourceUrl(value);
    return safe ? [safe] : [];
  }))];
  const observed = displayDate(proposal.observedAt);
  return (
    <details data-testid="company-industrial-sources" className="min-w-0 rounded-xl border border-[#dce7df] bg-[#fafcfb] px-3 py-2 text-xs leading-5 text-[#52645b]">
      <summary className="cursor-pointer break-words py-1 font-semibold text-[#1a5144] outline-offset-4">Fonti della ricerca · {urls.length}</summary>
      <div className="mt-2 min-w-0 space-y-3 border-t border-[#e5ebe7] pt-3">
        <p>{observed ? <>Proposta disponibile dal <time dateTime={observed.iso}>{observed.label}</time>.</> : "Data della proposta non disponibile."}</p>
        <p>Queste fonti riguardano la ricerca aziendale. Non sono prove associate alla singola voce né attestazioni di verifica.</p>
        {urls.length ? <ul className="min-w-0 space-y-3">
          {urls.map(href => <li key={href} className="min-w-0">
            <a href={href} target="_blank" rel="noopener noreferrer" className="block min-w-0 rounded-md font-semibold text-[#1a5144] underline decoration-[#b7c9bf] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]">
              <span className="[overflow-wrap:anywhere]">{new URL(href).hostname.replace(/^www\./, "")}</span><span aria-hidden="true"> ↗</span><span className="sr-only"> (si apre in una nuova scheda)</span>
            </a>
            <p className="mt-1 break-words [overflow-wrap:anywhere]">{href}</p>
          </li>)}
        </ul> : <p>Fonti della ricerca non disponibili.</p>}
      </div>
    </details>
  );
}

function existingTarget(kind: IndustrialKind, draft: Draft, state: ManagedNetworkProfileState): ExistingTarget | null {
  if (!draft.key || (kind !== "market" && !draft.facility)) return null;
  const facilityId = draft.facility === "company" ? null : draft.facility;
  if (kind === "product") {
    if (!draft.relationship) return null;
    const item = state.products.find(value => value.key === draft.key && value.relationship_type === draft.relationship && value.facility_id === facilityId);
    return item ? { id: item.id, anchorId: item.id, label: networkLabelIt(item.key, item.name) } : null;
  }
  if (kind === "capability") {
    const site = state.facilities.find(value => value.id === facilityId);
    const item = site?.capabilities.find(value => value.key === draft.key);
    return item && site ? { id: item.id, anchorId: site.id, label: networkLabelIt(item.key, item.name) + " · " + site.name } : null;
  }
  if (kind === "market") {
    const item = state.markets.find(value => value.key === draft.key);
    return item ? { id: item.id, anchorId: item.id, label: networkLabelIt(item.key, item.name) } : null;
  }
  const item = state.certifications.find(value => value.key === draft.key && value.facility_id === facilityId);
  return item ? { id: item.id, anchorId: item.id, label: item.name } : null;
}

function draftSelection(kind: IndustrialKind, draft: Draft): IndustrialSelection {
  return {
    key: draft.key,
    ...(kind === "product" ? { relationship_type: draft.relationship } : {}),
    ...(kind !== "market" ? { facility_id: draft.facility === "company" ? null : draft.facility } : {}),
  };
}

function SelectionSummary({ kind, selection, state }: { kind: IndustrialKind; selection: IndustrialSelection; state: ManagedNetworkProfileState }) {
  const option = state.taxonomy[industrialGroup(kind)].find(value => value.key === selection.key);
  const facility = selection.facility_id === null ? "Intera azienda" : state.facilities.find(site => site.id === selection.facility_id)?.name ?? "Sede collegata non disponibile";
  return <dl data-testid="company-industrial-selection" className="space-y-2 text-xs leading-5">
    <div><dt className="font-semibold">{copy[kind].field}</dt><dd className="break-words [overflow-wrap:anywhere]">{networkLabelIt(selection.key, option?.name)}</dd></div>
    {kind === "product" ? <div><dt className="font-semibold">Relazione commerciale</dt><dd>{relationships[selection.relationship_type ?? ""] ?? "Non indicata"}</dd></div> : null}
    {kind !== "market" ? <div><dt className="font-semibold">Ambito</dt><dd className="break-words [overflow-wrap:anywhere]">{facility}</dd></div> : null}
  </dl>;
}

function targetExists(kind: IndustrialKind, targetId: string | null, selection: IndustrialSelection | null, state: ManagedNetworkProfileState) {
  if (!targetId) return false;
  if (kind === "product") return state.products.some(item => item.id === targetId);
  if (kind === "market") return state.markets.some(item => item.id === targetId);
  if (kind === "certification") return state.certifications.some(item => item.id === targetId);
  return state.facilities.some(site => site.id === selection?.facility_id && site.capabilities.some(item => item.id === targetId));
}

function ProposalRow({ companyId, kind, review, state, action, proposal, live, retain, release }: Props & {
  proposal: IndustrialProposal;
  live: boolean;
  retain: (proposal: IndustrialProposal) => void;
  release: (contentKey: string) => void;
}) {
  const router = useRouter();
  const id = useId();
  const headingId = id + "-heading";
  const feedbackId = id + "-feedback";
  const hintId = id + "-hint";
  const formRef = useRef<HTMLFormElement>(null);
  const [result, formAction, pending] = useActionState(action, initialState);
  const [refreshing, startRefresh] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitted, setSubmitted] = useState<{ hash: string; stateHash: string; selection: IndustrialSelection } | null>(null);
  const group = industrialGroup(kind);
  const options = state.taxonomy[group];
  const stateHash = review.stateHashes[group];
  const sameProposal = Boolean(submitted && submitted.hash === proposal.hash && (!result.contentKey || result.contentKey === proposal.contentKey));
  const ownResolution: Resolution | null = sameProposal && (result.status === "confirmed" || result.status === "ignored" || result.status === "already_present")
    ? { status: result.status, targetId: result.targetId ?? null, selection: result.selection !== undefined ? result.selection : result.status === "ignored" ? null : submitted?.selection ?? null } : null;
  const saved = proposal.decision;
  const resolved: Resolution | null = ownResolution ?? (saved ? {
    status: saved.action === "ignored" ? "ignored" : saved.effect === "already_present" ? "already_present" : "confirmed",
    targetId: saved.targetId, selection: saved.selection, decidedAt: saved.decidedAt,
  } : null);
  const comparisonChanged = Boolean(submitted && (!live || review.availability !== "available" || submitted.hash !== proposal.hash || submitted.stateHash !== stateHash));
  const stale = result.status === "stale" && !comparisonChanged;
  const staleRefreshed = result.status === "stale" && comparisonChanged;
  const showError = result.status === "error" && sameProposal;
  const canReview = live && review.availability === "available" && !resolved;
  const showEditor = editing && !ownResolution;
  const busy = pending || refreshing;
  const suggested = options.find(option => option.key === proposal.suggestedKey);
  const present = !resolved && live ? existingTarget(kind, editing ? draft : { ...emptyDraft, key: suggested?.key ?? "" }, state) : null;
  const keyAvailable = options.some(option => option.key === draft.key);
  const siteAvailable = state.facilities.some(site => site.id === draft.facility);
  const scopeValid = kind === "market" || (kind !== "capability" && draft.facility === "company") || siteAvailable;
  const selectionValid = keyAvailable && scopeValid && (kind !== "product" || Object.hasOwn(relationships, draft.relationship));
  const missingSite = Boolean(draft.facility && draft.facility !== "company" && !siteAvailable);
  const missingKey = Boolean(draft.key && !keyAvailable);
  const rowState = pending ? "saving" : resolved?.status ?? (stale ? "stale" : !canReview ? "unavailable" : present ? "already_present" : showEditor ? "reviewing" : "available");
  const resolvedTargetExists = Boolean(resolved && targetExists(kind, resolved.targetId, resolved.selection, state));
  const resolvedAnchor = resolvedTargetExists ? kind === "capability" ? resolved?.selection?.facility_id : resolved?.targetId : null;
  const resolvedDate = displayDate(resolved?.decidedAt);

  useEffect(() => {
    if (!editing) return;
    const fields = Array.from(formRef.current?.querySelectorAll("select") ?? []);
    (fields.find(field => !field.value && !field.disabled) ?? fields[0])?.focus();
  }, [editing]);

  useEffect(() => {
    if (result.status === "idle") return;
    (document.getElementById(feedbackId) ?? document.getElementById(headingId))?.focus({ preventScroll: true });
  }, [result, feedbackId, headingId]);

  function startReview() {
    retain(proposal);
    setDraft({ ...emptyDraft, key: suggested?.key ?? "", keyLabel: suggested ? networkLabelIt(suggested.key, suggested.name) : "" });
    setEditing(true);
  }

  function cancelReview() {
    setEditing(false);
    release(proposal.contentKey);
  }

  return (
    <article aria-labelledby={headingId} aria-busy={busy} data-testid="company-industrial-proposal" data-kind={kind} data-content-key={proposal.contentKey} data-state={rowState} className="min-w-0 space-y-3 rounded-xl border border-[#dce2df] bg-white p-3 sm:p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#66736e]">Voce della ricerca</p>
          <h4 id={headingId} tabIndex={-1} data-testid="company-industrial-label" className="mt-1 break-words text-base font-semibold text-[#1d2824] outline-offset-4 [overflow-wrap:anywhere]">{proposal.label}</h4>
          {!resolved && !showEditor && !present ? <p className="mt-1 text-xs leading-5 text-[#52645b]">{suggested ? "Categoria proposta: " + networkLabelIt(suggested.key, suggested.name) : "Seleziona la categoria corretta durante la revisione."}</p> : null}
        </div>
        {canReview && !showEditor && !present ? <button type="button" data-testid="company-industrial-review" onClick={startReview} className={secondaryButton + " shrink-0"}>Rivedi</button> : null}
      </div>

      {resolved ? <div id={feedbackId} tabIndex={-1} role="status" data-testid="company-industrial-feedback" className="space-y-2 rounded-xl border border-[#d3e2d9] bg-[#f4f8f5] p-3 text-sm leading-6 text-[#43524c] outline-offset-4">
        <p className="font-semibold text-[#1a5144]">{resolved.status === "ignored" ? "Proposta ignorata" : resolved.status === "already_present" ? "Già presente nel profilo" : "Aggiunto al profilo"}</p>
        <p>{ownResolution && result.message ? result.message : resolved.status === "ignored" ? "La proposta è stata ignorata. I dati del profilo restano disponibili negli editor." : resolved.status === "already_present" ? "La selezione corrisponde a un dato già registrato." : "La voce è stata registrata come dichiarazione dell’azienda."}</p>
        {resolved.status !== "ignored" && resolved.selection ? <SelectionSummary kind={kind} selection={resolved.selection} state={state} /> : null}
        {resolvedDate ? <p className="text-xs">Scelta registrata il <time dateTime={resolvedDate.iso}>{resolvedDate.label}</time>.</p> : null}
        {resolved.status !== "ignored" && saved && !resolvedTargetExists ? <p className="text-xs">La decisione resta registrata, ma il dato collegato non è più presente nel profilo attuale.</p> : null}
        {resolved.status !== "ignored" ? <a data-testid="company-industrial-existing" href={industrialTargetHref(kind, resolvedAnchor)} className={secondaryButton + " w-full sm:w-auto"}>{!resolvedTargetExists ? "Apri la sezione del profilo" : kind === "certification" ? "Gestisci i dettagli della certificazione" : "Consulta il dato nel profilo"}</a> : null}
      </div> : null}

      {present ? <div data-testid="company-industrial-duplicate" className="space-y-2 rounded-xl border border-[#dce2df] bg-[#f4f7f5] p-3">
        <p className="text-sm font-semibold text-[#43524c]">Già presente nel profilo</p>
        <p className={textClass}>{present.label}</p>
        <p className="text-xs leading-5 text-[#52645b]">Questa selezione corrisponde a un dato già registrato. Puoi consultarlo nella sua sezione.</p>
        <a data-testid="company-industrial-existing" href={industrialTargetHref(kind, present.anchorId)} className={secondaryButton + " w-full sm:w-auto"}>Consulta il dato nel profilo</a>
      </div> : null}

      {showEditor ? <form
        ref={formRef}
        action={formAction}
        data-testid="company-industrial-form"
        onSubmit={() => setSubmitted({ hash: proposal.hash, stateHash, selection: draftSelection(kind, draft) })}
        onReset={event => {
          // React also resets forms when a fulfilled action returns stale/error.
          // Keep the DOM selections aligned with the draft until explicit exit.
          event.preventDefault();
        }}
        className="min-w-0 space-y-3"
      >
        <input type="hidden" name="network_company_id" value={companyId} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="content_key" value={proposal.contentKey} />
        <input type="hidden" name="expected_proposal_hash" value={proposal.hash} />
        <input type="hidden" name="expected_state_hash" value={stateHash} />

        {!canReview ? <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">Il confronto non è più disponibile per questa proposta. Le tue selezioni sono conservate qui sotto; puoi consultarle e continuare dall’editor del profilo.</p> : null}
        <fieldset disabled={!canReview || busy} aria-describedby={hintId} className="grid min-w-0 gap-3 rounded-xl border border-[#dce7df] bg-[#f7faf8] p-3 sm:grid-cols-2 [&>div]:min-w-0">
          <legend className="px-1 text-sm font-semibold text-[#43524c]">{canReview ? "Rivedi i dati da dichiarare" : "Selezioni conservate"}</legend>
          <div className={kind === "product" ? "sm:col-span-2" : ""}>
            <label htmlFor={id + "-key"} className="text-xs font-semibold text-[#43524c]">{copy[kind].field}</label>
            <select id={id + "-key"} name="canonical_key" data-testid="company-industrial-key" required value={draft.key} onChange={event => {
              const key = event.target.value;
              const value = options.find(option => option.key === key);
              setDraft(previous => ({ ...previous, key, keyLabel: value ? networkLabelIt(value.key, value.name) : "" }));
            }} className={selectClass}>
              <option value="">Seleziona una categoria</option>
              {missingKey ? <option value={draft.key} disabled>{draft.keyLabel || "Categoria selezionata"} — non più disponibile</option> : null}
              {options.map(option => <option key={option.key} value={option.key}>{networkLabelIt(option.key, option.name)}</option>)}
            </select>
          </div>
          {kind === "product" ? <div>
            <label htmlFor={id + "-relationship"} className="text-xs font-semibold text-[#43524c]">Relazione commerciale</label>
            <select id={id + "-relationship"} name="relationship_type" data-testid="company-industrial-relationship" required value={draft.relationship} onChange={event => {
              const relationship = event.target.value;
              setDraft(previous => ({ ...previous, relationship }));
            }} className={selectClass}>
              <option value="">Seleziona la relazione</option>
              {Object.entries(relationships).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div> : null}
          {kind !== "market" ? <div>
            <label htmlFor={id + "-facility"} className="text-xs font-semibold text-[#43524c]">{kind === "capability" ? "Sede della lavorazione" : "Ambito: azienda o sede"}</label>
            <select id={id + "-facility"} name="facility_id" data-testid="company-industrial-facility" required value={draft.facility} onChange={event => {
              const value = event.target.value;
              setDraft(previous => ({ ...previous, facility: value, facilityLabel: value === "company" ? "Intera azienda" : state.facilities.find(site => site.id === value)?.name ?? "" }));
            }} className={selectClass}>
              <option value="">{kind === "capability" ? "Seleziona una sede" : "Seleziona l’ambito"}</option>
              {kind !== "capability" ? <option value="company">Intera azienda</option> : null}
              {missingSite ? <option value={draft.facility} disabled>{draft.facilityLabel || "Sede selezionata"} — non più disponibile</option> : null}
              {state.facilities.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
            </select>
            {draft.facility && draft.facility !== "company" ? <p className="mt-2 break-words text-xs leading-5 text-[#52645b] [overflow-wrap:anywhere]">
              Sede selezionata: {state.facilities.find(site => site.id === draft.facility)?.name || draft.facilityLabel || "Sede non più disponibile"}
            </p> : null}
          </div> : null}
        </fieldset>
        {missingKey || missingSite ? <p className="text-sm leading-6 text-amber-950">{missingSite ? "La sede selezionata non è più disponibile. Scegli una sede attuale prima di confermare." : "La categoria selezionata non è più disponibile. Scegli una categoria attuale prima di confermare."}</p> : null}
        {kind === "capability" && state.facilities.length === 0 ? <p className={textClass}>Per associare una lavorazione serve una sede reale già registrata. <a href="#facilities-add" className="font-semibold text-[#1a5144] underline underline-offset-4">Aggiungi una sede</a> oppure ignora la proposta.</p> : null}
        <p id={hintId} className="text-xs leading-5 text-[#52645b]">{copy[kind].implication}</p>

        {!resolved ? busy ? <p id={feedbackId} tabIndex={-1} role="status" data-testid="company-industrial-feedback" className="rounded-xl border border-[#d3e2d9] p-3 text-sm text-[#43524c] outline-offset-4">{refreshing ? "Aggiornamento del confronto in corso…" : "Registrazione della scelta in corso…"}</p>
          : stale || showError ? <div id={feedbackId} tabIndex={-1} role="alert" data-testid="company-industrial-feedback" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950 outline-offset-4">
            <p>{result.message || "Il confronto è cambiato. Aggiornalo prima di confermare."}</p>
            <p>Le tue selezioni sono conservate.</p>
            <button type="button" data-testid="company-industrial-refresh" onClick={() => startRefresh(() => router.refresh())} className={secondaryButton + " w-full sm:w-auto"}>Aggiorna confronto</button>
          </div>
          : staleRefreshed && canReview ? <p id={feedbackId} tabIndex={-1} role="status" data-testid="company-industrial-feedback" className="rounded-xl border border-[#d3e2d9] p-3 text-sm leading-6 text-[#43524c] outline-offset-4">Confronto aggiornato. Rivedi la selezione prima di confermare; le tue scelte sono conservate.</p> : null : null}

        <div className="flex min-w-0 flex-col gap-2 border-t border-[#e5ebe7] pt-3 sm:flex-row sm:flex-wrap">
          {canReview && !present ? <>
            <button type="submit" name="decision" value="confirm" data-testid="company-industrial-confirm" disabled={busy || stale || !selectionValid} className={primaryButton}>{copy[kind].confirm}</button>
            <button type="submit" name="decision" value="ignore" formNoValidate data-testid="company-industrial-ignore" disabled={busy || stale} className={quietButton}>Ignora</button>
          </> : null}
          <button type="button" data-testid="company-industrial-cancel" onClick={cancelReview} disabled={busy} className={secondaryButton}>{canReview ? "Annulla" : "Chiudi bozza"}</button>
        </div>
      </form> : null}
      <ResearchSources proposal={proposal} />
    </article>
  );
}

export function CompanyIndustrialAssistant(props: Props) {
  const { kind, review } = props;
  const headingId = useId();
  // Keep only proposals the user has opened. A refresh can remove a candidate,
  // but its component and selections must survive until the user closes them.
  const [retained, setRetained] = useState<Record<string, IndustrialProposal>>({});
  const liveProposals = review.proposals.filter(proposal => proposal.kind === kind);
  const liveKeys = new Set(liveProposals.map(proposal => proposal.contentKey));
  const proposals = [...liveProposals, ...Object.values(retained).filter(proposal => !liveKeys.has(proposal.contentKey))];
  const emptyMessage = review.availability === "no_research"
    ? "Non è ancora disponibile una ricerca aziendale da cui ricavare proposte."
    : review.availability === "source_mismatch"
      ? "La ricerca disponibile non è collegata al sito attuale del profilo. Puoi continuare a gestire i dati manualmente."
      : review.availability === "unavailable"
        ? "Le proposte sono momentaneamente non disponibili. Gli editor del profilo restano accessibili."
        : "La ricerca disponibile non contiene proposte utilizzabili per questa sezione.";
  const available = review.availability === "available";
  return (
    <section aria-labelledby={headingId} data-testid="company-industrial-assistant" data-kind={kind} data-availability={review.availability} className="min-w-0 space-y-4 rounded-2xl border border-[#dce2df] bg-[#f7faf8] p-3 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#d3e2d9] bg-white text-[#1a5144]">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M5 3h10l4 4v14H5z M15 3v5h4 M8 12h8 M8 16h5" /></svg>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1a5144]">Company Intelligence</p>
          <h3 id={headingId} className="mt-1 break-words text-lg font-semibold text-[#1d2824]">{copy[kind].title}</h3>
          {available && liveProposals.length > 0 ? <p className="mt-1 text-sm leading-6 text-[#52645b]">{liveProposals.length} {liveProposals.length === 1 ? "voce dalla ricerca salvata" : "voci dalla ricerca salvata"}. Rivedi ogni proposta prima di dichiararla nel profilo.</p> : null}
        </div>
      </div>
      {!available || liveProposals.length === 0 ? <div data-testid="company-industrial-empty" className="space-y-2 rounded-xl border border-[#dce2df] bg-white p-3">
        <p className={textClass}>{emptyMessage}</p>
        <a href={copy[kind].href} className="inline-flex min-h-11 items-center break-words text-sm font-semibold text-[#1a5144] underline underline-offset-4">{copy[kind].manual}</a>
      </div> : null}
      {proposals.length > 0 ? <div className="min-w-0 space-y-3">
        {proposals.map(proposal => <ProposalRow {...props} key={proposal.contentKey} proposal={proposal} live={liveKeys.has(proposal.contentKey)} retain={value => setRetained(previous => ({ ...previous, [value.contentKey]: value }))} release={contentKey => setRetained(previous => {
          const next = { ...previous };
          delete next[contentKey];
          return next;
        })} />)}
      </div> : null}
    </section>
  );
}
