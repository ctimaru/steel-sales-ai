"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

const bucket = "producer-authorized-catalogs";
const fieldClass = "mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-[#d0ddd4] bg-white px-3 py-2 text-sm text-[#2d3934] outline-none focus:border-[#1a7651] focus:ring-2 focus:ring-[#e5efeb]";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a7651] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45";
const primaryButton = buttonClass + " bg-[#1a5144] text-white hover:bg-[#226657]";
const secondaryButton = buttonClass + " border border-[#cddbd2] bg-white text-[#175640] hover:bg-[#f3f7f4]";

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? String(error.code) : "";
}

function errorMessage(error: unknown) {
  const code = errorCode(error);
  if (code === "42501") return "Invio non autorizzato. Verifica lo stato dell’azienda, i diritti e i limiti di caricamento.";
  if (code === "22023") return "Controlla il link ufficiale, l’edizione e il formato del documento. I campi sono conservati.";
  return "Il caricamento non è riuscito. I campi sono conservati: riprova quando il servizio è disponibile.";
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, "0")).join("");
}

type UploadProps = {
  companyId: string;
  enabled: boolean;
  onUploaded: (message: string) => Promise<void> | void;
  onCancel: () => void;
  onCheckStatus: () => Promise<void> | void;
  onBusyChange?: (busy: boolean) => void;
};

/** The existing governed prepare/upload/finalize flow; no upload occurs on opening or cancel. */
export function ProducerCatalogueUpload({ companyId, enabled, onUploaded, onCancel, onCheckStatus, onBusyChange }: UploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [edition, setEdition] = useState("");
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [error, setError] = useState({ message: "", revision: 0 });
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (error.message) {
      errorRef.current?.focus({ preventScroll: true });
      errorRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [error]);

  function showError(message: string) {
    setError((previous) => ({ message, revision: previous.revision + 1 }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || unconfirmed || !enabled) return;
    setError((previous) => ({ message: "", revision: previous.revision }));
    if (!rights || !file) {
      showError("Seleziona il documento e conferma la dichiarazione dei diritti.");
      return;
    }
    const format = file.name.toLowerCase().endsWith(".pdf") ? "pdf" : file.name.toLowerCase().endsWith(".csv") ? "csv" : null;
    if (!format) {
      showError("Utilizza un file PDF o CSV.");
      return;
    }
    const maximum = format === "pdf" ? 8 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size < 1 || file.size > maximum) {
      showError("Dimensione massima: PDF 8 MB, CSV 2 MB. Il documento deve contenere dati.");
      return;
    }
    if (format === "pdf" && file.type && file.type !== "application/pdf") {
      showError("Formato PDF non valido.");
      return;
    }
    try {
      const source = new URL(url.trim());
      if (source.protocol !== "https:" || source.username || source.password || source.hash || source.port) throw new Error("invalid_source");
    } catch {
      showError("Inserisci il link HTTPS del catalogo sul sito ufficiale dell’azienda.");
      return;
    }
    if (!edition.trim()) {
      showError("Indica l’edizione del catalogo.");
      return;
    }
    const name = file.name.replace(/[^a-zA-Z0-9 ._-]/g, "_").slice(0, 140).trim();
    if (name.length < 5) {
      showError("Il nome del documento deve contenere almeno cinque caratteri.");
      return;
    }

    submitting.current = true;
    setBusy(true);
    onBusyChange?.(true);
    let phase: "hashing" | "preparing" | "uploading" | "finalizing" = "hashing";
    let rejectedBeforeReservation = false;
    try {
      const db = createClient();
      const sha = hex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
      phase = "preparing";
      const { data: prepared, error: prepareError } = await db.rpc("netproducers1_b3c2_catalog_submission", {
        p_operation: "prepare",
        p_payload: { company_id: companyId, source_url: url.trim(), edition: edition.trim(), name, format, sha256: sha, rights_declaration: true },
      });
      if (prepareError) {
        rejectedBeforeReservation = ["42501", "22023"].includes(errorCode(prepareError));
        throw prepareError;
      }
      const expectedPath = companyId + "/" + prepared?.catalog_id + "/" + sha + "." + format;
      if (prepared?.contract !== "netproducers-b3c2-v1" || prepared?.status !== "prepared" || typeof prepared?.catalog_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prepared.catalog_id) || prepared?.rights_verified !== false || prepared?.published_claims !== 0 || prepared?.bucket !== bucket || prepared?.object_path !== expectedPath) {
        throw new Error("invalid_upload_reservation");
      }
      phase = "uploading";
      const { error: uploadError } = await db.storage.from(bucket).upload(expectedPath, file, {
        contentType: format === "pdf" ? "application/pdf" : "text/csv", upsert: false, cacheControl: "0",
      });
      if (uploadError) throw uploadError;
      phase = "finalizing";
      const { data: done, error: finalizeError } = await db.rpc("netproducers1_b3c2_catalog_submission", {
        p_operation: "finalize", p_payload: { company_id: companyId, catalog_id: prepared.catalog_id },
      });
      if (finalizeError) throw finalizeError;
      if (done?.contract !== "netproducers-b3c2-v1" || done?.status !== "pending_provenance" || done?.rights_verified !== false || done?.published_claims !== 0) {
        throw new Error("invalid_finalized_receipt");
      }
      await onUploaded("Catalogo ricevuto. Fonte e diritti saranno verificati prima dell’analisi tecnica.");
    } catch (failure) {
      if (phase !== "hashing" && !rejectedBeforeReservation) {
        setUnconfirmed(true);
        showError("L’esito del caricamento non è confermato. I campi sono conservati. Controlla l’elenco e revoca l’eventuale invio incompleto prima di caricare nuovamente il documento.");
      } else {
        showError(errorMessage(failure));
      }
    } finally {
      submitting.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <form onSubmit={submit} data-testid="producer-catalogue-form" aria-busy={busy} className="min-w-0 space-y-5">
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <legend className="sr-only">Documento e autorizzazione</legend>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="block min-w-0 text-sm font-semibold text-[#475e50] sm:col-span-2">Catalogo PDF o CSV
            <input id="producer-catalog-file" name="catalogue_file" type="file" aria-label="Catalogo PDF o CSV" required accept=".pdf,.csv,application/pdf,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full min-w-0 rounded-xl border border-dashed border-[#9dbbab] bg-[#f5faf6] p-3 text-sm file:mb-2 file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[#dcece2] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[#175640] sm:p-4" />
            <span className="mt-1.5 block text-sm font-normal leading-6 text-[#596b61]">PDF massimo 8 MB · CSV massimo 2 MB</span>
            {file ? <span className="mt-1 block break-all text-sm font-normal leading-6 text-[#354d40]">Documento selezionato: {file.name}</span> : null}
          </label>
          <label className="block min-w-0 text-sm font-semibold text-[#475e50]">Edizione
            <input name="catalogue_edition" className={fieldClass} value={edition} onChange={(event) => setEdition(event.target.value)} maxLength={80} required placeholder="Es. 2026 · revisione 2" />
          </label>
          <label className="block min-w-0 text-sm font-semibold text-[#475e50] sm:col-span-2">URL ufficiale del catalogo
            <input name="catalogue_source_url" type="url" aria-label="URL ufficiale del catalogo" className={fieldClass} value={url} onChange={(event) => setUrl(event.target.value)} maxLength={1200} required placeholder="https://www.azienda.it/catalogo.pdf" aria-describedby="catalogue-source-help" />
            <span id="catalogue-source-help" className="mt-1.5 block text-sm font-normal leading-6 text-[#596b61]">Usa il sito della tua azienda, non un portale o il sito di un altro produttore.</span>
          </label>
        </div>
        <label className="flex min-w-0 items-start gap-3 rounded-xl border border-[#dce8df] bg-[#f5faf6] p-3 text-sm leading-6 text-[#335746] sm:p-4">
          <input type="checkbox" name="catalogue_rights" aria-label="Dichiaro i diritti del produttore" checked={rights} onChange={(event) => setRights(event.target.checked)} required className="mt-1 h-5 w-5 shrink-0 accent-[#19543f]" />
          <span><strong>Dichiaro i diritti del produttore.</strong> Sono autorizzato dall'azienda a fornire questo catalogo e a consentirne l'estrazione tecnica, la conservazione dei dati derivati e il loro uso nella ricerca industriale Smart Steel Sales. L'origine e i diritti saranno verificati prima della lavorazione.</span>
        </label>
        {error.message ? <p ref={errorRef} tabIndex={-1} role="alert" data-testid="catalogue-form-feedback" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-800 outline-none">{error.message}</p> : null}
        {!enabled ? <p className="text-sm leading-6 text-[#79602e]">L’accesso ai cataloghi non è disponibile. I dati inseriti sono conservati; aggiorna lo stato prima di inviare.</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="submit" disabled={!enabled || unconfirmed || !rights || !file} className={primaryButton}>{busy ? "Caricamento in corso…" : "Invia il catalogo"}</button>
          {unconfirmed ? <button type="button" onClick={() => void onCheckStatus()} className={secondaryButton}>Controlla lo stato</button> : null}
          <button type="button" onClick={onCancel} className={secondaryButton}>Annulla caricamento</button>
        </div>
        <p className="text-sm leading-6 text-[#596b61]">Il catalogo sarà controllato prima dell’analisi. L’invio non aggiorna le disponibilità di Stock e arrivi.</p>
      </fieldset>
    </form>
  );
}
