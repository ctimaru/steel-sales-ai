import Link from "next/link";
import { notFound } from "next/navigation";

import {
  RfqAwardPanel,
  type Rfqh7AwardSnapshot,
} from "@/components/rfq-award-panel";
import {
  RfqBuyerNegotiationPanel,
  type BuyerNegotiationThread,
} from "@/components/rfq-buyer-negotiation-panel";
import { RfqDispatchPanel } from "@/components/rfq-dispatch-panel";
import {
  RfqQuoteComparison,
  type RfqComparisonData,
} from "@/components/rfq-quote-comparison";
import { RfqSupplierAddForm } from "@/components/rfq-supplier-add-form";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ rfqId: string }>;

function formatNumber(value: number | string | null, digits: number) {
  if (value === null) return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "medium",
  }).format(date);
}

export default async function BuyerRfqCampaignPage({ params }: { params: Params }) {
  const { rfqId } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("buyer_rfq_campaigns")
    .select("id,title,status,source_distinta_id,due_at,buyer_message,created_at")
    .eq("id", rfqId)
    .maybeSingle();

  if (!campaign) notFound();

  const [
    { data: distinta },
    { data: lines },
    { data: suppliers },
    { data: dispatches },
    { data: quotes },
    { data: comparison },
    { data: negotiationThreads },
    { data: awardRow },
  ] = await Promise.all([
    supabase
      .from("buyer_distintas")
      .select("id,line_count,total_meters,total_tonnes,target_total_eur")
      .eq("id", campaign.source_distinta_id)
      .maybeSingle(),
    supabase
      .from("buyer_distinta_lines")
      .select("id,line_position,description,standard_code,grade_code,finish_code,quantity_mode,quantity,weight_kg_m,line_meters,line_tonnes,target_eur_t,target_eur_m,note")
      .eq("distinta_id", campaign.source_distinta_id)
      .order("line_position", { ascending: true }),
    supabase
      .from("buyer_rfq_suppliers")
      .select("id,supplier_name,supplier_email_normalized,status,delivery_channel,identity_source,resolution_status,created_at")
      .eq("rfq_id", campaign.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("buyer_rfq_dispatches")
      .select("id,supplier_id,status,attempt_count,reminder_count,last_reminder_at,sent_at,delivered_at,opened_at,last_error")
      .eq("rfq_id", campaign.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("buyer_rfq_quotes")
      .select("id,supplier_id,revision_no,status,incoterm,payment_terms,validity_until,lead_time_days,delivery_date,moq_tonnes,notes,decline_reason,attachment_bucket,attachment_path,attachment_name,attachment_size_bytes,submitted_at,declined_at")
      .eq("rfq_id", campaign.id)
      .order("revision_no", { ascending: false }),
    supabase.rpc("rfqh5_quote_comparison", {
      p_rfq_id: campaign.id,
    }),
    supabase
      .from("buyer_rfq_negotiation_threads")
      .select("id,supplier_id,status,active_request_type,request_due_at,round_no,reminder_count,last_message_at,updated_at")
      .eq("rfq_id", campaign.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("buyer_rfq_awards")
      .select("id,award_mode,reason,line_count,supplier_count,total_tonnes,total_eur,target_total_eur,savings_eur,savings_pct,confirmed_at")
      .eq("rfq_id", campaign.id)
      .maybeSingle(),
  ]);

  const supplierRows = suppliers ?? [];
  const lineRows = lines ?? [];
  const quoteRows = quotes ?? [];
  const comparisonData =
    comparison && typeof comparison === "object" && !Array.isArray(comparison)
      ? (comparison as RfqComparisonData)
      : null;
  const latestQuoteBySupplier = new Map<
    string,
    (typeof quoteRows)[number]
  >();

  for (const quote of quoteRows) {
    if (!latestQuoteBySupplier.has(quote.supplier_id)) {
      latestQuoteBySupplier.set(quote.supplier_id, quote);
    }
  }

  const latestQuotes = Array.from(latestQuoteBySupplier.values());
  const latestQuoteIds = latestQuotes.map((quote) => quote.id);
  const quoteLinesResult =
    latestQuoteIds.length > 0
      ? await supabase
          .from("buyer_rfq_quote_lines")
          .select("quote_id,rfq_line_id,line_position,response_status,price_basis,unit_price,normalized_eur_t,normalized_eur_m,offered_quantity,offered_quantity_mode,moq_tonnes,lead_time_days,delivery_date,notes")
          .in("quote_id", latestQuoteIds)
          .order("line_position", { ascending: true })
      : null;
  const quoteLineRows = quoteLinesResult?.data ?? [];

  const attachmentLinks = await Promise.all(
    latestQuotes.map(async (quote) => {
      if (!quote.attachment_path || !quote.attachment_bucket) {
        return [quote.id, null] as const;
      }
      const { data } = await supabase.storage
        .from(quote.attachment_bucket)
        .createSignedUrl(quote.attachment_path, 600, {
          download: quote.attachment_name || "offerta",
        });
      return [quote.id, data?.signedUrl ?? null] as const;
    }),
  );
  const attachmentUrlByQuote = new Map<string, string>();
  for (const [quoteId, signedUrl] of attachmentLinks) {
    if (signedUrl) attachmentUrlByQuote.set(quoteId, signedUrl);
  }

  const negotiationThreadRows = negotiationThreads ?? [];
  const negotiationThreadIds = negotiationThreadRows.map((thread) => thread.id);
  const negotiationMessageResult =
    negotiationThreadIds.length > 0
      ? await supabase
          .from("buyer_rfq_negotiation_messages")
          .select("id,thread_id,sender_role,message_type,round_no,body,request_due_at,notification_status,created_at")
          .in("thread_id", negotiationThreadIds)
          .order("created_at", { ascending: true })
      : null;
  const negotiationMessageRows = negotiationMessageResult?.data ?? [];
  const negotiationMessageIds = negotiationMessageRows.map((message) => message.id);
  const negotiationTargetResult =
    negotiationMessageIds.length > 0
      ? await supabase
          .from("buyer_rfq_negotiation_targets")
          .select("id,message_id,rfq_line_id,target_basis,target_value,normalized_eur_t,normalized_eur_m")
          .in("message_id", negotiationMessageIds)
      : null;
  const negotiationTargetRows = negotiationTargetResult?.data ?? [];

  const buyerNegotiationThreads = negotiationThreadRows.map((thread) => ({
    id: thread.id,
    supplier_id: thread.supplier_id,
    status: thread.status,
    active_request_type: thread.active_request_type,
    request_due_at: thread.request_due_at,
    round_no: Number(thread.round_no),
    reminder_count: Number(thread.reminder_count),
    last_message_at: thread.last_message_at,
    messages: negotiationMessageRows
      .filter((message) => message.thread_id === thread.id)
      .map((message) => ({
        ...message,
        round_no: Number(message.round_no),
        targets: negotiationTargetRows.filter(
          (target) => target.message_id === message.id,
        ),
      })),
  })) as BuyerNegotiationThread[];

  let awardSnapshot: Rfqh7AwardSnapshot | null = null;
  if (awardRow) {
    const [{ data: awardAllocations }, { data: poDrafts }] = await Promise.all([
      supabase
        .from("buyer_rfq_award_allocations")
        .select("id,rfq_line_id,supplier_id,line_position,description,awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur,savings_eur")
        .eq("award_id", awardRow.id)
        .order("line_position", { ascending: true }),
      supabase
        .from("buyer_purchase_order_drafts")
        .select("id,supplier_id,status,po_draft_ref,supplier_name_snapshot,supplier_email_snapshot,quote_revision_no,incoterm,payment_terms,total_tonnes,total_eur,commercial_order_id")
        .eq("award_id", awardRow.id)
        .order("po_draft_ref", { ascending: true }),
    ]);

    const poIds = (poDrafts ?? []).map((po) => po.id);
    const poLineResult =
      poIds.length > 0
        ? await supabase
            .from("buyer_purchase_order_lines")
            .select("id,po_draft_id,line_position,description,awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur")
            .in("po_draft_id", poIds)
            .order("line_position", { ascending: true })
        : null;
    const poLineRows = poLineResult?.data ?? [];

    awardSnapshot = {
      ...awardRow,
      award_mode: awardRow.award_mode as "full" | "split",
      allocations: awardAllocations ?? [],
      poDrafts: (poDrafts ?? []).map((po) => ({
        ...po,
        lines: poLineRows.filter((line) => line.po_draft_id === po.id),
      })),
    } as Rfqh7AwardSnapshot;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={appRoutes.marketplace.rfqHub}
          className="text-sm font-semibold text-[#52615b] hover:text-[#173f35]"
        >
          ← RFQ Hub
        </Link>
        <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#173f35]">
          {campaign.status}
        </span>
      </div>

      <header className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
          RFQ multi-fornitore
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1d2824]">
          {campaign.title}
        </h1>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-[#f7f9f8] p-3">
            <p className="text-xs text-[#718078]">Righe</p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">{distinta?.line_count ?? lineRows.length}</p>
          </div>
          <div className="rounded-xl bg-[#f7f9f8] p-3">
            <p className="text-xs text-[#718078]">Tonnellate</p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">{formatNumber(distinta?.total_tonnes ?? null, 3)}</p>
          </div>
          <div className="rounded-xl bg-[#edf5f2] p-3">
            <p className="text-xs text-[#527268]">Fornitori</p>
            <p className="mt-1 text-xl font-semibold text-[#173f35]">{supplierRows.length}</p>
          </div>
        </div>
      </header>

      <RfqDispatchPanel
        rfqId={campaign.id}
        campaignStatus={campaign.status}
        dueAt={campaign.due_at}
        buyerMessage={campaign.buyer_message}
        suppliers={supplierRows.map((supplier) => ({
          id: supplier.id,
          status: supplier.status,
          hasEmail: Boolean(supplier.supplier_email_normalized),
        }))}
      />

      {campaign.status === "draft" || campaign.status === "ready" ? (
        <RfqSupplierAddForm rfqId={campaign.id} />
      ) : null}

      <section className="rounded-2xl border border-[#dce2df] bg-white">
        <div className="border-b border-[#e7ece9] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Fornitori target
          </p>
        </div>
        {supplierRows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#66736e]">
            Aggiungi almeno un fornitore per preparare l&apos;invio.
          </p>
        ) : (
          <div className="divide-y divide-[#edf0ee]">
            {supplierRows.map((supplier, index) => (
              <div key={supplier.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-[#1d2824]">
                    {supplier.supplier_name || "Fornitore " + String(index + 1)}
                  </p>
                  <p className="mt-0.5 text-xs text-[#66736e]">
                    {supplier.supplier_email_normalized || "Canale piattaforma"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#edf5f2] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#1a5144]">
                      {supplier.identity_source.replaceAll("_", " ")}
                    </span>
                    <span className="rounded-full bg-[#f7f9f8] px-2 py-0.5 text-[9px] font-semibold text-[#66736e]">
                      {supplier.delivery_channel === "both"
                        ? "Email + piattaforma"
                        : supplier.delivery_channel === "platform"
                          ? "Piattaforma"
                          : "Email"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-bold uppercase text-[#52615b]">
                    {supplier.status}
                  </span>
                  {Number(dispatches?.find((dispatch) => dispatch.supplier_id === supplier.id)?.reminder_count ?? 0) > 0 ? (
                    <p className="mt-2 text-[10px] font-semibold text-[#66736e]">
                      Promemoria inviati: {dispatches?.find((dispatch) => dispatch.supplier_id === supplier.id)?.reminder_count}/2
                    </p>
                  ) : null}
                  {dispatches?.find((dispatch) => dispatch.supplier_id === supplier.id)?.last_error ? (
                    <p className="mt-2 max-w-72 text-[10px] leading-4 text-[#9a4f45]">
                      {dispatches.find((dispatch) => dispatch.supplier_id === supplier.id)?.last_error}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <RfqQuoteComparison comparison={comparisonData} />

      <RfqBuyerNegotiationPanel
        rfqId={campaign.id}
        suppliers={supplierRows.map((supplier) => ({
          id: supplier.id,
          name: supplier.supplier_name,
          email: supplier.supplier_email_normalized,
          status: supplier.status,
        }))}
        lines={lineRows.map((line) => ({
          id: line.id,
          position: Number(line.line_position),
          description: line.description,
          targetEurT: line.target_eur_t,
          targetEurM: line.target_eur_m,
        }))}
        threads={buyerNegotiationThreads}
        readOnly={campaign.status === "awarded"}
      />

      <RfqAwardPanel
        rfqId={campaign.id}
        campaignStatus={campaign.status}
        comparison={comparisonData}
        award={awardSnapshot}
      />

      <section className="rounded-2xl border border-[#dce2df] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ece9] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Risposte fornitori
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
              Offerte ricevute
            </h2>
          </div>
          <span className="text-xs text-[#718078]">
            {latestQuotes.filter((quote) => quote.status === "submitted").length} inviate ·{" "}
            {latestQuotes.filter((quote) => quote.status === "declined").length} rifiutate
          </span>
        </div>

        {latestQuotes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#66736e]">
            Nessuna risposta ricevuta per ora.
          </p>
        ) : (
          <div className="divide-y divide-[#edf0ee]">
            {supplierRows.map((supplier) => {
              const quote = latestQuoteBySupplier.get(supplier.id);
              if (!quote) return null;
              const responseLines = quoteLineRows.filter(
                (line) => line.quote_id === quote.id,
              );
              const attachmentUrl = attachmentUrlByQuote.get(quote.id);

              return (
                <article key={quote.id} className="px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-[#1d2824]">
                        {supplier.supplier_name || supplier.supplier_email_normalized || "Fornitore"}
                      </p>
                      <p className="mt-1 text-xs text-[#718078]">
                        Revisione {quote.revision_no}
                        {quote.submitted_at ? " · inviata " + formatDate(quote.submitted_at) : ""}
                      </p>
                    </div>
                    <span className={
                      "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] " +
                      (quote.status === "submitted"
                        ? "bg-[#edf5f2] text-[#173f35]"
                        : quote.status === "declined"
                          ? "bg-[#fff1ef] text-[#8b5148]"
                          : "bg-[#f2f4f3] text-[#52615b]")
                    }>
                      {quote.status}
                    </span>
                  </div>

                  {quote.status === "declined" ? (
                    <p className="mt-3 rounded-xl bg-[#fff8f6] px-4 py-3 text-sm text-[#76544e]">
                      {quote.decline_reason || "Il fornitore ha indicato che non può quotare questa RFQ."}
                    </p>
                  ) : (
                    <>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        <div className="rounded-xl bg-[#f7f9f8] p-3">
                          <p className="text-[10px] uppercase text-[#718078]">Incoterm</p>
                          <p className="mt-1 text-sm font-semibold">{quote.incoterm || "—"}</p>
                        </div>
                        <div className="rounded-xl bg-[#f7f9f8] p-3">
                          <p className="text-[10px] uppercase text-[#718078]">Pagamento</p>
                          <p className="mt-1 text-sm font-semibold">{quote.payment_terms || "—"}</p>
                        </div>
                        <div className="rounded-xl bg-[#f7f9f8] p-3">
                          <p className="text-[10px] uppercase text-[#718078]">Validità</p>
                          <p className="mt-1 text-sm font-semibold">{formatDate(quote.validity_until)}</p>
                        </div>
                        <div className="rounded-xl bg-[#f7f9f8] p-3">
                          <p className="text-[10px] uppercase text-[#718078]">Lead time</p>
                          <p className="mt-1 text-sm font-semibold">
                            {quote.lead_time_days === null ? "—" : quote.lead_time_days + " gg"}
                          </p>
                        </div>
                        <div className="rounded-xl bg-[#f7f9f8] p-3">
                          <p className="text-[10px] uppercase text-[#718078]">Consegna</p>
                          <p className="mt-1 text-sm font-semibold">{formatDate(quote.delivery_date)}</p>
                        </div>
                      </div>

                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-[920px] w-full border-collapse text-left text-xs">
                          <thead>
                            <tr className="border-b border-[#dce2df] text-[#66736e]">
                              <th className="px-2 py-2">Riga</th>
                              <th className="px-2 py-2">Esito</th>
                              <th className="px-2 py-2 text-right">€/t</th>
                              <th className="px-2 py-2 text-right">€/m</th>
                              <th className="px-2 py-2 text-right">Q.tà offerta</th>
                              <th className="px-2 py-2 text-right">MOQ t</th>
                              <th className="px-2 py-2 text-right">Lead gg</th>
                              <th className="px-2 py-2">Consegna</th>
                            </tr>
                          </thead>
                          <tbody>
                            {responseLines.map((line) => (
                              <tr key={line.rfq_line_id} className="border-b border-[#edf0ee]">
                                <td className="px-2 py-3 font-semibold">{line.line_position}</td>
                                <td className="px-2 py-3">
                                  {line.response_status === "quoted" ? "Quotata" : "Non disponibile"}
                                </td>
                                <td className="px-2 py-3 text-right font-semibold tabular-nums text-[#173f35]">
                                  {line.response_status === "quoted"
                                    ? formatNumber(line.normalized_eur_t, 2)
                                    : "—"}
                                </td>
                                <td className="px-2 py-3 text-right font-semibold tabular-nums text-[#173f35]">
                                  {line.response_status === "quoted"
                                    ? formatNumber(line.normalized_eur_m, 4)
                                    : "—"}
                                </td>
                                <td className="px-2 py-3 text-right tabular-nums">
                                  {line.offered_quantity === null
                                    ? "—"
                                    : formatNumber(line.offered_quantity, 3) +
                                      " " +
                                      (line.offered_quantity_mode || "")}
                                </td>
                                <td className="px-2 py-3 text-right tabular-nums">
                                  {formatNumber(line.moq_tonnes, 3)}
                                </td>
                                <td className="px-2 py-3 text-right tabular-nums">
                                  {line.lead_time_days ?? "—"}
                                </td>
                                <td className="px-2 py-3">{formatDate(line.delivery_date)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {quote.attachment_name ? (
                          attachmentUrl ? (
                            <a
                              href={attachmentUrl}
                              className="inline-flex min-h-10 items-center rounded-xl border border-[#b8d2c8] bg-white px-4 text-xs font-bold text-[#173f35]"
                            >
                              Scarica {quote.attachment_name}
                            </a>
                          ) : (
                            <span className="text-xs text-[#718078]">
                              Allegato: {quote.attachment_name}
                            </span>
                          )
                        ) : null}
                        {quote.notes ? (
                          <p className="text-xs text-[#66736e]">{quote.notes}</p>
                        ) : null}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Distinta
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">Snapshot inviabile</h2>
          </div>
          <span className="text-xs text-[#718078]">
            Target €/t e Target €/m restano congelati nello snapshot.
          </span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[860px] w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#dce2df] text-[#66736e]">
                <th className="px-2 py-2">Articolo</th>
                <th className="px-2 py-2">Norma</th>
                <th className="px-2 py-2">Grado</th>
                <th className="px-2 py-2 text-right">Quantità</th>
                <th className="px-2 py-2 text-right">kg/m</th>
                <th className="px-2 py-2 text-right">Target €/t</th>
                <th className="px-2 py-2 text-right">Target €/m</th>
              </tr>
            </thead>
            <tbody>
              {lineRows.map((line) => (
                <tr key={line.id} className="border-b border-[#edf0ee]">
                  <td className="px-2 py-3 font-semibold text-[#1d2824]">{line.description}</td>
                  <td className="px-2 py-3 text-[#52615b]">{line.standard_code || "—"}</td>
                  <td className="px-2 py-3 text-[#52615b]">{line.grade_code || "—"}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-[#52615b]">
                    {formatNumber(line.quantity, line.quantity_mode === "tonnes" ? 3 : 2)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-[#52615b]">{formatNumber(line.weight_kg_m, 3)}</td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-[#173f35]">{formatNumber(line.target_eur_t, 2)}</td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-[#173f35]">{formatNumber(line.target_eur_m, 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[#cddbd6] bg-[#f7faf8] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">RFQH7</p>
        <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">Award &amp; Commercial Conversion attivo.</h2>
        <p className="mt-2 text-sm leading-6 text-[#66736e]">
          Il buyer può congelare un award unico o split, generare PO draft procurement-native e
          chiudere le trattative non selezionate. L&apos;invio dell&apos;ordine resta un&apos;azione separata e intenzionale.
        </p>
      </section>
    </div>
  );
}
