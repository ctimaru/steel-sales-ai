"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { saveAndSubmitCompanyRegistration } from "@/app/register/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Input } from "@/components/ui/input";

type CompanyApplication = {
  legal_name?: string | null; trading_name?: string | null; country_code?: string | null;
  vat_id?: string | null; registration_id?: string | null; website_url?: string | null;
  primary_company_type?: string | null; secondary_company_types?: string[] | null;
  contact_name?: string | null; contact_phone?: string | null; short_description?: string | null;
};
type Claim = { claim_ref: string; legal_name: string; trading_name: string | null; country_code: string; vat_hint: string | null };
const types = [
  { value: "producer", label: "Producer / manufacturer" },
  { value: "trader_distributor", label: "Trader / distributor" },
  { value: "processor_service_provider", label: "Processor / service provider" },
  { value: "end_user", label: "Industrial buyer / end user" },
] as const;
const steps = ["Company identity", "Operations and contact", "Review and submit"] as const;

export function EnglishCompanyRegistrationForm({ initial, claim }: {
  initial?: CompanyApplication | null; claim?: Claim | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mainType, setMainType] = useState(initial?.primary_company_type ?? "");
  const [error, setError] = useState<string | null>(null);
  const control = "mt-2 h-11 w-full rounded-xl border border-[#cfd9d5] bg-white px-3 text-sm text-[#1d2824] focus:border-[#438d7a] focus:outline-none focus:ring-2 focus:ring-[#e1ece8]";
  const label = "block text-sm font-semibold text-[#43524c]";

  function validateStep(stepToValidate: 1 | 2 | 3) {
    const section = formRef.current?.querySelector<HTMLElement>(`[data-step="${stepToValidate}"]`);
    if (!section) return false;
    const controls = Array.from(section.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"));
    const invalid = controls.find((field) => !field.disabled && !field.checkValidity());
    if (invalid) {
      invalid.reportValidity(); invalid.focus();
      setError("Please complete the required fields before continuing.");
      return false;
    }
    setError(null);
    return true;
  }
  function forward() {
    if (validateStep(step)) setStep(step === 1 ? 2 : 3);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    if (!String(data.get("legal_name") ?? "").trim() || !/^[A-Z]{2}$/.test(String(data.get("country_code") ?? "").trim().toUpperCase())) {
      event.preventDefault(); setStep(1); setError("Provide a legal company name and ISO two-letter country code."); return;
    }
    if (!types.some(t => t.value === data.get("primary_company_type")) || !String(data.get("contact_name") ?? "").trim()) {
      event.preventDefault(); setStep(2); setError("Select a company type and provide a contact name."); return;
    }
    if (data.get("privacy_acknowledged") !== "on" || data.get("terms_accepted") !== "on") {
      event.preventDefault(); setStep(3); setError("Confirm privacy acknowledgement and terms acceptance separately.");
    }
  }
  const review = step === 3 && formRef.current ? new FormData(formRef.current) : null;
  const summary = (name: string) => review ? String(review.get(name) ?? "").trim() : "";

  return (
    <form ref={formRef} action={saveAndSubmitCompanyRegistration} onSubmit={submit} className="mt-8">
      <input type="hidden" name="registration_locale" value="en" />
      {claim ? <input type="hidden" name="claim_ref" value={claim.claim_ref} /> : null}
      {claim ? (
        <aside className="mb-5 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] p-4 text-sm text-[#173f35]">
          <strong>Company claim selected: {claim.legal_name}</strong>
          <p className="mt-1">{claim.country_code}{claim.vat_hint ? ` · VAT ${claim.vat_hint}` : ""}</p>
          <p className="mt-2 text-xs">The selected legal identity is locked to prevent duplicate companies. Ownership and activation remain subject to review.</p>
        </aside>
      ) : null}
      <ol aria-label="Company application steps" className="grid gap-2 rounded-2xl bg-[#f8faf9] p-3 sm:grid-cols-3">
        {steps.map((name, index) => {
          const number = (index + 1) as 1 | 2 | 3;
          return <li key={name} aria-current={step === number ? "step" : undefined}
            className={`rounded-xl border px-3 py-3 text-xs font-semibold ${step === number ? "border-[#8abca9] bg-white text-[#123b34]" : "border-transparent text-[#66736e]"}`}>
            <span className="mr-2 text-[#1f6b5a]">{step > number ? "✓" : number}.</span>{name}
          </li>;
        })}
      </ol>
      {error ? <p role="alert" aria-live="polite" className="mt-4 rounded-xl border border-[#efc5bd] bg-[#fff5f3] px-4 py-3 text-sm text-[#9f2f24]">{error}</p> : null}

      <section data-step="1" hidden={step !== 1} className="mt-7 space-y-5">
        <h2 className="text-xl font-bold text-[#123b34]">Identify your company</h2>
        <p className="text-sm leading-6 text-[#66736e]">We only need essential company identity details. You can complete the commercial profile after approval.</p>
        <label className={label}>Legal company name
          <Input name="legal_name" defaultValue={initial?.legal_name ?? ""} readOnly={Boolean(claim)}
            required={step === 1} autoComplete="organization" className={control} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Country (ISO two-letter code)
            <Input name="country_code" defaultValue={initial?.country_code ?? (claim ? claim.country_code : "")}
              readOnly={Boolean(claim)} maxLength={2} pattern="[A-Za-z]{2}" placeholder="GB" required={step === 1} className={control} />
          </label>
          <label className={label}>Website (optional)
            <Input name="website_url" defaultValue={initial?.website_url ?? ""} type="url" autoComplete="url" placeholder="https://example.com" className={control} />
          </label>
        </div>
        <details className="rounded-xl border border-[#dce2df] bg-[#f8faf9] p-4">
          <summary className="cursor-pointer text-sm font-bold text-[#43524c]">Additional company details (optional)</summary>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={label}>Trading name
              <Input name="trading_name" defaultValue={initial?.trading_name ?? claim?.trading_name ?? ""} className={control} />
            </label>
            <label className={label}>VAT / tax ID
              <Input name="vat_id" defaultValue={initial?.vat_id ?? ""} className={control} />
            </label>
            <label className={label}>Business registration number
              <Input name="registration_id" defaultValue={initial?.registration_id ?? ""} className={control} />
            </label>
          </div>
        </details>
      </section>

      <section data-step="2" hidden={step !== 2} className="mt-7 space-y-5">
        <h2 className="text-xl font-bold text-[#123b34]">How does your company operate?</h2>
        <fieldset>
          <legend className="text-sm font-bold text-[#43524c]">Primary company category</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {types.map(type => <label key={type.value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#dce2df] bg-white p-4 text-sm font-medium text-[#43524c]">
              <input type="radio" name="primary_company_type" value={type.value} required={step === 2}
                defaultChecked={initial?.primary_company_type === type.value} onChange={() => setMainType(type.value)} className="accent-[#1a5144]" />
              {type.label}
            </label>)}
          </div>
        </fieldset>
        <details className="rounded-xl border border-[#dce2df] bg-[#f8faf9] p-4">
          <summary className="cursor-pointer text-sm font-bold text-[#43524c]">Other business activities (optional)</summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {types.map(type => <label key={type.value} className="flex gap-3 rounded-lg bg-white px-3 py-2 text-sm text-[#43524c]">
              <input type="checkbox" name="secondary_company_types" value={type.value} disabled={mainType === type.value}
                defaultChecked={initial?.secondary_company_types?.includes(type.value)} className="accent-[#1a5144]" />{type.label}
            </label>)}
          </div>
        </details>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Primary contact name
            <Input name="contact_name" defaultValue={initial?.contact_name ?? ""} autoComplete="name" required={step === 2} className={control} />
          </label>
          <label className={label}>Contact phone (optional)
            <Input name="contact_phone" type="tel" defaultValue={initial?.contact_phone ?? ""} autoComplete="tel" className={control} />
          </label>
        </div>
        <label className={label}>Short company description (optional)
          <textarea name="short_description" defaultValue={initial?.short_description ?? ""} maxLength={2000}
            rows={3} placeholder="What do you produce, distribute, process or purchase?"
            className="mt-2 w-full rounded-xl border border-[#cfd9d5] p-3 text-sm" />
        </label>
      </section>

      <section data-step="3" hidden={step !== 3} className="mt-7 space-y-5">
        <h2 className="text-xl font-bold text-[#123b34]">Review your company application</h2>
        <p className="text-sm leading-6 text-[#66736e]">Once submitted, your application remains pending until reviewed by the platform team. Registration is not a business endorsement.</p>
        <dl className="grid gap-3 rounded-xl border border-[#dce2df] bg-white p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-[#66736e]">Legal company name</dt><dd className="font-bold">{summary("legal_name")}</dd></div>
          <div><dt className="text-[#66736e]">Country</dt><dd className="font-bold">{summary("country_code")}</dd></div>
          <div><dt className="text-[#66736e]">Primary category</dt><dd className="font-bold">{types.find(t=>t.value===summary("primary_company_type"))?.label ?? "—"}</dd></div>
          <div><dt className="text-[#66736e]">Contact</dt><dd className="font-bold">{summary("contact_name")}</dd></div>
        </dl>
        <fieldset className="space-y-3 rounded-xl bg-[#f8faf9] p-5">
          <legend className="sr-only">Legal acknowledgements</legend>
          <p className="text-sm font-bold">Privacy and terms</p>
          <p className="text-xs leading-5 text-[#66736e]">The acknowledgements are recorded separately with the current document versions. Reading the privacy notice is not marketing consent. The legal documents are currently in Italian.</p>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" name="privacy_acknowledged" required={step === 3} className="accent-[#1a5144]" />
            <span>I have read the <Link href="/privacy" hrefLang="it" target="_blank" className="font-bold underline">Privacy notice (Italian)</Link>.</span>
          </label>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" name="terms_accepted" required={step === 3} className="accent-[#1a5144]" />
            <span>I accept the <Link href="/terms" hrefLang="it" target="_blank" className="font-bold underline">Terms of use (Italian)</Link>.</span>
          </label>
        </fieldset>
        <p className="rounded-xl border border-[#b8d2c8] bg-[#edf5f2] p-4 text-sm leading-6 text-[#173f35]">
          Your company profile will be reviewed before activation. Commercial emails, RFQs, prices, offers and orders remain private to your authorized workspace.
        </p>
      </section>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#e7ece9] pt-5 sm:flex-row sm:justify-between">
        {step > 1 ? <button type="button" onClick={() => { setError(null); setStep(step === 3 ? 2 : 1); }}
          className="app-secondary h-11 rounded-xl px-5 text-sm font-bold">Back</button> : <span />}
        {step < 3 ? <button type="button" onClick={forward} className="app-primary h-11 rounded-xl px-6 text-sm font-bold">Continue</button>
          : <PendingSubmitButton pendingLabel="Submitting…" className="app-primary h-11 rounded-xl px-6 text-sm font-bold disabled:opacity-50">Submit for review</PendingSubmitButton>}
      </div>
    </form>
  );
}
