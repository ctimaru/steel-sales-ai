"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Input } from "@/components/ui/input";
import { trackProductEvent } from "@/lib/product-analytics";

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

type ClaimRegistrationContext = {
  claim_ref: string;
  legal_name: string;
  trading_name: string | null;
  country_code: string;
  vat_hint: string | null;
};

type ReviewSummary = {
  legalName: string;
  countryCode: string;
  website: string;
  primaryType: string;
  contactName: string;
};

const COMPANY_TYPES = [
  { value: "producer", label: "Produttore" },
  { value: "trader_distributor", label: "Commerciante / distributore" },
  { value: "processor_service_provider", label: "Terzista / service provider" },
  { value: "end_user", label: "Utilizzatore" },
] as const;

const STEPS = [
  { id: 1, label: "Azienda", description: "Identità essenziale" },
  { id: 2, label: "Attività e referente", description: "Come operate e chi seguire" },
  { id: 3, label: "Controlla e invia", description: "Ultima verifica" },
] as const;

function companyTypeLabel(value: string) {
  return COMPANY_TYPES.find((item) => item.value === value)?.label ?? value;
}

export function CompanyRegistrationForm({
  initial,
  claim,
}: {
  initial?: InitialApplication | null;
  claim?: ClaimRegistrationContext | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const mountedRef = useRef(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [primaryType, setPrimaryType] = useState(initial?.primary_company_type ?? "");
  const [clientError, setClientError] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const heading = formRef.current?.querySelector<HTMLElement>(
      `[data-registration-step="${step}"] h2`,
    );
    heading?.focus();
  }, [step]);

  function validateCurrentStep() {
    const container = formRef.current?.querySelector<HTMLElement>(
      `[data-registration-step="${step}"]`,
    );
    if (!container) return true;

    const fields = Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        "input, textarea, select",
      ),
    );

    const invalid = fields.find((field) => !field.disabled && !field.checkValidity());
    if (!invalid) {
      setClientError(null);
      return true;
    }

    invalid.reportValidity();
    invalid.focus();
    setClientError("Controlla i campi evidenziati prima di continuare.");
    return false;
  }

  function readReviewSummary() {
    if (!formRef.current) return null;
    const data = new FormData(formRef.current);

    return {
      legalName: String(data.get("legal_name") ?? "").trim(),
      countryCode: String(data.get("country_code") ?? "").trim().toUpperCase(),
      website: String(data.get("website_url") ?? "").trim(),
      primaryType: String(data.get("primary_company_type") ?? "").trim(),
      contactName: String(data.get("contact_name") ?? "").trim(),
    } satisfies ReviewSummary;
  }

  function goForward() {
    if (!validateCurrentStep()) return;

    if (step === 1) {
      setStep(2);
      setClientError(null);
      return;
    }

    if (step === 2) {
      setReview(readReviewSummary());
      setStep(3);
      setClientError(null);
    }
  }

  function goBack() {
    setClientError(null);
    setStep((current) => (current === 3 ? 2 : 1));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    const legalName = String(data.get("legal_name") ?? "").trim();
    const countryCode = String(data.get("country_code") ?? "").trim().toUpperCase();
    const companyType = String(data.get("primary_company_type") ?? "").trim();
    const contactName = String(data.get("contact_name") ?? "").trim();
    const privacyAcknowledged = data.get("privacy_acknowledged") === "on";
    const termsAccepted = data.get("terms_accepted") === "on";

    if (!legalName || !/^[A-Z]{2}$/.test(countryCode)) {
      event.preventDefault();
      setStep(1);
      setClientError("Completa ragione sociale e paese prima di inviare.");
      return;
    }

    if (!companyType || !contactName) {
      event.preventDefault();
      setStep(2);
      setClientError("Seleziona l’attività principale e indica il referente.");
      return;
    }

    if (!privacyAcknowledged || !termsAccepted) {
      event.preventDefault();
      setStep(3);
      setClientError("Conferma separatamente Informativa privacy e Termini d’uso prima di inviare.");
      return;
    }

    trackProductEvent("registration_submit", {
      flow: claim ? "claim" : "new_company",
      company_type: companyType,
      country: countryCode,
    });
  }

  return (
    <form
      ref={formRef}
      action={saveAndSubmitCompanyRegistration}
      onSubmit={handleSubmit}
      className="mt-8"
    >
      {claim ? <input type="hidden" name="claim_ref" value={claim.claim_ref} /> : null}

      {claim ? (
        <div className="mb-5 rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-4 sm:p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
            Claim selezionato
          </p>
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#173f35]">{claim.legal_name}</p>
              <p className="mt-1 text-xs text-[#52615b]">
                {claim.country_code}
                {claim.vat_hint ? " · P.IVA " + claim.vat_hint : ""}
              </p>
            </div>
            <span className="mt-2 inline-flex w-fit rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#1a5144] sm:mt-0">
              Identità preservata
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#52615b]">
            Questa registrazione resterà collegata al profilo che hai scelto nella ricerca pubblica.
            Il claim diventerà operativo solo dopo verifica e attivazione.
          </p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-4 sm:p-5">
        <div role="list" aria-label="Avanzamento registrazione" className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((item) => {
            const active = item.id === step;
            const completed = item.id < step;

            return (
              <div
                key={item.id}
                role="listitem"
                aria-current={active ? "step" : undefined}
                className={[
                  "rounded-xl border px-4 py-3",
                  active
                    ? "border-[#b8d2c8] bg-white shadow-sm"
                    : completed
                      ? "border-[#d9e8e2] bg-[#edf5f2]"
                      : "border-transparent bg-transparent",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      active || completed
                        ? "bg-[#1a5144] text-white"
                        : "bg-[#e7ece9] text-[#52615b]",
                    ].join(" ")}
                  >
                    {completed ? "✓" : item.id}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1d2824]">{item.label}</p>
                    <p className="mt-0.5 text-[11px] text-[#5d6a65]">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {clientError ? (
        <div
          role="alert"
          aria-live="polite"
          className="mt-5 rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]"
        >
          {clientError}
        </div>
      ) : null}

      <section
        data-registration-step="1"
        hidden={step !== 1}
        className="mt-7 space-y-5"
      >
        <div>
          <p className="app-kicker">Dati essenziali</p>
          <h2 tabIndex={-1} className="mt-2 text-xl font-semibold text-[#1d2824]">Identifichiamo l’azienda</h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            {claim
              ? "L’identità legale arriva dalla ricerca pubblica ed è bloccata per evitare duplicati. Completa solo i dati necessari alla verifica e all’attivazione."
              : "Bastano pochi dati per inviare la richiesta. Le informazioni tecniche e commerciali potranno essere completate dopo l’attivazione."}
          </p>
        </div>

        <label className="block text-sm font-medium text-[#43524c]">
          Ragione sociale
          <Input
            name="legal_name"
            defaultValue={initial?.legal_name ?? ""}
            className="mt-2 h-11"
            autoComplete="organization"
            readOnly={Boolean(claim)}
            required={step === 1}
          />
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#43524c]">
            Paese
            <Input
              name="country_code"
              defaultValue={initial?.country_code ?? "IT"}
              className="mt-2 h-11 uppercase"
              maxLength={2}
              pattern="[A-Za-z]{2}"
              inputMode="text"
              aria-describedby="country-help"
              readOnly={Boolean(claim)}
              required={step === 1}
            />
            <span id="country-help" className="mt-1.5 block text-xs text-[#5d6a65]">
              Codice ISO a 2 lettere, ad esempio IT.
            </span>
          </label>

          <label className="block text-sm font-medium text-[#43524c]">
            Sito web <span className="font-normal text-[#8b9792]">(facoltativo)</span>
            <Input
              name="website_url"
              defaultValue={initial?.website_url ?? ""}
              className="mt-2 h-11"
              type="url"
              inputMode="url"
              placeholder="https://azienda.it"
              autoComplete="url"
            />
          </label>
        </div>

        <details className="rounded-2xl border border-[#dce2df] bg-[#f8faf9]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#43524c]">
            Aggiungi dati societari facoltativi
          </summary>
          <div className="grid gap-5 border-t border-[#e7ece9] px-4 py-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[#43524c]">
              Nome commerciale
              <Input
                name="trading_name"
                defaultValue={initial?.trading_name ?? ""}
                className="mt-2 h-11"
                autoComplete="organization"
              />
            </label>
            <label className="block text-sm font-medium text-[#43524c]">
              Partita IVA
              <Input name="vat_id" defaultValue={initial?.vat_id ?? ""} className="mt-2 h-11" />
            </label>
            <label className="block text-sm font-medium text-[#43524c] sm:col-span-2">
              Numero registro impresa
              <Input
                name="registration_id"
                defaultValue={initial?.registration_id ?? ""}
                className="mt-2 h-11"
              />
            </label>
          </div>
        </details>
      </section>

      <section
        data-registration-step="2"
        hidden={step !== 2}
        className="mt-7 space-y-6"
      >
        <div>
          <p className="app-kicker">Profilo operativo</p>
          <h2 tabIndex={-1} className="mt-2 text-xl font-semibold text-[#1d2824]">
            Come operate nel mercato?
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Queste informazioni ci aiutano a classificare correttamente il profilo aziendale nel
            Network.
          </p>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-[#1d2824]">Attività principale</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {COMPANY_TYPES.map((type) => {
              const selected = primaryType === type.value;
              return (
                <label
                  key={type.value}
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-sm transition",
                    selected
                      ? "border-[#438d7a] bg-[#edf5f2] text-[#123d34]"
                      : "border-[#dce2df] bg-white text-[#43524c] hover:border-[#b8d2c8]",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="primary_company_type"
                    value={type.value}
                    defaultChecked={initial?.primary_company_type === type.value}
                    onChange={() => setPrimaryType(type.value)}
                    required={step === 2}
                    className="accent-[#1a5144]"
                  />
                  <span className="font-medium">{type.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <details className="rounded-2xl border border-[#dce2df] bg-[#f8faf9]">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#43524c]">
            L’azienda svolge anche altre attività?
          </summary>
          <div className="grid gap-3 border-t border-[#e7ece9] px-4 py-4 sm:grid-cols-2">
            {COMPANY_TYPES.map((type) => (
              <label
                key={type.value}
                className={[
                  "flex items-center gap-3 rounded-xl border p-3 text-sm",
                  primaryType === type.value
                    ? "border-[#e7ece9] bg-[#f2f4f3] text-[#9aa49f]"
                    : "border-[#dce2df] bg-white text-[#43524c]",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  name="secondary_company_types"
                  value={type.value}
                  disabled={primaryType === type.value}
                  defaultChecked={initial?.secondary_company_types?.includes(type.value)}
                  className="accent-[#1a5144]"
                />
                <span>{type.label}</span>
              </label>
            ))}
          </div>
        </details>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[#43524c]">
            Referente della richiesta
            <Input
              name="contact_name"
              defaultValue={initial?.contact_name ?? ""}
              className="mt-2 h-11"
              autoComplete="name"
              required={step === 2}
            />
          </label>
          <label className="block text-sm font-medium text-[#43524c]">
            Telefono <span className="font-normal text-[#8b9792]">(facoltativo)</span>
            <Input
              name="contact_phone"
              defaultValue={initial?.contact_phone ?? ""}
              className="mt-2 h-11"
              type="tel"
              autoComplete="tel"
            />
          </label>
        </div>

        <label className="block text-sm font-medium text-[#43524c]">
          Descrizione breve <span className="font-normal text-[#8b9792]">(facoltativa)</span>
          <textarea
            name="short_description"
            defaultValue={initial?.short_description ?? ""}
            maxLength={2000}
            rows={4}
            className="mt-2 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 py-3 text-sm text-[#1d2824] outline-none transition placeholder:text-[#8b9792] focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
            placeholder="In poche righe: cosa producete, distribuite, lavorate o utilizzate."
          />
        </label>
      </section>

      <section
        data-registration-step="3"
        hidden={step !== 3}
        className="mt-7 space-y-5"
      >
        <div>
          <p className="app-kicker">Ultimo controllo</p>
          <h2 tabIndex={-1} className="mt-2 text-xl font-semibold text-[#1d2824]">
            Tutto pronto per la revisione
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Controlla i dati principali. Dopo l’invio potrai seguire lo stato della richiesta
            direttamente dalla piattaforma.
          </p>
        </div>

        <dl className="overflow-hidden rounded-2xl border border-[#dce2df] bg-white">
          {[
            ["Azienda", review?.legalName || "—"],
            ["Paese", review?.countryCode || "—"],
            ["Attività principale", companyTypeLabel(review?.primaryType || "") || "—"],
            ["Referente", review?.contactName || "—"],
            ["Sito web", review?.website || "Non indicato"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="grid gap-1 border-b border-[#eef1ef] px-4 py-3 last:border-b-0 sm:grid-cols-[170px_1fr] sm:gap-4"
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5d6a65]">
                {label}
              </dt>
              <dd className="text-sm font-medium text-[#1d2824]">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-3 rounded-2xl border border-[#dce2df] bg-[#f8faf9] p-5">
          <p className="text-sm font-semibold text-[#1d2824]">Privacy e condizioni di accesso</p>
          <p className="text-xs leading-5 text-[#66736e]">
            Le due conferme sono registrate separatamente e con la versione dei documenti.
            Prendere visione dell’informativa privacy non equivale a prestare consenso.
          </p>

          <label className="flex gap-3 rounded-xl border border-[#e2e7e4] bg-white p-3 text-sm leading-5 text-[#43524c]">
            <input
              type="checkbox"
              name="privacy_acknowledged"
              required={step === 3}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#1a5144]"
            />
            <span>
              Ho letto l’{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="font-semibold text-[#173f35] underline underline-offset-4"
              >
                Informativa privacy
              </Link>.
            </span>
          </label>

          <label className="flex gap-3 rounded-xl border border-[#e2e7e4] bg-white p-3 text-sm leading-5 text-[#43524c]">
            <input
              type="checkbox"
              name="terms_accepted"
              required={step === 3}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#1a5144]"
            />
            <span>
              Accetto i{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-semibold text-[#173f35] underline underline-offset-4"
              >
                Termini d’uso
              </Link>.
            </span>
          </label>
        </div>

        <div className="rounded-2xl border border-[#b8d2c8] bg-[#edf5f2] p-5">
          <p className="text-sm font-semibold text-[#123d34]">Cosa succede dopo</p>
          <p className="mt-2 text-sm leading-6 text-[#43524c]">
            {claim
              ? "La richiesta viene revisionata insieme al claim dell’identità selezionata. Se approvata, l’attivazione collega il workspace a quel profilo gestito senza creare un duplicato."
              : "La richiesta viene revisionata prima dell’attivazione. L’approvazione della registrazione non equivale a una certificazione, una verifica commerciale o una raccomandazione dell’azienda."}
          </p>
        </div>

        <div className="rounded-2xl border border-[#e4d8cf] bg-[#fbf6f2] p-5 text-sm leading-6 text-[#674c3b]">
          Email, offerte, prezzi, ordini e documenti commerciali restano nel workspace privato
          dell’azienda e non diventano dati pubblici del Network.
        </div>
      </section>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#e7ece9] pt-5 sm:flex-row sm:items-center sm:justify-between">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            className="app-secondary h-11 rounded-xl px-5 text-sm font-semibold"
          >
            Indietro
          </button>
        ) : (
          <span />
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={goForward}
            className="app-primary h-11 rounded-xl px-6 text-sm font-semibold"
          >
            Continua
          </button>
        ) : (
          <PendingSubmitButton
            pendingLabel="Invio in corso…"
            className="app-primary inline-flex h-11 w-full items-center justify-center rounded-xl px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Invia richiesta
          </PendingSubmitButton>
        )}
      </div>
    </form>
  );
}
