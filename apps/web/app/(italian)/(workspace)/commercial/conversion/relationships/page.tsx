import Link from "next/link";

import { CrossThreadDecisionForm } from "@/components/cross-thread-decision-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { appRoutes } from "@/lib/routes";

import {
  loadCrossThreadRelationshipEvidence,
  type CrossThreadCandidate,
} from "./actions";

export const dynamic = "force-dynamic";

function relationshipLabel(type: CrossThreadCandidate["relationship_type"]) {
  if (type === "offer_rfq") return "Offerta → RFQ";
  if (type === "order_offer") return "Ordine → Offerta";
  return "Ordine → RFQ";
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function gapLabel(hours: number) {
  if (hours < 48) {
    return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(hours)} ore`;
  }
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(hours / 24)} giorni`;
}

export default async function CrossThreadRelationshipPage() {
  const payload = await loadCrossThreadRelationshipEvidence();

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3c8192]">
            P2.6 · Commercial Intelligence
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0b171e]">
            Relazioni cross-thread
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Evidenze che possono collegare RFQ, offerte e ordini appartenenti a thread email
            diversi. Ogni candidato richiede una decisione umana: il sistema non crea relazioni
            automaticamente e non usa dominio, filename, subject similarity o embedding.
          </p>
        </div>
        <Link
          href={appRoutes.commercial.conversion}
          className="inline-flex w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-[#33454e]"
        >
          ← Esiti & conversione
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Da revisionare", payload.summary.pending_total],
          ["Strong review", payload.summary.strong_review_count],
          ["Accettate", payload.summary.accepted_total],
          ["Rifiutate", payload.summary.rejected_total],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardContent>
              <p className="text-2xl font-semibold text-[#0b171e]">{String(value)}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-[#3c8192]/20 bg-[#eef5f6]">
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">Evidence-first</Badge>
            <Badge tone="neutral">Finestra {payload.policy.window_days} giorni</Badge>
            <Badge tone="neutral">Human decision required</Badge>
          </div>
          <p className="mt-3 text-sm font-semibold text-[#17343f]">
            Strong review non significa relazione confermata
          </p>
          <p className="mt-1 text-sm leading-6 text-[#45636d]">
            Il candidato entra in review solo con stessa Company verificata, thread distinti,
            sequenza temporale coerente e overlap canonicale o geometrico esatto. La classe
            strong richiede anche lo stesso Contact esatto entro {payload.policy.strong_review_max_days} giorni.
            Nessun fuzzy match dimensionale viene usato.
          </p>
        </CardContent>
      </Card>

      {payload.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {payload.error}
        </div>
      ) : payload.candidates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-base font-semibold text-[#0b171e]">
              Nessun candidato cross-thread in attesa
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Il sistema non amplia le soglie per riempire la coda. Nuovi candidati compariranno
              solo quando Company, cronologia e prodotto forniscono evidenza sufficiente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-4">
          {payload.candidates.map((candidate) => (
            <Card
              key={`${candidate.relationship_type}:${candidate.source_entity_id}:${candidate.target_entity_id}`}
            >
              <CardContent className="space-y-5">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={candidate.evidence_class === "strong_review" ? "green" : "amber"}>
                        {candidate.evidence_class === "strong_review" ? "Strong review" : "Review"}
                      </Badge>
                      <Badge tone="blue">{relationshipLabel(candidate.relationship_type)}</Badge>
                      <Badge tone="neutral">{gapLabel(candidate.gap_hours)}</Badge>
                      {candidate.shared_contact ? <Badge tone="green">Stesso Contact</Badge> : null}
                    </div>

                    <Link
                      href={appRoutes.commercial.company(candidate.company_id)}
                      className="mt-3 block text-xl font-semibold text-[#0b171e] hover:text-[#1b4c5d]"
                    >
                      {candidate.company_name ?? "Company verificata"}
                    </Link>

                    <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                      <p>
                        Target evidence: <strong>{dateTimeLabel(candidate.target_evidence_at)}</strong>
                      </p>
                      <p>
                        Source evidence: <strong>{dateTimeLabel(candidate.source_evidence_at)}</strong>
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {candidate.reason_codes.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                        >
                          {reason.replaceAll("_", " ")}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:w-80">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                      Overlap osservato
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xl font-semibold text-[#0b171e]">
                          {candidate.exact_product_overlap_count}
                        </p>
                        <p className="text-[11px] text-slate-500">Canonical exact</p>
                      </div>
                      <div>
                        <p className="text-xl font-semibold text-[#0b171e]">
                          {candidate.geometry_overlap_count}
                        </p>
                        <p className="text-[11px] text-slate-500">Geometrie exact</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <CrossThreadDecisionForm candidate={candidate} />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Evidence line-by-line · solo confronto, nessun link geometrico automatico
                  </p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {candidate.line_evidence.map((line) => (
                      <div
                        key={`${line.source_line_id}:${line.target_line_id}`}
                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={line.canonical_match ? "green" : "neutral"}>
                            {line.canonical_match ? "Canonical match" : "Geometry match"}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Target
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {line.target_text ?? "Testo sorgente non disponibile"}
                        </p>
                        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Source
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {line.source_text ?? "Testo sorgente non disponibile"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 text-xs font-semibold">
                  <Link
                    href={appRoutes.commercial.conversation(candidate.target_conversation_id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[#33454e]"
                  >
                    Apri target conversation
                  </Link>
                  <Link
                    href={appRoutes.commercial.conversation(candidate.source_conversation_id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[#33454e]"
                  >
                    Apri source conversation
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
