import { createHash } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";

import {
  RfqSupplierNegotiation,
  type SupplierNegotiationPayload,
} from "@/components/rfq-supplier-negotiation";
import { RfqSupplierResponseForm } from "@/components/rfq-supplier-response-form";
import { appRoutes } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Richiesta di offerta · Smart Steel Sales",
  robots: { index: false, follow: false },
};

type Params = Promise<{ token: string }>;

type InviteLine = {
  line_id: string;
  position: number;
  description: string;
  standard: string | null;
  grade: string | null;
  finish: string | null;
  quantity_mode: string;
  quantity: number | string;
  bar_length_m: number | string | null;
  weight_kg_m: number | string;
  line_meters: number | string;
  line_tonnes: number | string;
  note: string | null;
};

type QuoteLine = {
  line_id: string;
  position: number;
  response_status: "quoted" | "not_available";
  price_basis: "eur_t" | "eur_m" | null;
  unit_price: number | string | null;
  normalized_eur_t: number | string | null;
  normalized_eur_m: number | string | null;
  offered_quantity: number | string | null;
  offered_quantity_mode: "meters" | "tonnes" | "bars" | null;
  moq_tonnes: number | string | null;
  lead_time_days: number | string | null;
  delivery_date: string | null;
  notes: string | null;
};

type InviteQuote = {
  id: string;
  revision_no: number;
  status: "draft" | "submitted" | "declined" | "superseded";
  currency_code: string;
  incoterm: string | null;
  payment_terms: string | null;
  validity_until: string | null;
  lead_time_days: number | string | null;
  delivery_date: string | null;
  moq_tonnes: number | string | null;
  notes: string | null;
  decline_reason: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_size_bytes: number | string | null;
  submitted_at: string | null;
  declined_at: string | null;
  lines: QuoteLine[];
};

type InvitePayload = {
  valid?: boolean;
  title?: string;
  buyer_organization_name?: string;
  supplier_name?: string | null;
  due_at?: string | null;
  expired?: boolean;
  buyer_message?: string | null;
  line_count?: number;
  total_tonnes?: number | string;
  can_respond?: boolean;
  lines?: InviteLine[];
  quote?: InviteQuote | null;
};

function formatNumber(value: number | string | null | undefined, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatDue(value: string | null | undefined) {
  if (!value) return "Nessuna scadenza indicata";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Nessuna scadenza indicata";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export default async function SupplierRfqInvitePage({ params }: { params: Params }) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await createClient();
  const [
    { data, error },
    { data: negotiationData },
    { data: claimData },
  ] = await Promise.all([
    supabase.rpc("rfqh4_get_portal", {
      p_token_hash: tokenHash,
    }),
    supabase.rpc("rfqh6_supplier_thread", {
      p_token_hash: tokenHash,
    }),
    supabase.rpc("rfqh8_guest_claim_context", {
      p_token_hash: tokenHash,
    }),
  ]);

  const invite =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as InvitePayload)
      : null;

  if (error || !invite?.valid) {
    return (
      <main className="min-h-screen bg-[#f2f4f3] px-4 py-12 text-[#1d2824]">
        <div className="mx-auto max-w-xl rounded-3xl border border-[#dce2df] bg-white p-7">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Smart Steel Sales · RFQ
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Link RFQ non disponibile</h1>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Il link può essere scaduto, revocato oppure non valido. Contatta il buyer che ti ha inviato la richiesta.
          </p>
        </div>
      </main>
    );
  }

  const lines = Array.isArray(invite.lines) ? invite.lines : [];
  const expired = invite.expired === true;
  const uploadUrl =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "") +
    "/functions/v1/rfqh4-offer-upload";
  const negotiation =
    negotiationData &&
    typeof negotiationData === "object" &&
    !Array.isArray(negotiationData)
      ? (negotiationData as SupplierNegotiationPayload)
      : null;
  const claimContext =
    claimData && typeof claimData === "object" && !Array.isArray(claimData)
      ? (claimData as {
          available?: boolean;
          network_company_id?: string;
          company_name?: string;
          claimed_status?: string;
          verification_status?: string;
          claim_recommended?: boolean;
        })
      : null;

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-8 text-[#1d2824] sm:py-12">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-3xl border border-[#244d43] bg-[#123d34] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9cc5b7]">
            Smart Steel Sales · Richiesta di offerta
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
            {invite.title || "Richiesta di offerta"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#d8e5e0]">
            Da <strong>{invite.buyer_organization_name || "Buyer Smart Steel Sales"}</strong>
            {invite.supplier_name ? " · Per " + invite.supplier_name : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#d8e5e0]">
            <span className="rounded-full border border-[#35675a] bg-[#173f35] px-3 py-1.5">
              Scadenza: {formatDue(invite.due_at)}
            </span>
            <span className="rounded-full border border-[#35675a] bg-[#173f35] px-3 py-1.5">
              {invite.line_count ?? lines.length} righe
            </span>
            <span className="rounded-full border border-[#35675a] bg-[#173f35] px-3 py-1.5">
              {formatNumber(invite.total_tonnes, 3)} t richieste
            </span>
          </div>
        </header>

        {expired ? (
          <div className="rounded-2xl border border-[#ead9c0] bg-[#fffaf1] px-5 py-4 text-sm font-semibold text-[#7b5e2b]">
            La scadenza indicata dal buyer è trascorsa. La risposta è ora in sola lettura.
          </div>
        ) : null}

        {invite.buyer_message ? (
          <section className="rounded-2xl border border-[#dce2df] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Messaggio del buyer
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#52615b]">
              {invite.buyer_message}
            </p>
          </section>
        ) : null}

        <RfqSupplierNegotiation
          token={token}
          negotiation={negotiation}
          quoteStatus={invite.quote?.status ?? null}
        />

        <RfqSupplierResponseForm
          token={token}
          canRespond={invite.can_respond === true}
          expired={expired}
          lines={lines}
          quote={invite.quote ?? null}
          uploadUrl={uploadUrl}
        />

        {claimContext?.available && claimContext.network_company_id ? (
          <section className="rounded-2xl border border-[#cfe1da] bg-[#edf5f2] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              Profilo aziendale Network
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[#173f35]">
              {claimContext.company_name || "La tua azienda"} è già presente su Smart Steel Sales
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52615b]">
              Puoi rispondere a questa RFQ senza creare un account. Se vuoi gestire dati,
              contatti e presenza Network della tua azienda, puoi richiedere il profilo separatamente.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Link
                href={
                  claimContext.claim_recommended
                    ? appRoutes.network.claim(claimContext.network_company_id)
                    : appRoutes.network.company(claimContext.network_company_id)
                }
                className="inline-flex min-h-10 items-center rounded-xl border border-[#a9c9bd] bg-white px-4 text-xs font-bold text-[#173f35]"
              >
                {claimContext.claim_recommended
                  ? "Richiedi il profilo aziendale"
                  : "Apri profilo Network"}
              </Link>
              <span className="text-[10px] font-semibold text-[#718078]">
                Facoltativo · non influisce sulla risposta RFQ
              </span>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
                Privacy commerciale
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
                Questo link identifica unicamente il destinatario. Non puoi vedere gli altri fornitori invitati
                né il target economico interno del buyer. La tua risposta e gli eventuali allegati restano
                privati tra il tuo destinatario RFQ e il buyer.
              </p>
            </div>
            <span className="rounded-full bg-[#edf5f2] px-3 py-1 text-[10px] font-bold text-[#173f35]">
              Target buyer non condiviso
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
