import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { appRoutes } from "@/lib/routes";

import { loadConversionFoundation, type ConversionOutcome } from "./actions";
import { loadCrossThreadRelationshipEvidence } from "./relationships/actions";

export const dynamic = "force-dynamic";

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function statusLabel(status: ConversionOutcome["analysis_status"]) {
  if (status === "identity_gap") return "Identity gap";
  if (status === "unverified_company") return "Company non verificata";
  if (status === "relationship_gap") return "Relationship gap";
  if (status === "relationship_company_gap") return "Company conflict";
  if (status === "open_offer") return "Offerta aperta";
  if (status === "converted") return "Convertita";
  return "Ordine collegato";
}

function statusTone(status: ConversionOutcome["analysis_status"]): "neutral" | "amber" | "green" | "blue" | "red" {
  if (status === "converted" || status === "linked_order") return "green";
  if (status === "open_offer") return "blue";
  if (status === "relationship_company_gap") return "red";
  if (status === "identity_gap" || status === "relationship_gap" || status === "unverified_company") return "amber";
  return "neutral";
}

function entityHref(outcome: ConversionOutcome) {
  return outcome.entity_type === "offer"
    ? appRoutes.commercial.offer(outcome.entity_id)
    : appRoutes.commercial.order(outcome.entity_id);
}

export default async function ConversionFoundationPage() {
  const [payload, crossThread] = await Promise.all([
    loadConversionFoundation(),
    loadCrossThreadRelationshipEvidence(),
  ]);
  const summary = payload.summary;
  const totalOutcomes = summary.offer_count + summary.order_count;
  const attributedOutcomes = summary.attributed_offer_count + summary.attributed_order_count;
  const identityGaps = summary.identity_gap_offer_count + summary.identity_gap_order_count;
  const relationshipGaps = summary.relationship_gap_offer_count + summary.relationship_gap_order_count;
  const relationshipLinks =
    summary.offer_rfq_linked_count +
    summary.order_offer_linked_count +
    summary.order_rfq_linked_count;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3c8192]">
          Commercial Intelligence
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#0b171e]">
          Esiti & conversione
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Legge il percorso RFQ → Offerta → Ordine solo quando identità e relazioni sono
          dimostrate. I gap di dato restano separati dalle conversioni perse e non generano
          scoring sintetico.
        </p>
      </header>

      {crossThread.summary.pending_total > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="amber">P2.6 · Evidence cross-thread</Badge>
                {crossThread.summary.strong_review_count > 0 ? (
                  <Badge tone="green">{crossThread.summary.strong_review_count} strong review</Badge>
                ) : null}
              </div>
              <p className="mt-3 text-sm font-semibold text-[#0b171e]">
                {crossThread.summary.pending_total} relazioni richiedono una decisione umana
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Sono candidati spiegabili tra thread distinti, non link automatici.
              </p>
            </div>
            <Link
              href={appRoutes.commercial.crossThreadRelationships}
              className="inline-flex shrink-0 rounded-lg bg-[#1b4c5d] px-3 py-2 text-xs font-semibold text-white"
            >
              Revisiona evidence →
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-[#0b171e]">{summary.rfq_count}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              RFQ normalizzate
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-[#0b171e]">
              {attributedOutcomes}/{totalOutcomes}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Outcome attribuiti a Company
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-[#0b171e]">{relationshipLinks}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Relazioni esplicite
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-2xl font-semibold text-[#0b171e]">
              {summary.conversion_rate_pct === null
                ? "N/D"
                : `${summary.conversion_rate_pct.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%`}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Conversione verificabile
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-[#3c8192]/20 bg-[#eef5f6]">
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">P2.5 · Evidence-first</Badge>
              <Badge tone="neutral">No predictive score</Badge>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#17343f]">
              La conversione esiste solo su una catena deterministica
            </p>
            <p className="mt-1 text-sm leading-6 text-[#45636d]">
              Il denominatore richiede una Company verificata e un&apos;Offerta collegata a una RFQ
              della stessa Company. Se questa popolazione è vuota, la percentuale resta N/D invece
              di diventare artificialmente 0%.
            </p>
          </CardContent>
        </Card>

        <Card className={identityGaps + relationshipGaps > 0 ? "border-amber-200 bg-amber-50" : ""}>
          <CardContent>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Coverage prima del funnel
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xl font-semibold text-[#0b171e]">{identityGaps}</p>
                <p className="text-xs text-slate-500">Identity gap</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-[#0b171e]">{relationshipGaps}</p>
                <p className="text-xs text-slate-500">Relationship gap</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
              {identityGaps > 0 ? (
                <Link href={appRoutes.operations.reviewIdentities} className="text-[#9a4e22]">
                  Revisione identità →
                </Link>
              ) : null}
              {crossThread.summary.pending_total > 0 ? (
                <Link href={appRoutes.commercial.crossThreadRelationships} className="text-[#9a4e22]">
                  {crossThread.summary.pending_total} evidence cross-thread →
                </Link>
              ) : relationshipGaps > 0 ? (
                <Link href={appRoutes.operations.reviewRelationships} className="text-[#9a4e22]">
                  Revisione relazioni same-thread →
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent>
            <p className="text-xl font-semibold text-[#0b171e]">
              {summary.outcome_recovered_message_count}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Header outcome recuperati
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xl font-semibold text-[#0b171e]">
              {summary.outcome_company_conversation_count}/{summary.outcome_conversation_count}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Conversation outcome attribuite
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xl font-semibold text-[#0b171e]">
              {summary.conversion_eligible_offer_count}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Offerte nel denominatore
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xl font-semibold text-[#0b171e]">
              {summary.relationship_ready_count}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Relazioni già ready
            </p>
          </CardContent>
        </Card>
      </section>

      {payload.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {payload.error}
        </div>
      ) : payload.outcomes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-base font-semibold text-[#0b171e]">Nessun outcome normalizzato</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
              La foundation inizierà a produrre coverage quando vengono promosse Offerte o Ordini.
            </p>
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-[#0b171e]">Outcome normalizzati</h2>
            <p className="mt-1 text-sm text-slate-500">
              I record con gap restano visibili ma non entrano automaticamente nel funnel di conversione.
            </p>
          </div>

          {payload.outcomes.map((outcome) => (
            <Card key={`${outcome.entity_type}-${outcome.entity_id}`}>
              <CardContent className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Badge tone={statusTone(outcome.analysis_status)}>
                      {statusLabel(outcome.analysis_status)}
                    </Badge>
                    <Badge tone="neutral">
                      {outcome.entity_type === "offer" ? "Offerta" : "Ordine"}
                    </Badge>
                    <Badge tone="neutral">
                      {outcome.canonical_line_count}/{outcome.line_count} linee canonicali
                    </Badge>
                  </div>
                  <Link
                    href={entityHref(outcome)}
                    className="mt-3 block text-sm font-semibold text-[#0b171e] hover:text-[#1b4c5d]"
                  >
                    {outcome.company_name ?? "Company non attribuita"}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    {dateLabel(outcome.event_at)} · {outcome.status ?? "stato non disponibile"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  {outcome.company_id ? (
                    <Link
                      href={appRoutes.commercial.company(outcome.company_id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[#1b4c5d]"
                    >
                      Company 360
                    </Link>
                  ) : null}
                  {outcome.conversation_id ? (
                    <Link
                      href={appRoutes.commercial.conversation(outcome.conversation_id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[#33454e]"
                    >
                      Conversazione
                    </Link>
                  ) : null}
                  {outcome.rfq_id ? (
                    <Link
                      href={appRoutes.commercial.rfq(outcome.rfq_id)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[#33454e]"
                    >
                      RFQ
                    </Link>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
