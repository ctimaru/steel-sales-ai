import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getReviewItems } from "@/lib/commercial-data";

import { ReviewConfirmForm } from "@/components/review-confirm-form";
import { ReviewCorrectForm } from "@/components/review-correct-form";

export default async function ReviewPage() {
  const { mode, items } = await getReviewItems();
  const pending = items.filter((item) => item.reviewStatus === "pending").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-slate-500">Controllo dati</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Correzioni</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Controlla solo i casi in cui i dati estratti richiedono una verifica o una correzione.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="amber">{pending} da verificare</Badge>
          <Link
            href="/review/identities"
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950"
          >
            Identità aziendali
          </Link>
        </div>
      </div>

      {mode === "awaiting_assignment" ? (
        <Card className="mt-7 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Le correzioni sono disponibili, ma lo storico deve ancora essere associato al primo utente del workspace.
        </Card>
      ) : null}

      <div className="mt-7 space-y-4">
        {items.map((flag) => (
          <Card key={flag.id}>
            <CardContent className="grid gap-5 lg:grid-cols-[1fr_1fr_180px] lg:items-center">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={flag.reviewStatus === "pending" ? "amber" : "green"}>{flag.reviewStatus}</Badge>
                  <Badge tone="neutral">{flag.status}</Badge>
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
                  {Math.round(flag.confidence * 100)}% affidabilità
                </div>
                {mode === "live" ? (
                  <ReviewConfirmForm id={flag.id} reviewed={flag.reviewStatus !== "pending"} />
                ) : (
                  <button disabled className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white opacity-40">Conferma</button>
                )}
                <ReviewCorrectForm id={flag.id} reviewed={flag.reviewStatus !== "pending"} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-slate-400">
        Conferma un dato quando è corretto, oppure correggilo prima di proseguire. Ogni modifica viene registrata nello storico.
      </p>
    </div>
  );
}
