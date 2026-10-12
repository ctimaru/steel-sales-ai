import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FocusPage } from "@/components/focus-ui";
import { parsePulseEngagement } from "@/lib/steel-pulse-engagement";
import {
  EMPTY_PULSE_PREFERENCES,
  parsePulsePersonalizedFeed,
  pulseProfessionalInterests,
  pulseTopics,
} from "@/lib/steel-pulse-personalized";
import { createClient } from "@/lib/supabase/server";
import { appRoutes } from "@/lib/routes";

import { savePulseInterests, setPulseArticleEngagement } from "./actions";

export const metadata: Metadata = {
  title: "Steel Pulse · Il tuo feed",
};

export const dynamic = "force-dynamic";

function pulseDate(date: string | null) {
  if (!date || Number.isNaN(Date.parse(date))) return null;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(date));
}

export default async function SteelPulsePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; view?: string; engagement_updated?: string; engagement_error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: identity, error: identityError } = await supabase.auth.getUser();
  if (identityError || !identity.user) redirect("/login?next=%2Fpulse");

  let response: ReturnType<typeof parsePulsePersonalizedFeed> = null;
  let serviceAvailable = false;
  try {
    const { data, error } = await supabase.rpc("sp5_my_steel_pulse_feed", { p_limit: 12 });
    if (!error) {
      response = parsePulsePersonalizedFeed(data);
      serviceAvailable = response !== null;
    }
  } catch {
    serviceAvailable = false;
  }

  const preferences = response?.preferences ?? EMPTY_PULSE_PREFERENCES;
  const cards = response?.items ?? [];
  let engagement = null as ReturnType<typeof parsePulseEngagement>;
  let engagementReady = false;
  if (serviceAvailable) {
    try {
      const { data, error } = await supabase.rpc("sp6_my_article_engagement", { p_limit: 12 });
      if (!error) {
        engagement = parsePulseEngagement(data);
        engagementReady = engagement !== null;
      }
    } catch {
      engagementReady = false;
    }
  }
  const view = params.view === "saved" || params.view === "unread" ? params.view : "all";
  const savedUrls = new Set(engagement?.saved_urls ?? []);
  const readUrls = new Set(engagement?.read_urls ?? []);
  const visibleCards = view === "saved"
    ? (engagement?.saved_items ?? [])
    : view === "unread"
      ? cards.filter((card) => !readUrls.has(card.source_url))
      : cards;

  return (
    <FocusPage className="max-w-[1120px]">
      <div className="rounded-[28px] border border-[#d8e4de] bg-white p-5 shadow-[0_12px_36px_rgba(18,61,52,0.04)] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f6b5a]">Steel Pulse · Per te</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#123d34]">
              Il tuo aggiornamento sull’acciaio
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52615b]">
              Scegli i temi che segui. Il feed è personale, mentre la memoria commerciale
              e i dati del tuo Workspace restano privati.
            </p>
          </div>
          <Link href={appRoutes.home} className="app-secondary inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">
            Torna alla Home
          </Link>
        </div>

        {params.saved === "1" ? (
          <p role="status" aria-live="polite" className="mt-5 rounded-xl border border-[#b9d8ca] bg-[#eaf5ef] p-3 text-sm font-medium text-[#1a5a45]">
            Preferenze salvate per il tuo account.
          </p>
        ) : null}
        {params.error || !serviceAvailable ? (
          <p role="alert" className="mt-5 rounded-xl border border-[#ecd0aa] bg-[#fff8ed] p-3 text-sm text-[#815017]">
            {params.error === "invalid"
              ? "Controlla gli argomenti selezionati e riprova."
              : "Il servizio preferenze non è ancora disponibile. Nessuna modifica è stata salvata."}
          </p>
        ) : null}

        {params.engagement_updated === "1" ? (
          <p role="status" aria-live="polite" className="mt-5 rounded-xl border border-[#b9d8ca] bg-[#eaf5ef] p-3 text-sm font-medium text-[#1a5a45]">
            La tua raccolta personale è stata aggiornata.
          </p>
        ) : null}
        {params.engagement_error ? (
          <p role="alert" className="mt-5 rounded-xl border border-[#ecd0aa] bg-[#fff8ed] p-3 text-sm text-[#815017]">
            {params.engagement_error === "invalid" ? "Azione non valida." : "Impossibile aggiornare l’articolo. Riprova più tardi."}
          </p>
        ) : null}

        <form action={savePulseInterests} className="mt-7 rounded-2xl border border-[#dce6e0] bg-[#f7faf8] p-4 sm:p-6">
          <fieldset>
            <legend className="text-base font-semibold text-[#123d34]">Quali argomenti vuoi seguire?</legend>
            <p className="mt-1 text-xs leading-5 text-[#5d6b64]">
              Se non selezioni alcun tema vedrai tutte le categorie autorizzate.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pulseTopics.map(({ key, label }) => (
                <label key={key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#d4e1d9] bg-white px-4 py-3 text-sm font-medium text-[#24493d] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#1f6b5a]">
                  <input type="checkbox" name="topics" value={key} defaultChecked={preferences.topics.includes(key)} className="h-4 w-4 accent-[#1f6b5a]" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-[#24493d]">
              Il tuo ambito di interesse
              <select name="role_interest" defaultValue={preferences.role_interest} className="mt-2 min-h-11 w-full rounded-xl border border-[#b8d2c8] bg-white px-3 text-sm text-[#213c32]">
                {pulseProfessionalInterests.map(({ key, label }) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-[#24493d]">
              Lingua delle notizie
              <select name="language_code" defaultValue={preferences.language_code} className="mt-2 min-h-11 w-full rounded-xl border border-[#b8d2c8] bg-white px-3 text-sm text-[#213c32]">
                <option value="it">Italiano</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-xs leading-5 text-[#5d6b64]">
              Le preferenze appartengono solo a te e non cambiano l’accesso al Network o le autorizzazioni aziendali.
            </p>
            <button type="submit" disabled={!serviceAvailable} className="app-primary inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
              Salva preferenze
            </button>
          </div>
        </form>
      </div>

      <section aria-labelledby="pulse-feed-title" className="mt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1f6b5a]">Aggiornamenti selezionati</p>
            <h2 id="pulse-feed-title" className="mt-1 text-xl font-semibold text-[#173e34]">
              Per i tuoi interessi
            </h2>
          </div>
          <span className="text-xs font-medium text-[#52615b]">
            {visibleCards.length} aggiornamenti disponibili
          </span>
        </div>
        <div className="mb-4 flex flex-wrap gap-2" role="navigation" aria-label="Filtra il tuo feed">
          {([
            ["all", "Per te"],
            ["unread", "Da leggere"],
            ["saved", "Salvati"],
          ] as const).map(([key, label]) => (
            <Link
              key={key}
              href={key === "all" ? "/pulse" : "/pulse?view=" + key}
              aria-current={view === key ? "page" : undefined}
              className={["inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold transition",
                view === key
                  ? "border-[#1f6b5a] bg-[#e8f4ed] text-[#184936]"
                  : "border-[#d9e5dd] bg-white text-[#51615a] hover:border-[#97bba9]"
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </div>
        {!engagementReady && serviceAvailable ? (
          <p role="status" className="mb-4 rounded-xl border border-[#d9e5dd] bg-[#f7faf8] p-3 text-xs text-[#52615b]">
            Le funzioni Salva e Letto non sono ancora disponibili.
          </p>
        ) : null}
        {visibleCards.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {visibleCards.map((card) => (
              <article key={card.source_url} className="rounded-2xl border border-[#dce6df] bg-white p-5 shadow-[0_4px_20px_rgba(18,61,52,0.035)] sm:p-6">
                <div className="flex flex-wrap gap-2 text-xs text-[#64736c]">
                  <span className="rounded-full bg-[#e9f4ee] px-2.5 py-1 font-semibold text-[#1c654e]">
                    {pulseTopics.find((t) => t.key === card.topic)?.label}
                  </span>
                  {pulseDate(card.source_published_at) ? (
                    <time dateTime={card.source_published_at ?? undefined}>{pulseDate(card.source_published_at)}</time>
                  ) : null}
                </div>
                <h3 className="mt-4 text-lg font-semibold leading-6 text-[#123d34]">{card.headline}</h3>
                <p className="mt-2 text-sm leading-6 text-[#51615a]">{card.summary}</p>
                <div className="mt-4 rounded-xl border-l-[3px] border-[#40866f] bg-[#f2f7f4] p-3">
                  <p className="text-xs font-semibold text-[#23624e]">Perché ti interessa</p>
                  <p className="mt-1 text-sm leading-6 text-[#435a50]">{card.relevance}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <a href={card.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-xs font-semibold text-[#165d4a] underline underline-offset-4">
                    Fonte: {card.source_name} ↗
                  </a>
                  {engagementReady ? (
                    <div className="flex flex-wrap gap-2">
                      <form action={setPulseArticleEngagement}>
                        <input type="hidden" name="source_url" value={card.source_url} />
                        <input type="hidden" name="view" value={view} />
                        <input type="hidden" name="engagement_action" value={savedUrls.has(card.source_url) ? "unsave" : "save"} />
                        <button type="submit" aria-label={savedUrls.has(card.source_url) ? "Rimuovi dalle notizie salvate" : "Salva la notizia"} className="inline-flex min-h-11 items-center rounded-xl border border-[#bcd2c6] bg-[#f7faf8] px-3 text-xs font-semibold text-[#175740]">
                          {savedUrls.has(card.source_url) ? "Salvato ✓" : "Salva"}
                        </button>
                      </form>
                      <form action={setPulseArticleEngagement}>
                        <input type="hidden" name="source_url" value={card.source_url} />
                        <input type="hidden" name="view" value={view} />
                        <input type="hidden" name="engagement_action" value={readUrls.has(card.source_url) ? "unread" : "read"} />
                        <button type="submit" aria-label={readUrls.has(card.source_url) ? "Segna come da leggere" : "Segna come letto"} className="inline-flex min-h-11 items-center rounded-xl border border-[#d9e5dd] bg-white px-3 text-xs font-semibold text-[#51615a]">
                          {readUrls.has(card.source_url) ? "Letto ✓" : "Segna letto"}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[#bdcfc6] bg-[#f9fbfa] p-6 sm:p-8">
            <h3 className="text-base font-semibold text-[#123d34]">
              {view === "saved" ? "Non hai notizie salvate disponibili" :
                view === "unread" ? "Non ci sono notizie da leggere" : "Nessuna notizia verificata per ora"}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52615b]">
              Steel Pulse mostra soltanto aggiornamenti autorizzati. Nel frattempo puoi
              scegliere i tuoi interessi o consultare la Scuola pubblica.
            </p>
            <Link href="/knowledge" className="app-secondary mt-4 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold">
              Apri la Scuola
            </Link>
          </div>
        )}
      </section>
    </FocusPage>
  );
}
