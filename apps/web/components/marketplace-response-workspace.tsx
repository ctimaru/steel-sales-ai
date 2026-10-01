import Link from "next/link";
import {
  createMarketplaceResponse,
  removeMarketplaceResponseLine,
  submitMarketplaceResponse,
  updateMarketplaceResponse,
  upsertMarketplaceResponseLine,
  withdrawMarketplaceResponse,
} from "@/app/(workspace)/marketplace/actions";
import type {
  MarketplaceSupplierWorkspace,
  MarketplaceUnlockedLine,
} from "@/lib/marketplace";
import { appRoutes } from "@/lib/routes";

function statusLabel(status: string) {
  if (status === "draft") return "Bozza";
  if (status === "submitted") return "Inviata";
  if (status === "acknowledged") return "Presa in carico";
  if (status === "declined") return "Declinata";
  if (status === "withdrawn") return "Ritirata";
  if (status === "closed") return "Chiusa";
  return status;
}

function reasonLabel(reason: string) {
  if (reason === "rate_limited") {
    return "Limite risposte raggiunto. Riprova quando la finestra anti-spam si riapre.";
  }
  if (reason === "request_not_open") {
    return "La ricerca non è più aperta: la bozza resta nello storico ma non può essere modificata o inviata.";
  }
  if (reason === "entitlement_required") {
    return "L’entitlement non è più attivo: la bozza resta nello storico ma non può essere modificata o inviata.";
  }
  if (reason === "unlock_required") {
    return "Prima di rispondere devi aprire almeno una volta il dettaglio governato dell’opportunità.";
  }
  return "Il diritto di risposta non è disponibile per questa opportunità.";
}

function reasonAction(reason: string, requestId: string) {
  if (reason === "request_not_open") {
    return {
      href: appRoutes.marketplace.home,
      label: "Torna alle opportunità aperte",
    };
  }
  if (reason === "entitlement_required") {
    return {
      href: appRoutes.marketplace.notifications,
      label: "Apri opportunità per te",
    };
  }
  if (reason === "unlock_required") {
    return {
      href: appRoutes.marketplace.opportunity(requestId),
      label: "Riapri il dettaglio opportunità",
    };
  }
  if (reason === "rate_limited") {
    return {
      href: appRoutes.marketplace.responses,
      label: "Apri le risposte Marketplace",
    };
  }
  return {
    href: appRoutes.marketplace.home,
    label: "Torna al Demand Board",
  };
}

function numberLabel(value: number | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 3,
  }).format(value);
}

function lineTitle(
  requestLine: MarketplaceSupplierWorkspace["request_lines"][number],
  unlockedLines: MarketplaceUnlockedLine[],
) {
  const line = unlockedLines.find(
    (item) => item.line_number === requestLine.line_number,
  );
  return line?.product_family_name ?? "Posizione " + requestLine.line_number;
}

export function MarketplaceResponseWorkspace({
  requestId,
  workspace,
  unlockedLines,
}: {
  requestId: string;
  workspace: MarketplaceSupplierWorkspace;
  unlockedLines: MarketplaceUnlockedLine[];
}) {
  const { rights, response } = workspace;

  if (!response && rights.can_create) {
    return (
      <section className="rounded-3xl border border-[#b8d2c8] bg-[#f3f7f5] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
          P5.4 · Governed response
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
          Rispondi al buyer
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
          Il diritto di risposta è stato verificato lato server: listing aperta,
          entitlement attivo e dettaglio già sbloccato. Per una richiesta anonima
          l’identità del buyer resta protetta durante tutto questo workflow.
        </p>

        <form action={createMarketplaceResponse} className="mt-6 space-y-4">
          <input type="hidden" name="request_id" value={requestId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-[#66736e]">
                Tipo risposta
              </label>
              <select
                name="response_kind"
                defaultValue="interest"
                className="mt-2 h-11 w-full rounded-xl border border-[#c8d5d0] bg-white px-3 text-sm"
              >
                <option value="interest">Manifestazione di interesse</option>
                <option value="quote">Quotazione strutturata</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#66736e]">
                Valida fino al
              </label>
              <input
                name="valid_until"
                type="date"
                className="mt-2 h-11 w-full rounded-xl border border-[#c8d5d0] bg-white px-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#66736e]">
              Messaggio commerciale
            </label>
            <textarea
              name="message"
              maxLength={4000}
              rows={5}
              placeholder="Disponibilità, condizioni indicative o informazioni utili al buyer…"
              className="mt-2 w-full rounded-xl border border-[#c8d5d0] bg-white px-3 py-3 text-sm leading-6"
            />
          </div>
          <button className="rounded-xl bg-[#1a5144] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#226657]">
            Crea bozza risposta
          </button>
        </form>
      </section>
    );
  }

  if (!response) {
    const action = reasonAction(rights.reason, requestId);
    return (
      <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
          Response blocker
        </p>
        <p className="mt-2 text-sm font-semibold text-amber-950">
          Risposta non disponibile
        </p>
        <p className="mt-1 text-sm leading-6 text-amber-800">
          {reasonLabel(rights.reason)}
        </p>
        <Link
          href={action.href}
          className="mt-4 inline-flex rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-50"
        >
          {action.label}
        </Link>
      </section>
    );
  }

  const editable = rights.can_edit && response.status === "draft";

  return (
    <section className="rounded-3xl border border-[#b8d2c8] bg-white p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            P5.4 · La tua risposta
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            {response.response_kind === "quote"
              ? "Quotazione Marketplace"
              : "Manifestazione di interesse"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Questa risposta appartiene alla tua organizzazione ed è separata dalle
            offerte private della Commercial Memory.
          </p>
        </div>
        <span className="rounded-full bg-[#edf5f2] px-3 py-1.5 text-xs font-bold text-[#173f35]">
          {statusLabel(response.status)}
        </span>
      </div>

      {editable ? (
        <>
          <form action={updateMarketplaceResponse} className="mt-6 rounded-2xl border border-[#e2e7e4] bg-[#f8faf9] p-5">
            <input type="hidden" name="request_id" value={requestId} />
            <input type="hidden" name="response_id" value={response.response_id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[#66736e]">
                  Tipo risposta
                </label>
                <select
                  name="response_kind"
                  defaultValue={response.response_kind}
                  className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                >
                  <option value="interest">Manifestazione di interesse</option>
                  <option value="quote">Quotazione strutturata</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736e]">
                  Valida fino al
                </label>
                <input
                  name="valid_until"
                  type="date"
                  defaultValue={response.valid_until ?? ""}
                  className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold text-[#66736e]">
                Messaggio commerciale
              </label>
              <textarea
                name="message"
                maxLength={4000}
                rows={4}
                defaultValue={response.message ?? ""}
                className="mt-2 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 py-3 text-sm leading-6"
              />
            </div>
            <button className="mt-4 rounded-xl border border-[#b8d2c8] bg-white px-4 py-2.5 text-sm font-semibold text-[#173f35] hover:bg-[#edf5f2]">
              Salva bozza
            </button>
          </form>

          <div className="mt-6 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#7b8782]">
                Risposta per linea
              </p>
              <p className="mt-1 text-sm text-[#66736e]">
                Per inviare una quotazione serve almeno una linea con prezzo.
              </p>
            </div>

            {workspace.request_lines.map((requestLine) => {
              const existing = response.lines.find(
                (item) => item.request_line_id === requestLine.request_line_id,
              );

              return (
                <form
                  key={requestLine.request_line_id}
                  action={upsertMarketplaceResponseLine}
                  className="rounded-2xl border border-[#e2e7e4] bg-[#f8faf9] p-5"
                >
                  <input type="hidden" name="request_id" value={requestId} />
                  <input type="hidden" name="response_id" value={response.response_id} />
                  <input
                    type="hidden"
                    name="request_line_id"
                    value={requestLine.request_line_id}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1d2824]">
                      Pos. {requestLine.line_number} ·{" "}
                      {lineTitle(requestLine, unlockedLines)}
                    </p>
                    <span className="text-xs font-semibold text-[#66736e]">
                      Richiesta: {numberLabel(requestLine.quantity)}{" "}
                      {requestLine.quantity_unit}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="text-[11px] font-semibold text-[#7b8782]">
                        Quantità offerta
                      </label>
                      <input
                        name="offered_quantity"
                        type="number"
                        min="0.001"
                        step="0.001"
                        defaultValue={existing?.offered_quantity ?? ""}
                        className="mt-1 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#7b8782]">
                        Unità
                      </label>
                      <select
                        name="quantity_unit"
                        defaultValue={existing?.quantity_unit ?? requestLine.quantity_unit}
                        className="mt-1 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                      >
                        <option value="t">t</option>
                        <option value="kg">kg</option>
                        <option value="m">m</option>
                        <option value="pcs">pezzi</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#7b8782]">
                        Prezzo unitario
                      </label>
                      <input
                        name="unit_price"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={existing?.unit_price ?? ""}
                        className="mt-1 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#7b8782]">
                        Valuta
                      </label>
                      <input
                        name="currency_code"
                        maxLength={3}
                        defaultValue={existing?.currency_code ?? "EUR"}
                        className="mt-1 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#7b8782]">
                        Lead time giorni
                      </label>
                      <input
                        name="lead_time_days"
                        type="number"
                        min="0"
                        max="3650"
                        defaultValue={existing?.lead_time_days ?? ""}
                        className="mt-1 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#7b8782]">
                        Data consegna
                      </label>
                      <input
                        name="offered_delivery_date"
                        type="date"
                        defaultValue={existing?.offered_delivery_date ?? ""}
                        className="mt-1 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-semibold text-[#7b8782]">
                        Note linea
                      </label>
                      <input
                        name="notes"
                        maxLength={2000}
                        defaultValue={existing?.notes ?? ""}
                        className="mt-1 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="rounded-xl bg-[#1a5144] px-4 py-2 text-xs font-semibold text-white hover:bg-[#226657]">
                      Salva linea
                    </button>
                    {existing ? (
                      <button
                        formAction={removeMarketplaceResponseLine}
                        className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Rimuovi linea
                      </button>
                    ) : null}
                  </div>
                </form>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <form action={submitMarketplaceResponse}>
              <input type="hidden" name="request_id" value={requestId} />
              <input type="hidden" name="response_id" value={response.response_id} />
              <button className="rounded-xl bg-[#1a5144] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#226657]">
                Invia risposta al buyer
              </button>
            </form>
            <form action={withdrawMarketplaceResponse}>
              <input type="hidden" name="request_id" value={requestId} />
              <input type="hidden" name="response_id" value={response.response_id} />
              <button className="rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                Ritira bozza
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          {response.message ? (
            <div className="mt-5 rounded-2xl border border-[#e2e7e4] bg-[#f8faf9] p-4 text-sm leading-6 text-[#66736e]">
              {response.message}
            </div>
          ) : null}

          {response.lines.length > 0 ? (
            <div className="mt-5 space-y-3">
              {response.lines.map((line) => (
                <div
                  key={line.request_line_id}
                  className="rounded-2xl border border-[#e2e7e4] bg-[#f8faf9] p-4"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#173f35]">
                    Pos. {line.line_number}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[#43524c]">
                    {line.offered_quantity != null
                      ? numberLabel(line.offered_quantity) + " " + (line.quantity_unit ?? "")
                      : "Quantità non specificata"}
                    {line.unit_price != null
                      ? " · " + numberLabel(line.unit_price) + " " + (line.currency_code ?? "")
                      : ""}
                  </p>
                  {line.lead_time_days != null ? (
                    <p className="mt-1 text-xs text-[#87938e]">
                      Lead time: {line.lead_time_days} giorni
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {rights.can_withdraw ? (
            <form action={withdrawMarketplaceResponse} className="mt-5">
              <input type="hidden" name="request_id" value={requestId} />
              <input type="hidden" name="response_id" value={response.response_id} />
              <button className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                Ritira risposta
              </button>
            </form>
          ) : null}

          {response.status === "draft" && !rights.can_edit ? (() => {
            const action = reasonAction(rights.reason, requestId);
            return (
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
                <p className="text-sm text-amber-800">
                  {reasonLabel(rights.reason)}
                </p>
                <Link
                  href={action.href}
                  className="mt-3 inline-flex text-sm font-semibold text-amber-900 hover:underline"
                >
                  {action.label} →
                </Link>
              </div>
            );
          })() : null}
        </>
      )}
    </section>
  );
}
