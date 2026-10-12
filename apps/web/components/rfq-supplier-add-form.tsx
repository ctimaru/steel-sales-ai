"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";

import {
  addSupplierToBuyerRfq,
  addSuppliersToBuyerRfqBulk,
  searchBuyerRfqSuppliers,
  type SupplierCandidate,
} from "@/app/(workspace)/marketplace/rfq-hub/actions";
import { appRoutes } from "@/lib/routes";

function sourceLabel(source: SupplierCandidate["source"]) {
  if (source === "recent") return "Già usato";
  if (source === "private_contact" || source === "private_company") return "Contatto privato";
  if (source === "network_contact" || source === "network_company") return "Network";
  return "Smart Steel Sales";
}

function deliveryLabel(channel: SupplierCandidate["delivery_channel"]) {
  if (channel === "both") return "Email + piattaforma";
  if (channel === "platform") return "Piattaforma";
  return "Email";
}

function CandidateGroup({
  title,
  hint,
  candidates,
  addingKey,
  addPending,
  onAdd,
  selectedKeys,
  existingKeys,
  existingEmails,
  onToggle,
}: {
  title: string;
  hint: string;
  candidates: SupplierCandidate[];
  addingKey: string | null;
  addPending: boolean;
  onAdd: (candidate: SupplierCandidate) => void;
  selectedKeys: ReadonlySet<string>;
  existingKeys: ReadonlySet<string>;
  existingEmails: ReadonlySet<string>;
  onToggle: (candidate: SupplierCandidate) => void;
}) {
  if (!candidates.length) return null;

  return (
    <section className="rounded-2xl border border-[#e1e6e3] bg-[#fbfcfb]">
      <div className="border-b border-[#e8ecea] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#173f35]">
              {title}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[#718078]">{hint}</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#66736e]">
            {candidates.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-[#edf0ee]">
        {candidates.map((candidate) => {
          const busy = addPending && addingKey === candidate.identity_key;
          const alreadyAdded = existingKeys.has(candidate.identity_key) || Boolean(candidate.email && existingEmails.has(candidate.email.toLowerCase()));
          const checked = selectedKeys.has(candidate.identity_key);
          return (
            <div
              key={candidate.identity_key}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex flex-1 items-start gap-3">
                <input type="checkbox" aria-label={"Seleziona " + (candidate.company_name || candidate.contact_name || candidate.email || "fornitore")}
                  checked={checked} disabled={addPending || alreadyAdded}
                  onChange={() => onToggle(candidate)}
                  className="mt-1 h-5 w-5 shrink-0 accent-[#174b3d]" />
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[#1d2824]">
                    {candidate.company_name || candidate.contact_name || candidate.email || "Fornitore"}
                  </p>
                  {candidate.preferred ? (
                    <span className="rounded-full bg-[#173f35] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white">
                      Preferito
                    </span>
                  ) : null}
                  <span className="rounded-full bg-[#edf5f2] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#1a5144]">
                    {sourceLabel(candidate.source)}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-[#718078] ring-1 ring-inset ring-[#dce2df]">
                    {deliveryLabel(candidate.delivery_channel)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#66736e]">
                  {candidate.contact_name &&
                  candidate.contact_name !== candidate.company_name ? (
                    <span>{candidate.contact_name}</span>
                  ) : null}
                  {candidate.email ? <span>{candidate.email}</span> : null}
                  {candidate.country_code ? <span>{candidate.country_code}</span> : null}
                </div>
                {alreadyAdded ? <p className="mt-1 text-[11px] font-semibold text-[#276247]">Già nella RFQ ✓</p> : null}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onAdd(candidate)}
                disabled={addPending || alreadyAdded}
                className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border border-[#b8d2c8] bg-white px-4 text-xs font-bold text-[#173f35] transition hover:bg-[#edf5f2] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {alreadyAdded ? "Presente ✓" : busy ? "Aggiunta…" : "Aggiungi"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RfqSupplierAddForm({ rfqId, existingIdentityKeys = [], existingEmails = [], currentCount = 0 }: {
  rfqId: string;
  existingIdentityKeys?: string[];
  existingEmails?: string[];
  currentCount?: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<SupplierCandidate[]>([]);
  const [networkEnabled, setNetworkEnabled] = useState<boolean | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [selectedByKey, setSelectedByKey] = useState<Record<string, SupplierCandidate>>({});
  const [batchBusy, setBatchBusy] = useState(false);
  const existingKeys = useMemo(() => new Set(existingIdentityKeys.filter(Boolean)), [existingIdentityKeys]);
  const emailsPresent = useMemo(() => new Set(existingEmails.filter(Boolean).map(email => email.toLowerCase())), [existingEmails]);
  const selectedCandidates = Object.values(selectedByKey);
  const selectedKeys = new Set(Object.keys(selectedByKey));
  const [searchPending, startSearchTransition] = useTransition();
  const [addPending, startAddTransition] = useTransition();

  const groups = useMemo(
    () => ({
      preferred: candidates.filter((candidate) => candidate.preferred),
      recent: candidates.filter(
        (candidate) => !candidate.preferred && candidate.source === "recent",
      ),
      private: candidates.filter(
        (candidate) =>
          !candidate.preferred &&
          (candidate.source === "private_contact" ||
            candidate.source === "private_company"),
      ),
      network: candidates.filter(
        (candidate) =>
          !candidate.preferred &&
          (candidate.source === "network_contact" ||
            candidate.source === "network_company" ||
            candidate.source === "platform_organization"),
      ),
    }),
    [candidates],
  );

  function toggleCandidate(candidate: SupplierCandidate) {
    const key = candidate.identity_key;
    if (existingKeys.has(key) || (candidate.email && emailsPresent.has(candidate.email.toLowerCase()))) return;
    setSelectedByKey((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return Object.keys(prev).length >= Math.min(20, Math.max(0, 100-currentCount)) ? prev : { ...prev, [key]: candidate };
    });
  }

  function addSelectedCandidates() {
    if (batchBusy || addPending || selectedCandidates.length < 1 || currentCount + selectedCandidates.length > 100) return;
    setBatchBusy(true);
    setMessage(null);
    startAddTransition(async () => {
      try {
        const result = await addSuppliersToBuyerRfqBulk({ rfqId, candidates: selectedCandidates });
        if (result.error) { setMessage(result.error); return; }
        const added = new Set(result.addedKeys);
        setSelectedByKey(prev => Object.fromEntries(Object.entries(prev).filter(([key]) => !added.has(key))));
        setMessage(`${added.size} fornitori aggiunti alla RFQ.${result.failed.length ? ` ${result.failed.length} non aggiunti: ${result.failed.slice(0, 3).map(f => f.error).join("; ")}` : ""}`);
        if (added.size) { router.refresh(); loadCandidates(query); }
      } catch {
        setMessage("Aggiunta multipla non riuscita. I fornitori già inseriti restano salvati: aggiorna la pagina prima di riprovare.");
      } finally {
        setBatchBusy(false);
      }
    });
  }

  function loadCandidates(nextQuery = query) {
    startSearchTransition(async () => {
      const result = await searchBuyerRfqSuppliers(rfqId, nextQuery);
      if (!result.ok) {
        setCandidates([]);
        setMessage(result.error ?? "Ricerca fornitori non riuscita.");
        return;
      }
      setCandidates(result.candidates ?? []);
      setNetworkEnabled(result.networkEnabled ?? false);
    });
  }

  useEffect(() => {
    startSearchTransition(async () => {
      const result = await searchBuyerRfqSuppliers(rfqId, "");
      if (!result.ok) {
        setCandidates([]);
        setMessage(result.error ?? "Ricerca fornitori non riuscita.");
        return;
      }
      setCandidates(result.candidates ?? []);
      setNetworkEnabled(result.networkEnabled ?? false);
    });
  }, [rfqId]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    loadCandidates(query);
  }

  function addCandidate(candidate: SupplierCandidate) {
    if (batchBusy) return;
    setMessage(null);
    setAddingKey(candidate.identity_key);
    startAddTransition(async () => {
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

      setAddingKey(null);

      if (!result.ok) {
        setMessage(result.error ?? "Aggiunta non riuscita.");
        return;
      }

      setMessage("Fornitore aggiunto alla RFQ.");
      router.refresh();
      loadCandidates(query);
    });
  }

  function addManualSupplier() {
    if (batchBusy) return;
    setMessage(null);
    setAddingKey("manual");
    startAddTransition(async () => {
      const result = await addSupplierToBuyerRfq({
        rfqId,
        identitySource: "manual",
        supplierName,
        supplierEmail,
      });

      setAddingKey(null);

      if (!result.ok) {
        setMessage(result.error ?? "Aggiunta non riuscita.");
        return;
      }

      setSupplierName("");
      setSupplierEmail("");
      setMessage("Fornitore aggiunto e identità verificata.");
      router.refresh();
      loadCandidates(query);
    });
  }

  return (
    <section className="rounded-3xl border border-[#d8e1dd] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 border-b border-[#e7ece9] pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            1 · Seleziona fornitori
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            Scegli i fornitori senza ricopiare gli indirizzi.
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Cerchiamo nella rubrica supplier, nello storico RFQ, nei contatti privati della tua azienda e nel Network.
            Le identità coincidenti vengono riconciliate prima dell&apos;aggiunta.
          </p>
        </div>

        <div className="w-full lg:max-w-xl">
          <div className="mb-2 flex justify-end">
            <Link
              href={appRoutes.marketplace.suppliers}
              className="text-xs font-bold text-[#173f35] underline underline-offset-4"
            >
              Apri rubrica supplier
            </Link>
          </div>
        <form
          onSubmit={handleSearch}
          className="flex w-full gap-2"
        >
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Azienda, contatto, email, P.IVA o dominio"
            className="h-11 min-w-0 flex-1 rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
          />
          <button
            type="submit"
            disabled={searchPending}
            className="platform-primary inline-flex h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-bold disabled:opacity-60"
          >
            {searchPending ? "Cerco…" : "Cerca"}
          </button>
        </form>
        </div>
      </div>

      {networkEnabled === false ? (
        <div className="mt-4 rounded-xl border border-[#e6dfca] bg-[#fbf8ef] px-4 py-3 text-xs leading-5 text-[#725f31]">
          I contatti privati e lo storico restano disponibili. I risultati del Network compariranno quando l&apos;azienda avrà accesso al prodotto Network.
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#c5dcd0] bg-[#f0f8f3] px-3 py-3">
        <div className="text-xs font-bold text-[#164337]">{selectedCandidates.length} selezionati · {currentCount} già nella RFQ</div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedCandidates.length ? <button type="button" onClick={() => setSelectedByKey({})} disabled={batchBusy}
              className="min-h-11 px-3 text-xs font-semibold text-[#245f4f] underline disabled:opacity-50">Deseleziona</button> : null}
          <button type="button" onClick={addSelectedCandidates}
            disabled={!selectedCandidates.length || addPending || batchBusy || currentCount + selectedCandidates.length > 100}
            className="platform-primary min-h-11 rounded-xl px-4 text-xs font-bold disabled:opacity-50">
            {batchBusy ? "Aggiunta fornitori…" : `Aggiungi ${selectedCandidates.length} alla RFQ`}
          </button>
        </div>
        <p className="w-full text-[11px] leading-4 text-[#47665a]">Seleziona più aziende dai preferiti, dallo storico o dai risultati di ricerca; puoi aggiungerne fino a 20 per volta. Nessuna email viene inviata.</p>
      </div>

      <div className="mt-5 space-y-4">
        <CandidateGroup
          title="Preferiti"
          hint="Supplier preferiti nella rubrica acquisti o aziende salvate nel Network."
          candidates={groups.preferred}
          addingKey={addingKey}
          addPending={addPending}
          onAdd={addCandidate}
          selectedKeys={selectedKeys} existingKeys={existingKeys} existingEmails={emailsPresent} onToggle={toggleCandidate}
        />
        <CandidateGroup
          title="Già usati"
          hint="Fornitori già selezionati in altre RFQ della tua azienda."
          candidates={groups.recent}
          addingKey={addingKey}
          addPending={addPending}
          onAdd={addCandidate}
          selectedKeys={selectedKeys} existingKeys={existingKeys} existingEmails={emailsPresent} onToggle={toggleCandidate}
        />
        <CandidateGroup
          title="Contatti privati"
          hint="Aziende e contatti provenienti dalla memoria commerciale privata."
          candidates={groups.private}
          addingKey={addingKey}
          addPending={addPending}
          onAdd={addCandidate}
          selectedKeys={selectedKeys} existingKeys={existingKeys} existingEmails={emailsPresent} onToggle={toggleCandidate}
        />
        <CandidateGroup
          title="Network"
          hint="Profili e contatti Network utilizzabili secondo entitlement e regole privacy."
          candidates={groups.network}
          addingKey={addingKey}
          addPending={addPending}
          onAdd={addCandidate}
          selectedKeys={selectedKeys} existingKeys={existingKeys} existingEmails={emailsPresent} onToggle={toggleCandidate}
        />

        {!searchPending && candidates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#cfd8d4] bg-[#fafbfa] px-5 py-6 text-center">
            <p className="text-sm font-semibold text-[#43524c]">
              Nessun fornitore trovato con questi criteri.
            </p>
            <p className="mt-1 text-xs leading-5 text-[#718078]">
              Puoi modificare la ricerca oppure inserire un nuovo indirizzo manualmente.
            </p>
          </div>
        ) : null}
      </div>

      <details className="mt-5 rounded-2xl border border-[#e1e6e3] bg-[#fbfcfb]">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold text-[#173f35]">
          + Aggiungi manualmente un nuovo fornitore
        </summary>
        <div className="border-t border-[#e8ecea] p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
            <label className="text-xs font-semibold text-[#52615b]">
              Nome fornitore
              <input
                value={supplierName}
                onChange={(event) => setSupplierName(event.target.value)}
                placeholder="Es. Acciai Rossi"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
              />
            </label>
            <label className="text-xs font-semibold text-[#52615b]">
              Email *
              <input
                type="email"
                value={supplierEmail}
                onChange={(event) => setSupplierEmail(event.target.value)}
                placeholder="offerte@fornitore.it"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824] outline-none focus:border-[#438d7a]"
              />
            </label>
            <button
              type="button"
              onClick={addManualSupplier}
              disabled={addPending || batchBusy || !supplierEmail.trim() || currentCount >= 100}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-5 text-sm font-bold text-[#173f35] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {addPending && addingKey === "manual" ? "Aggiunta…" : "Aggiungi"}
            </button>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-[#718078]">
            Anche l&apos;inserimento manuale passa dall&apos;identity resolver: se l&apos;email coincide con un contatto privato già noto, Smart Steel Sales lo collega automaticamente invece di creare un duplicato.
          </p>
        </div>
      </details>

      {message ? (
        <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-[#f7f9f8] px-4 py-3 text-xs font-semibold text-[#52615b]">
          {message}
        </p>
      ) : null}
    </section>
  );
}
