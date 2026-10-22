import Link from "next/link";

import { appendCommercialRelationshipEvent, confirmCommercialRelationship } from "@/app/(workspace)/commercial/relationship-ledger-actions";
import type { CommercialRelationshipState } from "@/lib/commercial-relationship-ledger";
import { appRoutes } from "@/lib/routes";

const eventNames: Record<string, string> = {
  created: "Relazione creata",
  note: "Nota",
  call: "Telefonata",
  meeting: "Incontro",
  follow_up: "Promemoria di follow-up",
};
function dateLabel(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Data non disponibile"
    : new Intl.DateTimeFormat("it-IT", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome",
      }).format(d);
}

/** C4B — org-shared, permission-aware and append-only. No client-side write on load. */
export function CommercialRelationshipLedger({
  networkCompanyId, name, state, canWrite, feedback,
}: {
  networkCompanyId: string;
  name: string;
  state: CommercialRelationshipState;
  canWrite: boolean;
  feedback?: string;
}) {
  const relationship = state.relationship;
  return (
    <section
      id="commercial-relationship-ledger"
      aria-labelledby="commercial-relationship-title"
      data-testid="commercial-relationship-ledger"
      className="mt-3 min-w-0 scroll-mt-24 rounded-xl border border-[#bdd8c8] bg-white p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#246c53]">Commercial Relationship Intelligence</p>
          <h3 id="commercial-relationship-title" className="mt-0.5 text-sm font-semibold text-[#173f35]">
            Relazione condivisa nel workspace
          </h3>
          <p className="mt-0.5 text-xs leading-5 text-[#52615b]">
            {name} · Note e attività visibili ai colleghi della stessa organizzazione.
            Il Network pubblico e la Company 360 verificata restano identità distinte.
          </p>
        </div>
        <Link href={appRoutes.commercial.home + "?relationships=1#commercial-relationships"}
          className="inline-flex min-h-10 items-center text-xs font-semibold text-[#175640] underline underline-offset-4"
        >Relazioni del team →</Link>
      </div>
      {feedback === "created" || feedback === "existing" || feedback === "logged" ? (
        <p role="status" className="mt-2 rounded-lg bg-[#eaf6ee] px-3 py-2 text-xs text-[#175640]">
          {feedback === "created" ? "Relazione creata e registrata nello storico."
            : feedback === "logged" ? "Attività registrata nel ledger aziendale."
              : "La relazione esiste già: nessun duplicato creato."}
        </p>
      ) : feedback === "invalid" || feedback === "denied" || feedback === "unavailable" ? (
        <p role="alert" className="mt-2 text-xs text-[#945321]">
          Operazione non eseguita: verifica dati, permessi o disponibilità del Network.
        </p>
      ) : null}
      {state.status === "unavailable" ? (
        <p role="status" className="mt-2 text-xs text-[#75582a]">
          Il registro non è disponibile. Nessun dato è stato creato o modificato.
        </p>
      ) : !relationship ? (
        <div className="mt-2 rounded-lg border border-[#dce9df] bg-[#f9fcfa] px-3 py-3">
          <p className="text-xs leading-5 text-[#52615b]">
            Non esiste ancora una relazione condivisa con questa azienda.
            La creazione non produce automaticamente contatti, email, RFQ o associazioni Company 360.
          </p>
          {canWrite ? (
            <form action={confirmCommercialRelationship} className="mt-2 flex flex-col items-start gap-2">
              <input type="hidden" name="network_company_id" value={networkCompanyId} />
              <label className="flex items-start gap-2 text-xs leading-5 text-[#52615b]">
                <input type="checkbox" name="confirm_relationship" value="yes" required
                  className="mt-1 h-4 w-4 shrink-0 accent-[#175640]" />
                Confermo che questa relazione sarà visibile ai colleghi della mia azienda.
              </label>
              <button type="submit"
                className="inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-3 text-xs font-semibold text-white hover:bg-[#246c53] focus-visible:outline-2 focus-visible:outline-offset-2">
                Crea relazione condivisa
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-[#52615b]">Sola lettura: un commerciale autorizzato può creare la relazione.</p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f2f9f4] px-3 py-2">
            <p className="text-xs font-semibold text-[#175640]">Relazione attiva nel workspace</p>
            <p className="text-[11px] text-[#52615b]">Dal {dateLabel(relationship.createdAt)}</p>
          </div>
          {canWrite ? (
            <form action={appendCommercialRelationshipEvent} className="grid gap-2 sm:grid-cols-[160px_1fr]" data-testid="commercial-ledger-append">
              <input type="hidden" name="network_company_id" value={networkCompanyId} />
              <label className="space-y-1">
                <span className="text-xs font-medium text-[#173f35]">Attività</span>
                <select name="event_type" required defaultValue="note"
                  className="min-h-10 w-full rounded-lg border border-[#c9dacd] bg-white px-2 text-xs text-[#173f35]">
                  <option value="note">Nota</option>
                  <option value="call">Telefonata</option>
                  <option value="meeting">Incontro</option>
                  <option value="follow_up">Follow-up</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-[#173f35]">Dettaglio registrato</span>
                <textarea name="note" required minLength={1} maxLength={1200} rows={2}
                  placeholder="Es. Valutare disponibilità tubi strutturali per il prossimo progetto"
                  className="min-h-16 w-full resize-y rounded-lg border border-[#c9dacd] bg-white px-3 py-2 text-xs leading-5 text-[#173f35]" />
              </label>
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-[#52615b]">
                  <input name="confirm_activity" value="yes" type="checkbox" required className="h-4 w-4 accent-[#175640]" />
                  Confermo il salvataggio nel registro condiviso.
                </label>
                <button type="submit"
                  className="inline-flex min-h-10 items-center rounded-lg bg-[#175640] px-3 text-xs font-semibold text-white hover:bg-[#246c53] focus-visible:outline-2 focus-visible:outline-offset-2">
                  Registra attività
                </button>
              </div>
            </form>
          ) : <p className="text-xs text-[#52615b]">Registro consultabile: il tuo ruolo non permette modifiche.</p>}
          <section aria-label="Cronologia della relazione" className="rounded-lg border border-[#e0ece3] px-3 py-2">
            <h4 className="text-xs font-semibold text-[#173f35]">Ultime attività</h4>
            {relationship.events.length > 0 ? (
              <ol className="mt-1 divide-y divide-[#e6eee8]">
                {relationship.events.map((event) => (
                  <li key={event.id} className="min-w-0 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#607269]">
                      <span className="font-semibold text-[#246c53]">{eventNames[event.kind] ?? "Attività"}</span>
                      <time dateTime={event.createdAt}>{dateLabel(event.createdAt)}</time>
                    </div>
                    {event.note ? <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-5 text-[#3a5145]">{event.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : <p className="mt-2 text-xs text-[#52615b]">Non sono ancora disponibili attività.</p>}
            <p className="mt-2 text-[10px] text-[#64746a]">
              Registro append-only: le voci non sono modificabili né cancellabili dagli utenti. Mostriamo le ultime 15.
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
