import Link from "next/link";
import { FirstUseEmptyState } from "@/components/first-use-empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getReviewItems } from "@/lib/commercial-data";
import { appRoutes } from "@/lib/routes";
import { PilotEvent } from "@/components/pilot-event";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

import { ReviewConfirmForm } from "@/components/review-confirm-form";
import { ReviewCorrectForm } from "@/components/review-correct-form";

const reviewStateLabel = {
  pending: "Da verificare",
  confirmed: "Confermato",
  corrected: "Corretto",
} as const;

export default async function ReviewPage() {
  const context = await requireWorkspaceAdmin();
  const { mode, items } = await getReviewItems();
  const pending = items.filter((item) => item.reviewStatus === "pending").length;
  const completed = items.length - pending;
  // Put actionable evidence first without changing the underlying queue or decisions.
  const orderedItems = [...items].sort(
    (a, b) => Number(b.reviewStatus === "pending") - Number(a.reviewStatus === "pending"),
  );

  return (
    <>
      <PilotEvent eventName="review_viewed" entityType="review" metadata={{ surface: "review" }} />
      <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-slate-500">Qualità dati aziendali · {context.organizationName}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Review dati commerciali</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Verifica i dati estratti dai documenti della tua azienda. Conferma quelli corretti o segnala una correzione. La Review della piattaforma è separata e non compare qui.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={pending > 0 ? "amber" : "green"}>{pending} da verificare</Badge>
          {completed > 0 ? <Badge tone="neutral">{completed} completati</Badge> : null}
          <details className="group relative w-full sm:w-auto">
            <summary className="inline-flex min-h-10 cursor-pointer list-none items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2">
              Strumenti avanzati <span aria-hidden="true" className="ml-2">▾</span>
            </summary>
            <nav aria-label="Strumenti avanzati della Review" className="mt-2 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <Link
            href="/review/coverage"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950"
          >
            Copertura normalizzazione
          </Link>
          <Link
            href="/review/identities"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950"
          >
            Identità aziendali
          </Link>
          <Link
            href="/review/offer-reparse"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950"
          >
            Candidate reparse
          </Link>
            </nav>
          </details>
        </div>
      </div>

      {mode === "awaiting_assignment" ? (
        <Card className="mt-7 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Le correzioni sono disponibili, ma lo storico deve ancora essere associato al primo utente del workspace.
        </Card>
      ) : null}

      <div className="mt-7 space-y-4">
        {items.length > 0 && pending === 0 ? (
          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
            Non ci sono verifiche aperte. Le {completed} decisioni completate rimangono consultabili sotto.
          </p>
        ) : null}
        {items.length === 0 ? (
          <FirstUseEmptyState
            eyebrow="Coda pulita"
            title="Non ci sono correzioni da gestire"
            description="Questa è una condizione positiva: nessun dato estratto richiede intervento umano in questo momento. Importa nuovo materiale oppure torna al workspace."
            primaryAction={{
              href: appRoutes.operations.uploads,
              label: "Importa documenti",
            }}
            secondaryAction={{
              href: appRoutes.home,
              label: "Torna al workspace",
            }}
            note="Quando parser o identity resolution richiederanno una decisione, i casi compariranno automaticamente qui."
          />
        ) : null}
        {orderedItems.map((flag) => (
          <Card key={flag.id}>
            <CardContent className="grid gap-5 lg:grid-cols-[1fr_1fr_180px] lg:items-center">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={flag.reviewStatus === "pending" ? "amber" : "green"}>
                    {reviewStateLabel[flag.reviewStatus]}
                  </Badge>
                  {flag.reviewStatus === "pending" ? (
                    <span className="text-xs text-slate-500">Richiede una decisione</span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">{flag.subject}</p>
                <p className="mt-1 text-sm text-slate-500">{flag.product}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Evidenza</p>
                <p className="mt-2 text-sm italic leading-6 text-slate-600">“{flag.source}”</p>
                <p className="mt-2 text-[11px] text-slate-400">{flag.inferred}</p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                  Confidenza estrazione: {Math.round(Math.min(1, Math.max(0, Number.isFinite(flag.confidence) ? flag.confidence : 0)) * 100)}%
                </div>
                {mode === "live" ? (
                  <ReviewConfirmForm id={flag.id} reviewed={flag.reviewStatus !== "pending"} />
                ) : (
                  <button disabled className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white opacity-40">Conferma</button>
                )}
                {mode === "live" ? (
                  <ReviewCorrectForm id={flag.id} reviewed={flag.reviewStatus !== "pending"} />
                ) : (
                  <button disabled className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 opacity-60">
                    Correzione non disponibile
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-slate-400">
        Conferma un dato quando è corretto, oppure correggilo prima di proseguire. Ogni modifica viene registrata nello storico.
      </p>
      </div>
    </>
  );
}
