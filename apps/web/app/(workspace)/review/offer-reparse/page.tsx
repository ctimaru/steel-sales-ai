import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

import { loadOfferReparseCandidateReview } from "./actions";
import { ReparseCandidateReviewCard } from "./reparse-candidate-review-card";

export default async function OfferReparseReviewPage() {
  const result = await loadOfferReparseCandidateReview();
  const data = result.data;

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
          PA2.29 · Reparse Candidate Review & Controlled Adoption
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Candidate evidence review
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Confronta le candidate prodotte dal reparse con le observation Offer esistenti. Nessun target viene
          scelto automaticamente e PA2.29 può adottare soltanto campi oggi mancanti: i conflitti restano
          esplicitamente fuori da questa fase.
        </p>
      </div>

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
