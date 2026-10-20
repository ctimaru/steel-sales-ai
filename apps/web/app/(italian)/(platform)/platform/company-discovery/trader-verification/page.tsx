import Link from "next/link";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { recordTraderReview } from "./actions";

export const dynamic = "force-dynamic";

const COUNTRY_CODES = [
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU",
  "IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK",
];
const GATES = [
  ["legal_identity","Identità legale"],
  ["trader_role","Ruolo commerciante"],
  ["product_evidence","Prodotti e norme"],
  ["domain_reconciliation","Domini e gruppi"],
  ["reuse_rights","Diritti di riuso"],
  ["facility_source","Sedi e magazzini"],
] as const;
type Decision = "accepted" | "hold" | "rejected";
type ListItem = {
  id: string; name: string; market: string; domain: string;
  source_url: string; research_state: string; source_rights: string;
  domain_collision_count: number;
  reviews: Partial<Record<(typeof GATES)[number][0], Decision>>;
};
type ReviewHistory = {
  dimension: string; decision: Decision; note: string;
  evidence_url: string | null; recorded_at: string;
  legal_name: string | null; legal_country: string | null;
  permission_basis: string | null; permission_scope: string | null;
};
type Selected = {
  id: string; name: string; market: string; domain: string;
  legal_name: string | null; legal_country: string | null;
  legal_identity_evidence_url: string | null;
  official_website: string; role_evidence_url: string;
  product_evidence_url: string | null; product_evidence_summary: string | null;
  research_state: string; source_rights: string; research_note: string | null;
  facilities: Array<{
    city: string; country: string; type: string; source_url: string; state: string;
  }>;
  history: ReviewHistory[];
};
type Payload = {
  contract: "trader1d2-superadmin-v1"; scope: "private_research_only";
  total: number; limit: number; offset: number; country: string | null;
  published_by_trader1d2: 0; items: ListItem[]; selected: Selected | null;
};
function url(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.toString() : null;
  } catch { return null; }
}
function statusLabel(value: string | null | undefined) {
  return value === "accepted" ? "Accettata" : value === "hold" ? "Sospesa"
    : value === "rejected" ? "Respinta" : "Da verificare";
}
function statusStyle(value: string | null | undefined) {
  return value === "accepted"
    ? "border-[#b9d9c8] bg-[#ecf6ef] text-[#174c35]"
    : value === "rejected"
    ? "border-[#e7c8c8] bg-[#fff5f5] text-[#8b2323]"
    : "border-[#e8d9b6] bg-[#fffaf0] text-[#6e521b]";
}
function href(country: string, page: number, id?: string) {
  const qs = new URLSearchParams();
  if (country) qs.set("country",country);
  if (page !== 1) qs.set("page",String(page));
  if (id) qs.set("id",id);
  const query = qs.toString();
  return "/platform/company-discovery/trader-verification" + (query ? `?${query}` : "");
}
function ExternalEvidence({ value, label }: { value: string | null | undefined; label: string }) {
  const safe = url(value);
  return safe
    ? <a href={safe} target="_blank" rel="noopener noreferrer"
      className="text-sm font-semibold text-[#175640] underline underline-offset-4 break-all">
      {label} ↗ <span className="sr-only">(apre nuova scheda)</span></a>
    : <span className="text-sm text-[#6b7771]">{label}: non documentata</span>;
}

export default async function TraderVerificationConsole({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; page?: string; id?: string; message?: string; error?: string }>;
}) {
  // Strict owner-only before any research read. Never rely on menu visibility.
  await requirePlatformSuperadmin();
  const params = await searchParams;
  const country = COUNTRY_CODES.includes(params.country ?? "") ? params.country! : "";
  const requestedPage = params.page && /^\d{1,3}$/.test(params.page)
    ? Math.min(400, Math.max(1,Number(params.page))) : 1;
  const id = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(params.id ?? "")
    ? params.id! : null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("trader1d2_superadmin_queue", {
    p_limit: 25, p_offset: (requestedPage - 1) * 25,
    p_country: country || null, p_research_id: id,
  });
  const value = !error && data && typeof data === "object" ? data as Payload : null;
  const available = value?.contract === "trader1d2-superadmin-v1"
    && value.scope === "private_research_only"
    && value.published_by_trader1d2 === 0
    && Number.isInteger(value.total) && value.total >= 0
    && Array.isArray(value.items) && value.items.length <= 25;
  const snapshot = available ? value : null;
  const pageCount = snapshot ? Math.max(1,Math.ceil(snapshot.total/25)) : 1;
  const items = snapshot && requestedPage <= pageCount ? snapshot.items : [];
  const selected = snapshot?.selected ?? null;
  const currentItem = items.find((item) => item.id === selected?.id);
  const decisions = currentItem?.reviews ?? Object.fromEntries(
    (selected?.history ?? []).slice().reverse().map(h => [h.dimension,h.decision])
  );
  const completedGates = GATES.filter(([key]) => decisions[key] === "accepted").length;

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-4 px-3 py-4 sm:px-5 sm:py-6"
      data-testid="trader1d2-superadmin-console">
      <div className="flex items-center justify-between gap-3">
        <Link href="/platform/company-discovery"
          className="text-sm font-semibold text-[#175640] underline underline-offset-4">
          ← Discovery aziende</Link>
        <span className="rounded-full border border-[#d3ded7] bg-white px-3 py-1 text-xs font-bold text-[#204c3b]">
          Accesso esclusivo Superadmin</span>
      </div>
      <header className="rounded-2xl border border-[#d7e5da] bg-white p-4 sm:p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#175640]">
          TRADER1D.2 · European Trader Intelligence
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#183e33] sm:text-3xl">
              Verifica aziende · Commercianti UE
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52635b]">
              Esamina dossier e fonti ufficiali, registra una decisione umana per ogni criterio.
              Le schede restano ricerca privata: approvare un&apos;evidenza non verifica,
              non pubblica e non abilita un&apos;azienda agli RFQ.
            </p>
          </div>
          <div className="rounded-xl border border-[#d5e4dc] bg-[#f3f9f5] px-4 py-3">
            <p className="text-xs text-[#52635b]">Dossier nel filtro</p>
            <p className="text-2xl font-bold tabular-nums text-[#174c35]">
              {snapshot ? snapshot.total.toLocaleString("it-IT") : "—"}
            </p>
            <p className="text-xs text-[#52635b]">0 pubblicati da TRADER1D.2</p>
          </div>
        </div>
      </header>

      {!snapshot ? (
        <section role="alert" className="rounded-2xl border border-[#dec8aa] bg-[#fffaf2] p-5 text-sm text-[#6b4a21]">
          <h2 className="text-base font-bold">Console non ancora attiva sui dati di produzione</h2>
          <p className="mt-2 leading-6">Non è stato possibile leggere il contratto dati
            TRADER1D.2. La migrazione di ricerca privata e il ledger richiedono
            un deployment Supabase autorizzato. Non viene mostrato un elenco fittizio
            e non sono consentite decisioni senza backend verificato.</p>
          <a className="mt-3 inline-flex font-semibold underline" target="_blank" rel="noopener noreferrer"
            href="https://github.com/ctimaru/steel-sales-ai/issues/771">
            Segui il blocco di attivazione #771 ↗</a>
        </section>
      ) : (
        <>
          {params.message ? <p role="status" className="rounded-xl border border-[#b9d9c8] bg-[#ecf6ef] p-3 text-sm text-[#174c35]">
            {params.message}</p> : null}
          {params.error ? <p role="alert" className="rounded-xl border border-[#e7c8c8] bg-[#fff5f5] p-3 text-sm text-[#8b2323]">
            {params.error}</p> : null}

          <section aria-label="Filtri e paginazione" className="flex flex-wrap items-end gap-3 rounded-xl border border-[#d9e4de] bg-white p-3">
            <form method="get" className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold text-[#455d50]">
                Paese mercato
                <select name="country" defaultValue={country}
                  className="mt-1 block h-11 min-w-44 rounded-lg border border-[#aabfb1] bg-white px-3 text-sm font-medium text-[#173f35]">
                  <option value="">Tutta l&apos;Unione Europea</option>
                  {COUNTRY_CODES.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              </label>
              <button type="submit" className="platform-primary h-11 rounded-lg px-4 text-sm font-bold">
                Filtra</button>
            </form>
            <span className="ml-auto text-xs font-semibold text-[#52635b]">
              Pagina {Math.min(requestedPage,pageCount)} / {pageCount}</span>
            {requestedPage > 1 ?
              <Link href={href(country,requestedPage-1)} className="platform-secondary rounded-lg px-3 py-2 text-sm font-semibold">
                ← Precedente</Link> : null}
            {requestedPage < pageCount ?
              <Link href={href(country,requestedPage+1)} className="platform-secondary rounded-lg px-3 py-2 text-sm font-semibold">
                Successiva →</Link> : null}
          </section>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
            <section aria-labelledby="queue-heading" className="min-w-0 space-y-2">
              <div className="flex items-center justify-between">
                <h2 id="queue-heading" className="text-lg font-bold text-[#173f35]">Coda di verifica</h2>
                <span className="text-xs text-[#586e61]">Ordine: conflitti e hold prima</span>
              </div>
              {items.length === 0 ? <p className="rounded-xl border bg-white p-4 text-sm">
                Nessun dossier in questa pagina.</p> : null}
              {items.map(item => {
                const accepted = GATES.filter(([key]) => item.reviews?.[key] === "accepted").length;
                const chosen = selected?.id === item.id;
                return <Link key={item.id} href={href(country,requestedPage,item.id)}
                  aria-current={chosen ? "true" : undefined}
                  className={["block rounded-xl border p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]",
                    chosen ? "border-[#478e6a] bg-[#f0f8f2]" : "border-[#dbe5df] bg-white hover:border-[#92bea6]"].join(" ")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#173f35]">{item.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[#52635b]">{item.market} · {item.domain}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-[#e6f1e9] px-2 py-1 text-xs font-bold text-[#205b40]">
                      {accepted}/6</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.domain_collision_count > 0
                      ? <span className="rounded-md border border-[#d8bb7e] px-2 py-1 text-[11px] font-bold text-[#715018]">
                        {item.domain_collision_count} possibili collisioni</span> : null}
                    {item.research_state !== "research_only"
                      ? <span className="rounded-md border border-[#e8d9b6] px-2 py-1 text-[11px] text-[#6e521b]">
                        {item.research_state}</span> : null}
                    <span className="rounded-md border border-[#dce6df] px-2 py-1 text-[11px] text-[#53675b]">
                      Diritti: {item.source_rights}</span>
                  </div>
                </Link>;
              })}
            </section>

            <section aria-labelledby="detail-heading" className="min-w-0 rounded-2xl border border-[#d6e3d9] bg-white p-4 sm:p-5">
              {!selected ? (
                <>
                  <h2 id="detail-heading" className="text-lg font-bold text-[#173f35]">Seleziona un dossier</h2>
                  <p className="mt-2 text-sm leading-6 text-[#52635b]">
                    Apri un&apos;azienda a sinistra per controllare identità,
                    fonti, possibili duplicati e registrare la tua decisione.</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#175640]">Dossier di ricerca</p>
                  <h2 id="detail-heading" className="mt-1 text-xl font-bold text-[#173f35]">
                    {selected.name}</h2>
                  <p className="mt-1 text-xs text-[#556960]">
                    Mercato {selected.market} · Dominio {selected.domain}
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#dee6df] p-3 text-sm">
                      <p className="text-xs font-bold text-[#52635b]">Identità legale dal dossier</p>
                      <p className="mt-1 font-semibold text-[#183e33]">
                        {selected.legal_name ?? "Non documentata"}</p>
                      <p className="text-xs text-[#586e61]">
                        Paese legale: {selected.legal_country ?? "non confermato"}</p>
                    </div>
                    <div className="rounded-lg border border-[#dee6df] p-3 text-sm">
                      <p className="text-xs font-bold text-[#52635b]">Fonte e permessi</p>
                      <p className="mt-1 font-semibold text-[#183e33]">
                        {selected.source_rights}</p>
                      <p className="text-xs text-[#586e61]">Stato: {selected.research_state}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                    <ExternalEvidence value={selected.official_website} label="Sito ufficiale" />
                    <ExternalEvidence value={selected.role_evidence_url} label="Fonte ruolo" />
                    <ExternalEvidence value={selected.product_evidence_url} label="Fonte prodotti" />
                    <ExternalEvidence value={selected.legal_identity_evidence_url} label="Fonte identità" />
                  </div>
                  {selected.product_evidence_summary
                    ? <p className="mt-2 text-sm leading-6 text-[#52635b]">
                      {selected.product_evidence_summary}</p> : null}
                  {selected.research_note
                    ? <p className="mt-2 text-sm leading-6 text-[#52635b]">
                      Nota ricerca: {selected.research_note}</p> : null}

                  <div className="mt-4 border-t border-[#e1e9e3] pt-4">
                    <div className="flex justify-between gap-2">
                      <h3 className="font-bold text-[#173f35]">Sei verifiche indipendenti</h3>
                      <span className="text-xs font-bold text-[#175640]">{completedGates}/6</span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {GATES.map(([key,label]) =>
                        <div key={key} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${statusStyle(decisions[key])}`}>
                          <span className="font-semibold">{label}</span>
                          <span>{statusLabel(decisions[key])}</span>
                        </div>)}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#52635b]">
                      Anche 6/6 evidenze accettate NON significa ready o pubblicata:
                      i diritti nel dossier e l&apos;identità societaria restano gate separati.</p>
                  </div>

                  {selected.facilities.length > 0 ? (
                    <div className="mt-4 border-t border-[#e1e9e3] pt-3">
                      <h3 className="text-sm font-bold text-[#173f35]">
                        Sedi osservate ({selected.facilities.length})</h3>
                      <div className="mt-2 space-y-2">
                        {selected.facilities.map((f,i)=>
                          <p key={i} className="text-xs leading-5 text-[#52635b]">
                            {f.city} · {f.country} · {f.type} · {f.state} ·{" "}
                            <ExternalEvidence value={f.source_url} label="fonte" />
                          </p>)}
                      </div>
                    </div>
                  ) : null}

                  <form action={recordTraderReview} className="mt-4 space-y-3 rounded-xl border border-[#a9cdb7] bg-[#f7fbf8] p-4">
                    <h3 className="font-bold text-[#173f35]">Registra una decisione</h3>
                    <input type="hidden" name="research_id" value={selected.id} />
                    <input type="hidden" name="country" value={country} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-[#305344]">
                        Dimensione
                        <select name="dimension" required defaultValue=""
                          className="mt-1 block h-11 w-full rounded-lg border border-[#96b3a3] bg-white px-3 text-sm text-[#183e33]">
                          <option value="" disabled>Seleziona un controllo</option>
                          {GATES.map(([key,label]) => <option key={key} value={key}>{label}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-[#305344]">
                        Esito
                        <select name="decision" required defaultValue="hold"
                          className="mt-1 block h-11 w-full rounded-lg border border-[#96b3a3] bg-white px-3 text-sm text-[#183e33]">
                          <option value="hold">Sospendi per approfondire</option>
                          <option value="accepted">Accetta evidenza</option>
                          <option value="rejected">Respingi evidenza</option>
                        </select>
                      </label>
                    </div>
                    <label className="block text-xs font-semibold text-[#305344]">
                      URL evidenza HTTPS (obbligatorio per accettare)
                      <input name="evidence_url" type="url" inputMode="url" maxLength={500}
                        placeholder="https://sito-ufficiale.example/..." className="mt-1 block h-11 w-full rounded-lg border border-[#96b3a3] bg-white px-3 text-sm text-[#183e33]" />
                    </label>
                    <label className="block text-xs font-semibold text-[#305344]">
                      Motivo della decisione (20–800 caratteri)
                      <textarea name="note" minLength={20} maxLength={800} required rows={3}
                        placeholder="Descrivi il documento consultato, ciò che prova e i limiti dell'evidenza..."
                        className="mt-1 block w-full rounded-lg border border-[#96b3a3] bg-white p-3 text-sm text-[#183e33]" />
                    </label>
                    <details className="rounded-lg border border-[#c9dace] bg-white px-3 py-2">
                      <summary className="cursor-pointer text-xs font-bold text-[#26583d]">
                        Dati aggiuntivi: identità legale / diritti di riuso
                      </summary>
                      <p className="mt-2 text-xs leading-5 text-[#52635b]">
                        Per &quot;Identità legale&quot; accettata inserisci nome e paese.
                        Per &quot;Diritti di riuso&quot; accettati inserisci la base documentale e
                        l&apos;ambito: una pagina pubblica non equivale a una licenza.</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-semibold text-[#305344]">Ragione sociale
                          <input name="legal_name" maxLength={180}
                            className="mt-1 h-10 w-full rounded-lg border border-[#96b3a3] px-2 text-sm" /></label>
                        <label className="text-xs font-semibold text-[#305344]">Paese legale
                          <select name="legal_country" defaultValue="" className="mt-1 h-10 w-full rounded-lg border border-[#96b3a3] bg-white px-2 text-sm">
                            <option value="">Da confermare</option>
                            {COUNTRY_CODES.map(c=><option key={c} value={c}>{c}</option>)}
                          </select></label>
                        <label className="text-xs font-semibold text-[#305344]">Base di autorizzazione
                          <select name="permission_basis" defaultValue="" className="mt-1 h-10 w-full rounded-lg border border-[#96b3a3] bg-white px-2 text-sm">
                            <option value="">Da documentare</option>
                            <option value="written_permission">Permesso scritto</option>
                            <option value="written_license">Licenza scritta</option>
                            <option value="open_license">Licenza aperta</option>
                          </select></label>
                        <label className="text-xs font-semibold text-[#305344]">Ambito autorizzato
                          <select name="permission_scope" defaultValue="" className="mt-1 h-10 w-full rounded-lg border border-[#96b3a3] bg-white px-2 text-sm">
                            <option value="">Da confermare</option>
                            <option value="internal_research">Solo ricerca interna</option>
                            <option value="network_profile">Profilo Network</option>
                            <option value="network_facility">Sede Network</option>
                          </select></label>
                      </div>
                    </details>
                    <button type="submit" className="platform-primary min-h-11 rounded-lg px-5 py-2 text-sm font-bold">
                      Registra nel ledger privato</button>
                    <p className="text-xs leading-5 text-[#52635b]">
                      Ogni decisione è append-only, attribuita al superadmin autenticato.
                      Non è possibile annullarla: una correzione richiede una nuova decisione.</p>
                  </form>

                  <details className="mt-4 border-t border-[#e1e9e3] pt-3">
                    <summary className="cursor-pointer text-sm font-bold text-[#173f35]">
                      Storico decisioni ({selected.history.length}{selected.history.length===100 ? "+" : ""})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {selected.history.length === 0 ? <p className="text-sm text-[#52635b]">
                        Nessuna verifica registrata.</p> : null}
                      {selected.history.map((h,i)=>
                        <article key={i} className="rounded-lg border border-[#e1e9e3] p-3">
                          <div className="flex flex-wrap justify-between gap-2 text-xs font-bold text-[#173f35]">
                            <span>{GATES.find(([key])=>key===h.dimension)?.[1] ?? h.dimension} · {statusLabel(h.decision)}</span>
                            <time dateTime={h.recorded_at}>{new Date(h.recorded_at).toLocaleString("it-IT")}</time>
                          </div>
                          <p className="mt-1 text-sm leading-5 text-[#52635b]">{h.note}</p>
                          <ExternalEvidence value={h.evidence_url} label="Fonte decisione" />
                          {h.permission_basis ? <p className="text-xs text-[#52635b]">
                            Diritti: {h.permission_basis} / {h.permission_scope}</p> : null}
                        </article>)}
                    </div>
                  </details>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
