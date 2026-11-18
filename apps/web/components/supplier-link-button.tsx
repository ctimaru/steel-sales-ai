"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { linkSupplierToNetworkCompany } from "@/app/(workspace)/marketplace/suppliers/actions";

/**
 * RFQHUB1D: an e-mail-only supplier (a person) can be linked to its Network
 * company, found by the e-mail domain. Explicit click, nothing automatic.
 */
export function SupplierLinkButton({
  profileId,
  networkCompanyId,
  companyName,
}: {
  profileId: string;
  networkCompanyId: string;
  companyName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button type="button" data-testid="supplier-link" disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await linkSupplierToNetworkCompany({ profileId, networkCompanyId });
            if (!result.ok) { setError(result.error ?? "Collegamento non riuscito."); return; }
            router.refresh();
          });
        }}
        className="inline-flex min-h-9 items-center rounded-lg border border-[#d6e5db] bg-white px-2.5 text-xs font-bold text-[#2f5a45] hover:bg-[#f2f8f4] disabled:opacity-50">
        {pending ? "Collegamento…" : "Collega a " + companyName}
      </button>
      {error ? <span role="alert" className="text-[11px] font-semibold text-[#8c431e]">{error}</span> : null}
    </span>
  );
}
