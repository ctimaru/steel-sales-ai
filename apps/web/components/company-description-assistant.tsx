"use client";

import { useActionState, useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  descriptionSourceUrl,
  type DescriptionAssistantActionState,
  type DescriptionAssistantReview,
} from "@/lib/company-description-assistant";

type Props = {
  companyId: string;
  review: DescriptionAssistantReview;
  action: (
    previous: DescriptionAssistantActionState,
    formData: FormData,
  ) => Promise<DescriptionAssistantActionState>;
};

type Proposal = NonNullable<DescriptionAssistantReview["proposal"]>;
type Decision = "accepted" | "edited" | "ignored";

const initialState: DescriptionAssistantActionState = { status: "idle", message: "" };
const primaryButton = "inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl bg-[#1a5144] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[#226657] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton = "inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-[#c5d5ce] bg-white px-4 py-2.5 text-center text-sm font-semibold text-[#1a5144] hover:bg-[#edf4f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144] disabled:cursor-not-allowed disabled:opacity-60";
const quietButton = "inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-[#52645b] underline decoration-[#b7c9bf] underline-offset-4 hover:bg-[#edf4f0] hover:text-[#1a5144] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144] disabled:cursor-not-allowed disabled:opacity-60";
const textClass = "whitespace-pre-wrap break-words text-sm leading-6 text-[#43524c] [overflow-wrap:anywhere]";

function decision(value: string | undefined): Decision | null {
  return value === "accepted" || value === "edited" || value === "ignored" ? value : null;
}

function displayDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    iso: date.toISOString(),
    label: new Intl.DateTimeFormat("it-IT", {
      day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome",
    }).format(date),
  };
}

function safeSources(urls: string[]) {
  const seen = new Set<string>();
  return urls.flatMap((value) => {
    const href = descriptionSourceUrl(value);
    if (!href || seen.has(href)) return [];
    seen.add(href);
    return [{ href, host: new URL(href).hostname.replace(/^www\./, "") }];
  });
}

function ProposalSources({ proposal }: { proposal: Proposal }) {
  const sources = safeSources(proposal.sourceUrls);
  const observed = displayDate(proposal.observedAt);
  return (
    <div className="min-w-0 space-y-2 border-t border-[#dce7df] pt-3 text-xs leading-5 text-[#52645b]">
      <p>
        {observed ? <>Proposta disponibile dal <time dateTime={observed.iso}>{observed.label}</time>.</> : "Data della proposta non disponibile."}
      </p>
      {sources.length ? (
        <details data-testid="company-description-sources" className="min-w-0 rounded-xl border border-[#dce7df] bg-white px-3 py-2">
          <summary className="cursor-pointer break-words py-1 font-semibold text-[#1a5144] outline-offset-4">
            Fonti consultate · {sources.length}
          </summary>
          <ul className="mt-2 min-w-0 space-y-3 border-t border-[#e5ebe7] pt-3">
            {sources.map((source) => (
              <li key={source.href} className="min-w-0">
                <a href={source.href} target="_blank" rel="noopener noreferrer" className="block min-w-0 rounded-md font-semibold text-[#1a5144] underline decoration-[#b7c9bf] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]">
                  <span className="break-words [overflow-wrap:anywhere]">{source.host}</span><span aria-hidden="true"> ↗</span>
                  <span className="sr-only"> (si apre in una nuova scheda)</span>
                </a>
                <p className="mt-1 break-words font-normal text-[#66736e] [overflow-wrap:anywhere]">{source.href}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p data-testid="company-description-sources">Fonti consultate non disponibili.</p>
      )}
      <p>Le fonti aiutano a valutare la proposta; non attestano la verifica dei singoli dati.</p>
    </div>
  );
}

const decisionCopy: Record<Decision, { title: string; description: string }> = {
  accepted: { title: "Proposta utilizzata", description: "Questa proposta è stata utilizzata per la descrizione aziendale." },
  edited: { title: "Proposta modificata e salvata", description: "La proposta è stata rielaborata prima del salvataggio della descrizione." },
  ignored: { title: "Proposta ignorata", description: "Puoi continuare a gestire la descrizione aziendale dal campo manuale." },
};

const unavailableCopy: Record<Exclude<DescriptionAssistantReview["availability"], "available" | "already_decided">, { title: string; description: string }> = {
  no_research: { title: "Nessuna proposta disponibile", description: "Non è ancora disponibile una ricerca aziendale da cui ricavare una proposta di descrizione." },
  no_summary: { title: "Nessuna descrizione da proporre", description: "La ricerca disponibile non contiene una descrizione utilizzabile per questo profilo." },
  source_mismatch: { title: "Fonti da riallineare", description: "La ricerca disponibile non è collegata al sito attuale del profilo. Puoi aggiornare manualmente la descrizione." },
  already_current: { title: "Il testo coincide con la proposta", description: "Il testo salvato coincide con questa proposta." },
  unavailable: { title: "Proposte momentaneamente non disponibili", description: "Puoi continuare a gestire la descrizione aziendale dal campo manuale." },
};

export function CompanyDescriptionAssistant({ companyId, review, action }: Props) {
  const router = useRouter();
  const id = useId();
  const headingId = id + "-heading";
  const feedbackId = id + "-feedback";
  const draftId = id + "-draft";
  const draftHintId = id + "-draft-hint";
  const [result, formAction, pending] = useActionState(action, initialState);
  const [refreshing, startRefresh] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState<{ proposalHash: string | null; descriptionHash: string } | null>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const proposal = review.proposal;
  const sameProposal = Boolean(submitted && submitted.proposalHash === proposal?.hash);
  const actionDecision = sameProposal ? decision(result.status) : null;
  const savedDecision = review.availability === "already_decided" ? review.decision?.action ?? null : null;
  const resolved = actionDecision ?? savedDecision;
  const comparisonChanged = Boolean(submitted && (submitted.proposalHash !== proposal?.hash || submitted.descriptionHash !== review.currentDescriptionHash));
  const stale = result.status === "stale" && !comparisonChanged;
  const staleRefreshed = result.status === "stale" && comparisonChanged;
  const draftValid = draft.trim().length > 0 && draft.length <= 4000;
  const proposalValid = Boolean(proposal?.description.trim() && proposal.description.length <= 4000);
  const canReview = (review.availability === "available" || review.availability === "already_current") && proposal && !resolved;
  const busy = pending || refreshing;
  const showError = result.status === "error" && sameProposal;
  const currentDescription = actionDecision && result.description !== undefined ? result.description : review.currentDescription;
  const resolvedDate = displayDate(review.decision?.decidedAt);
  const fallback = resolved ? decisionCopy[resolved] : unavailableCopy[
    review.availability === "already_decided" || review.availability === "available" ? "unavailable" : review.availability
  ];

  useEffect(() => {
    if (editing) draftRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    if (result.status === "idle") return;
    const target = document.getElementById(feedbackId) ?? document.getElementById(headingId);
    target?.focus({ preventScroll: true });
  }, [result, feedbackId, headingId]);

  function startEditing() {
    if (!proposal) return;
    setDraft(proposal.description);
    setEditing(true);
  }

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={busy}
      data-testid="company-description-assistant"
      data-availability={review.availability}
      data-state={pending ? "saving" : resolved ?? review.availability}
      className="min-w-0 space-y-4 rounded-2xl border border-[#dce2df] bg-[#f7faf8] p-3 sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#d3e2d9] bg-white text-[#1a5144]">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M5 3h10l4 4v14H5z M15 3v5h4 M8 12h8 M8 16h5" /></svg>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1a5144]">Company Intelligence</p>
          <h3 id={headingId} tabIndex={-1} className="mt-1 break-words text-lg font-semibold text-[#1d2824] outline-offset-4">{canReview ? review.availability === "already_current" ? "Il testo coincide con la proposta" : "Una descrizione pronta da rivedere" : fallback.title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#52645b]">{canReview ? review.availability === "already_current" ? "Puoi confermarlo come descrizione dichiarata dall’azienda, modificarlo o ignorarlo." : "Confronta la proposta con il testo salvato e scegli cosa usare." : fallback.description}</p>
        </div>
      </div>

      {canReview ? (
        <form
          action={formAction}
          data-testid="company-description-review-form"
          onSubmit={() => setSubmitted({ proposalHash: proposal.hash, descriptionHash: review.currentDescriptionHash })}
          className="min-w-0 space-y-4"
        >
          <input type="hidden" name="network_company_id" value={companyId} />
          <input type="hidden" name="expected_proposal_hash" value={proposal.hash} />
          <input type="hidden" name="expected_description_hash" value={review.currentDescriptionHash} />
          <div className="grid min-w-0 items-start gap-3 xl:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-[#dce2df] bg-white p-4">
              <h4 className="text-sm font-semibold text-[#43524c]">Descrizione attuale</h4>
              <p className="mt-1 text-xs leading-5 text-[#66736e]">Testo salvato nel profilo gestito</p>
              <div data-testid="company-description-current" className="mt-3">
                {currentDescription?.trim() ? <p className={textClass}>{currentDescription}</p> : <p className="text-sm leading-6 text-[#66736e]">Nessuna descrizione salvata.</p>}
              </div>
            </div>
            <div data-testid="company-description-proposal" className="min-w-0 space-y-4 rounded-xl border border-[#bbd4c6] bg-[#edf5f0] p-4">
              <div>
                <h4 className="text-sm font-semibold text-[#1a5144]">{editing ? "La tua versione" : "Proposta dalle fonti"}</h4>
                <p className="mt-1 text-xs leading-5 text-[#52645b]">{editing ? "Rivedi il testo prima di salvarlo." : "Da valutare prima del salvataggio"}</p>
              </div>
              {editing ? (
                <div className="min-w-0">
                  <label htmlFor={draftId} className="mb-2 block text-xs font-semibold text-[#43524c]">Descrizione da salvare</label>
                  <textarea
                    ref={draftRef}
                    id={draftId}
                    name="description"
                    data-testid="company-description-draft"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={4000}
                    rows={9}
                    required
                    disabled={busy}
                    aria-describedby={draftHintId}
                    aria-invalid={!draftValid}
                    className="w-full min-w-0 resize-y rounded-xl border border-[#b9cdbf] bg-white px-3 py-3 text-sm leading-6 text-[#2d3934] outline-none [overflow-wrap:anywhere] focus:border-[#86a99e] focus:ring-2 focus:ring-[#d9e9e0] disabled:opacity-70"
                  />
                  <div id={draftHintId} className="mt-1 flex flex-wrap items-start justify-between gap-2 text-xs leading-5 text-[#52645b]">
                    <span>{draftValid ? "La bozza viene salvata solo con la tua conferma." : "Inserisci un testo da 1 a 4.000 caratteri."}</span>
                    <span className="shrink-0 tabular-nums">{draft.length.toLocaleString("it-IT")} / 4.000</span>
                  </div>
                  <details className="mt-3 min-w-0 text-xs text-[#52645b]">
                    <summary className="cursor-pointer py-1 font-semibold outline-offset-4">Rileggi la proposta originale</summary>
                    <p className={"mt-2 " + textClass}>{proposal.description}</p>
                  </details>
                </div>
              ) : <p className={textClass}>{proposal.description}</p>}
              <ProposalSources proposal={proposal} />
            </div>
          </div>

          {pending || refreshing ? (
            <p id={feedbackId} tabIndex={-1} role="status" data-testid="company-description-feedback" className="rounded-xl border border-[#d3e2d9] bg-white px-3 py-2 text-sm text-[#43524c] outline-offset-4">{refreshing ? "Aggiornamento del confronto in corso…" : "Registrazione della scelta in corso…"}</p>
          ) : stale || showError ? (
            <div id={feedbackId} tabIndex={-1} role="alert" data-testid="company-description-feedback" className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-950 outline-offset-4">
              <p>{result.message || (stale ? "La descrizione o la proposta è cambiata. Aggiorna il confronto prima di proseguire." : "Non è stato possibile registrare la scelta. Riprova.")}</p>
              {editing ? <p className="text-xs leading-5">La tua bozza è conservata qui sopra.</p> : null}
              {stale ? <button type="button" data-testid="company-description-refresh" onClick={() => startRefresh(() => router.refresh())} className={secondaryButton}>Aggiorna confronto</button> : null}
            </div>
          ) : staleRefreshed ? (
            <p id={feedbackId} tabIndex={-1} role="status" data-testid="company-description-feedback" className="rounded-xl border border-[#d3e2d9] bg-white px-3 py-3 text-sm leading-6 text-[#43524c] outline-offset-4">Confronto aggiornato. Rivedi il testo attuale e la proposta prima di confermare{editing ? "; la tua bozza è conservata." : "."}</p>
          ) : null}

          <div className="space-y-3 border-t border-[#dce2df] pt-4">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
              {editing ? (
                <>
                  <button type="submit" name="decision" value="edit" data-testid="company-description-save" disabled={busy || stale || !draftValid} className={primaryButton}>Salva descrizione</button>
                  <button type="button" data-testid="company-description-cancel" onClick={() => setEditing(false)} disabled={busy} className={secondaryButton}>Annulla</button>
                </>
              ) : (
                <>
                  <button type="submit" name="decision" value="accept" data-testid="company-description-accept" disabled={busy || stale || !proposalValid} className={primaryButton}>Usa proposta</button>
                  <button type="button" data-testid="company-description-edit" onClick={startEditing} disabled={busy} className={secondaryButton}>Modifica prima di salvare</button>
                  <button type="submit" name="decision" value="ignore" data-testid="company-description-ignore" disabled={busy || stale} className={quietButton}>Ignora</button>
                </>
              )}
            </div>
            <p className="text-xs leading-5 text-[#52645b]">{editing ? "Salva descrizione aggiorna il testo del profilo gestito." : "Usa proposta salva questo testo nella descrizione del profilo gestito."}</p>
          </div>
        </form>
      ) : (
        <div className="min-w-0 space-y-3">
          {actionDecision ? <p id={feedbackId} tabIndex={-1} role="status" data-testid="company-description-feedback" className="rounded-xl border border-[#c5dacd] bg-white px-3 py-2 text-sm leading-6 text-[#1a5144] outline-offset-4">{result.message || decisionCopy[actionDecision].description}</p> : null}
          {resolvedDate && resolved ? <p className="text-xs text-[#66736e]">Scelta registrata il <time dateTime={resolvedDate.iso}>{resolvedDate.label}</time>.</p> : null}
          {editing && draft && !actionDecision ? (
            <div className="min-w-0 rounded-xl border border-[#c5d5ce] bg-white p-3">
              <label htmlFor={draftId} className="block text-sm font-semibold text-[#43524c]">Bozza conservata</label>
              <p id={draftHintId} role="status" className="mt-1 text-xs leading-5 text-[#52645b]">Il confronto non è più disponibile. Puoi recuperare il testo qui sotto e continuare dal campo descrizione.</p>
              <textarea id={draftId} data-testid="company-description-draft" value={draft} readOnly rows={7} aria-describedby={draftHintId} className="mt-3 w-full min-w-0 resize-y rounded-xl border border-[#d7dfdb] bg-[#fafcfa] px-3 py-3 text-sm leading-6 text-[#2d3934] outline-none [overflow-wrap:anywhere] focus:border-[#86a99e] focus:ring-2 focus:ring-[#e5efeb]" />
            </div>
          ) : null}
          {proposal && (resolved || review.availability === "already_current") ? (
            <details className="min-w-0 rounded-xl border border-[#dce2df] bg-white p-3">
              <summary className="cursor-pointer py-1 text-sm font-semibold text-[#43524c] outline-offset-4">Rivedi proposta e fonti</summary>
              <div data-testid="company-description-proposal" className="mt-3 min-w-0 space-y-3">
                <p className={textClass}>{proposal.description}</p>
                <ProposalSources proposal={proposal} />
              </div>
            </details>
          ) : null}
          <a href="#company-description" className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-[#1a5144] underline decoration-[#b7c9bf] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a5144]">{review.currentDescription?.trim() ? "Modifica la descrizione aziendale" : "Scrivi la descrizione aziendale"}</a>
        </div>
      )}
    </section>
  );
}
