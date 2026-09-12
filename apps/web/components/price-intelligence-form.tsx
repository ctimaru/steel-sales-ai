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

function commercialDate(value: string | null): string {
  if (!value) return "Data non disponibile";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function PriceIntelligenceForm() {
  const [state, formAction, pending] = useActionState(lookupLatestPrice, initialState);
  const observation = state.observation ?? null;

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
            {pending ? "Ricerca..." : "Trova ultimo prezzo"}
          </button>
          <p className="text-xs text-slate-500">
            La data è quella commerciale del thread, non la data di importazione nel database.
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
              ["Diametro", observation.outer_diameter_mm !== null ? `${numberLabel(observation.outer_diameter_mm)} mm` : "—"],
              ["Spessore", observation.thickness_mm !== null ? `${numberLabel(observation.thickness_mm)} mm` : "—"],
              ["Lunghezza", observation.length_mm !== null ? `${numberLabel(observation.length_mm)} mm` : "—"],
              ["Quantità", observation.quantity !== null ? `${numberLabel(observation.quantity)} ${observation.quantity_unit ?? ""}`.trim() : "—"],
              ["File sorgente", observation.source_filename ?? "—"],
              ["Confidenza", observation.confidence !== null ? `${Math.round(Number(observation.confidence) * 100)}%` : "—"],
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
    </div>
  );
}
