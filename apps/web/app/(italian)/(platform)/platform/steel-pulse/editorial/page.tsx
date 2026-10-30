import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Steel Pulse · Editorial Studio" };
export const dynamic = "force-dynamic";

const FILTERS = [
  ["all", "Tutte"],
  ["unassigned", "Da preparare"],
  ["draft", "Bozze"],
  ["in_review", "In revisione"],
  ["editor_approved", "Fact-check ok"],
  ["legal_approved", "Diritti ok"],
  ["published", "Pubblicate"],
  ["withdrawn", "Ritirate"],
] as const;
type Filter = (typeof FILTERS)[number][0];
type QueueItem = {
  item_id: string;
  card_id: string | null;
  revision: number | null;
  status: string;
  headline: string | null;
  topic: string | null;
  language_code: string | null;
  source_name: string;
  canonical_url: string;
  last_changed: string | null;
};
type Queue = { items: QueueItem[]; state: Filter; limit: number };
type Card = {
  headline: string;
  summary: string;
  relevance: string;
  status: string;
  topic: string;
  language_code: string;
  revision: number;
};
type Detail = {
  source: { source_name: string; canonical_url: string; source_status: string; rights_valid_now: boolean };
  card: Card | null;
  history: { event: string; occurred_at: string; revision: number }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function safeText(value: unknown, max = 650) {
  return typeof value === "string" && value.length <= max ? value : null;
}
function parseFilter(value: string | undefined): Filter {
  return FILTERS.find((row) => row[0] === value)?.[0] ?? "all";
}
function parseQueue(value: unknown, expected: Filter): Queue | null {
  if (!record(value) || value.state !== expected || value.limit !== 25 || !Array.isArray(value.items) || value.items.length > 25) return null;
  const items: QueueItem[] = [];
  for (const entry of value.items) {
    if (!record(entry) || typeof entry.item_id !== "string" || !UUID.test(entry.item_id) ||
      typeof entry.source_name !== "string" || entry.source_name.length > 140 ||
      typeof entry.canonical_url !== "string" || entry.canonical_url.length > 2048 ||
      typeof entry.status !== "string" || entry.status.length > 40 ||
      (entry.card_id !== null && (typeof entry.card_id !== "string" || !UUID.test(entry.card_id))) ||
      (entry.revision !== null && (typeof entry.revision !== "number" || !Number.isInteger(entry.revision)))) return null;
    items.push({
      item_id: entry.item_id, card_id: entry.card_id, revision: entry.revision,
      status: entry.status, headline: safeText(entry.headline, 160),
      topic: safeText(entry.topic, 32), language_code: safeText(entry.language_code, 8),
      source_name: entry.source_name, canonical_url: entry.canonical_url,
      last_changed: safeText(entry.last_changed, 64),
    });
  }
  return { items, state: expected, limit: 25 };
}
function parseDetail(value: unknown): Detail | null {
  if (!record(value) || !record(value.source) ||
    typeof value.source.source_name !== "string" ||
    typeof value.source.canonical_url !== "string" ||
    typeof value.source.source_status !== "string" ||
    typeof value.source.rights_valid_now !== "boolean" ||
    !Array.isArray(value.history)) return null;
  let card: Card | null = null;
  if (value.card !== null) {
    if (!record(value.card) ||
      typeof value.card.headline !== "string" || value.card.headline.length > 160 ||
      typeof value.card.summary !== "string" || value.card.summary.length > 650 ||
      typeof value.card.relevance !== "string" || value.card.relevance.length > 380 ||
      typeof value.card.status !== "string" || typeof value.card.topic !== "string" ||
      typeof value.card.language_code !== "string" ||
      typeof value.card.revision !== "number" || !Number.isInteger(value.card.revision)) return null;
    card = {
      headline: value.card.headline, summary: value.card.summary,
      relevance: value.card.relevance, status: value.card.status,
      topic: value.card.topic, language_code: value.card.language_code,
      revision: value.card.revision,
    };
  }
  const history: Detail["history"] = [];
  for (const event of value.history.slice(0, 12)) {
    if (!record(event) || typeof event.event !== "string" ||
      typeof event.occurred_at !== "string" || typeof event.revision !== "number") return null;
    history.push({ event: event.event, occurred_at: event.occurred_at, revision: event.revision });
  }
  return {
    source: {
      source_name: value.source.source_name,
      canonical_url: value.source.canonical_url,
      source_status: value.source.source_status,
      rights_valid_now: value.source.rights_valid_now,
    },
    card, history,
  };
}
function safeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}
function displayTime(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Data non disponibile";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}
function statusLabel(value: string) {
  return FILTERS.find((entry) => entry[0] === value)?.[1] ?? "Da verificare";
}

export default async function SteelPulseEditorialStudio({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; item?: string }>;
}) {
  const context = await requirePlatformConsoleContext();
  if (!context.is_platform_owner) redirect("/platform");
  const params = await searchParams;
  const status = parseFilter(params.status);
  const requestedItem = params.item && UUID.test(params.item) ? params.item : null;
  let queue: Queue | null = null;
  let detail: Detail | null = null;
  let detailUnavailable = false;

  try {
    const client = await createClient();
    const result = await client.rpc("sp3_editorial_queue", { p_state: status, p_limit: 25 });
    if (!result.error) queue = parseQueue(result.data, status);
    // Deliberately allow detail reads only for an item from the owner-scoped queue.
    if (queue && requestedItem && queue.items.some((item) => item.item_id === requestedItem)) {
      const selected = await client.rpc("sp3_editorial_detail", { p_item_id: requestedItem });
      detail = selected.error ? null : parseDetail(selected.data);
      detailUnavailable = detail === null;
    }
  } catch {
    queue = null;
  }

  const selected = queue?.items.find((item) => item.item_id === requestedItem) ?? null;
  const sourceUrl = detail ? safeSourceUrl(detail.source.canonical_url) : null;
  const baseHref = "/platform/steel-pulse/editorial";
  return (
    <div className="uxf2-dense-page mx-auto max-w-[1240px] space-y-4 pb-10">
      <header className="rounded-3xl border border-[#dbe7df] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#22634f]">SP8.A · Console Platform / Owner</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#173f35] sm:text-3xl">Steel Pulse · Editorial Studio</h1>
            <p className="mt-2 text-sm leading-6 text-[#52645a]">
              Coda e anteprime editoriali in sola lettura. Bozze, diritti e revisioni non sono notizie pubbliche.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/platform/steel-pulse" className="inline-flex min-h-11 items-center rounded-lg border border-[#c3d7cb] bg-white px-3 text-xs font-semibold text-[#175640]">Verifica readiness →</Link>
            <Link href="/platform/people#editorial-staff-invite" className="inline-flex min-h-11 items-center rounded-lg border border-[#c3d7cb] bg-white px-3 text-xs font-semibold text-[#175640]">Operatori →</Link>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="rounded-full border border-[#e8d2a7] bg-[#fff8e9] px-3 py-1.5 text-[#835916]">SP7.2 sospeso · nessuna pubblicazione</span>
          <span className="rounded-full border border-[#c5dacc] bg-[#eef7f0] px-3 py-1.5 text-[#245741]">Nessuna approvazione automatica</span>
          <span className="rounded-full border border-[#dce4df] bg-[#f5f8f6] px-3 py-1.5 text-[#52645a]">Solo dati autorizzati SP3</span>
        </div>
      </header>

      <nav aria-label="Filtra il lavoro editoriale" className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        {FILTERS.map(([key, label]) => (
          <Link key={key} href={baseHref + "?status=" + key} aria-current={status === key ? "page" : undefined}
            className={"inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 " +
              (status === key ? "border-[#236448] bg-[#e6f2e9] text-[#174c37]" :
                "border-[#d7e5db] bg-white text-[#586c60] hover:bg-[#f4f8f5]")}>
            {label}
          </Link>
        ))}
      </nav>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)]">
        <section aria-labelledby="sp8-queue-title" className="min-w-0 rounded-2xl border border-[#dce6df] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="sp8-queue-title" className="text-base font-semibold text-[#173f35]">Coda editoriale</h2>
            {queue ? <span className="text-xs tabular-nums text-[#52645a]">{queue.items.length} elementi mostrati · max 25</span> : null}
          </div>
          {!queue ? (
            <p role="alert" className="mt-3 rounded-xl border border-[#e9d3a9] bg-[#fffbf4] p-3 text-xs leading-5 text-[#805916]">
              Impossibile verificare la coda SP3. Non sono mostrate bozze o autorizzazioni presunte.
            </p>
          ) : queue.items.length === 0 ? (
            <div role="status" className="mt-3 rounded-xl border border-dashed border-[#c8d9d0] bg-[#f7faf8] p-4">
              <p className="text-sm font-semibold text-[#173f35]">Nessuna scheda in questa vista</p>
              <p className="mt-2 text-xs leading-5 text-[#52645a]">
                Il pilota di pubblicazione SP7.2 è sospeso. Questa coda mostrerà soltanto materiali realmente acquisiti e autorizzati.
              </p>
              {status !== "all" ? <Link href={baseHref} className="mt-3 inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4">Mostra tutte le schede →</Link> : null}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {queue.items.map((item) => (
                <Link key={item.item_id} href={baseHref + "?status=" + status + "&item=" + encodeURIComponent(item.item_id)}
                  aria-current={selected?.item_id === item.item_id ? "true" : undefined}
                  className={"block rounded-xl border px-3 py-3 transition focus-visible:outline-2 focus-visible:outline-offset-2 " +
                    (selected?.item_id === item.item_id
                      ? "border-[#619b79] bg-[#f0f8f2]" : "border-[#dce7df] bg-white hover:border-[#a9ceba]")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#22634f]">{statusLabel(item.status)}</span>
                    <span className="text-[11px] text-[#607368]">{displayTime(item.last_changed)}</span>
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-[#173f35]">{item.headline || "Materiale acquisito · bozza non ancora creata"}</h3>
                  <p className="mt-1 truncate text-xs text-[#53665b]">{item.source_name} · {item.language_code?.toUpperCase() ?? "Lingua da scegliere"}</p>
                  <p className="mt-2 text-xs font-semibold text-[#175640]">Apri anteprima →</p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="sp8-preview-title" className="min-w-0 rounded-2xl border border-[#dce6df] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#22634f]">Vista privata · non pubblicata</p>
              <h2 id="sp8-preview-title" className="mt-1 text-base font-semibold text-[#173f35]">Anteprima editoriale</h2>
            </div>
            {detail?.card ? <span className="rounded-lg bg-[#f0f5f1] px-2.5 py-1.5 text-[11px] font-semibold text-[#245741]">Revisione {detail.card.revision}</span> : null}
          </div>
          {!selected ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#c8d9d0] bg-[#f7faf8] p-4 text-sm leading-6 text-[#53665b]">
              {queue?.items.length ? "Seleziona una scheda dalla coda per visualizzare testo, fonte e verifiche." : "Nessuna anteprima disponibile. Non viene creato alcun articolo dimostrativo."}
            </p>
          ) : detailUnavailable || !detail ? (
            <p role="alert" className="mt-4 rounded-xl border border-[#e9d3a9] bg-[#fffbf4] p-4 text-sm text-[#805916]">Dettaglio non verificabile. Nessun contenuto mostrato.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="rounded-lg bg-[#eef7f0] px-2.5 py-1 text-[#225f44]">{statusLabel(detail.card?.status ?? selected.status)}</span>
                <span className="rounded-lg bg-[#f1f5f3] px-2.5 py-1 text-[#53665b]">{detail.card?.topic ?? "Tema non assegnato"}</span>
                <span className="rounded-lg bg-[#f1f5f3] px-2.5 py-1 text-[#53665b]">{detail.card?.language_code?.toUpperCase() ?? "Lingua non assegnata"}</span>
              </div>
              {detail.card ? (
                <article aria-label="Anteprima di una bozza originale" className="rounded-xl border border-[#dce6df] bg-[#f9fbfa] p-4 sm:p-5">
                  <h3 className="text-xl font-semibold leading-snug tracking-tight text-[#173f35]">{detail.card.headline}</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#43574c]">{detail.card.summary}</p>
                  <div className="mt-4 rounded-lg border-l-[3px] border-[#46866b] bg-[#eff7f1] px-3 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#26614d]">Perché interessa al professionista</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#43574c]">{detail.card.relevance}</p>
                  </div>
                </article>
              ) : (
                <p role="status" className="rounded-lg border border-dashed border-[#c8d9d0] p-3 text-sm text-[#53665b]">La fonte è stata acquisita ma la bozza editoriale non esiste ancora.</p>
              )}
              <section aria-label="Fonte e diritti" className="rounded-xl border border-[#e2eae4] p-4">
                <h3 className="text-sm font-semibold text-[#173f35]">Fonte e diritti</h3>
                <p className="mt-2 text-xs text-[#52645a]">{detail.source.source_name} · Stato: {detail.source.source_status}</p>
                <p className="mt-2 text-xs font-semibold text-[#52645a]">
                  {detail.source.rights_valid_now ? "Fonte idonea secondo il controllo SP3 corrente" : "Diritti non verificati o non attualmente validi · pubblicazione bloccata"}
                </p>
                {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-10 items-center break-all text-xs font-semibold text-[#175640] underline underline-offset-4">
                  Apri fonte originale ↗
                </a> : null}
              </section>
              <section aria-label="Cronologia decisioni" className="rounded-xl border border-[#e2eae4] p-4">
                <h3 className="text-sm font-semibold text-[#173f35]">Cronologia decisioni</h3>
                {detail.history.length ? (
                  <ol className="mt-2 divide-y divide-[#e5ece7]">
                    {detail.history.map((event, i) => (
                      <li key={String(i) + event.occurred_at} className="flex flex-wrap justify-between gap-2 py-2 text-xs text-[#52645a]">
                        <span>{event.event} · rev. {event.revision}</span>
                        <time dateTime={event.occurred_at}>{displayTime(event.occurred_at)}</time>
                      </li>
                    ))}
                  </ol>
                ) : <p className="mt-2 text-xs text-[#52645a]">Nessuna decisione editoriale registrata.</p>}
              </section>
            </div>
          )}
        </section>
      </div>
      <p className="text-xs leading-5 text-[#69786f]">
        SP8.A riutilizza le letture autorizzate SP3: nessuna mutazione, approvazione, crawler, generazione AI o pubblicazione da questa schermata.
      </p>
    </div>
  );
}
