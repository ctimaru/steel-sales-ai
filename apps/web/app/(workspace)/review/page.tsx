import { confirmReview } from "@/app/(workspace)/review/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getReviewQueue } from "@/lib/data/commercial";

export default async function ReviewPage() {
  const { mode, flags } = await getReviewQueue();
  const pending = flags.filter((flag) => flag.reviewStatus === "pending").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-slate-500">Data Quality</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Review Queue
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            {mode === "live"
              ? "Review Queue live protetta da RLS. Le conferme aggiornano solo record appartenenti all’utente autenticato."
              : mode === "empty"
                ? "Il layer RLS è pronto, ma nessun dataset è ancora assegnato all’utente autenticato."
                : "I 3 warning residui del parser v3.1 sono mostrati in modalità demo finché Supabase non è configurato."}
          </p>
        </div>
        <Badge tone={pending > 0 ? "amber" : "green"}>{pending} da verificare</Badge>
      </div>

      <div className="mt-7 space-y-4">
        {flags.map((flag) => (
          <Card key={flag.id}>
            <CardContent className="grid gap-5 lg:grid-cols-[1fr_1fr_180px] lg:items-center">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={flag.reviewStatus === "pending" ? "amber" : "green"}>
                    {flag.reviewStatus}
                  </Badge>
                  <Badge tone="neutral">{flag.availability}</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">{flag.subject}</p>
                <p className="mt-1 text-sm text-slate-500">{flag.product}</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Evidenza
                </p>
                <p className="mt-2 text-sm italic leading-6 text-slate-600">“{flag.source}”</p>
                <p className="mt-2 text-[11px] text-slate-400">{flag.inferred}</p>
              </div>

              <div className="flex flex-col gap-2">
                <div className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600">
                  {Math.round(flag.confidence * 100)}% confidence
                </div>
                <form action={confirmReview}>
                  <input type="hidden" name="reviewId" value={flag.id} />
                  <button
                    disabled={mode !== "live" || flag.reviewStatus !== "pending"}
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    title={mode === "live" ? "Conferma questo record" : "Disponibile con dataset live"}
                  >
                    Conferma
                  </button>
                </form>
                <button
                  disabled
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 opacity-50"
                  title="Editor correzione previsto nel prossimo incremento"
                >
                  Correggi
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {flags.length === 0 ? (
        <Card className="mt-7 p-10 text-center">
          <p className="font-semibold text-slate-800">Nessun record nella Review Queue</p>
          <p className="mt-2 text-sm text-slate-500">
            {mode === "empty"
              ? "Crea il primo utente Auth e assegna il dataset validato per vedere i 3 warning reali."
              : "Non ci sono warning da verificare."}
          </p>
        </Card>
      ) : null}

      <p className="mt-5 text-xs leading-5 text-slate-400">
        Lo schema staging non è mai accessibile dal browser. La UI usa esclusivamente
        commercial_review_queue con RLS owner-scoped.
      </p>
    </div>
  );
}
