import Link from "next/link";

import { RfqQuoteComparison, type RfqComparisonData } from "@/components/rfq-quote-comparison";
import { RfqBuyerNegotiationPanel, type BuyerNegotiationThread } from "@/components/rfq-buyer-negotiation-panel";
import { RfqAwardPanel, type Rfqh7AwardSnapshot } from "@/components/rfq-award-panel";
import { Rfqh9PurchaseOrderPanel, type Rfqh9PoState } from "@/components/rfqh9-purchase-order-panel";
import { canWriteWorkspace } from "@/lib/access-policy";
import { createRfqh9PoSecurity, buildRfqh9SupplierUrl } from "@/lib/rfqh9-po";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { appRoutes } from "@/lib/routes";
import { commercialHref, type CommercialView } from "@/lib/commercial-unified-data";

export type CommercialOperationsTab = "compare" | "negotiate" | "award" | "po";

const operationsTabs: ReadonlyArray<{ id: CommercialOperationsTab; title: string }> = [
  { id: "compare", title: "Confronta offerte" },
  { id: "negotiate", title: "Negozia" },
  { id: "award", title: "Aggiudica" },
  { id: "po", title: "Ordini PO" },
];

function operationsHref(view: CommercialView, query: string, selected: string, tab: CommercialOperationsTab) {
  const path = commercialHref(view, query, selected).replace(/#.*$/, "");
  return path + (path.includes("?") ? "&" : "?") + "tab=" + tab + "#commercial-operations";
}

/**
 * Reuses exactly the existing RFQH5/7/9 components and their server actions.
 * No alternative mutation endpoint or permission model is introduced.
 */
export async function CommercialCampaignOperations({
  rfqId, selected, tab, view, query,
}: {
  rfqId: string;
  selected: string;
  tab: CommercialOperationsTab;
  view: CommercialView;
  query: string;
}) {
  const context = await getWorkspaceContext();
  const db = await createClient();
  // Strong explicit tenant check in addition to table RLS, before any RPC.
  const { data: campaign, error: campaignError } = await db.from("buyer_rfq_campaigns")
    .select("id,title,status,owner_user_id,organization_id,source_distinta_id")
    .eq("id", rfqId)
    .eq("organization_id", context.organizationId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return <p role="status" className="text-xs text-[var(--text-secondary)]">RFQ non visibile nell'azienda selezionata.</p>;
  }

  const canWrite = canWriteWorkspace(context.role);
  // The owner / existing governance engine is the only source for critical actions.
  const { data: governance, error: governanceError } = canWrite
    ? await db.rpc("rfqh13_governance_state", { p_rfq_id: campaign.id })
    : { data: null, error: null };
  const governed = governance && typeof governance === "object" && !Array.isArray(governance)
    ? governance as { current_user?: { role?: string } } : null;
  const canExecuteCritical = canWrite && !governanceError &&
    (governed?.current_user?.role === "owner" || campaign.owner_user_id === context.userId);

  let body: React.ReactNode = null;
  let unavailable = false;

  if (tab === "compare" || tab === "award") {
    const { data: comparison, error: comparisonError } = await db.rpc("rfqh5_quote_comparison", {
      p_rfq_id: campaign.id,
    });
    const comparisonData: RfqComparisonData | null = !comparisonError && comparison &&
      typeof comparison === "object" && !Array.isArray(comparison)
        ? comparison as RfqComparisonData : null;

    if (comparisonError || !comparisonData) {
      unavailable = true;
    } else if (tab === "compare") {
      body = <RfqQuoteComparison comparison={comparisonData} />;
    } else {
      const { data: awardRow, error: awardError } = await db.from("buyer_rfq_awards")
        .select("id,award_mode,reason,line_count,supplier_count,total_tonnes,total_eur,target_total_eur,savings_eur,savings_pct,confirmed_at")
        .eq("rfq_id", campaign.id).maybeSingle();
      if (awardError) {
        unavailable = true;
      } else {
        let snapshot: Rfqh7AwardSnapshot | null = null;
        if (awardRow) {
          const [allocs, pos] = await Promise.all([
            db.from("buyer_rfq_award_allocations")
              .select("id,rfq_line_id,supplier_id,line_position,description,awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur,savings_eur")
              .eq("award_id", awardRow.id).order("line_position", { ascending: true }),
            db.from("buyer_purchase_order_drafts")
              .select("id,supplier_id,status,po_draft_ref,supplier_name_snapshot,supplier_email_snapshot,quote_revision_no,incoterm,payment_terms,total_tonnes,total_eur,commercial_order_id")
              .eq("award_id", awardRow.id).order("po_draft_ref", { ascending: true }),
          ]);
          if (allocs.error || pos.error) {
            unavailable = true;
          } else {
            const poIds = (pos.data ?? []).map((po) => po.id);
            const poLines = poIds.length
              ? await db.from("buyer_purchase_order_lines")
                .select("id,po_draft_id,line_position,description,awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur")
                .in("po_draft_id", poIds).order("line_position", { ascending: true })
              : null;
            if (poLines?.error) {
              unavailable = true;
            } else {
              snapshot = {
                ...awardRow,
                award_mode: awardRow.award_mode as "full" | "split",
                allocations: allocs.data ?? [],
                poDrafts: (pos.data ?? []).map((po) => ({
                  ...po,
                  lines: (poLines?.data ?? []).filter((line) => line.po_draft_id === po.id),
                })),
              } as Rfqh7AwardSnapshot;
            }
          }
        }
        if (!unavailable) {
          body = <RfqAwardPanel rfqId={campaign.id} campaignStatus={campaign.status}
            comparison={comparisonData} award={snapshot} canExecute={canExecuteCritical} />;
        }
      }
    }
  } else if (tab === "negotiate") {
    const [suppliers, lines, threads] = await Promise.all([
      db.from("buyer_rfq_suppliers")
        .select("id,supplier_name,supplier_email_normalized,status")
        .eq("rfq_id", campaign.id),
      db.from("buyer_distinta_lines")
        .select("id,line_position,description,target_eur_t,target_eur_m")
        .eq("distinta_id", campaign.source_distinta_id)
        .order("line_position", { ascending: true }),
      db.from("buyer_rfq_negotiation_threads")
        .select("id,supplier_id,status,active_request_type,request_due_at,round_no,reminder_count,last_message_at")
        .eq("rfq_id", campaign.id),
    ]);
    if (suppliers.error || lines.error || threads.error) {
      unavailable = true;
    } else {
      const ids = (threads.data ?? []).map((thread) => thread.id);
      const messages = ids.length
        ? await db.from("buyer_rfq_negotiation_messages")
          .select("id,thread_id,sender_role,message_type,round_no,body,request_due_at,notification_status,created_at")
          .in("thread_id", ids).order("created_at", { ascending: true })
        : null;
      const messageIds = (messages?.data ?? []).map((msg) => msg.id);
      const targets = !messages?.error && messageIds.length
        ? await db.from("buyer_rfq_negotiation_targets")
          .select("id,message_id,rfq_line_id,target_basis,target_value,normalized_eur_t,normalized_eur_m")
          .in("message_id", messageIds) : null;
      if (messages?.error || targets?.error) {
        unavailable = true;
      } else {
        const mapped = (threads.data ?? []).map((thread) => ({
          ...thread,
          round_no: Number(thread.round_no),
          reminder_count: Number(thread.reminder_count),
          messages: (messages?.data ?? []).filter((message) => message.thread_id === thread.id)
            .map((message) => ({
              ...message,
              round_no: Number(message.round_no),
              targets: (targets?.data ?? []).filter((target) => target.message_id === message.id),
            })),
        })) as BuyerNegotiationThread[];
        body = <RfqBuyerNegotiationPanel
          rfqId={campaign.id}
          suppliers={(suppliers.data ?? []).map((supplier) => ({
            id: supplier.id, name: supplier.supplier_name,
            email: supplier.supplier_email_normalized, status: supplier.status,
          }))}
          lines={(lines.data ?? []).map((line) => ({
            id: line.id, position: Number(line.line_position),
            description: line.description, targetEurT: line.target_eur_t, targetEurM: line.target_eur_m,
          }))}
          threads={mapped}
          readOnly={campaign.status === "awarded" || !canExecuteCritical}
        />;
      }
    }
  } else if (tab === "po") {
    const { data, error } = await db.rpc("rfqh9_po_state", { p_rfq_id: campaign.id });
    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      unavailable = true;
    } else {
      let state = data as Rfqh9PoState;
      // Shareable supplier confirmation tokens are never generated for viewers.
      if (canExecuteCritical && state.purchase_orders?.length) {
        state = { ...state, purchase_orders: state.purchase_orders.map((po) => ({
          ...po,
          versions: (po.versions ?? []).map((version) => {
            let supplierUrl: string | null = null;
            try {
              const security = createRfqh9PoSecurity({ poDraftId: po.id, versionNo: Number(version.version_no) });
              supplierUrl = buildRfqh9SupplierUrl(security.token);
            } catch { /* Missing signing configuration: no link */ }
            return { ...version, supplier_url: supplierUrl };
          }),
        })) };
      }
      body = <Rfqh9PurchaseOrderPanel rfqId={campaign.id} state={state} canExecute={canExecuteCritical} />;
    }
  }

  return (
    <section id="commercial-operations" aria-label="Operazioni RFQ in Commerciale" className="scroll-mt-36 min-w-0 space-y-3">
      <h4 className="text-sm font-bold text-[var(--brand-deep)]">Lavora sulla RFQ qui</h4>
      <nav aria-label="Fasi della trattativa" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)] p-1">
        {operationsTabs.map((option) => (
          <Link key={option.id} href={operationsHref(view, query, selected, option.id)}
            aria-current={tab === option.id ? "page" : undefined}
            className={"inline-flex min-h-10 shrink-0 items-center rounded-lg px-2.5 text-xs font-semibold " +
              (tab === option.id ? "bg-[var(--brand-deep)] text-white" : "text-[var(--brand-deep)] hover:bg-[var(--brand-primary-soft)]")}>
            {option.title}
          </Link>
        ))}
      </nav>
      {unavailable ? (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Le informazioni operative non sono disponibili. Nessuna azione è stata eseguita.
        </p>
      ) : body}
      <p className="text-[11px] text-[var(--text-secondary)]">
        Operazioni protette dalle autorizzazioni RFQ esistenti. Invio, aggiudicazione ed emissione PO richiedono conferme esplicite.
      </p>
      <Link href={appRoutes.rfqHub.campaign(campaign.id)}
        className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border-strong)] px-3 text-xs font-semibold text-[var(--brand-deep)]">
        Apri RFQ completa ↗
      </Link>
    </section>
  );
}
