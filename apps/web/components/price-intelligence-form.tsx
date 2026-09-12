"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  lookupLatestPrice,
  type PriceLookupState,
  type PriceObservation,
} from "@/app/(workspace)/price-intelligence/actions";

const initialState: PriceLookupState = {
  status: "idle",
  message: "",
};

function numberLabel(value: number | string | null): string {
  if (value === null || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(number)
    : String(value);
}

function priceLabel(observation: PriceObservation): string {
  const amount = Number(observation.price_value);
  const currency = observation.currency ?? "EUR";
  const formatted = Number.isFinite(amount)
    ? new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    : String(observation.price_value);

  const unit = observation.price_unit === "M"
    ? "/m"
    : observation.price_unit === "T"
      ? "/t"
      : observation.price_unit
        ? `/${observation.price_unit}`
        : "";

  return `${formatted}${unit}`;
}

function commercialDate(value: string | null, includeTime = true): string {
  if (!value) return "Data non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

function sizeLabel(observation: PriceObservation): string {
  if (observation.outer_diameter_mm !== null) {
    const thickness = observation.thickness_mm !== null
      ? ` × ${numberLabel(observation.thickness_mm)}`
      : "";
    return `Ø ${numberLabel(observation.outer_diameter_mm)}${thickness}`;
  }
  if (observation.width_mm !== null && observation.height_mm !== null) {
    const thickness = observation.thickness_mm !== null
      ? ` × ${numberLabel(observation.thickness_mm)}`
      : "";
    return `${numberLabel(observation.width_mm)} × ${numberLabel(observation.height_mm)}${thickness}`;
  }
  return observation.thickness_mm !== null
    ? `sp. ${numberLabel(observation.thickness_mm)} mm`
    : "—";
}

export function PriceIntelligenceForm() {
  const [state, formAction, pending] = useActionState(lookupLatestPrice, initialState);
  const observation = state.observation ?? null;
  const history = state.history ?? [];

  return (
    <div className="space-y-6">
      <form action={formAction} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-2 text-sm font-semibold text-slate-900">
            <span>Qualità</span>
            <input
              name="grade"
              placeholder="es. P265GH"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-slate-900">
            <span>Diametro esterno mm</span>
            <input
              name="outer_diameter_mm"
              inputMode="decimal"
              placeholder="es. 406,4"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-slate-900">
            <span>Spessore mm</span>
            <input
              name="thickness_mm"
              inputMode="decimal"
              placeholder="es. 6,3"
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-slate-900">
            <span>Larghezza mm</span>
            <input
              name="width_mm"
              inputMode="decimal"
              placeholder="quad./rett."
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500"
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-slate-900">
            <span>Altezza mm</span>
            <input
              name="height_mm"
              inputMode="decimal"
              placeholder="quad./rett."
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none transition focus:border-slate-500"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
          >
            {pending ? "Ricerca..." : "Cerca prezzi"}
          </button>
          <p className="text-xs text-slate-500">
            Risultati ordinati per data commerciale del thread, non per data di importazione.
          </p>
        </div>
      </form>

      {state.message ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            state.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {observation ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Ultima offerta</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-slate-950">
                  {priceLabel(observation)}
                </p>
                <p className="mt-1 text-sm text-slate-500">{commercialDate(observation.commercial_at)}</p>
              </div>
              <Link
                href={`/conversations/${observation.thread_id}`}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              >
                Apri trattativa
              </Link>
            </div>
          </div>

          <div className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Qualità", observation.grade ?? "—"],
              ["Norma", observation.standard ?? "—"],
              ["Dimensione", sizeLabel(observation)],
              ["Lunghezza", observation.length_mm !== null ? `${numberLabel(observation.length_mm)} mm` : "—"],
              ["Quantità", observation.quantity !== null ? `${numberLabel(observation.quantity)} ${observation.quantity_unit ?? ""}`.trim() : "—"],
              ["File sorgente", observation.source_filename ?? "—"],
              ["Confidenza", observation.confidence !== null ? `${Math.round(Number(observation.confidence) * 100)}%` : "—"],
              ["Storico prezzi", `${history.length} ${history.length === 1 ? "rilevazione" : "rilevazioni"}`],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Provenienza</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {observation.thread_subject ?? "Thread commerciale"}
            </p>
            <p className="mt-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {observation.source_text ?? "Testo sorgente non disponibile."}
            </p>
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Storico prodotto</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Storico prezzi offerti</h2>
            <p className="mt-1 text-sm text-slate-500">
              Fino a 50 offerte compatibili, dalla più recente alla più vecchia.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Prodotto</th>
                  <th className="px-5 py-3">Norma</th>
                  <th className="px-5 py-3">Prezzo</th>
                  <th className="px-5 py-3">Quantità</th>
                  <th className="px-5 py-3">Trattativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {commercialDate(row.commercial_at, false)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-950">{row.grade ?? "—"}</p>
                      <p className="mt-1 whitespace-nowrap text-xs text-slate-500">{sizeLabel(row)}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{row.standard ?? "—"}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-950">
                      {priceLabel(row)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {row.quantity !== null
                        ? `${numberLabel(row.quantity)} ${row.quantity_unit ?? ""}`.trim()
                        : "—"}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        href={`/conversations/${row.thread_id}`}
                        className="font-semibold text-indigo-600 hover:text-indigo-800"
                      >
                        {row.thread_subject ?? "Apri thread"}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
