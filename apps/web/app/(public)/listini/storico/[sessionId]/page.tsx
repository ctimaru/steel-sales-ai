import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SavedPricingSessionActions } from "@/components/saved-pricing-session-actions";
import { getPricingSessionSnapshot } from "@/lib/price-list-explorer-server";

export const metadata: Metadata = {
  title: "Distinta salvata · Listini",
  robots: { index: false, follow: false },
};

type Params = Promise<{ sessionId: string }>;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatNumber(value: number | null, digits: number) {
  if (value === null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("it-IT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function quantityLabel(
  mode: "meters" | "bars" | "tonnes",
  quantity: number,
  barLengthM: number | null,
) {
  if (mode === "meters") return formatNumber(quantity, 2) + " m";
  if (mode === "tonnes") return formatNumber(quantity, 3) + " t";
  return (
    formatNumber(quantity, 0) +
    " barre × " +
    formatNumber(barLengthM, 2) +
    " m"
  );
}

export default async function SavedPricingSessionPage({
  params,
}: {
  params: Params;
}) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) notFound();

  const result = await getPricingSessionSnapshot(sessionId);

  if (!result.authenticated) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#dce2df] bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Distinta privata
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#1d2824]">
            Accedi per aprire questo snapshot
          </h1>
          <Link
            href={"/login?next=" + encodeURIComponent("/listini/storico/" + sessionId)}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-[#173f35] px-4 text-sm font-semibold text-white"
          >
            Accedi
          </Link>
        </div>
      </div>
    );
  }

  if (!result.session) notFound();
  const session = result.session;

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <nav className="text-xs font-semibold text-[#66736e]" aria-label="Breadcrumb">
        <Link href="/listini/storico" className="hover:text-[#173f35]">
          I miei calcoli
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#1d2824]">{session.title}</span>
      </nav>

      <header className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Snapshot immutabile · {formatDateTime(session.created_at)}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#1d2824]">
              {session.title}
            </h1>
            <p className="mt-2 text-sm font-medium text-[#52615b]">
              {session.list_name_snapshot} · {session.manufacturer_version_snapshot}
            </p>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Questa distinta conserva i valori utilizzati al momento del salvataggio. Eventuali modifiche
              successive a listino, pesi o profili sconto non modificano questo snapshot.
            </p>
          </div>

          <SavedPricingSessionActions session={session} />
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-[#f6f8f7] text-[11px] font-bold uppercase tracking-[0.08em] text-[#66736e]">
              <tr>
                <th className="px-4 py-3">Articolo</th>
                <th className="px-3 py-3">Quantità</th>
                <th className="px-3 py-3 text-right">Metri</th>
                <th className="px-3 py-3 text-right">Tonnellate</th>
                <th className="px-3 py-3 text-right">€/m</th>
                <th className="px-3 py-3 text-right">€/t</th>
                <th className="px-4 py-3 text-right">Totale €</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0ee]">
              {session.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#1d2824]">
                      {line.dimension_label_snapshot}
                    </p>
                    <p className="mt-1 text-[11px] text-[#7a8781]">
                      {[line.grade_code_snapshot, line.finish_code_snapshot]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[#43524c]">
                    {quantityLabel(
                      line.quantity_mode,
                      Number(line.quantity),
                      line.bar_length_m === null ? null : Number(line.bar_length_m),
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-[#43524c]">
                    {formatNumber(line.line_meters, 2)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-[#43524c]">
                    {formatNumber(line.line_tonnes, 3)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-[#173f35]">
                    {formatNumber(line.net_eur_m, 4)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums text-[#173f35]">
                    {formatNumber(line.net_eur_t, 2)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-[#173f35]">
                    {formatNumber(line.line_total, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[#dfe8e4] bg-white p-4">
          <p className="text-xs text-[#718078]">Metri totali</p>
          <p className="mt-1 text-xl font-bold text-[#1d2824]">
            {formatNumber(session.total_meters, 2)}
          </p>
        </div>
        <div className="rounded-xl border border-[#dfe8e4] bg-white p-4">
          <p className="text-xs text-[#718078]">Tonnellate totali</p>
          <p className="mt-1 text-xl font-bold text-[#1d2824]">
            {formatNumber(session.total_tonnes, 3)}
          </p>
        </div>
        <div className="rounded-xl border border-[#cfe0d9] bg-[#edf5f2] p-4">
          <p className="text-xs text-[#527268]">Valore totale €</p>
          <p className="mt-1 text-xl font-bold text-[#173f35]">
            {formatNumber(session.total_value, 2)}
          </p>
        </div>
        <div className="rounded-xl border border-[#cfe0d9] bg-[#edf5f2] p-4">
          <p className="text-xs text-[#527268]">€/t medio ponderato</p>
          <p className="mt-1 text-xl font-bold text-[#173f35]">
            {formatNumber(session.weighted_average_eur_t, 2)}
          </p>
        </div>
      </section>

      <details className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8]">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[#43524c]">
          Dati di riproducibilità
        </summary>
        <div className="grid gap-3 border-t border-[#e2e7e4] px-5 py-4 text-xs text-[#66736e] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-semibold text-[#43524c]">Modalità prezzo</p>
            <p className="mt-1">{session.pricing_mode}</p>
          </div>
          <div>
            <p className="font-semibold text-[#43524c]">Formula</p>
            <p className="mt-1 break-all">{session.pricing_formula}</p>
          </div>
          <div>
            <p className="font-semibold text-[#43524c]">Versione listino</p>
            <p className="mt-1">{session.manufacturer_version_snapshot}</p>
          </div>
          <div>
            <p className="font-semibold text-[#43524c]">Righe</p>
            <p className="mt-1">{session.line_count}</p>
          </div>
        </div>
      </details>
    </div>
  );
}
