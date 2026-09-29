import Link from "next/link";
import { notFound } from "next/navigation";

import {
  addMarketplaceRequestLine,
  publishMarketplaceRequest,
  removeMarketplaceRequestLine,
  updateMarketplaceRequest,
  withdrawMarketplaceRequest,
} from "@/app/(workspace)/marketplace/actions";
import { canWriteWorkspace } from "@/lib/access-policy";
import {
  getMarketplaceRequest,
  getMarketplaceTaxonomy,
  type MarketplaceRequestLine,
} from "@/lib/marketplace";
import { appRoutes } from "@/lib/routes";
import { getWorkspaceContext } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function numberLabel(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 3 }).format(value);
}

function lineSpecification(line: MarketplaceRequestLine) {
  const pieces = [
    line.standard_code,
    line.grade_designation,
    line.outer_diameter_mm != null ? "Ø " + numberLabel(line.outer_diameter_mm) : null,
    line.width_mm != null ? numberLabel(line.width_mm) : null,
    line.height_mm != null ? "× " + numberLabel(line.height_mm) : null,
    line.thickness_mm != null ? "sp. " + numberLabel(line.thickness_mm) : null,
    line.length_mm != null ? "L " + numberLabel(line.length_mm) + " mm" : null,
  ].filter(Boolean);
  return pieces.join(" · ") || "Specifica tecnica da completare";
}

function statusText(status: string) {
  if (status === "published") return "Pubblicata";
  if (status === "withdrawn") return "Ritirata";
  return "Bozza";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function MarketplaceRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ id }, { error, message }, context, taxonomy] = await Promise.all([
    params,
    searchParams,
    getWorkspaceContext(),
    getMarketplaceTaxonomy(),
  ]);

  const detail = await getMarketplaceRequest(id);
  if (!detail) notFound();

  const request = detail.request;
  const canWrite = canWriteWorkspace(context.role);
  const editable = canWrite && request.status === "draft";
  const withdrawable = canWrite && (request.status === "draft" || request.status === "published");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href={appRoutes.marketplace.home}
        className="text-sm font-semibold text-[#66736e] hover:text-[#173f35]"
      >
        ← Torna al Marketplace
      </Link>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#edf5f2] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#173f35]">
                {statusText(request.status)}
              </span>
              <span className="rounded-full bg-[#f2f4f3] px-2.5 py-1 text-[10px] font-semibold text-[#66736e]">
                {request.visibility_mode === "anonymous" ? "Anonima" : "Azienda visibile"}
              </span>
              {request.status === "published" ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                  Feed supplier P5.2
                </span>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#1d2824]">
              {request.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              {request.status === "draft"
                ? "Completa le linee prodotto e pubblica esplicitamente quando la ricerca è pronta."
                : request.status === "published"
                  ? "La ricerca è pubblicata. In P5.2 i supplier vedono solo il teaser privacy-safe; i dettagli completi restano locked."
                  : "La ricerca è stata ritirata e resta conservata nello storico audit."}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] px-4 py-3 text-xs text-[#66736e]">
            <p><strong className="text-[#43524c]">Apertura:</strong> {formatDate(request.opens_at)}</p>
            <p className="mt-1"><strong className="text-[#43524c]">Scadenza:</strong> {formatDate(request.closes_at)}</p>
          </div>
        </div>
      </section>

      {editable ? (
        <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <form action={updateMarketplaceRequest} className="rounded-2xl border border-[#dce2df] bg-white p-5">
            <input type="hidden" name="request_id" value={request.id} />
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b8782]">Impostazioni</p>
            <div className="mt-4">
              <label className="text-xs font-semibold text-[#66736e]">Titolo</label>
              <input
                name="title"
                required
                minLength={5}
                maxLength={200}
                defaultValue={request.title}
                className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm outline-none focus:border-[#438d7a] focus:ring-4 focus:ring-[#e1ece8]"
              />
            </div>
            <div className="mt-4">
              <label className="text-xs font-semibold text-[#66736e]">Visibilità buyer</label>
              <select
                name="visibility_mode"
                defaultValue={request.visibility_mode}
                className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm outline-none"
              >
                <option value="named">Azienda visibile</option>
                <option value="anonymous">Anonima</option>
              </select>
            </div>
            <button className="mt-4 rounded-xl border border-[#b8d2c8] bg-[#edf5f2] px-4 py-2.5 text-sm font-semibold text-[#173f35] hover:bg-[#e1ece8]">
              Salva impostazioni
            </button>
          </form>

          <form action={publishMarketplaceRequest} className="rounded-2xl border border-[#d9e8e2] bg-[#f3f7f5] p-5">
            <input type="hidden" name="request_id" value={request.id} />
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">Pubblicazione</p>
            <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">Imposta la durata</h2>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Il countdown è autoritativo lato database. P5.1 consente da 1 a 30 giorni;
              il feed supplier usa il teaser privacy-safe P5.2; unlock e dettagli completi arrivano in P5.3.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="text-xs font-semibold text-[#66736e]">Durata</label>
                <select
                  name="duration_days"
                  defaultValue="7"
                  className="mt-2 h-11 w-full rounded-xl border border-[#c8d5d0] bg-white px-3 text-sm outline-none"
                >
                  <option value="1">1 giorno</option>
                  <option value="3">3 giorni</option>
                  <option value="7">7 giorni</option>
                  <option value="14">14 giorni</option>
                  <option value="30">30 giorni</option>
                </select>
              </div>
              <button
                disabled={detail.lines.length === 0}
                className="h-11 rounded-xl bg-[#1a5144] px-5 text-sm font-semibold text-white hover:bg-[#226657] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pubblica ricerca
              </button>
            </div>
            {detail.lines.length === 0 ? (
              <p className="mt-3 text-xs font-semibold text-amber-700">
                Aggiungi almeno una linea prodotto prima di pubblicare.
              </p>
            ) : null}
          </form>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b8782]">Richiesta strutturata</p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Linee prodotto · {detail.lines.length}
            </h2>
          </div>
        </div>

        {detail.lines.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#c8d5d0] bg-white p-6 text-sm text-[#66736e]">
            Nessuna linea prodotto. La richiesta non può essere pubblicata finché non ne aggiungi almeno una.
          </div>
        ) : (
          <div className="space-y-3">
            {detail.lines.map((line) => (
              <article key={line.id} className="rounded-2xl border border-[#dce2df] bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#173f35]">
                      Pos. {line.line_number} · {line.product_family_name}
                    </p>
                    <h3 className="mt-2 font-semibold text-[#1d2824]">{lineSpecification(line)}</h3>
                    <p className="mt-2 text-sm text-[#66736e]">
                      Quantità: <strong className="text-[#43524c]">{numberLabel(line.quantity)} {line.quantity_unit}</strong>
                      {" · "}Consegna: <strong className="text-[#43524c]">{line.delivery_country_code}{line.delivery_region ? " · " + line.delivery_region : ""}</strong>
                    </p>
                    {line.requested_delivery_date ? (
                      <p className="mt-1 text-xs text-[#7b8782]">Data richiesta: {line.requested_delivery_date}</p>
                    ) : null}
                    {line.certification ? (
                      <p className="mt-1 text-xs text-[#7b8782]">Certificazione: {line.certification}</p>
                    ) : null}
                    {line.notes ? (
                      <p className="mt-3 text-sm leading-6 text-[#66736e]">{line.notes}</p>
                    ) : null}
                  </div>
                  {editable ? (
                    <form action={removeMarketplaceRequestLine}>
                      <input type="hidden" name="request_id" value={request.id} />
                      <input type="hidden" name="line_id" value={line.id} />
                      <button className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                        Rimuovi
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {editable ? (
        <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#173f35]">Aggiungi linea</p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">Specifica il prodotto richiesto</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            Famiglia prodotto, norma e grado usano le tassonomie governate di Network e Scuola.
            Le combinazioni tecniche vengono validate anche lato database.
          </p>

          <form action={addMarketplaceRequestLine} className="mt-6 space-y-6">
            <input type="hidden" name="request_id" value={request.id} />

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Famiglia prodotto *</label>
                <select name="product_family_key" required className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm">
                  <option value="">Seleziona</option>
                  {taxonomy.product_families.map((item) => (
                    <option key={item.id} value={item.key}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Norma</label>
                <select name="standard_id" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm">
                  <option value="">Non specificata</option>
                  {taxonomy.standards.map((item) => (
                    <option key={item.id} value={item.id}>{item.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Grado / materiale</label>
                <select name="material_grade_id" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm">
                  <option value="">Non specificato</option>
                  {taxonomy.grades.map((item) => (
                    <option key={item.standard_id + ":" + item.material_grade_id} value={item.material_grade_id}>
                      {item.standard_code} · {item.designation}{item.material_number ? " · " + item.material_number : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Processo produttivo</label>
                <select name="manufacturing_process" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm">
                  <option value="">Non specificato</option>
                  <option value="welded">Saldato</option>
                  <option value="seamless">Senza saldatura</option>
                  <option value="electric_welded">Saldato elettricamente</option>
                  <option value="submerged_arc_welded">SAW</option>
                  <option value="cold_formed">Formato a freddo</option>
                  <option value="hot_finished">Finito a caldo</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Certificazione</label>
                <input name="certification" maxLength={200} placeholder="Es. EN 10204 3.1" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Data consegna richiesta</label>
                <input name="requested_delivery_date" type="date" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm" />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#66736e]">Dimensioni mm</p>
              <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {[
                  ["outer_diameter_mm", "Diametro esterno"],
                  ["width_mm", "Larghezza"],
                  ["height_mm", "Altezza"],
                  ["thickness_mm", "Spessore"],
                  ["length_mm", "Lunghezza"],
                ].map(([name, label]) => (
                  <div key={name}>
                    <label className="text-[11px] text-[#87938e]">{label}</label>
                    <input name={name} type="number" min="0.001" step="0.001" className="mt-1 h-10 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm" />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Quantità *</label>
                <input name="quantity" required type="number" min="0.001" step="0.001" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Unità *</label>
                <select name="quantity_unit" required defaultValue="t" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm">
                  <option value="t">t</option>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                  <option value="pcs">pezzi</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Paese consegna *</label>
                <input name="delivery_country_code" required minLength={2} maxLength={2} defaultValue="IT" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm uppercase" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#66736e]">Area / regione</label>
                <input name="delivery_region" maxLength={120} placeholder="Es. Piemonte" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#66736e]">Note tecniche</label>
              <textarea name="notes" maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border border-[#d7dfdb] px-3 py-3 text-sm leading-6" />
            </div>

            <button className="rounded-xl bg-[#1a5144] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#226657]">
              Aggiungi linea
            </button>
          </form>
        </section>
      ) : null}

      {withdrawable ? (
        <section className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
          <h2 className="text-sm font-semibold text-rose-900">Ritira ricerca</h2>
          <p className="mt-1 text-xs leading-5 text-rose-700">
            Il ritiro è definitivo in P5.1 e viene registrato nell’audit ledger.
          </p>
          <form action={withdrawMarketplaceRequest} className="mt-3">
            <input type="hidden" name="request_id" value={request.id} />
            <button className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">
              Ritira
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
