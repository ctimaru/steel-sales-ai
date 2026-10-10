import Link from "next/link";

import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { appRoutes } from "@/lib/routes";
import type {
  SupplierDirectoryData,
  SupplierDirectoryItem,
} from "@/lib/rfqh11-supplier";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  preferred?: string;
  tag?: string;
}>;

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value: unknown, digits = 1) {
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

function SupplierCard({ supplier }: { supplier: SupplierDirectoryItem }) {
  const latest = supplier.latest_price;

  return (
    <article className="rounded-2xl border border-[#dce2df] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {supplier.preferred ? (
              <span className="rounded-full bg-[#173f35] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
                Preferito
              </span>
            ) : null}
            {supplier.saved_in_network ? (
              <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#1a5144]">
                Salvato nel Network
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            {supplier.display_name || supplier.email || "Supplier"}
          </h2>
          {supplier.email ? (
            <p className="mt-1 text-xs text-[#66736e]">{supplier.email}</p>
          ) : null}
          {supplier.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {supplier.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#f2f4f3] px-2 py-1 text-[10px] font-semibold text-[#52615b]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <Link
          href={appRoutes.rfqHub.supplier(supplier.id)}
          className="inline-flex min-h-10 items-center rounded-xl border border-[#b8d2c8] bg-white px-4 text-xs font-bold text-[#173f35] hover:bg-[#edf5f2]"
        >
          Apri CRM →
        </Link>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-[#f7f9f8] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">
            RFQ
          </p>
          <p className="mt-1 text-xl font-semibold text-[#1d2824]">
            {supplier.rfq_count}
          </p>
        </div>
        <div className="rounded-xl bg-[#f7f9f8] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">
            Response rate
          </p>
          <p className="mt-1 text-xl font-semibold text-[#173f35]">
            {formatNumber(supplier.response_rate_pct, 1)}%
          </p>
        </div>
        <div className="rounded-xl bg-[#f7f9f8] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">
            Tempo risposta
          </p>
          <p className="mt-1 text-xl font-semibold text-[#1d2824]">
            {formatResponseHours(supplier.avg_response_hours)}
          </p>
        </div>
        <div className="rounded-xl bg-[#f7f9f8] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#718078]">
            Award / PO
          </p>
          <p className="mt-1 text-xl font-semibold text-[#1d2824]">
            {supplier.award_count} / {supplier.po_count}
          </p>
        </div>
      </div>

      {latest ? (
        <div className="mt-4 rounded-2xl border border-[#d9e8e2] bg-[#f3f8f6] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#527268]">
                Ultimo prezzo
              </p>
              <p className="mt-1 text-sm font-semibold text-[#1d2824]">
                {latest.description}
              </p>
              <p className="mt-1 text-[10px] text-[#718078]">
                {[latest.standard_code, latest.grade_code, latest.finish_code]
                  .filter(Boolean)
                  .join(" · ") || "Specifiche non disponibili"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-semibold text-[#173f35]">
                € {formatNumber(latest.eur_t, 2)}/t
              </p>
              <p className="mt-0.5 text-xs font-semibold text-[#52615b]">
                € {formatNumber(latest.eur_m, 4)}/m
              </p>
              <p className="mt-1 text-[10px] text-[#87908c]">
                {formatDate(latest.at)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-[#f7f9f8] px-4 py-3 text-xs text-[#718078]">
          Nessun prezzo strutturato ricevuto ancora.
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#edf0ee] pt-3 text-[10px] text-[#718078]">
        <span>Ultimo utilizzo {formatDate(supplier.last_used_at)}</span>
        <span>
          Award € {formatNumber(supplier.awarded_total_eur, 2)} · Lead medio{" "}
          {supplier.avg_lead_time_days === null
            ? "—"
            : formatNumber(supplier.avg_lead_time_days, 1) + " gg"}
        </span>
      </div>
    </article>
  );
}

export default async function SupplierDirectoryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const preferredOnly = params.preferred === "1";
  const tag = params.tag?.trim() || "";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rfqh11_supplier_directory", {
    p_query: query || null,
    p_preferred_only: preferredOnly,
    p_tag: tag || null,
    p_limit: 200,
    p_offset: 0,
  });

  const directory =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as SupplierDirectoryData)
      : null;

  const items = directory?.items ?? [];
  const summary = directory?.summary ?? {};

  return (
    <FocusPage>
      <FocusHeader
        eyebrow="Acquisti · Fornitori"
        title="La tua rubrica fornitori"
        description={
          <>
            Ogni fornitore usato nelle RFQ entra in una rubrica unica. Preferiti, tag e note sono gestiti dal buyer; prezzi, tempi di risposta, assegnazioni e PO arrivano direttamente dallo storico RFQ.
            <span className="mt-2 block text-xs font-semibold text-[#78857f]">
              {num(summary.supplier_count)} supplier · {num(summary.with_quotes_count)} con quote ·{" "}
              {num(summary.with_awards_count)} con award
            </span>
          </>
        }
        actions={
          <>
            <Link
              href={appRoutes.rfqHub.inbox}
              className="app-secondary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            >
              Inbox acquisti
            </Link>
            <Link
              href={appRoutes.rfqHub.home}
              className="app-primary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
            >
              RFQ Hub
            </Link>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Supplier", summary.supplier_count ?? 0],
          ["Preferiti", summary.preferred_count ?? 0],
          ["Con quote", summary.with_quotes_count ?? 0],
          ["Con award", summary.with_awards_count ?? 0],
          ["PO confermati", summary.with_confirmed_po_count ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-[#dce2df] bg-white p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#718078]">
              {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-[#1d2824]">{num(value)}</p>
          </div>
        ))}
      </section>

      <form
        method="get"
        className="grid gap-3 rounded-2xl border border-[#dce2df] bg-white p-4 md:grid-cols-[1.6fr_0.8fr_auto_auto] md:items-end"
      >
        <label className="text-xs font-semibold text-[#52615b]">
          Cerca supplier
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Nome, email o tag"
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none focus:border-[#438d7a]"
          />
        </label>

        <label className="text-xs font-semibold text-[#52615b]">
          Tag / gruppo
          <input
            name="tag"
            defaultValue={tag}
            placeholder="es. strategico"
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none focus:border-[#438d7a]"
          />
        </label>

        <label className="flex h-11 items-center gap-2 rounded-xl border border-[#d7dfdb] px-3 text-xs font-semibold text-[#52615b]">
          <input
            type="checkbox"
            name="preferred"
            value="1"
            defaultChecked={preferredOnly}
          />
          Solo preferiti
        </label>

        <button className="h-11 rounded-xl bg-[#173f35] px-5 text-sm font-bold text-white">
          Filtra
        </button>
      </form>

      {error ? (
        <section className="rounded-2xl border border-[#ead0cb] bg-[#fff7f5] p-5 text-sm font-semibold text-[#8a3e35]">
          La rubrica supplier non è temporaneamente disponibile.
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-3xl border border-[#cfe1da] bg-[#f3f8f6] p-7 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#527268]">
            Rubrica supplier
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#173f35]">
            Nessun supplier in questa vista
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#66736e]">
            I supplier entrano automaticamente qui quando vengono aggiunti a una RFQ. Nessuna
            anagrafica parallela da mantenere.
          </p>
          <Link
            href={appRoutes.rfqHub.home}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white"
          >
            Apri RFQ Hub
          </Link>
        </section>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {items.map((supplier) => (
            <SupplierCard key={supplier.id} supplier={supplier} />
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-[#dce2df] bg-white px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#718078]">
          Identity resolution
        </p>
        <p className="mt-1 text-xs leading-5 text-[#66736e]">
          Organization → Network company → company privata → email normalizzata. La rubrica non
          copia il Network e non sostituisce i contatti privati: conserva i collegamenti e usa lo
          storico procurement come fonte delle metriche.
        </p>
      </section>
    </FocusPage>
  );
}
