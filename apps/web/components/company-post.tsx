"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";

import {
  createCompanyPost,
  deleteCompanyPost,
  editCompanyPost,
  loadCompanyPostsByType,
  reportCompanyPost,
} from "@/app/(workspace)/dashboard/company-post-actions";
import {
  CAPACITY_PROCESSES,
  COMPANY_POST_DAILY_LIMIT,
  COMPANY_POST_MAX_CHARS,
  COMPANY_POST_REPORT_REASONS,
  COMPANY_POST_TYPES,
  companyPostDetailRows,
  companyPostIsOffer,
  companyPostOfferHref,
  companyPostTypeLabel,
  type CompanyPostItem,
  type CompanyPostType,
} from "@/lib/company-posts-model";
import { companyInitials } from "@/lib/home-feed-model";

/**
 * CPOST1/CPOST2: posts written by verified companies, shown in the Home feed.
 * Typed posts (capacity first, stock, news, event) carry structured details;
 * the card shows the company, never the person who wrote it. Every action goes
 * through a server action whose RPC re-checks permissions and validates details.
 */
const COLLAPSE_AT = 600;

const actionClass =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-[#3f5248] transition hover:bg-[#f1f6f3] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]";

const fieldClass =
  "w-full rounded-xl border border-[#c8dccf] bg-[#fafcfb] px-3 py-2 text-sm leading-6 text-[#143f30] placeholder:text-[#72877a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]";

const labelClass = "block text-[11px] font-semibold text-[#4d6156]";

const TYPE_TONE: Record<CompanyPostType, string> = {
  capacity: "bg-[#e6eefb] text-[#284b86]",
  stock: "bg-[#e4f0e9] text-[#175640]",
  news: "bg-[#f1ecf7] text-[#5a3d83]",
  event: "bg-[#fff3df] text-[#815017]",
};

function postDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Rome" });
}

/** expires_at is the start of the first day it is gone; show the last day it is valid. */
function lastValidDay(expiresAt: string) {
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "";
  return postDate(new Date(date.getTime() - 1000).toISOString());
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
  if (!body) return null;
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

export function CompanyPostTypeChip({ type }: { type: CompanyPostType }) {
  return (
    <span data-testid="company-post-type" data-type={type}
      className={"inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " + TYPE_TONE[type]}>
      {companyPostTypeLabel(type)}
    </span>
  );
}

function PostDetails({ item }: { item: Pick<CompanyPostItem, "postType" | "details"> }) {
  const rows = companyPostDetailRows(item);
  if (!rows.length) return null;
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-1.5 rounded-xl bg-[#f7faf8] p-3 text-xs sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5b6b62]">{row.label}</dt>
          <dd className="break-words font-medium text-[#173f35]">{row.value}</dd>
        </div>
      ))}
    </dl>
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
  const offerHref = companyPostOfferHref(item);
  const textRequired = item.postType === "news";

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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CompanyPostTypeChip type={item.postType} />
          {companyPostIsOffer(item.postType) && item.expiresAt ? (
            <span className="text-[11px] text-[#5b6b62]">Disponibile fino al {lastValidDay(item.expiresAt)}</span>
          ) : null}
        </div>

        {hidden ? (
          <p role="status" className="mt-3 rounded-lg bg-[#f6f3ec] px-3 py-2 text-xs leading-5 text-[#6a5a3d]">
            Grazie: il post è stato nascosto ed è in revisione da parte dello staff.
          </p>
        ) : (
          <>
            <PostDetails item={item} />
            {mode === "edit" ? (
              <div className="mt-3 space-y-2">
                <label htmlFor={ids + "-edit"} className="sr-only">Modifica il testo del post</label>
                <textarea id={ids + "-edit"} value={draft} onChange={(event) => setDraft(event.target.value)}
                  rows={5} maxLength={COMPANY_POST_MAX_CHARS + 200} className={fieldClass + " resize-y"} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CharCount value={draft} />
                  <div className="flex gap-1">
                    <button type="button" onClick={() => { setMode("view"); setDraft(body); setError(""); }} disabled={pending} className={actionClass}>Annulla</button>
                    <button type="button" onClick={saveEdit}
                      disabled={pending || (textRequired && !draft.trim()) || draft.trim().length > COMPANY_POST_MAX_CHARS}
                      className="inline-flex min-h-10 items-center rounded-full bg-[#176045] px-4 text-xs font-semibold !text-white hover:bg-[#114b36] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176045]">
                      {pending ? "Salvataggio…" : "Salva"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <PostBody body={body} />
            )}
          </>
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
            <label htmlFor={ids + "-details"} className={labelClass}>Dettagli (facoltativi)</label>
            <textarea id={ids + "-details"} value={details} onChange={(event) => setDetails(event.target.value)}
              rows={2} maxLength={2000} className={fieldClass + " resize-y text-xs"} />
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
          {offerHref ? (
            <Link href={offerHref} data-testid="company-post-offer"
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-semibold text-[#175640] hover:bg-[#f1f6f3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]"
              aria-label={"Chiedi un’offerta a " + item.companyName}>
              Chiedi un’offerta <span aria-hidden="true">&nbsp;→</span>
            </Link>
          ) : null}
          {item.isMine ? (
            <button type="button" onClick={() => { setDraft(body); setMode("edit"); }} className={actionClass}>
              {item.postType === "news" ? "Modifica" : "Modifica il testo"}
            </button>
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

type Draft = Record<string, string | boolean>;

function Field({
  id,
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
  maxLength = 120,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: "text" | "date";
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass}>
        {label}{required ? <span aria-hidden="true"> *</span> : <span className="font-normal text-[#72877a]"> (facoltativo)</span>}
      </label>
      <input id={id} type={type} value={value} required={required} maxLength={maxLength} placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)} className={"mt-1 " + fieldClass} />
    </div>
  );
}

function TypedFields({ type, draft, set, id }: { type: CompanyPostType; draft: Draft; set: (key: string, value: string | boolean) => void; id: string }) {
  const v = (key: string) => (typeof draft[key] === "string" ? (draft[key] as string) : "");
  if (type === "capacity") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={id + "-process"} className={labelClass}>Lavorazione<span aria-hidden="true"> *</span></label>
          <select id={id + "-process"} value={v("process")} required onChange={(event) => set("process", event.target.value)}
            className={"mt-1 " + fieldClass}>
            <option value="">Scegli…</option>
            {CAPACITY_PROCESSES.map((process) => <option key={process.value} value={process.value}>{process.label}</option>)}
          </select>
        </div>
        {v("process") === "altro" ? (
          <Field id={id + "-process-detail"} label="Quale lavorazione" required value={v("process_detail")} onChange={(x) => set("process_detail", x)} />
        ) : (
          <Field id={id + "-quantity"} label="Quantità o capacità" value={v("quantity")} onChange={(x) => set("quantity", x)} placeholder="es. 200 t/mese, 40 ore/settimana" maxLength={80} />
        )}
        <Field id={id + "-from"} label="Disponibile dal" type="date" value={v("available_from")} onChange={(x) => set("available_from", x)} />
        <Field id={id + "-to"} label="Fino al" type="date" value={v("available_to")} onChange={(x) => set("available_to", x)} />
        {v("process") === "altro" ? (
          <Field id={id + "-quantity"} label="Quantità o capacità" value={v("quantity")} onChange={(x) => set("quantity", x)} placeholder="es. 200 t/mese" maxLength={80} />
        ) : null}
        <Field id={id + "-location"} label="Luogo" value={v("location")} onChange={(x) => set("location", x)} placeholder="es. Brescia" />
      </div>
    );
  }
  if (type === "stock") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={id + "-product"} label="Prodotto" required value={v("product")} onChange={(x) => set("product", x)} placeholder="es. Tubo senza saldatura" />
        <Field id={id + "-standard"} label="Norma" value={v("standard")} onChange={(x) => set("standard", x)} placeholder="es. EN 10216-2" maxLength={60} />
        <Field id={id + "-grade"} label="Grado" value={v("grade")} onChange={(x) => set("grade", x)} placeholder="es. P235GH" maxLength={60} />
        <Field id={id + "-dimensions"} label="Dimensioni" value={v("dimensions")} onChange={(x) => set("dimensions", x)} placeholder="es. 114,3 × 6,02 mm" maxLength={80} />
        <Field id={id + "-quantity"} label="Quantità" value={v("quantity")} onChange={(x) => set("quantity", x)} placeholder="es. 18 t" maxLength={80} />
        <Field id={id + "-location"} label="Luogo di ritiro" value={v("location")} onChange={(x) => set("location", x)} placeholder="es. Milano" />
        <label className="flex min-h-10 items-center gap-2 text-xs text-[#2f4a3e] sm:col-span-2">
          <input type="checkbox" checked={draft.certificate_31 === true} onChange={(event) => set("certificate_31", event.target.checked)}
            className="h-4 w-4 accent-[#176045]" />
          Con certificato EN 10204 3.1
        </label>
      </div>
    );
  }
  if (type === "event") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={id + "-name"} label="Nome dell’evento" required value={v("name")} onChange={(x) => set("name", x)} placeholder="es. Made in Steel" />
        <Field id={id + "-location"} label="Luogo" required value={v("location")} onChange={(x) => set("location", x)} placeholder="es. Fiera Milano Rho" />
        <Field id={id + "-from"} label="Dal" required type="date" value={v("date_from")} onChange={(x) => set("date_from", x)} />
        <Field id={id + "-to"} label="Al" type="date" value={v("date_to")} onChange={(x) => set("date_to", x)} />
        <Field id={id + "-stand"} label="Stand" value={v("stand")} onChange={(x) => set("stand", x)} placeholder="es. Padiglione 3, B12" maxLength={40} />
      </div>
    );
  }
  return null;
}

/** CPOST1/CPOST2 composer above the feed; shown only when cpost1_can_publish allows it. */
export function CompanyPostComposer({
  organizationName,
  onPublished,
}: {
  organizationName: string;
  onPublished: (item: CompanyPostItem | null) => void;
}) {
  const [type, setType] = useState<CompanyPostType>("capacity");
  const [value, setValue] = useState("");
  const [draft, setDraft] = useState<Draft>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const id = useId();
  const length = value.trim().length;
  const textRequired = type === "news";

  const set = useCallback((key: string, next: string | boolean) => {
    setDraft((current) => ({ ...current, [key]: next }));
    setDone(false);
  }, []);

  function choose(next: CompanyPostType) {
    setType(next);
    setDraft({});
    setError("");
    setDone(false);
  }

  function publish() {
    setError("");
    setDone(false);
    startTransition(async () => {
      const result = await createCompanyPost(type, value, draft);
      if (!result.ok) return setError(result.error);
      setValue("");
      setDraft({});
      setDone(true);
      onPublished(result.item);
    });
  }

  const current = COMPANY_POST_TYPES.find((option) => option.value === type)!;

  return (
    <section aria-labelledby={id + "-heading"} data-testid="company-post-composer" className="rounded-2xl border border-[#dce5df] bg-white p-3 sm:p-4">
      <h2 id={id + "-heading"} className="text-sm font-semibold text-[#173f35]">Pubblica un aggiornamento</h2>
      <p className="mt-0.5 text-[11px] leading-4 text-[#5b6b62]">
        Come {organizationName} · visibile alle aziende della piattaforma · massimo {COMPANY_POST_DAILY_LIMIT} post al giorno
      </p>

      <div role="radiogroup" aria-label="Tipo di post" className="mt-3 flex flex-wrap gap-1.5">
        {COMPANY_POST_TYPES.map((option) => (
          <button key={option.value} type="button" role="radio" aria-checked={type === option.value}
            data-testid={"company-post-type-" + option.value}
            onClick={() => choose(option.value)}
            className={"inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
              (type === option.value ? "border-[#176045] bg-[#176045] text-white" : "border-[#d5e4da] bg-white text-[#3f5248] hover:bg-[#f2f8f4]")}>
            {option.label}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-[#5b6b62]">
        {current.hint}{companyPostIsOffer(type) ? " · resta visibile 30 giorni" : ""}
      </p>

      <div className="mt-3 space-y-3">
        <TypedFields type={type} draft={draft} set={set} id={id} />
        <div>
          <label htmlFor={id + "-body"} className={textRequired ? "sr-only" : labelClass}>
            {textRequired ? "Testo del post" : <>Note <span className="font-normal text-[#72877a]">(facoltative)</span></>}
          </label>
          <textarea
            id={id + "-body"}
            value={value}
            onChange={(event) => { setValue(event.target.value); setDone(false); }}
            rows={textRequired ? 3 : 2}
            maxLength={COMPANY_POST_MAX_CHARS + 200}
            placeholder={textRequired ? "Nuovi impianti, nuove gamme, investimenti, collaborazioni…" : "Condizioni, tempi, contatti interni…"}
            className={"mt-1 resize-y " + fieldClass}
          />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <CharCount value={value} />
        <button
          type="button"
          onClick={publish}
          disabled={pending || (textRequired && length === 0) || length > COMPANY_POST_MAX_CHARS}
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

/** CPOST2 feed filter: everything, or only company posts of one type. */
export function CompanyPostTypeFilter({
  value,
  onChange,
}: {
  value: CompanyPostType | null;
  onChange: (value: CompanyPostType | null) => void;
}) {
  const options: Array<{ value: CompanyPostType | null; label: string }> = [
    { value: null, label: "Tutto il feed" },
    ...COMPANY_POST_TYPES.map((type) => ({ value: type.value, label: type.short })),
  ];
  return (
    <div role="radiogroup" aria-label="Filtra il feed" data-testid="company-post-filter" className="flex gap-1.5 overflow-x-auto pb-1">
      {options.map((option) => (
        <button key={option.value ?? "all"} type="button" role="radio" aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={"inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " +
            (value === option.value ? "border-[#173f35] bg-[#173f35] text-white" : "border-[#d5e4da] bg-white text-[#3f5248] hover:bg-[#f2f8f4]")}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** CPOST2: posts of one type only, with their own keyset pagination. */
export function CompanyPostsOfType({ type, isAdmin }: { type: CompanyPostType; isAdmin: boolean }) {
  const [items, setItems] = useState<CompanyPostItem[]>([]);
  const [next, setNext] = useState<string | null>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);

  const load = useCallback(async (token: string, reset: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    const result = await loadCompanyPostsByType(type, token);
    busy.current = false;
    setLoading(false);
    if (!result.ok) return setError(result.error);
    setItems((current) => (reset ? result.items : [...current, ...result.items.filter((item) => !current.some((c) => c.key === item.key))]));
    setNext(result.next);
  }, [type]);

  useEffect(() => {
    setItems([]);
    setNext("");
    void load("", true);
  }, [load]);

  const remove = useCallback((key: string) => setItems((current) => current.filter((item) => item.key !== key)), []);

  return (
    <div data-testid="company-posts-of-type" data-type={type} className="space-y-3">
      {items.map((item) => (
        <article key={item.key} data-testid="home-feed-post" data-kind="post" className="overflow-hidden rounded-2xl border border-[#dce5df] bg-white">
          <CompanyPostCard item={item} isAdmin={isAdmin} onRemoved={remove} />
        </article>
      ))}
      {!loading && !error && items.length === 0 ? (
        <p role="status" className="rounded-2xl border border-[#dce5df] bg-white p-5 text-sm text-[#52615b]">
          Nessun post di tipo «{companyPostTypeLabel(type)}» al momento.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-center text-xs text-[#9d4e28]">{error}</p> : null}
      {next ? (
        <div className="flex justify-center py-2">
          <button type="button" onClick={() => void load(next, false)} disabled={loading}
            className="inline-flex min-h-10 items-center rounded-full border border-[#b9d2c5] bg-white px-4 text-xs font-semibold text-[#175640] hover:bg-[#f2f8f4] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2">
            {loading ? "Caricamento…" : "Mostra altri post"}
          </button>
        </div>
      ) : loading ? (
        <p role="status" className="py-3 text-center text-xs text-[#5b6b62]">Caricamento…</p>
      ) : null}
    </div>
  );
}
