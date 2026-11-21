import { canWriteWorkspace } from "@/lib/access-policy";
import { officeWriteDenied } from "@/lib/office-profile-guard";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";
import { CommercialCustomerOfferEditor, type CustomerOfferLine, type CustomerOfferRevision } from "@/components/commercial-customer-offer-editor";
import type { QuoteUnit } from "@/lib/comm-cycle2b-pricing";
import { CommercialCustomerOfferEmail } from "@/components/commercial-customer-offer-email";

/**
 * COMM-CYCLE2.B — tenant-scoped server loader. The request remains the anchor;
 * the browser only receives customer-facing draft rows, never private target
 * prices, buying quotes or raw supplier documents.
 */
export async function CommercialCustomerOfferPanel({ rfqId }: { rfqId: string }) {
  const context = await getWorkspaceContext();
  const db = await createClient();
  const { data: request, error: requestError } = await db.from("rfqs")
    .select("id,company_id").eq("id",rfqId).eq("organization_id",context.organizationId)
    .maybeSingle();
  if (requestError || !request) return null;

  const { data: offers, error: offerError } = await db.from("offers")
    .select("id,revision_no,revision_managed,draft_edit_version,status,valid_until,delivery_term,payment_terms,notes")
    .eq("organization_id",context.organizationId).eq("rfq_id",rfqId)
    .order("revision_no",{ ascending: false }).order("created_at",{ ascending: false })
    .limit(30);
  // A deploy before the founder-authorized migrations must not break the
  // existing document detail. The offer editor simply stays unavailable.
  if (offerError) return null;

  const revisions: CustomerOfferRevision[] = (offers ?? []).map((row) => ({
    id: row.id,
    revision: Number(row.revision_no) || 1,
    status: row.status ?? "draft",
    isManaged: row.revision_managed === true,
    editVersion: Number(row.draft_edit_version) || 0,
    validity: row.valid_until ?? "",
    delivery: row.delivery_term ?? "",
    payment: row.payment_terms ?? "",
    notes: row.notes ?? "",
  }));
  const latest = revisions[0] ?? null;
  const canWrite = canWriteWorkspace(context.role) && !(await officeWriteDenied("commercial"));
  let lines: CustomerOfferLine[] = [];
  if (latest?.status === "draft" && latest.isManaged) {
    const result = await db.from("offer_lines")
      .select("id,quantity,quantity_unit,price_value,price_unit,weight_kg_m,raw_spec_text")
      .eq("organization_id",context.organizationId).eq("offer_id",latest.id)
      .order("created_at",{ ascending: true }).limit(100);
    if (result.error) return null;
    lines = (result.data ?? []).map((line) => ({
      line_id: line.id,
      description: line.raw_spec_text ?? "",
      quantity: line.quantity === null ? null : Number(line.quantity),
      quantityUnit: line.quantity_unit ?? "",
      rate: line.price_value === null ? "" : String(line.price_value),
      unit: line.price_unit === "EUR/m" ? "EUR/m" as QuoteUnit : "EUR/t" as QuoteUnit,
      weight: line.weight_kg_m === null ? "" : String(line.weight_kg_m),
    }));
  }

  // Separate email ledger is additive: a migration not yet applied must not
  // hide or break the existing quote editor.
  const {data: sends,error: sendsError}=await db.from("comm_offer_email_dispatches")
    .select("id,revision_no,attempt_no,status,recipient_email,created_at,resolved_at")
    .eq("organization_id",context.organizationId).eq("rfq_id",rfqId)
    .order("created_at",{ascending:false}).limit(30);
  let clientName:string|null=null;
  if(request.company_id){
    const {data: company}=await db.from("companies").select("name")
      .eq("id",request.company_id).eq("organization_id",context.organizationId).maybeSingle();
    clientName=company?.name??null;
  }
  return (
    <>
      <CommercialCustomerOfferEditor
        key={(latest?.id ?? "none") + ":" + (latest?.editVersion ?? 0)}
        rfqId={rfqId}
        revisions={revisions}
        lines={lines}
        canWrite={canWrite}
      />
      {latest?.isManaged && !sendsError && (
        <div className="mx-auto max-w-6xl">
          <CommercialCustomerOfferEmail
            key={latest.id+":"+latest.editVersion}
            rfqId={rfqId}
            offerId={latest.id}
            version={latest.editVersion}
            status={latest.status}
            canWrite={canWrite}
            snapshot={{
              seller:context.organizationName,client:clientName,revision:latest.revision,
              validUntil:latest.validity,delivery:latest.delivery,payment:latest.payment,
              lines:lines.map(line=>({
                description:line.description,quantity:line.quantity,quantityUnit:line.quantityUnit,
                rate:line.rate,unit:line.unit,weight:line.weight,
              })),
            }}
            history={(sends??[]).map(d=>({
              id:d.id,revision:d.revision_no,attempt:d.attempt_no,status:d.status,
              recipient:d.recipient_email,at:d.created_at,resolved:d.resolved_at,
            }))}
          />
        </div>
      )}
    </>
  );
}
