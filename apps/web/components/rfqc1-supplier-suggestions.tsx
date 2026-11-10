"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addSupplierToBuyerRfq,
  searchBuyerRfqSuppliers,
  type SupplierCandidate,
} from "@/app/(workspace)/marketplace/rfq-hub/actions";
import { rankSupplierSuggestions, type SupplierSuggestion } from "@/lib/rfqc1-supplier-suggestions";

/**
 * Chat RFQ, passo 2: propone fornitori dalla rete e dai contatti dell'azienda.
 * Nulla viene aggiunto o inviato senza il clic su "Aggiungi"; l'invio resta un
 * passo separato e confermato.
 */
export function Rfqc1SupplierSuggestions({
  rfqId, existingEmails, existingNames, canAdd,
}: {
  rfqId: string;
  existingEmails: string[];
  existingNames: string[];
  canAdd: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<SupplierSuggestion<SupplierCandidate>[] | null>(null);
  const [message, setMessage] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function suggest() {
    setMessage("");
    startTransition(async () => {
      const result = await searchBuyerRfqSuppliers(rfqId, "");
      if (!result.ok) {
        setMessage(result.error ?? "Non è stato possibile cercare i fornitori.");
        return;
      }
      const ranked = rankSupplierSuggestions(result.candidates ?? [], { emails: existingEmails, names: existingNames });
      setItems(ranked);
      if (!ranked.length) setMessage("Nessun nuovo fornitore da suggerire. Puoi aggiungerne uno a mano nella gestione RFQ.");
    });
  }

  function add(candidate: SupplierCandidate) {
    setMessage("");
    setBusyKey(candidate.identity_key);
    startTransition(async () => {
      const result = await addSupplierToBuyerRfq({
        rfqId,
        identitySource: candidate.source,
        supplierName: candidate.company_name,
        supplierEmail: candidate.email,
        supplierCompanyId: candidate.supplier_company_id,
        supplierContactId: candidate.supplier_contact_id,
        supplierNetworkCompanyId: candidate.supplier_network_company_id,
        supplierNetworkContactId: candidate.supplier_network_contact_id,
        supplierOrganizationId: candidate.supplier_organization_id,
      });
      setBusyKey(null);
      if (!result.ok) {
        setMessage(result.error ?? "Aggiunta non riuscita.");
        return;
      }
      setItems((current) => current?.filter((item) => item.candidate.identity_key !== candidate.identity_key) ?? null);
      setMessage((candidate.company_name ?? "Il fornitore") + " è stato aggiunto. Nessuna richiesta è stata inviata.");
      router.refresh();
    });
  }

  return (
    <section data-testid="rfqc1-supplier-suggestions" aria-label="Fornitori suggeriti"
      className="border-b border-[#e2eae5] bg-white px-3 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[#143f30]">Fornitori suggeriti</p>
          <p className="text-[11px] leading-4 text-[#5c7063]">Dai tuoi contatti e dal Network. Scegli tu chi aggiungere; l'invio è un passo separato.</p>
        </div>
        {canAdd ? (
          <button type="button" onClick={suggest} disabled={pending}
            className="inline-flex min-h-9 items-center rounded-lg border border-[#b8d6c3] px-3 text-xs font-semibold text-[#175640] hover:bg-[#edf6f0] disabled:opacity-60">
            {pending && busyKey === null ? "Cerco…" : items ? "Aggiorna suggerimenti" : "Suggerisci fornitori"}
          </button>
        ) : null}
      </div>
      {items?.length ? (
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {items.map(({ candidate, reason }) => (
            <li key={candidate.identity_key} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-[#e0e7e2] px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-[#173f35]" title={candidate.company_name ?? ""}>{candidate.company_name ?? candidate.email}</p>
                <p className="truncate text-[11px] text-[#5c7063]">{reason}{candidate.country_code ? " · " + candidate.country_code : ""}</p>
              </div>
              {canAdd ? (
                <button type="button" onClick={() => add(candidate)} disabled={pending}
                  className="shrink-0 rounded-md bg-[#175640] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#104632] disabled:opacity-60">
                  {busyKey === candidate.identity_key ? "Aggiungo…" : "Aggiungi"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {message ? <p role="status" className="mt-2 text-[11px] leading-4 text-[#48685a]">{message}</p> : null}
      {!canAdd ? <p className="mt-2 text-[11px] leading-4 text-[#5c7063]">Il tuo profilo consulta quest'area in sola lettura.</p> : null}
    </section>
  );
}
