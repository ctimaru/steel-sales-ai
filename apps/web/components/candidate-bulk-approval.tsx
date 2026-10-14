"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

export type BulkCandidateChoice = {
  id: string;
  name: string;
  domain: string;
};

function ConfirmSubmit({ count, ready }: { count: number; ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={!ready || pending}
      className="min-h-11 rounded-xl bg-[#173f35] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2">
      {pending ? "Registrazione in corso…" : `Conferma approvazione di ${count} candidati`}
    </button>
  );
}

export function CandidateBulkApproval({
  candidates,
  action,
}: {
  candidates: BulkCandidateChoice[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [attested, setAttested] = useState(false);
  const [note, setNote] = useState("");
  const available = candidates.slice(0, 50);
  const allSelected = available.length > 0 && selected.length === available.length;
  const validNote = note.trim().length >= 12 && note.trim().length <= 1000;

  function setChecked(id: string, checked: boolean) {
    setSelected(prev => checked ? [...prev.filter(item => item !== id), id] : prev.filter(item => item !== id));
    setConfirming(false);
    setAttested(false);
  }

  return (
    <section aria-labelledby="candidate-bulk-heading" className="mb-6 rounded-2xl border border-[#c6d9d0] bg-[#f6faf8] p-4 sm:p-5">
      <h3 id="candidate-bulk-heading" className="text-lg font-semibold text-[#173f35]">Approvazione multipla · dati societari</h3>
      <p className="mt-2 text-sm leading-6 text-[#52615b]">
        Seleziona solo le aziende di cui hai controllato identità, evidenze e assenza di dati personali.
        Sono escluse fonti non approvate, corrispondenze con aziende esistenti, conflitti e candidati già revisionati.
        Massimo 50 per operazione; nessuna pubblicazione o fusione nel Network.
      </p>
      <p className="mt-2 text-xs font-semibold text-[#52615b]">
        {available.length} candidati selezionabili nella coda corrente
        {candidates.length > 50 ? " · primi 50 disponibili" : ""}
      </p>

      {available.length === 0 ? (
        <p className="mt-4 rounded-xl border border-[#d7e5dc] bg-white p-4 text-sm text-[#52615b]">
          Nessun candidato idoneo al Bulk Approve in questa pagina. Usa la review individuale per le eccezioni.
        </p>
      ) : (
        <form action={action} className="mt-4 space-y-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-[#173f35]">
            <input type="checkbox" checked={allSelected}
              onChange={e => { setSelected(e.target.checked ? available.map(item => item.id) : []); setConfirming(false); setAttested(false); }}
              className="h-4 w-4 accent-[#173f35]" />
            Seleziona tutti gli idonei visibili ({available.length})
          </label>
          <div className="max-h-80 space-y-2 overflow-auto" role="group" aria-label="Candidati selezionabili per approvazione">
            {available.map(candidate => (
              <label key={candidate.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#d7e5dc] bg-white p-3">
                <input type="checkbox" name="candidate_id" value={candidate.id}
                  checked={selected.includes(candidate.id)}
                  onChange={e => setChecked(candidate.id, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-[#173f35]" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#1d2824]">{candidate.name}</span>
                  <span className="block break-all text-xs text-[#52615b]">{candidate.domain}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={selected.length === 0} onClick={() => setConfirming(true)}
              className="min-h-11 rounded-xl border border-[#173f35] px-4 py-2 text-sm font-semibold text-[#173f35] disabled:cursor-not-allowed disabled:opacity-50">
              Revisiona selezione ({selected.length})
            </button>
            <span role="status" className="text-sm text-[#52615b]">{selected.length} / 50 selezionati</span>
          </div>

          {confirming && selected.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-[#aabfb2] bg-white p-4">
              <p className="text-sm font-semibold text-[#173f35]">Conferma umana obbligatoria: {selected.length} candidati</p>
              <p className="text-xs leading-5 text-[#52615b]">
                Il server ricontrollerà diritti della fonte, evidenze, stato, qualità e possibili identità duplicate.
                I non idonei saranno esclusi e mostrati nel riepilogo. Ogni approvazione sarà registrata singolarmente nell’audit immutabile.
              </p>
              <label className="block text-sm font-medium text-[#1d2824]">
                Motivazione della verifica (minimo 12 caratteri)
                <textarea name="note" required minLength={12} maxLength={1000} rows={2}
                  value={note} onChange={e => setNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#aabfb2] p-3 text-sm" placeholder="Ho esaminato le evidenze societarie e la fonte autorizzata." />
              </label>
              <label className="flex items-start gap-3 text-sm text-[#173f35]">
                <input name="attested" type="checkbox" checked={attested} onChange={e => setAttested(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[#173f35]" required />
                Confermo di aver verificato che i candidati selezionati contengano esclusivamente dati societari e che la fonte ne consenta il riutilizzo.
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <ConfirmSubmit count={selected.length} ready={attested && validNote} />
                <button type="button" onClick={() => { setConfirming(false); setAttested(false); }}
                  className="min-h-11 rounded-xl border px-4 text-sm font-semibold text-[#52615b]">
                  Annulla
                </button>
              </div>
            </div>
          ) : null}
        </form>
      )}
    </section>
  );
}
