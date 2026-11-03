"use client";

import Link from "next/link";
import { useState } from "react";

import { italianVatMessage, italianVatRequired, normalizeItalianVat } from "@/lib/italian-vat";
import type { PublicCompanyLookupItem } from "@/lib/public-company-lookup-contract";

/**
 * ONBOARDING-AUDIT2 · F3 — Partita IVA validation and a non-blocking duplicate
 * check for the company registration form (IT and EN).
 *
 * The duplicate check reuses the public company lookup (published profiles
 * only, VAT masked), so it reveals nothing the public search does not already
 * show. A match pauses the form once with a warning; pressing Continue again
 * with the same VAT proceeds. Pending applications are not disclosed here:
 * duplicate applications are still resolved in staff review.
 */
export function validateRegistrationVat(
  form: HTMLFormElement,
  locale: "it" | "en",
  hasClaim: boolean,
): boolean {
  const input = form.querySelector<HTMLInputElement>('input[name="vat_id"]');
  const country = form.querySelector<HTMLInputElement>('input[name="country_code"]')?.value;
  if (!input) return true;

  const required = italianVatRequired(country, hasClaim);
  const valid = !required || normalizeItalianVat(input.value) !== null;
  input.setCustomValidity(valid ? "" : italianVatMessage(locale));
  if (!valid) {
    input.reportValidity();
    input.focus();
  }
  return valid;
}

export function useVatDuplicateCheck() {
  const [matches, setMatches] = useState<PublicCompanyLookupItem[]>([]);
  const [checkedVat, setCheckedVat] = useState<string | null>(null);

  /** Resolves true when the form should pause to show matches for a VAT not seen yet. */
  async function shouldPause(form: HTMLFormElement, hasClaim: boolean): Promise<boolean> {
    if (hasClaim) return false;
    const raw = form.querySelector<HTMLInputElement>('input[name="vat_id"]')?.value ?? "";
    const vat = normalizeItalianVat(raw) ?? raw.replace(/\s+/g, "").toUpperCase();
    if (vat.replace(/\D/g, "").length < 8 || vat === checkedVat) return false;

    setCheckedVat(vat);
    try {
      const body = new FormData();
      body.set("company_query", vat);
      body.set("company_website", "");
      const response = await fetch("/api/public/company-lookup", { method: "POST", body });
      const state = (await response.json()) as {
        status?: string;
        mode?: string | null;
        items?: PublicCompanyLookupItem[];
      };
      const found = state.status === "ok" && state.mode === "vat" && Array.isArray(state.items)
        ? state.items
        : [];
      setMatches(found);
      return found.length > 0;
    } catch {
      setMatches([]);
      return false;
    }
  }

  return { matches, shouldPause };
}

export function VatDuplicateNotice({
  matches,
  locale,
}: {
  matches: PublicCompanyLookupItem[];
  locale: "it" | "en";
}) {
  if (!matches.length) return null;
  const en = locale === "en";

  return (
    <div
      role="alert"
      data-testid="registration-vat-duplicate"
      className="mt-5 rounded-xl border border-[#ead7aa] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-[#77551c]"
    >
      <p className="font-semibold">
        {en
          ? "A company with this VAT number is already on Smart Steel Sales."
          : "Un’azienda con questa Partita IVA è già presente su Smart Steel Sales."}
      </p>
      <ul className="mt-2 space-y-2">
        {matches.map((item) => (
          <li key={item.claim_ref} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-[#5c4314]">
              {item.legal_name}
              {item.vat_hint ? ` · ${en ? "VAT" : "P.IVA"} ${item.vat_hint}` : ""}
            </span>
            {item.claim_state === "claimable" ? (
              <Link
                href={(en ? "/en/register?claim_ref=" : "/register?claim_ref=") + encodeURIComponent(item.claim_ref)}
                className="font-semibold underline underline-offset-4"
              >
                {en ? "Claim this profile instead" : "Rivendica questo profilo"}
              </Link>
            ) : (
              <span className="text-xs">
                {en
                  ? "Already claimed or under review: ask your company administrator for an invitation."
                  : "Già rivendicata o in verifica: chiedi un invito all’amministratore della tua azienda."}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs">
        {en
          ? "If this is a different company, check the VAT number and press Continue again."
          : "Se si tratta di un’altra azienda, controlla la Partita IVA e premi di nuovo Continua."}
      </p>
    </div>
  );
}
