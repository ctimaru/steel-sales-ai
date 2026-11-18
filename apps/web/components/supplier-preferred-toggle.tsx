"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateSupplierProfile } from "@/app/(workspace)/marketplace/suppliers/actions";

/** RFQHUB1D: mark a supplier as preferred straight from the row. */
export function SupplierPreferredToggle({
  profileId,
  supplierName,
  preferred,
  tags,
  notes,
}: {
  profileId: string;
  supplierName: string;
  preferred: boolean;
  tags: string[];
  notes: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(preferred);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <span className="inline-flex items-center">
      <button type="button" data-testid="supplier-preferred-toggle" aria-pressed={value} disabled={pending}
        aria-label={(value ? "Togli dai preferiti " : "Segna come preferito ") + supplierName}
        title={value ? "Preferito" : "Segna come preferito"}
        onClick={() => {
          const next = !value;
          setValue(next);
          setError("");
          startTransition(async () => {
            const result = await updateSupplierProfile({ profileId, preferred: next, tags, notes });
            if (!result.ok) { setValue(!next); setError(result.error ?? "Non salvato."); return; }
            router.refresh();
          });
        }}
        className={"inline-flex h-9 w-9 items-center justify-center rounded-lg border text-base leading-none disabled:opacity-50 " +
          (value ? "border-[#e2b54a] bg-[#fff6dc] text-[#7a4d0e]" : "border-[#d6e5db] bg-white text-[#5c7063] hover:text-[#7a4d0e]")}>
        <span aria-hidden="true">{value ? "★" : "☆"}</span>
      </button>
      {error ? <span role="alert" className="ml-1 text-[10px] font-semibold text-[#8c431e]">{error}</span> : null}
    </span>
  );
}
