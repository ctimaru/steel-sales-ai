"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProducerCatalogueUpload } from "@/components/producer-catalogue-upload";
import { ProducerStructuredModeration } from "@/components/producer-structured-moderation";
import { ProducerPdfSizeOwner } from "@/components/producer-pdf-size-owner";
import { parseCompanyCatalogueStatus, type CompanyCatalogueItem, type CompanyCatalogueStatus } from "@/lib/company-catalogue-workspace";
import { createClient } from "@/lib/supabase/client";

const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a7651] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";
const primaryButton = buttonClass + " bg-[#1a5144] text-white hover:bg-[#226657]";
const secondaryButton = buttonClass + " border border-[#cddbd2] bg-white text-[#175640] hover:bg-[#f3f7f4]";
const dangerButton = buttonClass + " border border-[#ddbab3] bg-white text-[#8b392e] hover:bg-[#fff5f2]";
const dateFormatter = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Rome" });

const stateLabels: Record<CompanyCatalogueItem["state"], string> = {
  awaiting_upload: "Caricamento incompleto",
  pending_provenance: "In attesa di verifica",
  verifying: "Verifica della fonte in corso",
  in_analysis: "Inviato all’analisi tecnica",
  needs_review: "Verifica da completare",
  withdrawn: "Invio revocato",
};
const stateDescriptions: Record<CompanyCatalogueItem["state"], string> = {
  awaiting_upload: "L’invio non è completo. Controlla il caricamento o revocalo prima di inviare nuovamente il documento.",
  pending_provenance: "Il documento è stato ricevuto. Fonte e diritti devono essere verificati.",
  verifying: "È in corso il confronto con il documento disponibile sul sito ufficiale.",
  in_analysis: "Il documento è stato inoltrato all’analisi. Questo stato non attesta dati estratti o pubblicati.",
  needs_review: "La fonte o l’autorizzazione richiedono un controllo aggiuntivo.",
  withdrawn: "Questo invio è stato revocato e rimane consultabile nello storico.",
};
const rightsLabels: Record<CompanyCatalogueItem["rights_status"], string> = {
  not_verified: "Diritti da verificare",
  active: "Diritti autorizzati",
  expired: "Autorizzazione scaduta",
  revoked: "Autorizzazione revocata",
};

function date(value: string) {
  return dateFormatter.format(new Date(value));
}

function DocumentIcon({ className = "h-6 w-6" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}><path d="M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h6" /></svg>;
}

type Feedback = { kind: "success" | "error"; message: string; sequence: number };

export function CompanyCatalogueWorkspace({ companyId, companyName }: { companyId: string | null; companyName: string | null }) {
  const [status, setStatus] = useState<CompanyCatalogueStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(companyId));
  const [readError, setReadError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const request = useRef(0);
  const writing = useRef(false);
  const feedbackSequence = useRef(0);
  const workspaceRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const unavailableRef = useRef<HTMLDivElement>(null);
  const withdrawButtons = useRef(new Map<string, HTMLButtonElement>());

  const refresh = useCallback(async () => {
    const revision = ++request.current;
    if (!companyId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setReadError("");
    try {
      const { data, error } = await createClient().rpc("netproducers1_b3c2_catalog_submission", {
        p_operation: "status", p_payload: { company_id: companyId },
      });
      if (error) throw error;
      const parsed = parseCompanyCatalogueStatus(data);
      if (!parsed) throw new Error("invalid_catalogue_status");
      if (revision !== request.current) return;
      setStatus(parsed);
      setWithdrawalId((current) => parsed.items.some((item) => item.catalog_id === current && item.state !== "withdrawn") ? current : null);
      if (!parsed.eligible) setReviewOpen(false);
    } catch {
      if (revision !== request.current) return;
      setStatus(null);
      setReadError("Non è stato possibile leggere lo stato dei cataloghi. Aggiorna per riprovare; i dati di un eventuale modulo aperto sono conservati.");
      setReviewOpen(false);
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void refresh();
    return () => { request.current += 1; };
  }, [refresh]);

  useEffect(() => {
    if (editorOpen) {
      editorRef.current?.focus({ preventScroll: true });
      editorRef.current?.scrollIntoView({ block: "start" });
    }
  }, [editorOpen]);

  useEffect(() => {
    if (withdrawalId) {
      confirmationRef.current?.focus({ preventScroll: true });
      confirmationRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [withdrawalId]);

  useEffect(() => {
    if (feedback && !loading) {
      feedbackRef.current?.focus({ preventScroll: true });
      feedbackRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [feedback, loading]);

  useEffect(() => {
    if (readError && !loading) {
      unavailableRef.current?.focus({ preventScroll: true });
      unavailableRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [readError, loading]);

  function report(kind: Feedback["kind"], message: string) {
    feedbackSequence.current += 1;
    setFeedback({ kind, message, sequence: feedbackSequence.current });
  }

  function openEditor() {
    if (writing.current || loading || !status?.eligible || editorOpen || withdrawalId) return;
    setFeedback(null);
    setEditorOpen(true);
  }

  function cancelEditor() {
    if (writing.current) return;
    setEditorOpen(false);
    requestAnimationFrame(() => (addRef.current ?? workspaceRef.current)?.focus());
  }

  function cancelWithdrawal() {
    if (writing.current) return;
    const catalogueId = withdrawalId;
    setWithdrawalId(null);
    requestAnimationFrame(() => {
      const opener = catalogueId ? withdrawButtons.current.get(catalogueId) : null;
      (opener?.isConnected ? opener : addRef.current)?.focus();
    });
  }

  async function uploaded(message: string) {
    setEditorOpen(false);
    report("success", message);
    await refresh();
  }

  async function withdraw(catalogueId: string) {
    if (!companyId || writing.current || loading || !status?.eligible || withdrawalId !== catalogueId) return;
    writing.current = true;
    setWithdrawingId(catalogueId);
    setFeedback(null);
    try {
      const { data, error } = await createClient().rpc("netproducers1_b3c2_catalog_submission", {
        p_operation: "withdraw", p_payload: { company_id: companyId, catalog_id: catalogueId },
      });
      if (error) throw error;
      if (data?.contract !== "netproducers-b3c2-v1" || !["withdrawn", "already_withdrawn"].includes(data?.status) || data?.published_claims !== 0) throw new Error("invalid_withdrawal_receipt");
      setWithdrawalId(null);
      report("success", "Catalogo revocato.");
      await refresh();
    } catch {
      report("error", "L’esito della revoca non è confermato. Aggiorna l’elenco prima di riprovare; lo stato visualizzato non è stato modificato.");
    } finally {
      writing.current = false;
      setWithdrawingId(null);
    }
  }

  const ready = !loading && !readError && status?.eligible === true;
  const busy = formBusy || withdrawingId !== null;
  const items = status?.items ?? [];
  const verifying = items.filter((item) => item.state === "pending_provenance" || item.state === "verifying").length;
  const withdrawn = items.filter((item) => item.state === "withdrawn").length;

  return (
    <section ref={workspaceRef} id="products-catalogues" tabIndex={-1} aria-label="Cataloghi e documenti tecnici" data-testid="company-catalogue-workspace" className="min-w-0 scroll-mt-28 space-y-5 rounded-2xl border border-[#dce2df] bg-[#f7faf8] p-3 outline-offset-2 sm:p-5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1a5144]">Documentazione industriale</p>
          <h3 className="mt-1 text-xl font-semibold text-[#1d2824]">Cataloghi e documenti tecnici</h3>
          <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-[#52645b]">Raccogli i cataloghi ufficiali{companyName ? " di " + companyName : " dell’azienda"} e segui la verifica delle fonti e dei diritti.</p>
        </div>
        {ready ? <button ref={addRef} type="button" onClick={openEditor} disabled={busy || editorOpen || withdrawalId !== null} className={primaryButton + " w-full shrink-0 sm:w-auto"}><span aria-hidden="true">+</span>Aggiungi catalogo</button> : null}
      </div>

      {!companyId ? <div className="space-y-3 rounded-xl border border-[#d9e7de] bg-white p-4" data-testid="catalogue-ineligible">
        <h4 className="font-semibold text-[#214e3b]">Collega la tua azienda</h4>
        <p className="text-sm leading-6 text-[#52645b]">La gestione dei cataloghi richiede un profilo aziendale gestito da un amministratore autorizzato.</p>
        <Link href="/network" className={secondaryButton}>Cerca la tua azienda</Link>
      </div> : null}

      {companyId ? <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-6 text-[#596b61]">Fonte dichiarata, diritti verificati e analisi tecnica hanno stati distinti.</p>
        <button type="button" onClick={() => { if (!writing.current) { setFeedback(null); void refresh(); } }} disabled={busy || loading} className={secondaryButton}>Aggiorna cataloghi</button>
      </div> : null}

      {loading ? <p role="status" className="rounded-xl border border-[#dce2df] bg-white p-4 text-sm text-[#52645b]">Lettura dei cataloghi e verifica dell’accesso…</p> : null}

      {readError ? <div ref={unavailableRef} tabIndex={-1} role="alert" data-testid="catalogue-unavailable" className="space-y-2 rounded-xl border border-[#e1cbae] bg-[#fffbf3] p-4 outline-none">
        <h4 className="font-semibold text-[#70521f]">Cataloghi temporaneamente non disponibili</h4>
        <p className="text-sm leading-6 text-[#705e3d]">{readError}</p>
      </div> : null}

      {!loading && !readError && status?.eligible === false ? <div data-testid="catalogue-ineligible" className="space-y-3 rounded-xl border border-[#e1cbae] bg-[#fffbf3] p-4">
        <h4 className="font-semibold text-[#70521f]">Verifica i requisiti per condividere cataloghi</h4>
        <p className="text-sm leading-6 text-[#705e3d]">Il caricamento è disponibile agli amministratori di produttori italiani pubblicati nel Network, con sito aziendale, rivendicazione approvata e identità verificata.</p>
        <a href="#overview" className={secondaryButton}>Rivedi identità e verifica</a>
      </div> : null}

      {ready ? <>
        <dl className="grid gap-2 sm:grid-cols-3" data-testid="catalogue-summary">
          {[["Invii recenti", items.length], ["In verifica", verifying], ["Revocati", withdrawn]].map(([label, count]) => <div key={label} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#dce2df] bg-white px-4 py-3 sm:block">
            <dt className="text-sm text-[#52645b]">{label}</dt><dd className="text-xl font-semibold tabular-nums text-[#1d2824] sm:mt-1">{count}</dd>
          </div>)}
        </dl>
        <p className="text-sm leading-6 text-[#596b61]">{items.length === 20 ? "Sono mostrati i 20 invii più recenti. I conteggi riguardano questi documenti." : "L’elenco mostra fino a 20 invii recenti, comprese le revoche."}</p>
      </> : null}

      {feedback ? <p ref={feedbackRef} tabIndex={-1} role={feedback.kind === "error" ? "alert" : "status"} data-testid="catalogue-feedback" className={"rounded-xl border p-3 text-sm leading-6 outline-none " + (feedback.kind === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-[#bdd8ca] bg-[#edf7f1] text-[#175640]")}>{feedback.message}</p> : null}

      {editorOpen && companyId ? <div ref={editorRef} tabIndex={-1} role="region" aria-label="Invia un catalogo" data-testid="catalogue-editor" className="min-w-0 scroll-mt-28 space-y-5 rounded-2xl border border-[#b6cfc2] bg-white p-3 outline-none sm:p-5">
        <div><p className="text-sm font-semibold text-[#1a5144]">Nuovo documento</p><h4 className="mt-1 text-lg font-semibold text-[#1d2824]">Invia un catalogo</h4><p className="mt-2 text-sm leading-6 text-[#52645b]">Prepara documento, fonte ed edizione. Annulla caricamento chiude il modulo senza inviarlo.</p></div>
        <ProducerCatalogueUpload companyId={companyId} enabled={ready} onUploaded={uploaded} onCancel={cancelEditor} onCheckStatus={refresh} onBusyChange={(value) => { writing.current = value; setFormBusy(value); }} />
      </div> : null}

      {ready && items.length === 0 ? <div data-testid="catalogue-empty" className="flex min-w-0 flex-col items-start gap-3 rounded-xl border border-dashed border-[#cbdad1] bg-white p-4 sm:p-5">
        <span className="rounded-xl bg-[#edf4f0] p-3 text-[#1a5144]"><DocumentIcon /></span>
        <h4 className="text-base font-semibold text-[#1d2824]">Il primo catalogo parte da una fonte ufficiale</h4>
        <p className="max-w-3xl text-sm leading-6 text-[#52645b]">Aggiungi un PDF o CSV della tua azienda e il relativo link ufficiale. Qui potrai seguirne le verifiche e l’inoltro all’analisi tecnica.</p>
      </div> : null}

      {ready && items.length > 0 ? <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        {items.map((item) => <article key={item.catalog_id} data-testid="company-catalogue-card" data-catalog-id={item.catalog_id} data-state={item.state} data-rights-status={item.rights_status} className="min-w-0 space-y-4 rounded-2xl border border-[#dce2df] bg-white p-3 sm:p-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="shrink-0 rounded-xl bg-[#edf4f0] p-2.5 text-[#1a5144]"><DocumentIcon /></span>
            <div className="min-w-0"><h4 className="break-words text-base font-semibold text-[#1d2824]">{item.name}</h4><p className="mt-1 break-words text-sm text-[#52645b]">{item.format.toUpperCase()} · Edizione {item.edition}</p></div>
          </div>
          <div className="space-y-2">
            <span className={"inline-flex max-w-full rounded-lg px-2.5 py-1.5 text-sm font-semibold " + (item.state === "withdrawn" ? "bg-[#f0f2f1] text-[#52645b]" : item.state === "needs_review" || item.state === "awaiting_upload" ? "bg-[#fff4df] text-[#7c551b]" : "bg-[#eaf3ee] text-[#235c45]")}>{stateLabels[item.state]}</span>
            <p className="text-sm leading-6 text-[#52645b]">{stateDescriptions[item.state]}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-[#e1e8e3] bg-[#f8faf9] p-3">
            <p className="text-sm font-semibold text-[#354d40]">Fonte dichiarata</p>
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" aria-label={"Apri fonte dichiarata di " + item.name} className="mt-1 inline-block max-w-full break-all text-sm leading-6 text-[#175640] underline decoration-[#91b4a3] underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a7651]">{item.source_url}</a>
            <p className="mt-2 text-sm leading-6 text-[#596b61]">{item.source_checked_at ? "Ultimo controllo della fonte: " + date(item.source_checked_at) : "Controllo della fonte non ancora registrato."}</p>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-[#596b61]">Invio creato</dt><dd className="font-medium text-[#354d40]">{date(item.created_at)}</dd></div>
            {item.uploaded_at ? <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-[#596b61]">Documento ricevuto</dt><dd className="font-medium text-[#354d40]">{date(item.uploaded_at)}</dd></div> : null}
            <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-[#596b61]">Diritti dichiarati</dt><dd className="font-medium text-[#354d40]">{date(item.rights_declared_at)}</dd></div>
            {item.rights_verified_at ? <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-[#596b61]">Diritti verificati</dt><dd className="font-medium text-[#354d40]">{date(item.rights_verified_at)}</dd></div> : null}
            {item.rights_expires_at ? <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-[#596b61]">Scadenza autorizzazione</dt><dd className="font-medium text-[#354d40]">{date(item.rights_expires_at)}</dd></div> : null}
            {item.rights_revoked_at ? <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-[#596b61]">Diritti revocati</dt><dd className="font-medium text-[#354d40]">{date(item.rights_revoked_at)}</dd></div> : null}
            {item.withdrawn_at ? <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt className="text-[#596b61]">Invio revocato</dt><dd className="font-medium text-[#354d40]">{date(item.withdrawn_at)}</dd></div> : null}
          </dl>
          <p className={"rounded-lg px-3 py-2 text-sm font-semibold " + (item.rights_status === "active" ? "bg-[#eaf5ee] text-[#235c45]" : item.rights_status === "not_verified" ? "bg-[#f1f4f2] text-[#52645b]" : "bg-[#fff1e9] text-[#873e23]")}>{rightsLabels[item.rights_status]}</p>
          {item.state !== "withdrawn" ? <>
            {withdrawalId === item.catalog_id ? <div ref={confirmationRef} tabIndex={-1} role="region" aria-label="Revoca catalogo" data-testid="catalogue-withdraw-confirmation" className="space-y-3 rounded-xl border border-[#ddbab3] bg-[#fff8f5] p-3 outline-none">
              <h5 className="text-sm font-semibold text-[#873e23]">Revocare questo catalogo?</h5>
              <p className="break-words text-sm font-semibold text-[#573d33]">{item.name}</p>
              <p className="text-sm leading-6 text-[#705449]">La revoca interrompe l’uso autorizzato di questo invio e dei dati derivati collegati. Il documento rimane nello storico come revocato.</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><button type="button" onClick={() => void withdraw(item.catalog_id)} disabled={busy} className={dangerButton}>{withdrawingId === item.catalog_id ? "Revoca in corso…" : "Conferma revoca"}</button><button type="button" onClick={cancelWithdrawal} disabled={busy} className={secondaryButton}>Mantieni catalogo</button></div>
            </div> : <button ref={(element) => { if (element) withdrawButtons.current.set(item.catalog_id, element); else withdrawButtons.current.delete(item.catalog_id); }} type="button" onClick={() => { if (!writing.current && !editorOpen) { setFeedback(null); setWithdrawalId(item.catalog_id); } }} disabled={busy || editorOpen || withdrawalId !== null} className={dangerButton + " w-full sm:w-auto"}>Revoca catalogo</button>}
          </> : null}
        </article>)}
      </div> : null}

      <div className="space-y-3 border-t border-[#dce2df] pt-4">
        <p className="text-sm leading-6 text-[#52645b]">I cataloghi documentano l’offerta tecnica dell’azienda. Le famiglie dichiarate e le disponibilità commerciali si gestiscono nei rispettivi pannelli.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"><a href="#products" className={secondaryButton}>Vai ai prodotti dichiarati</a><a href="#stock" className={secondaryButton}>Vai a Stock e arrivi</a></div>
      </div>

      {status?.eligible ? <div className="space-y-4 border-t border-[#dce2df] pt-4">
        <div><h4 className="text-base font-semibold text-[#1d2824]">Dati estratti dai cataloghi</h4><p className="mt-2 text-sm leading-6 text-[#52645b]">Rivedi gli attributi e le misure già osservati dalla piattaforma. Ogni conferma riguarda il singolo dato mostrato.</p></div>
        <button type="button" aria-expanded={reviewOpen} aria-controls="company-catalogue-extracted-review" onClick={() => setReviewOpen((open) => !open)} disabled={busy || loading} className={secondaryButton}>{reviewOpen ? "Chiudi revisione dati" : "Rivedi dati estratti"}</button>
        {reviewOpen ? <div id="company-catalogue-extracted-review" data-testid="catalogue-extracted-review" className="min-w-0 space-y-4 [&_button]:min-h-11 [&_button]:text-sm [&_p]:text-sm [&_p]:leading-6 [&_span]:text-sm">
          <ProducerStructuredModeration companyId={companyId} />
          <ProducerPdfSizeOwner companyId={companyId} />
        </div> : null}
      </div> : null}
    </section>
  );
}
