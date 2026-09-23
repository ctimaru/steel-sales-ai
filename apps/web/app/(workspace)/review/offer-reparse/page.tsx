import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import {
  loadOfferReparseCandidateReview,
  loadOfferReparseRemediationClosureReadiness,
  loadOfferSourceReingestReadiness,
} from "./actions";
import { ReparseCandidateReviewCard } from "./reparse-candidate-review-card";
import { ReparseRemediationClosureCard } from "./reparse-remediation-closure-card";
import { SourceReingestCard } from "./source-reingest-card";

export default async function OfferReparseReviewPage() {
  const [result, closureResult, recoveryResult] = await Promise.all([
    loadOfferReparseCandidateReview(),
    loadOfferReparseRemediationClosureReadiness(),
    loadOfferSourceReingestReadiness(),
  ]);
  const data = result.data;
  const closure = closureResult.data;
  const recovery = recoveryResult.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
          <Link href="/review/offer-remediation" className="hover:text-slate-950">
            ← Offer remediation
          </Link>
          <Link href="/review" className="hover:text-slate-950">
            Review hub
          </Link>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
          PA2.29–PA2.30 · Candidate Review & Remediation Closure
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Candidate evidence review
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Confronta le candidate prodotte dal reparse con le observation Offer esistenti. Nessun target viene
          scelto automaticamente. PA2.29 può adottare soltanto campi oggi mancanti; PA2.30 chiude la remediation
          solo dopo decisioni terminali, recupero completo dei gap richiesti e assenza di conflitti non-null.
          Nessuna chiusura è automatica.
        </p>
      </div>

      {recoveryResult.error || !recovery ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {recoveryResult.error ?? "Source recovery non disponibile."}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
              PA2.30.3 · Source Re-ingest & Provenance Recovery
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs text-slate-400">Thread target</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{recovery.summary.target_threads}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Da recuperare</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{recovery.summary.needs_reingest}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Richiesti</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{recovery.summary.requested}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Upload</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{recovery.summary.uploading}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Recuperati</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{recovery.summary.recovered}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Falliti</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{recovery.summary.failed}</p>
              </div>
            </div>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-500">
              Il re-ingest accetta esclusivamente l’EML originale. La sorgente viene salvata nel bucket privato,
              legata direttamente al thread e usata per creare un nuovo reparse che supersede il run quarantinato.
              Il recovery non crea né promuove observation.
            </p>
          </Card>

          <div className="space-y-4">
            {recovery.items
              .filter((item) => item.invalidated_run_id !== null)
              .map((item) => (
                <SourceReingestCard key={item.remediation_queue_id} item={item} />
              ))}
          </div>
        </>
      )}

      {closureResult.error || !closure ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {closureResult.error ?? "Closure readiness non disponibile."}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
              PA2.30 · Reparse Remediation Resolution & Decision Closure
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-4 lg:grid-cols-8">
              <div>
                <p className="text-xs text-slate-400">Remediation</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{closure.summary.remediation_count}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Resolve ready</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{closure.summary.ready_resolve}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Dismiss ready</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{closure.summary.ready_dismiss}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Waiting run</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{closure.summary.waiting_on_run}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Decisioni pending</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{closure.summary.candidate_decisions_pending}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Conflitti</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{closure.summary.conflict_review_required}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Gap residui</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{closure.summary.residual_evidence_gap}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Chiuse</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{closure.summary.already_closed}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">explicit close</Badge>
              <Badge tone="green">terminal decisions required</Badge>
              <Badge tone="amber">conflicts block closure</Badge>
              <Badge tone="neutral">no auto-closure</Badge>
            </div>
          </Card>

          <div className="space-y-4">
            {closure.items.map((item) => (
              <ReparseRemediationClosureCard key={item.remediation_queue_id} item={item} />
            ))}
          </div>
        </>
      )}

      {result.error || !data ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {result.error ?? "Candidate reparse non disponibili."}
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-slate-400">Candidate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.candidate_count}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Da verificare</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.pending_review}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Adottate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.accepted}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Rifiutate</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{data.summary.rejected}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="blue">target manuale</Badge>
              <Badge tone="blue">campi manuali</Badge>
              <Badge tone="green">P1.11 correction loop</Badge>
              <Badge tone="amber">no overwrite</Badge>
              <Badge tone="neutral">no auto-resolution</Badge>
            </div>
          </Card>

          {data.items.length ? (
            <div className="space-y-4">
              {data.items.map((item) => (
                <ReparseCandidateReviewCard key={item.candidate_id} item={item} />
              ))}
            </div>
          ) : (
            <Card className="p-6 text-sm text-slate-600">
              Nessuna candidate disponibile. I run PA2.28 possono restare in coda senza che PA2.29 modifichi
              observation o remediation.
            </Card>
          )}
        </>
      )}
    </div>
  );
}
