import Link from "next/link";
import { notFound } from "next/navigation";

import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { requirePlatformConsoleContext } from "@/lib/platform-admin";
import { getFounderDecisionHistory } from "@/lib/founder-decision-history";
import {
  getPlatformCockpitSnapshot,
  type PlatformCockpitKey,
  type PlatformCockpitSignal,
} from "@/lib/platform-cockpit";

export const dynamic = "force-dynamic";

type DecisionGuide = {
  question: string;
  impact: string;
  recommendation: string;
  consequence: string;
  href: string;
  action: string;
};

const GUIDES: Record<PlatformCockpitKey, DecisionGuide> = {
  registration_identity_conflicts: {
    question: "Queste aziende sono già presenti nella piattaforma?",
    impact: "Evitare identità doppie protegge i contatti e la qualità del Network.",
    recommendation: "Controlla le corrispondenze prima di collegare o attivare profili.",
    consequence: "Le situazioni dubbie restano da esaminare.",
    href: "/platform/registrations",
    action: "Verifica le identità",
  },
  registrations_activate: {
    question: "Quali aziende approvate possiamo attivare?",
    impact: "L'attivazione permette alle aziende idonee di iniziare a usare il workspace.",
    recommendation: "Controlla le autorizzazioni e attiva soltanto i profili pronti.",
    consequence: "Le aziende già approvate restano in attesa di attivazione.",
    href: "/platform/registrations?status=approved",
    action: "Esamina le attivazioni",
  },
  registrations_review: {
    question: "Quali nuove aziende possiamo approvare?",
    impact: "Le registrazioni permettono di ampliare la rete di utenti della piattaforma.",
    recommendation: "Valuta i dati e approva solo le richieste che rispettano i criteri previsti.",
    consequence: "Le richieste restano in attesa e non vengono approvate automaticamente.",
    href: "/platform/registrations?status=pending_review",
    action: "Esamina le richieste",
  },
  claims_proof_pending: {
    question: "Chi può gestire queste schede aziendali?",
    impact: "Affidare un profilo al referente corretto consente l'arricchimento da parte dell'azienda.",
    recommendation: "Controlla le prove di titolarità prima di concedere la gestione.",
    consequence: "Le richieste di proprietà restano sospese.",
    href: "/platform/company-claims",
    action: "Controlla la proprietà",
  },
  discovery_review: {
    question: "Quali aziende raccolte possiamo rendere pubbliche?",
    impact: "La pubblicazione amplia il Network visibile, separandolo dal database di ricerca privato.",
    recommendation: "Prosegui la raccolta privata; pubblica solo schede con identità e fonti ammissibili.",
    consequence: "Le candidature restano private, ma la ricerca può continuare.",
    href: "/platform/company-discovery?status=pending_review",
    action: "Controlla le aziende",
  },
  network_identity_candidates: {
    question: "Ci sono aziende duplicate nel Network?",
    impact: "Unire solo identità corrispondenti riduce errori nella ricerca dei fornitori.",
    recommendation: "Verifica manualmente i possibili duplicati prima di intervenire.",
    consequence: "Le segnalazioni rimangono aperte.",
    href: "/platform/network-trust",
    action: "Controlla i duplicati",
  },
  knowledge_review: {
    question: "Quali contenuti possiamo pubblicare nella Scuola?",
    impact: "Contenuti affidabili rendono la piattaforma più utile e facile da trovare.",
    recommendation: "Conferma accuratezza e completezza prima della pubblicazione.",
    consequence: "I contenuti restano in revisione.",
    href: "/platform/knowledge",
    action: "Esamina i contenuti",
  },
};

const ORDER: readonly PlatformCockpitKey[] = [
  "registration_identity_conflicts",
  "registrations_activate",
  "registrations_review",
  "claims_proof_pending",
  "discovery_review",
  "network_identity_candidates",
  "knowledge_review",
];

const formatNumber = (value: number | null) =>
  value === null ? "—" : new Intl.NumberFormat("it-IT").format(value);

export default async function PlatformDecisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string | string[] }>;
}) {
  const context = await requirePlatformConsoleContext();
  // This is the founder's cross-domain dashboard, not a delegated staff queue.
  if (!context.is_platform_owner) notFound();

  const { before } = await searchParams;
  const cursor = typeof before === "string" ? before : undefined;
  const [snapshot, history] = await Promise.all([
    getPlatformCockpitSnapshot(context),
    getFounderDecisionHistory(cursor),
  ]);
  const pending = ORDER
    .map((key) => snapshot.signals.find((signal) => signal.key === key))
    .filter((signal): signal is PlatformCockpitSignal =>
      Boolean(signal && signal.status === "verified" && signal.value !== null && signal.value > 0));
  const unavailable = snapshot.signals.filter((signal) => signal.status === "unavailable");

  return (
    <FocusPage className="space-y-5 sm:space-y-6">
      <FocusHeader
        eyebrow="SMART STEEL SALES · CONSOLE DEL FONDATORE"
        title="Le mie decisioni"
        description="Qui trovi soltanto le attività confermate dal sistema. Per ciascuna: la scelta da valutare, il nostro consiglio e l'effetto di rimandarla. Nessuna approvazione avviene da questa pagina."
        actions={
          <Link href="/platform"
            className="inline-flex min-h-10 items-center rounded-xl border border-[#dce2df] bg-white px-4 text-sm font-semibold text-[#1a5144] hover:bg-[#f2f7f4]">
            ← Torna alla panoramica
          </Link>
        }
      />
      <section aria-labelledby="founder-decisions-summary" className="rounded-2xl border border-[#dce2df] bg-[#f4f9f5] p-4 sm:p-5">
        <h2 id="founder-decisions-summary" className="text-base font-bold text-[#173f35]">Dove serve una scelta</h2>
        <p className="mt-1 text-sm leading-6 text-[#49665a]">
          {pending.length > 0
            ? `${pending.length} ${pending.length === 1 ? "area richiede" : "aree richiedono"} una verifica. Le prime tre sono in evidenza.`
            : unavailable.length > 0
              ? "Non ci sono attività confermate, ma alcune fonti non sono disponibili."
              : "Nessuna attività in attesa risulta dalle fonti disponibili."}
        </p>
        <p className="mt-2 text-xs text-[#526b5e]">
          {snapshot.checkedAt
            ? "Dati verificati: " + new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(snapshot.checkedAt))
            : "Ultimo aggiornamento non disponibile"}
        </p>
      </section>

      {pending.length > 0 ? (
        <section aria-label="Decisioni da valutare" className="grid gap-3">
          {pending.slice(0, 3).map((signal) => {
            const guide = GUIDES[signal.key];
            return (
              <article key={signal.key} className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#175640]">Da valutare</span>
                  <span className="rounded-lg bg-[#eff5f1] px-2 py-1 text-xs font-semibold tabular-nums text-[#173f35]">
                    {formatNumber(signal.value)} {signal.value === 1 ? "elemento" : "elementi"}
                  </span>
                </div>
                <h2 className="mt-2 text-base font-bold leading-6 text-[#1d2824] sm:text-lg">{guide.question}</h2>
                <p className="mt-2 text-sm leading-6 text-[#52615b]"><strong className="text-[#173f35]">Perché conta:</strong> {guide.impact}</p>
                <p className="mt-1 text-sm leading-6 text-[#52615b]"><strong className="text-[#173f35]">Consiglio:</strong> {guide.recommendation}</p>
                <p className="mt-1 text-xs leading-5 text-[#66736e]"><strong>Se rimandi:</strong> {guide.consequence}</p>
                <Link href={guide.href} className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-[#175640] px-4 py-2 text-sm font-semibold text-white hover:bg-[#124a35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                  {guide.action} →
                </Link>
              </article>
            );
          })}
          {pending.length > 3 ? (
            <details className="rounded-2xl border border-[#dce2df] bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#175640] focus-visible:outline-2 focus-visible:outline-[#175640]">
                Mostra altre {pending.length - 3} aree da valutare
              </summary>
              <div className="mt-3 grid gap-3">
                {pending.slice(3).map((signal) => {
                  const guide = GUIDES[signal.key];
                  return (
                    <div key={signal.key} className="rounded-xl border border-[#e6ece8] p-3">
                      <h3 className="text-sm font-bold text-[#173f35]">{guide.question}</h3>
                      <p className="mt-1 text-xs leading-5 text-[#52615b]">{guide.recommendation}</p>
                      <Link href={guide.href} className="mt-2 inline-flex min-h-9 items-center text-xs font-bold text-[#175640] underline underline-offset-4">
                        {guide.action} ({formatNumber(signal.value)}) →
                      </Link>
                    </div>
                  );
                })}
              </div>
            </details>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-[#dce2df] bg-white p-5 text-sm text-[#52615b]">
          Non ci sono scelte operative confermate in attesa. Puoi continuare a sviluppare il Network e gli altri strumenti.
        </section>
      )}

      {unavailable.length > 0 ? (
        <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-bold text-amber-900">Alcuni dati non sono disponibili</h2>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            {unavailable.map((item) => item.label).join(" · ")}. Non li consideriamo pari a zero.
          </p>
        </section>
      ) : null}

      <section id="history" aria-labelledby="platform-decision-history" className="scroll-mt-24 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="platform-decision-history" className="text-lg font-bold text-[#173f35]">
              Storico delle decisioni
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#52615b]">
              Approvazioni, verifiche e pubblicazioni già registrate nel sistema.
              Non comprende automaticamente le scelte strategiche discusse fuori dalla piattaforma.
            </p>
          </div>
          {cursor ? (
            <Link href="/platform/decisions#history"
              className="inline-flex min-h-10 items-center text-sm font-semibold text-[#175640] underline underline-offset-4">
              ← Torna alle più recenti
            </Link>
          ) : null}
        </div>

        {history.status === "unavailable" ? (
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Storico non consultabile in questo momento. Non significa che non siano state registrate decisioni.
          </div>
        ) : (
          <div className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e6ece8] pb-3">
              <span className="text-xs font-semibold text-[#52615b]">
                {history.entries.length} {history.entries.length === 1 ? "decisione registrata" : "decisioni registrate"} in questa pagina
              </span>
              <span className="text-xs text-[#66736e]">
                {history.checkedAt
                  ? "Consultato alle " + new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(new Date(history.checkedAt))
                  : "Ora non disponibile"}
              </span>
            </div>
            {history.entries.length === 0 ? (
              <p className="py-5 text-sm leading-6 text-[#52615b]">
                Nessun evento registrato per le categorie attualmente incluse nello storico.
              </p>
            ) : (
              <ol className="divide-y divide-[#e6ece8]">
                {history.entries.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold leading-5 text-[#173f35]">{entry.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-[#52615b]">{entry.effect}</p>
                      <p className="mt-1 text-xs text-[#66736e]">
                        {entry.actor} · <time dateTime={entry.at}>{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(entry.at))}</time>
                      </p>
                    </div>
                    <Link href={entry.href}
                      className="inline-flex min-h-10 shrink-0 items-center text-xs font-bold text-[#175640] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                      Apri la sezione →
                    </Link>
                  </li>
                ))}
              </ol>
            )}
            {history.hasMore && history.nextCursor ? (
              <Link href={"/platform/decisions?before=" + encodeURIComponent(history.nextCursor) + "#history"}
                className="mt-2 inline-flex min-h-10 items-center rounded-xl border border-[#c8dcd0] px-3 text-sm font-semibold text-[#175640] hover:bg-[#f4f9f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]">
                Mostra decisioni precedenti →
              </Link>
            ) : null}
            <p className="mt-3 border-t border-[#e6ece8] pt-3 text-xs leading-5 text-[#66736e]">
              Fonte: registro amministrativo della piattaforma. Solo operazioni concluse e documentate;
              nessun dato delle trattative commerciali private viene mostrato.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
        <h2 className="text-sm font-bold text-[#173f35]">Come funzionano le decisioni</h2>
        <p className="mt-2 text-sm leading-6 text-[#52615b]">
          Le attività in alto richiedono ancora una valutazione; lo storico mostra invece operazioni già registrate.
          Le decisioni si effettuano nelle funzioni autorizzate della piattaforma, non da questa pagina.
          Un registro separato per le scelte strategiche verrà introdotto soltanto con una tracciatura verificabile.
        </p>
      </section>
    </FocusPage>
  );
}
