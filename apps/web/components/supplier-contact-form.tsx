"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { saveSupplierContact } from "@/app/(workspace)/marketplace/suppliers/actions";

const field =
  "mt-1 block h-10 w-full min-w-0 rounded-lg border border-[#d6e5db] bg-white px-2.5 text-sm text-[var(--brand-deep)] focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]";

/**
 * RFQHUB1B: «+ Contatto» on a supplier row. Saves into the organization's
 * Commerciale contacts; the same contacts appear in step 2 «A chi lo chiedi».
 */
export function SupplierContactForm({
  supplierName,
  networkCompanyId,
  companyId,
}: {
  supplierName: string;
  networkCompanyId: string | null;
  companyId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" data-testid="supplier-contact-add" onClick={() => { setOpen(true); setError(""); }}
        className="inline-flex min-h-9 items-center rounded-lg border border-[#d6e5db] bg-white px-2.5 text-xs font-bold text-[#2f5a45] hover:bg-[#f2f8f4]">
        + Contatto
      </button>
    );
  }

  return (
    <form data-testid="supplier-contact-form" aria-label={"Nuovo contatto per " + supplierName}
      className="mt-2 grid w-full min-w-0 gap-2 rounded-lg border border-[#d6e5db] bg-[#f7fbf8] p-2.5 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setError("");
        startTransition(async () => {
          const result = await saveSupplierContact({
            networkCompanyId,
            companyId,
            fullName: String(data.get("fullName") ?? ""),
            email: String(data.get("email") ?? ""),
            phone: String(data.get("phone") ?? ""),
            role: String(data.get("role") ?? ""),
          });
          if (!result.ok) { setError(result.error ?? "Salvataggio non riuscito."); return; }
          setOpen(false);
          router.refresh();
        });
      }}>
      <label className="min-w-0 text-[11px] font-semibold text-[var(--text-secondary)]">
        Nome e cognome *
        <input name="fullName" required maxLength={160} autoComplete="off" autoFocus className={field} />
      </label>
      <label className="min-w-0 text-[11px] font-semibold text-[var(--text-secondary)]">
        Email *
        <input name="email" type="email" required maxLength={254} autoComplete="off" className={field} />
      </label>
      <label className="min-w-0 text-[11px] font-semibold text-[var(--text-secondary)]">
        Ruolo
        <input name="role" maxLength={80} placeholder="es. Ufficio vendite" autoComplete="off" className={field} />
      </label>
      <label className="min-w-0 text-[11px] font-semibold text-[var(--text-secondary)]">
        Telefono
        <input name="phone" type="tel" maxLength={40} autoComplete="off" className={field} />
      </label>
      {error ? <p role="alert" className="text-xs font-semibold text-[#8c431e] sm:col-span-2">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending}
          className="inline-flex min-h-9 items-center rounded-lg bg-[#175640] px-3 text-xs font-bold text-white hover:bg-[#104632] disabled:opacity-50">
          {pending ? "Salvataggio…" : "Salva contatto"}
        </button>
        <button type="button" disabled={pending} onClick={() => setOpen(false)}
          className="inline-flex min-h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:underline">
          Annulla
        </button>
        <span className="text-[10px] text-[var(--text-secondary)]">Visibile solo alla tua azienda.</span>
      </div>
    </form>
  );
}
