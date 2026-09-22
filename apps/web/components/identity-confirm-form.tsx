"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import {
  confirmIdentityMapping,
  type IdentityConfirmState,
} from "@/app/(workspace)/review/identities/actions";

const initialState: IdentityConfirmState = { status: "idle", message: "" };

export type VerifiedCompanyOption = {
  companyId: string;
  name: string;
  vatNumber: string | null;
};

export function IdentityConfirmForm({
  contactId,
  companies,
  disabled = false,
}: {
  contactId: string;
  companies: VerifiedCompanyOption[];
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(confirmIdentityMapping, initialState);
  const messageId = useId();

  return (
    <form action={action} aria-busy={pending} className="space-y-2">
      <input type="hidden" name="contact_id" value={contactId} />
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Company verificata
        <select
          name="company_id"
          required
          disabled={disabled || pending || state.status === "success"}
          defaultValue=""
          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none focus:border-slate-400 disabled:bg-slate-100"
        >
          <option value="" disabled>
            Seleziona una Company…
          </option>
          {companies.map((company) => (
            <option key={company.companyId} value={company.companyId}>
              {company.name}{company.vatNumber ? ` · ${company.vatNumber}` : ""}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={disabled || pending || state.status === "success" || companies.length === 0}
        aria-describedby={state.message ? messageId : undefined}
        className="w-full rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Conferma in corso…" : state.status === "success" ? "Confermata" : "Conferma associazione"}
      </button>

      <p
        id={messageId}
        role={state.status === "error" ? "alert" : "status"}
        className={`text-xs leading-5 ${state.status === "error" ? "text-red-700" : "text-emerald-700"}`}
      >
        {pending ? "Salvataggio e propagazione in corso…" : state.message}
      </p>

      {state.status === "success" && state.companyId ? (
        <Link
          href={`/customers/${state.companyId}`}
          className="block rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          Apri Company 360 →
        </Link>
      ) : null}
    </form>
  );
}
