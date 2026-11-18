import Link from "next/link";

import { Rfqh11SupplierProfileEditor } from "@/components/rfqh11-supplier-profile-editor";
import { SupplierContactForm } from "@/components/supplier-contact-form";
import { canWriteWorkspace } from "@/lib/access-policy";
import { formatHubDate, rfqOrderStatusLabel } from "@/lib/rfq-hub-overview";
import type { SupplierDetailData } from "@/lib/rfqh11-supplier";
import {
  supplierRequestHref,
  supplierRequestStatusLabel,
  type SupplierBookContact,
} from "@/lib/rfqhub-suppliers";
import { appRoutes } from "@/lib/routes";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fornitore · Fornitori RFQ", robots: privateNoIndexRobots };

const PRICES_SHOWN = 8;

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function euro(value: unknown, digits = 0): string {
  return num(value).toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function responseTime(value: unknown): string | null {
  const hours = num(value);
  if (!hours) return null;
  if (hours < 24) return Math.round(hours) + " ore";
  const days = Math.round(hours / 24);
  return days + (days === 1 ? " giorno" : " giorni");
}

/**
 * RFQHUB1D (founder decision, 18 Nov 2026): the supplier card in the same
 * style as Centro RFQ and Fornitori. Contacts first, then the requests that
 * were sent (plain Italian states), the prices received and private notes.
 * Read model: rfqh11_supplier_detail (owner-scoped); contacts from the
 * organization's Commerciale. Nothing is sent from here.
 */
export default async function SupplierDetailPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const context = await getWorkspaceContext();
  const canWrite = canWriteWorkspace(context.role);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rfqh11_supplier_detail", { p_profile_id: profileId });
  const detail = data && typeof data === "object" && !Array.isArray(data) ? (data as SupplierDetailData) : null;
  const profile = detail?.profile;

  if (error || !profile) {
    return (
      <div className="mx-auto w-full max-w-[880px] space-y-3 pb-8">
        <Link href={appRoutes.rfqHub.suppliers} className="text-xs font-semibold text-[#2f5a45] hover:underline">← Fornitori</Link>
        <section className="rounded-xl border border-[#ead0cb] bg-[#fff7f5] p-5">
          <h1 className="text-lg font-bold text-[#5a2a24]">Fornitore non disponibile</h1>
          <p className="mt-1 text-sm text-[#66736e]">La scheda non esiste oppure non è nella tua rubrica.</p>
        </section>
      </div>
    );
  }

  const name = profile.display_name || profile.email || "Fornitore";
  const summary = detail?.summary ?? {};
  const history = detail?.rfq_history ?? [];
  const sent = history.filter((item) => item.sent_at);
  const drafts = history.length - sent.length;
  const prices = (detail?.price_history ?? []).slice(0, PRICES_SHOWN);

  // Contacts: the organization's Commerciale company for this supplier.
  const companyFilter = [
    profile.supplier_company_id ? "id.eq." + profile.supplier_company_id : null,
    profile.supplier_network_company_id ? "network_company_id.eq." + profile.supplier_network_company_id : null,
  ].filter(Boolean).join(",");
  let companyId: string | null = profile.supplier_company_id;
  let contacts: SupplierBookContact[] = [];
  if (companyFilter) {
    const { data: companies } = await supabase.from("companies")
      .select("id")
      .eq("organization_id", context.organizationId)
      .or(companyFilter)
      .limit(5);
    const ids = (companies ?? []).map((row) => row.id as string);
    companyId = companyId ?? ids[0] ?? null;
    if (ids.length) {
      const { data: contactRows } = await supabase.from("contacts")
        .select("id,company_id,full_name,email,phone,role")
        .eq("organization_id", context.organizationId)
        .in("company_id", ids)
        .order("full_name", { ascending: true })
        .limit(100);
      contacts = (contactRows ?? []) as SupplierBookContact[];
    }
  }

  const facts = [
    sent.length ? sent.length + (sent.length === 1 ? " richiesta inviata" : " richieste inviate") : "Nessuna richiesta inviata",
    sent.length ? "ha risposto a " + num(summary.responded_rfq_count) : null,
    responseTime(summary.avg_response_hours) ? "risponde in media in " + responseTime(summary.avg_response_hours) : null,
    num(summary.award_count) ? num(summary.award_count) + (num(summary.award_count) === 1 ? " aggiudicazione" : " aggiudicazioni") : null,
    num(summary.po_count) ? num(summary.po_count) + (num(summary.po_count) === 1 ? " ordine" : " ordini") : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto w-full min-w-0 max-w-[880px] space-y-3 pb-8" data-testid="supplier-card">
      <Link href={appRoutes.rfqHub.suppliers} className="text-xs font-semibold text-[#2f5a45] hover:underline">← Fornitori</Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--brand-primary)]">Fornitore</p>
          <h1 className="mt-0.5 flex flex-wrap items-center gap-2 text-xl font-extrabold text-[var(--brand-deep)]">
            <span className="min-w-0 break-words">{name}</span>
            {profile.preferred ? <span className="rounded-full bg-[#fff6dc] px-2 py-0.5 text-[11px] font-bold text-[#7a4d0e]">★ Preferito</span> : null}
          </h1>
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]" data-testid="supplier-card-facts">{facts}</p>
          {drafts > 0 ? (
            <p className="text-[11px] text-[var(--text-secondary)]">Anche in {drafts} {drafts === 1 ? "bozza" : "bozze"} non ancora {drafts === 1 ? "inviata" : "inviate"}.</p>
          ) : null}
        </div>
        <span className="flex flex-wrap items-center gap-1.5">
          {canWrite && profile.supplier_network_company_id ? (
            <Link href={supplierRequestHref(profile.supplier_network_company_id)}
              className="inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-3 text-xs font-bold text-white hover:bg-[#104632]">
              Chiedi un&apos;offerta
            </Link>
          ) : null}
          {profile.supplier_network_company_id ? (
            <Link href={appRoutes.network.company(profile.supplier_network_company_id)}
              className="app-secondary inline-flex min-h-10 items-center rounded-lg px-3 text-xs font-bold">
              Profilo nel Network
            </Link>
          ) : null}
        </span>
      </header>

      <section aria-labelledby="supplier-contacts" className="rounded-xl border border-[var(--border)] bg-white p-3 sm:p-4" data-testid="supplier-card-contacts">
        <h2 id="supplier-contacts" className="text-sm font-bold text-[var(--brand-deep)]">Contatti</h2>
        {contacts.length ? (
          <ul className="mt-1.5 space-y-1">
            {contacts.map((contact) => (
              <li key={contact.id} className="min-w-0 break-words text-xs text-[var(--brand-deep)]">
                <span className="font-semibold">{contact.full_name}</span>
                {contact.role ? <span className="text-[var(--text-secondary)]"> · {contact.role}</span> : null}
                {contact.email ? <> · <a href={"mailto:" + contact.email} className="text-[#175e43] hover:underline">{contact.email}</a></> : null}
                {contact.phone ? <span className="text-[var(--text-secondary)]"> · {contact.phone}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {profile.email ? "Nessun contatto salvato. Email usata nelle richieste: " + profile.email : "Nessun contatto salvato."}
          </p>
        )}
        {canWrite && (companyId || profile.supplier_network_company_id) ? (
          <div className="mt-2">
            <SupplierContactForm supplierName={name}
              networkCompanyId={companyId ? null : profile.supplier_network_company_id}
              companyId={companyId} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="supplier-requests" className="rounded-xl border border-[var(--border)] bg-white p-3 sm:p-4" data-testid="supplier-card-requests">
        <h2 id="supplier-requests" className="text-sm font-bold text-[var(--brand-deep)]">Richieste</h2>
        {history.length ? (
          <ul className="mt-1 divide-y divide-[var(--border)]">
            {history.map((item) => (
              <li key={item.rfq_id} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                <Link href={appRoutes.rfqHub.campaign(item.rfq_id)} className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-[var(--brand-deep)] hover:underline">{item.rfq_title || "Richiesta"}</span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    {item.sent_at ? "inviata il " + formatHubDate(item.sent_at) : "creata il " + formatHubDate(item.rfq_created_at)}
                    {item.quote ? " · offerta" + (item.quote.revision_no > 1 ? " rev. " + item.quote.revision_no : "")
                      + (item.quote.lead_time_days ? " · consegna in " + item.quote.lead_time_days + " gg" : "") : ""}
                    {item.purchase_order ? " · ordine " + item.purchase_order.ref + " (" + rfqOrderStatusLabel(item.purchase_order.status).toLowerCase() + ")"
                      + " · € " + euro(item.purchase_order.total_eur) : ""}
                  </span>
                </Link>
                <span className="rounded-full bg-[#eef2f0] px-2 py-0.5 text-[11px] font-semibold text-[#3f544a]">{supplierRequestStatusLabel(item.supplier_status)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Nessuna richiesta finora.</p>
        )}
      </section>

      <section aria-labelledby="supplier-prices" className="rounded-xl border border-[var(--border)] bg-white p-3 sm:p-4" data-testid="supplier-card-prices">
        <h2 id="supplier-prices" className="text-sm font-bold text-[var(--brand-deep)]">Prezzi ricevuti</h2>
        {prices.length ? (
          <ul className="mt-1 divide-y divide-[var(--border)]">
            {prices.map((price) => (
              <li key={price.quote_id + ":" + price.line_position} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-[var(--brand-deep)]">{price.description}</span>
                  <span className="text-[var(--text-secondary)]">
                    {[price.standard_code, price.grade_code].filter(Boolean).length ? " · " + [price.standard_code, price.grade_code].filter(Boolean).join(" ") : ""}
                    {" · " + formatHubDate(price.submitted_at)}
                  </span>
                </span>
                <span className="font-bold text-[#175640]">{price.eur_t !== null ? "€ " + euro(price.eur_t) + "/t" : "—"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Nessun prezzo ricevuto finora.</p>
        )}
      </section>

      {canWrite ? (
        <Rfqh11SupplierProfileEditor profileId={profile.id} preferred={profile.preferred} tags={profile.tags} notes={profile.notes} />
      ) : null}

      <p className="px-1 text-[11px] text-[var(--text-secondary)]">
        Collegata al profilo nel Network. La rubrica conserva il link, non duplica il profilo Network.
      </p>
    </div>
  );
}
