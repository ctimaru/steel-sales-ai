"use client";

import { useId, useState, useTransition } from "react";

import {
  createCompanyPost,
  deleteCompanyPost,
  editCompanyPost,
  reportCompanyPost,
} from "@/app/(workspace)/dashboard/company-post-actions";
import {
  COMPANY_POST_DAILY_LIMIT,
  COMPANY_POST_MAX_CHARS,
  COMPANY_POST_REPORT_REASONS,
  type CompanyPostItem,
} from "@/lib/company-posts-model";
import { companyInitials } from "@/lib/home-feed-model";

/**
 * CPOST1: posts written by verified companies, shown in the Home feed.
 * Text only; the card shows the company, never the person who wrote it.
 * Every action goes through a server action whose RPC re-checks permissions.
 */
const COLLAPSE_AT = 600;

const actionClass =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#3f5248] transition hover:bg-[#f1f6f3] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]";

const fieldClass =
  "w-full resize-y rounded-xl border border-[#c8dccf] bg-[#fafcfb] px-3 py-2 text-sm leading-6 text-[#143f30] placeholder:text-[#72877a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]";

function postDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" });
}

function CharCount({ value }: { value: string }) {
  const length = value.trim().length;
  const over = length > COMPANY_POST_MAX_CHARS;
  return (
    <span aria-live="polite" className={"text-[11px] tabular-nums " + (over ? "font-semibold text-[#9d4e28]" : "text-[#65746c]")}>
      {length.toLocaleString("it-IT")}/{COMPANY_POST_MAX_CHARS.toLocaleString("it-IT")}
    </span>
  );
}

function PostBody({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  const long = body.length > COLLAPSE_AT;
  const shown = long && !open ? body.slice(0, COLLAPSE_AT).trimEnd() + "…" : body;
  return (
    <div className="mt-3">
      <p className="whitespace-pre-line break-words text-sm leading-6 text-[#2f4a3e]">{shown}</p>
      {long ? (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
          className="mt-1 text-xs font-semibold text-[#175640] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
          {open ? "Mostra meno" : "Mostra tutto"}
        </button>
      ) : null}
    </div>
  );
}

export function CompanyPostCard({
  item,
  isAdmin,
  onRemoved,
}: {
  item: CompanyPostItem;
  isAdmin: boolean;
  onRemoved: (key: string) => void;
}) {
  const [body, setBody] = useState(item.body);
  const [edited, setEdited] = useState(Boolean(item.editedAt));
  const [mode, setMode] = useState<"view" | "edit" | "confirm_delete" | "report">("view");
  const [draft, setDraft] = useState(item.body);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [reported, setReported] = useState(item.reportedByMe);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const ids = useId();

  const canDelete = item.isMine || (item.isOwnCompany && isAdmin);
  const canReport = !item.isOwnCompany;

  function saveEdit() {
    setError("");
    startTransition(async () => {
      const result = await editCompanyPost(item.id, draft);
      if (!result.ok) return setError(result.error);
      setBody(result.body);
      setEdited(true);
      setMode("view");
    });
  }

  function confirmDelete() {
    setError("");
    startTransition(async () => {
      const result = await deleteCompanyPost(item.id);
      if (!result.ok) return setError(result.error);
      onRemoved(item.key);
    });
  }

  function sendReport() {
    setError("");
    startTransition(async () => {
      const result = await reportCompanyPost(item.id, reason, details);
      if (!result.ok) return setError(result.error);
      setReported(true);
      setHidden(result.hidden);
      setMode("view");
    });
  }

  return (
    <>
      <div className="px-4 pt-4">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#176045] text-xs font-bold text-white">
            {companyInitials(item.companyName)}
          </span>
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[#173f35]">
              <span className="truncate">{item.companyName}</span>
              <span title="Azienda verificata" className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#176045] text-[9px] font-bold text-white">
                ✓<span className="sr-only">Azienda verificata</span>
              </span>
            </p>
            <p className="truncate text-[11px] text-[#5b6b62]">
              Post dell’azienda · {postDate(item.createdAt)}{edited ? " · modificato" : ""}
            </p>
          </div>
        </div>

        {hidden ? (
          <p role="status" className="mt-3 rounded-lg bg-[#f6f3ec] px-3 py-2 text-xs leading-5 text-[#6a5a3d]">
            Grazie: il post è stato nascosto ed è in revisione da parte dello staff.
          </p>
        ) : mode === "edit" ? (
          <div className="mt-3 space-y-2">
            <label htmlFor={ids + "-edit"} className="sr-only">Modifica il testo del post</label>
            <textarea id={ids + "-edit"} value={draft} onChange={(event) => setDraft(event.target.value)}
              rows={5} maxLength={COMPANY_POST_MAX_CHARS + 200} className={fieldClass} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CharCount value={draft} />
              <div className="flex gap-1">
                <button type="button" onClick={() => { setMode("view"); setDraft(body); setError(""); }} disabled={pending} className={actionClass}>Annulla</button>
                <button type="button" onClick={saveEdit} disabled={pending || !draft.trim() || draft.trim().length > COMPANY_POST_MAX_CHARS}
                  className="inline-flex min-h-10 items-center rounded-full bg-[#176045] px-4 text-xs font-semibold !text-white hover:bg-[#114b36] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176045]">
                  {pending ? "Salvataggio…" : "Salva"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <PostBody body={body} />
        )}

        {mode === "report" ? (
          <fieldset className="mt-3 space-y-2 rounded-xl border border-[#e3e9e5] bg-[#fafcfb] p-3">
            <legend className="px-1 text-xs font-semibold text-[#173f35]">Perché segnali questo post?</legend>
            {COMPANY_POST_REPORT_REASONS.map((option) => (
              <label key={option.value} className="flex min-h-9 items-center gap-2 text-xs text-[#2f4a3e]">
                <input type="radio" name={ids + "-reason"} value={option.value} checked={reason === option.value}
                  onChange={() => setReason(option.value)} className="h-4 w-4 accent-[#176045]" />
                {option.label}
              </label>
            ))}
            <label htmlFor={ids + "-details"} className="block text-[11px] font-semibold text-[#4d6156]">Dettagli (facoltativi)</label>
            <textarea id={ids + "-details"} value={details} onChange={(event) => setDetails(event.target.value)}
              rows={2} maxLength={2000} className={fieldClass + " text-xs"} />
            <div className="flex justify-end gap-1">
              <button type="button" onClick={() => { setMode("view"); setError(""); }} disabled={pending} className={actionClass}>Annulla</button>
              <button type="button" onClick={sendReport} disabled={pending || !reason}
                className="inline-flex min-h-10 items-center rounded-full bg-[#9d4e28] px-4 text-xs font-semibold !text-white hover:bg-[#843f1f] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2">
                {pending ? "Invio…" : "Invia segnalazione"}
              </button>
            </div>
          </fieldset>
        ) : null}

        {mode === "confirm_delete" ? (
          <div role="alertdialog" aria-labelledby={ids + "-delete"} className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#ecd3c4] bg-[#fdf6f2] p-3">
            <p id={ids + "-delete"} className="text-xs font-semibold text-[#7a3b1d]">Eliminare definitivamente il post?</p>
            <div className="flex gap-1">
              <button type="button" onClick={() => setMode("view")} disabled={pending} className={actionClass}>Annulla</button>
              <button type="button" onClick={confirmDelete} disabled={pending}
                className="inline-flex min-h-10 items-center rounded-full bg-[#9d4e28] px-4 text-xs font-semibold !text-white hover:bg-[#843f1f] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2">
                {pending ? "Eliminazione…" : "Elimina"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p role="alert" className="mt-2 text-xs text-[#9d4e28]">{error}</p> : null}
      </div>

      {!hidden && mode === "view" ? (
        <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-[#edf2ef] px-2 py-1">
          {item.isMine ? (
            <button type="button" onClick={() => { setDraft(body); setMode("edit"); }} className={actionClass}>Modifica</button>
          ) : null}
          {canDelete ? (
            <button type="button" onClick={() => setMode("confirm_delete")} className={actionClass}>Elimina</button>
          ) : null}
          {canReport ? (
            reported ? (
              <span className="px-3 text-xs font-semibold text-[#5b6b62]">Segnalato</span>
            ) : (
              <button type="button" onClick={() => setMode("report")} className={actionClass}
                aria-label={"Segnala il post di " + item.companyName}>
                Segnala
              </button>
            )
          ) : null}
          {!item.isMine && !canDelete && !canReport ? (
            <span className="px-3 text-[11px] text-[#65746c]">Post della tua azienda</span>
          ) : null}
        </div>
      ) : (
        <div className="h-3" />
      )}
    </>
  );
}

/** CPOST1 composer above the feed; shown only when cpost1_can_publish allows it. */
export function CompanyPostComposer({
  organizationName,
  onPublished,
}: {
  organizationName: string;
  onPublished: (item: CompanyPostItem | null) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const length = value.trim().length;

  function publish() {
    setError("");
    setDone(false);
    startTransition(async () => {
      const result = await createCompanyPost(value);
      if (!result.ok) return setError(result.error);
      setValue("");
      setDone(true);
      onPublished(result.item);
    });
  }

  return (
    <section aria-labelledby={id + "-heading"} data-testid="company-post-composer" className="rounded-2xl border border-[#dce5df] bg-white p-3 sm:p-4">
      <h2 id={id + "-heading"} className="text-sm font-semibold text-[#173f35]">Pubblica un aggiornamento</h2>
      <p className="mt-0.5 text-[11px] leading-4 text-[#5b6b62]">
        Come {organizationName} · visibile alle aziende della piattaforma · massimo {COMPANY_POST_DAILY_LIMIT} post al giorno
      </p>
      <label htmlFor={id + "-body"} className="sr-only">Testo del post</label>
      <textarea
        id={id + "-body"}
        value={value}
        onChange={(event) => { setValue(event.target.value); setDone(false); }}
        rows={3}
        maxLength={COMPANY_POST_MAX_CHARS + 200}
        placeholder="Novità, materiale disponibile, nuove certificazioni, fiere a cui partecipate…"
        className={"mt-2 " + fieldClass}
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <CharCount value={value} />
        <button
          type="button"
          onClick={publish}
          disabled={pending || length === 0 || length > COMPANY_POST_MAX_CHARS}
          data-testid="company-post-publish"
          className="inline-flex min-h-10 items-center rounded-full bg-[#176045] px-5 text-xs font-semibold !text-white hover:bg-[#114b36] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176045]"
        >
          {pending ? "Pubblicazione…" : "Pubblica"}
        </button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-[#9d4e28]">{error}</p> : null}
      {done ? <p role="status" className="mt-2 text-xs font-semibold text-[#175640]">Post pubblicato.</p> : null}
    </section>
  );
}

/** CPOST1: allowed role, company not verified yet → point to the verification card. */
export function CompanyPostVerifyFirst() {
  return (
    <p data-testid="company-post-verify-first" className="rounded-2xl border border-dashed border-[#cfdcd4] bg-white px-4 py-3 text-xs leading-5 text-[#52615b]">
      Le aziende verificate possono pubblicare aggiornamenti nel feed.{" "}
      <a href="#home-verification" className="font-semibold text-[#175640] underline underline-offset-4">Vedi come ottenere la spunta</a>
    </p>
  );
}
