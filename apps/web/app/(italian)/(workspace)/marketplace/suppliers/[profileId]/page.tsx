import Link from "next/link";

import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { Rfqh11SupplierProfileEditor } from "@/components/rfqh11-supplier-profile-editor";
import { appRoutes } from "@/lib/routes";
import type { SupplierDetailData } from "@/lib/rfqh11-supplier";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = Promise<{ profileId: string }>;

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown, digits = 2) {
  return num(value).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "medium",
  }).format(date);
}

function formatResponseHours(value: unknown) {
  const hours = num(value);
  if (!hours) return "—";
  if (hours < 24) return formatNumber(hours, 1) + " h";
  return formatNumber(hours / 24, 1) + " gg";
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default async function SupplierDetailPage({
  params,
}: {
  params: Params;
}) {
  const { profileId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rfqh11_supplier_detail", {
    p_profile_id: profileId,
  });

  const detail =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as SupplierDetailData)
      : null;

  const profile = detail?.profile;
  const summary = detail?.summary ?? {};
  const rfqHistory = detail?.rfq_history ?? [];
  const priceHistory = detail?.price_history ?? [];

  if (error || !profile) {
    return (
      <FocusPage>
        <section className="rounded-3xl border border-[#ead0cb] bg-[#fff7f5] p-7">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8a3e35]">
            Fornitore
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Supplier non disponibile
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Il profilo non esiste oppure non appartiene alla tua rubrica procurement.
          </p>
          <Link
            href={appRoutes.rfqHub.suppliers}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white"
          >
            Torna alla rubrica
          </Link>
        </section>
      </FocusPage>
    );
  }

  return (
    <FocusPage>
      <FocusHeader
        eyebrow="Fornitori"
        title={profile.display_name || profile.email || "Supplier"}
        description={
          <>
            Profilo acquisti consolidato: storico RFQ, prezzi ricevuti, tempi di risposta, assegnazioni e Purchase Order restano collegati allo stesso fornitore.
            <span className="mt-2 block text-xs font-semibold text-[#78857f]">
              Ultimo utilizzo {formatDate(profile.last_used_at)}
              {profile.email ? " · " + profile.email : ""}
            </span>
          </>
        }
        actions={
          <>
            {profile.supplier_network_company_id ? (
              <Link
                href={appRoutes.network.company(profile.supplier_network_company_id)}
                className="app-secondary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
              >
                Apri Network
              </Link>
            ) : null}
            <Link
              href={appRoutes.rfqHub.home}
              className="app-secondary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            >
              RFQ Hub
            </Link>
            <Link
              href={appRoutes.rfqHub.suppliers}
              className="app-primary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            >
              Rubrica supplier
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          ["RFQ", summary.rfq_count ?? 0],
          ["Response rate", formatNumber(summary.response_rate_pct, 1) + "%"],
          ["Tempo risposta", formatResponseHours(summary.avg_response_hours)],
          ["Award", summary.award_count ?? 0],
          ["PO", summary.po_count ?? 0],
          ["PO confermati", summary.confirmed_po_count ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">
              {label}
            </p>
            <p className="mt-1 text-xl font-semibold text-[#1d2824]">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Rfqh11SupplierProfileEditor
          profileId={profile.id}
          preferred={profile.preferred}
          tags={profile.tags}
          notes={profile.notes}
        />

        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Identità collegata
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
            Company e contatti
          </h2>

          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#87908c]">
                Identity key
              </dt>
              <dd className="mt-1 break-all font-semibold text-[#52615b]">
                {profile.identity_key}
              </dd>
            </div>

            {detail?.private_company ? (
              <div className="rounded-xl bg-[#f7f9f8] p-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#87908c]">
                  Company privata
                </dt>
                <dd className="mt-1 font-semibold text-[#1d2824]">
                  {detail.private_company.name}
                </dd>
                <dd className="mt-1 text-xs text-[#66736e]">
                  {[detail.private_company.country, detail.private_company.vat_number]
                    .filter(Boolean)
                    .join(" · ") || "Dati anagrafici disponibili nella memoria privata"}
                </dd>
              </div>
            ) : null}

            {detail?.private_contact ? (
              <div className="rounded-xl bg-[#f7f9f8] p-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#87908c]">
                  Contatto privato
                </dt>
                <dd className="mt-1 font-semibold text-[#1d2824]">
                  {detail.private_contact.full_name}
                </dd>
                <dd className="mt-1 text-xs text-[#66736e]">
                  {[detail.private_contact.role, detail.private_contact.email]
                    .filter(Boolean)
                    .join(" · ") || "Contatto collegato"}
                </dd>
              </div>
            ) : null}

            {profile.supplier_network_company_id ? (
              <div className="rounded-xl border border-[#cfe1da] bg-[#f3f8f6] p-3">
                <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#527268]">
                  Network
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[#173f35]">
                  Profilo Network collegato
                </dd>
                <dd className="mt-1 text-xs text-[#66736e]">
                  La rubrica conserva il link, non duplica il profilo Network.
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#e7ece9] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
              Procurement history
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
              RFQ, quote, award e PO
            </h2>
          </div>
          <span className="text-xs text-[#718078]">
            Award € {formatNumber(summary.awarded_total_eur, 2)} ·{" "}
            {formatNumber(summary.awarded_total_tonnes, 3)} t
          </span>
        </div>

        {rfqHistory.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#66736e]">
            Nessuno storico RFQ disponibile.
          </p>
        ) : (
          <div className="divide-y divide-[#edf0ee]">
            {rfqHistory.map((item) => (
              <article key={item.rfq_id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={appRoutes.rfqHub.campaign(item.rfq_id)}
                      className="text-sm font-semibold text-[#173f35] hover:underline"
                    >
                      {item.rfq_title}
                    </Link>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#87908c]">
                      {statusLabel(item.rfq_status)} · supplier {statusLabel(item.supplier_status)}
                    </p>
                  </div>
                  <p className="text-xs text-[#718078]">
                    {formatDate(item.rfq_created_at)}
                  </p>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-[10px] uppercase text-[#87908c]">Risposta</p>
                    <p className="mt-1 text-xs font-semibold">
                      {item.responded_at ? formatDate(item.responded_at) : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-[10px] uppercase text-[#87908c]">Quote</p>
                    <p className="mt-1 text-xs font-semibold">
                      {item.quote
                        ? "Rev. " + item.quote.revision_no + " · " + statusLabel(item.quote.status)
                        : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-[10px] uppercase text-[#87908c]">Award</p>
                    <p className="mt-1 text-xs font-semibold">
                      {item.awarded_at ? "Aggiudicato" : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#f7f9f8] p-3">
                    <p className="text-[10px] uppercase text-[#87908c]">Purchase Order</p>
                    <p className="mt-1 text-xs font-semibold">
                      {item.purchase_order
                        ? item.purchase_order.ref + " · " + statusLabel(item.purchase_order.status)
                        : "—"}
                    </p>
                    {item.purchase_order ? (
                      <p className="mt-1 text-[10px] text-[#718078]">
                        € {formatNumber(item.purchase_order.total_eur, 2)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white">
        <div className="border-b border-[#e7ece9] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
            Price history
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
            Storico prezzi ricevuti
          </h2>
        </div>

        {priceHistory.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#66736e]">
            Nessuna riga prezzo strutturata disponibile.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#dce2df] text-[#66736e]">
                  <th className="px-5 py-3">Data</th>
                  <th className="px-3 py-3">RFQ</th>
                  <th className="px-3 py-3">Articolo</th>
                  <th className="px-3 py-3">Norma / grado</th>
                  <th className="px-3 py-3 text-right">€/t</th>
                  <th className="px-3 py-3 text-right">€/m</th>
                  <th className="px-3 py-3 text-right">Lead gg</th>
                  <th className="px-5 py-3">Condizioni</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((row) => (
                  <tr
                    key={row.quote_id + ":" + String(row.line_position)}
                    className="border-b border-[#edf0ee]"
                  >
                    <td className="px-5 py-3">{formatDate(row.submitted_at)}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={appRoutes.rfqHub.campaign(row.rfq_id)}
                        className="font-semibold text-[#173f35] hover:underline"
                      >
                        {row.rfq_title}
                      </Link>
                      <p className="mt-0.5 text-[9px] text-[#87908c]">
                        Rev. {row.revision_no}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[#1d2824]">{row.description}</p>
                      <p className="mt-0.5 text-[9px] text-[#87908c]">
                        {row.finish_code || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {[row.standard_code, row.grade_code].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-[#173f35]">
                      € {formatNumber(row.eur_t, 2)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-[#173f35]">
                      € {formatNumber(row.eur_m, 4)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {row.lead_time_days ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {[row.incoterm, row.payment_terms].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#cddbd6] bg-[#f7faf8] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
          Rubrica fornitori
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
          Storico fornitore collegato
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#66736e]">
          Questa è la vista acquisti che unisce
          identità, utilizzo RFQ, prezzi, award e PO. I tag sono anche gruppi operativi riutilizzabili
          nella ricerca della rubrica.
        </p>
      </section>
    </FocusPage>
  );
}
