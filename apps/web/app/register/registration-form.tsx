"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

import { saveAndSubmitCompanyRegistration } from "./actions";

type InitialApplication = {
  legal_name?: string | null;
  trading_name?: string | null;
  country_code?: string | null;
  vat_id?: string | null;
  registration_id?: string | null;
  website_url?: string | null;
  primary_company_type?: string | null;
  secondary_company_types?: string[] | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  short_description?: string | null;
};

const COMPANY_TYPES = [
  { value: "producer", label: "Produttore" },
  { value: "trader_distributor", label: "Commerciante / distributore" },
  { value: "processor_service_provider", label: "Terzista / service provider" },
  { value: "end_user", label: "Utilizzatore" },
];

export function CompanyRegistrationForm({
  initial,
}: {
  initial?: InitialApplication | null;
}) {
  const [step, setStep] = useState(1);
  const [primaryType, setPrimaryType] = useState(initial?.primary_company_type ?? "");

  const stepTitle = useMemo(
    () =>
      ({
        1: "Azienda",
        2: "Tipo di attività",
        3: "Contatti",
        4: "Conferma",
      })[step],
    [step],
  );

  return (
    <form action={saveAndSubmitCompanyRegistration} className="mt-8">
      <div className="mb-8">
        <div className="flex items-center justify-between gap-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="flex flex-1 items-center gap-2">
              <div
                className={[
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  item <= step ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-400",
                ].join(" ")}
              >
                {item}
              </div>
              {item < 4 ? (
                <div className={item < step ? "h-px flex-1 bg-slate-900" : "h-px flex-1 bg-slate-200"} />
              ) : null}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-900">{stepTitle}</p>
      </div>

      <div className={step === 1 ? "space-y-5" : "hidden"}>
        <label className="block text-sm font-medium text-slate-700">
          Ragione sociale *
          <Input name="legal_name" defaultValue={initial?.legal_name ?? ""} className="mt-2 h-11" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Nome commerciale
          <Input name="trading_name" defaultValue={initial?.trading_name ?? ""} className="mt-2 h-11" />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Paese *
            <Input
              name="country_code"
              defaultValue={initial?.country_code ?? "IT"}
              className="mt-2 h-11 uppercase"
              maxLength={2}
              pattern="[A-Za-z]{2}"
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Partita IVA
            <Input name="vat_id" defaultValue={initial?.vat_id ?? ""} className="mt-2 h-11" />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Numero registro impresa
          <Input name="registration_id" defaultValue={initial?.registration_id ?? ""} className="mt-2 h-11" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Sito web
          <Input
            name="website_url"
            defaultValue={initial?.website_url ?? ""}
            className="mt-2 h-11"
            type="url"
            placeholder="https://"
          />
        </label>
      </div>

      <div className={step === 2 ? "space-y-6" : "hidden"}>
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Attività principale *</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {COMPANY_TYPES.map((type) => (
              <label
                key={type.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm text-slate-700 transition hover:border-slate-400"
              >
                <input
                  type="radio"
                  name="primary_company_type"
                  value={type.value}
                  defaultChecked={initial?.primary_company_type === type.value}
                  onChange={() => setPrimaryType(type.value)}
                  required
                />
                <span className="font-medium">{type.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Attività secondarie</legend>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Se la tua azienda opera in più ruoli, seleziona quelli aggiuntivi.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {COMPANY_TYPES.map((type) => (
              <label
                key={type.value}
                className={[
                  "flex items-center gap-3 rounded-xl border p-4 text-sm",
                  primaryType === type.value ? "border-slate-100 bg-slate-50 text-slate-300" : "border-slate-200 text-slate-700",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  name="secondary_company_types"
                  value={type.value}
                  disabled={primaryType === type.value}
                  defaultChecked={initial?.secondary_company_types?.includes(type.value)}
                />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className={step === 3 ? "space-y-5" : "hidden"}>
        <label className="block text-sm font-medium text-slate-700">
          Referente *
          <Input name="contact_name" defaultValue={initial?.contact_name ?? ""} className="mt-2 h-11" required />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Telefono
          <Input name="contact_phone" defaultValue={initial?.contact_phone ?? ""} className="mt-2 h-11" type="tel" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Descrizione breve
          <textarea
            name="short_description"
            defaultValue={initial?.short_description ?? ""}
            maxLength={2000}
            rows={5}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
            placeholder="Descrivi in poche righe l'attività della tua azienda."
          />
        </label>
      </div>

      <div className={step === 4 ? "space-y-5" : "hidden"}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-950">Prima di inviare</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            La richiesta verrà inviata al Platform Superadmin. L’approvazione abilita successivamente il workspace aziendale; non equivale a una verifica commerciale o a una raccomandazione dell’azienda.
          </p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm leading-6 text-blue-900">
          I dati di questa registrazione appartengono al profilo aziendale. Email, offerte, prezzi e documenti commerciali privati restano separati e tenant-only.
        </div>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-800"
          >
            Indietro
          </button>
        ) : <span />}

        {step < 4 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.min(4, current + 1))}
            className="h-11 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white"
          >
            Continua
          </button>
        ) : (
          <button
            type="submit"
            className="h-11 rounded-xl bg-slate-950 px-6 text-sm font-semibold text-white"
          >
            Invia richiesta
          </button>
        )}
      </div>
    </form>
  );
}
