import Link from "next/link";

import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const EU = [
  "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU",
  "IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK",
];

type Item = {
  id: string; name: string; market: string; domain: string;
  source_url: string; research_state: string; source_rights: string;
  domain_collision_count: number;
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
  history: Array<{ dimension: string; decision: string; note: string; recorded_at: string }>;
};
type Payload = {
  contract: "trader1d2-superadmin-v1"; scope: "private_research_only";
  total: number; items: Item[]; selected: Selected | null; published_by_trader1d2: 0;
};
type SourceHealth = { status: string; checked_at: string; change: string } | null;
type SourceHealthRow = {
  research_id: string; role: SourceHealth; product: SourceHealth;
};
type HealthPayload = {
  contract: "trader1d3b2-owner-health-v1"; items: SourceHealthRow[];
};
function sourceHealthLabel(value: SourceHealth) {
  if (!value) return "Non ancora controllata";
  if (value.status === "reachable_html" || value.status === "reachable_unknown_type")
    return "HEAD raggiungibile";
  if (value.status === "method_not_supported") return "HEAD non supportato";
  if (value.status === "robots_or_unavailable") return "Robots / accesso non disponibile";
  if (value.status === "redirect_observed") return "Reindirizzamento da esaminare";
  if (value.status === "rate_limited") return "Limite richieste";
  return "Esito HTTP: " + value.status.replaceAll("_", " ");
}
function SourceHealthCard({title, observation}: {title:string; observation:SourceHealth}) {
  const date = observation && Number.isFinite(Date.parse(observation.checked_at))
    ? new Date(observation.checked_at).toLocaleDateString("it-IT") : null;
  return <div className="rounded-xl border border-[#d5e4db] bg-[#f8faf8] px-3 py-3">
    <p className="text-xs font-bold text-[#244c38]">{title}</p>
    <p className="mt-1 text-sm font-semibold text-[#283f35]">{sourceHealthLabel(observation)}</p>
    <p className="mt-1 text-xs leading-5 text-[#66766b]">
      {date ? `Ultima osservazione ${date} · ${observation?.change?.replaceAll("_"," ")}`
        : "Nessuna osservazione ancora registrata"}
    </p>
  </div>;
}

/** Presence + same-domain checks, NOT a website recrawl, legal identity proof or reuse licence. */
function firstPartyEvidence(value: string | null | undefined, domain: string) {
  if (!value) return false;
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return u.protocol === "https:" && !u.username && !u.password
      && (host === domain || host.endsWith("." + domain));
  } catch { return false; }
}

function safeEvidence(value: string | null | undefined) {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch { return null; }
}
function signals(v: {
  domain: string; research_state: string; source_rights: string;
  domain_collision_count: number; role_evidence_url?: string | null;
  product_evidence_url?: string | null; legal_name?: string | null;
  legal_country?: string | null; facilities?: Selected["facilities"];
}) {
  const role = firstPartyEvidence(v.role_evidence_url, v.domain);
  const product = firstPartyEvidence(v.product_evidence_url, v.domain);
  const legal = Boolean(v.legal_name && v.legal_country);
  const locations = (v.facilities ?? []).some(f => Boolean(safeEvidence(f.source_url)));
  const collisions = v.domain_collision_count > 0 || v.research_state === "identity_hold";
  // Rights cannot be inferred from an official website. A claim is separate from a licence.
  const rightsClear = v.source_rights === "license_approved";
  return {
    role, product, legal, locations, collisions, rightsClear,
    evidenceCount: Number(role) + Number(product) + Number(legal) + Number(locations),
    publicationBlocked: collisions || !rightsClear || !legal,
  };
}
function href(country: string, page: number, id?: string) {
  const q = new URLSearchParams();
  if (country) q.set("country", country);
  if (page > 1) q.set("page", String(page));
  if (id) q.set("id", id);
  return "/platform/company-discovery/trader-verification" + (q.size ? "?" + q : "");
}
function Source({ value, title }: { value: string | null | undefined; title: string }) {
  const u = safeEvidence(value);
  return u
    ? <a href={u} target="_blank" rel="noopener noreferrer"
        className="text-xs font-semibold text-[#175640] underline underline-offset-4 break-all">
        {title} ↗</a>
    : <span className="text-xs text-[#637168]">{title}: non documentata</span>;
}
function Signal({ title, ok, note }: { title: string; ok: boolean; note: string }) {
  return <div className={["rounded-xl border p-3",
      ok ? "border-[#c4dece] bg-[#f2f8f3]" : "border-[#e6d7b9] bg-[#fffaf1]"].join(" ")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[#193c30]">{title}</span>
        <span className={["rounded-full px-2 py-1 text-[11px] font-bold",
          ok ? "bg-[#d7eee0] text-[#184e35]" : "bg-[#f8eac9] text-[#694919]"].join(" ")}>
          {ok ? "Presente" : "Incompleta"}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-[#5a6b61]">{note}</p>
    </div>;
}

export default async function TraderQualityMonitor({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; page?: string; id?: string }>;
}) {
  // Research remains private; only the single platform owner can inspect source-level metadata.
  await requirePlatformSuperadmin();
  const p = await searchParams;
  const country = EU.includes(p.country ?? "") ? p.country! : "";
  const requestedPage = p.page && /^\d{1,3}$/.test(p.page)
    ? Math.max(1, Math.min(400, Number(p.page))) : 1;
  const id = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(p.id ?? "") ? p.id! : null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("trader1d2_superadmin_queue", {
    p_limit: 25, p_offset: (requestedPage - 1) * 25,
    p_country: country || null, p_research_id: id,
  });
  const value = !error && data && typeof data === "object" ? data as Payload : null;
  const available = value?.contract === "trader1d2-superadmin-v1"
    && value.scope === "private_research_only" && value.published_by_trader1d2 === 0
    && Number.isInteger(value.total) && value.total >= 0
    && Array.isArray(value.items) && value.items.length <= 25;
  const snapshot = available ? value! : null;
  const pageCount = snapshot ? Math.max(1, Math.ceil(snapshot.total / 25)) : 1;
  const items = snapshot && requestedPage <= pageCount ? snapshot.items : [];
  const selected = snapshot?.selected ?? null;
  // Separate bounded authenticated RPC. Null is "not activated", never zero checks.
  const ids = items.map(item => item.id);
  if (selected && !ids.includes(selected.id) && ids.length < 25) ids.push(selected.id);
  const healthResult = snapshot && ids.length
    ? await supabase.rpc("trader1d3b2_owner_health", {p_ids: ids}) : null;
  const healthValue = healthResult && !healthResult.error && healthResult.data
    && typeof healthResult.data === "object"
    ? healthResult.data as HealthPayload : null;
  const liveAvailable = healthValue?.contract === "trader1d3b2-owner-health-v1"
    && Array.isArray(healthValue.items) && healthValue.items.length <= 25;
  const liveRows = liveAvailable ? healthValue!.items : null;
  const selectedHealth = liveRows?.find(row => row.research_id === selected?.id) ?? null;
  const selectedRow = items.find(r => r.id === selected?.id);
  const profile = selected ? signals({
    ...selected,
    domain_collision_count: selectedRow?.domain_collision_count ?? (
      selected.research_state === "identity_hold" ? 1 : 0),
  }) : null;

  return <main data-testid="trader1d3a-quality-monitor"
    className="mx-auto w-full max-w-[1440px] space-y-4 px-3 py-4 sm:px-5 sm:py-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Link href="/platform/company-discovery"
        className="text-sm font-semibold text-[#175640] underline underline-offset-4">
        ← Discovery aziende</Link>
      <span className="rounded-full border border-[#d6e5db] bg-[#f2f8f3] px-3 py-1 text-xs font-bold text-[#184e35]">
        Solo superadmin · Monitor lettura</span>
    </div>
    <header className="rounded-2xl border border-[#d7e5da] bg-white p-4 sm:p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#175640]">
        TRADER1D.3B.2 · Live Source Intelligence</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#183e33] sm:text-3xl">
            Qualità automatica · Commercianti UE</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#52635b]">
            Le verifiche strutturali individuano fonti presenti, lacune e conflitti senza
            approvazioni manuali. Dove disponibili, i controlli HEAD vengono letti dal
            registro Supabase corrente; non validano il contenuto della pagina.
            I controlli sul dossier non certificano un&apos;azienda:
            la gestione dei dati pubblici spetterà all&apos;impresa dopo il claim del profilo.
          </p>
        </div>
        <div className="rounded-xl border border-[#d5e4dc] bg-[#f3f9f5] px-4 py-3">
          <p className="text-xs text-[#52635b]">Dossier nel filtro</p>
          <p className="text-2xl font-bold tabular-nums text-[#174c35]">
            {snapshot ? snapshot.total.toLocaleString("it-IT") : "—"}</p>
          <p className="text-xs text-[#52635b]">Ricerca privata, non pubblicazione</p>
        </div>
      </div>
    </header>
    {!snapshot ? <section role="alert" className="rounded-xl border border-[#dec8aa] bg-[#fffaf2] p-4 text-sm text-[#6b4a21]">
      <h2 className="font-bold">Dati non disponibili</h2>
      <p className="mt-1">La coda privata non risponde con il contratto previsto.
        Nessun conteggio o livello di fiducia viene simulato.</p>
      <a className="mt-2 inline-block font-semibold underline"
        href="https://github.com/ctimaru/steel-sales-ai/issues/780"
        target="_blank" rel="noopener noreferrer">Controlli di produzione #780 ↗</a>
    </section> : <>
      <section aria-label="Filtri" className="flex flex-wrap items-end gap-3 rounded-xl border border-[#d9e4de] bg-white p-3">
        <form method="get" className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-[#455d50]">Mercato di ricerca
            <select name="country" defaultValue={country}
              className="mt-1 block h-11 min-w-44 rounded-lg border border-[#aabfb1] bg-white px-3 text-sm text-[#173f35]">
              <option value="">Tutta l&apos;UE</option>
              {EU.map(code => <option key={code} value={code}>{code}</option>)}
            </select>
          </label>
          <button type="submit" className="platform-primary h-11 rounded-lg px-4 text-sm font-bold">Filtra</button>
        </form>
        <p className="ml-auto text-xs font-semibold text-[#52635b]">Pagina {Math.min(requestedPage,pageCount)} / {pageCount}</p>
        {requestedPage > 1 ? <Link className="platform-secondary rounded-lg px-3 py-2 text-sm font-semibold"
          href={href(country,requestedPage - 1)}>← Precedente</Link> : null}
        {requestedPage < pageCount ? <Link className="platform-secondary rounded-lg px-3 py-2 text-sm font-semibold"
          href={href(country,requestedPage + 1)}>Successiva →</Link> : null}
      </section>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <section className="min-w-0 space-y-2" aria-label="Dossier di ricerca">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#173f35]">Fonti e anomalie</h2>
            <span className="text-xs text-[#617369]">Presenza fonti, non verifica societaria</span>
          </div>
          {items.length === 0 ? <p className="rounded-xl border bg-white p-4 text-sm">Nessun dossier nel filtro.</p> : null}
          {items.map(item => {
            const s = signals({
              ...item,
              role_evidence_url: item.source_url,
            });
            const active = selected?.id === item.id;
            return <Link key={item.id} href={href(country,requestedPage,item.id)}
              aria-current={active ? "true" : undefined}
              className={["block rounded-xl border p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]",
                active ? "border-[#478e6a] bg-[#f0f8f2]" : "border-[#dbe5df] bg-white hover:border-[#92bea6]"].join(" ")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#173f35]">{item.name}</p>
                  <p className="mt-1 truncate text-xs text-[#52635b]">{item.market} · {item.domain}</p>
                </div>
                <span className="shrink-0 rounded-lg border border-[#d8e8de] bg-white px-2 py-1 text-[11px] font-bold text-[#285c43]">
                  {s.role ? "Fonte presente" : "Fonte assente"}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {s.collisions ? <span className="rounded-md border border-[#e4ce9e] bg-[#fff7e6] px-2 py-1 text-xs text-[#694919]">
                  Identità o dominio da distinguere</span> : null}
                {!s.rightsClear ? <span className="rounded-md border border-[#dbe3e0] bg-[#f7f9f8] px-2 py-1 text-xs text-[#52635b]">
                  Riuso non autorizzato</span> : null}
              </div>
            </Link>;
          })}
        </section>
        <section className="min-w-0 rounded-2xl border border-[#d6e3d9] bg-white p-4 sm:p-5"
          aria-label="Dettaglio e qualità fonti">
          {!selected || !profile ? <>
            <h2 className="text-lg font-bold text-[#173f35]">Esplora il dossier</h2>
            <p className="mt-2 text-sm text-[#52635b]">Seleziona un commerciante per vedere
              controlli strutturali automatici, fonti e possibili conflitti.</p>
          </> : <>
            <p className="text-xs font-bold uppercase tracking-wide text-[#175640]">Ricerca privata</p>
            <h2 className="mt-1 text-xl font-bold text-[#173f35]">{selected.name}</h2>
            <p className="mt-1 text-xs text-[#556960]">Mercato {selected.market} · {selected.domain}</p>
            <div className="mt-3 rounded-xl border border-[#cee0d4] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-[#174c35]">Monitor live delle fonti</p>
                <span className="rounded-full bg-[#ecf5ed] px-2 py-1 text-xs font-semibold text-[#31543e]">
                  {liveAvailable ? "Storico HTTP Supabase" : "Backend live non attivo"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#607167]">
                Metadati HEAD e data dell&apos;ultima osservazione. Una risposta positiva non
                dimostra identità legale, contenuti attuali, diritti di riuso o disponibilità a magazzino.
              </p>
              {liveAvailable ? <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <SourceHealthCard title="Fonte ruolo" observation={selectedHealth?.role ?? null} />
                <SourceHealthCard title="Fonte prodotti" observation={selectedHealth?.product ?? null} />
              </div> : <p className="mt-2 text-xs font-semibold text-[#755421]">
                Nessun risultato live disponibile: migrazione e worker da attivare dopo il controllo versioni Supabase.
              </p>}
            </div>
            <div className="mt-3 rounded-xl border border-[#d6e5db] bg-[#f3f9f5] px-4 py-3">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold text-[#52635b]">Completezza documentale disponibile</p>
                  <p className="text-2xl font-bold tabular-nums text-[#174c35]">{profile.evidenceCount}/4</p>
                </div>
                <p className="text-xs font-semibold text-[#52635b]">
                  {profile.publicationBlocked ? "Pubblicazione non abilitata" : "Da valutare nei controlli di rilascio"}
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#d5e5dc]" role="progressbar"
                aria-label="Indicatori documentali presenti" aria-valuemin={0} aria-valuemax={4}
                aria-valuenow={profile.evidenceCount}>
                <div className="h-full rounded-full bg-[#287452]"
                  style={{ width: `${(profile.evidenceCount / 4) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs leading-5 text-[#52635b]">Indicatore automatico basato sui dati memorizzati,
                senza visita in tempo reale del sito. Non è una percentuale di affidabilità, una
                verifica legale o una licenza per pubblicare.</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Signal title="Ruolo commerciante" ok={profile.role}
                note="URL HTTPS associato al dominio aziendale. Da aggiornare alla prossima acquisizione." />
              <Signal title="Prodotti e tubi" ok={profile.product}
                note="Evidenza prodotto collegata al sito; nessuna disponibilità di magazzino dedotta." />
              <Signal title="Identità societaria" ok={profile.legal}
                note="Ragione sociale e Paese legale espliciti; il mercato di ricerca non prova la sede legale." />
              <Signal title="Sedi documentate" ok={profile.locations}
                note="Almeno una fonte geografica; sede osservata non equivale a deposito verificato." />
            </div>
            {profile.collisions ? <p role="status"
              className="mt-3 rounded-xl border border-[#e2cd97] bg-[#fff8e8] p-3 text-sm text-[#70501e]">
              Possibile conflitto di identità o dominio condiviso: non unire società o filiali automaticamente.
            </p> : null}
            <p className="mt-3 rounded-xl border border-[#e1e6e2] bg-[#f8faf8] p-3 text-sm leading-6 text-[#52635b]">
              Diritti fonte: <strong>{selected.source_rights}</strong>. Una fonte ufficiale non costituisce
              autorizzazione al riutilizzo dei suoi contenuti. Fino a una base di utilizzo idonea,
              il dossier resta privato. Il claim dimostra il controllo di un profilo, non i diritti su
              contenuti di terzi.</p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
              <Source title="Sito ufficiale" value={selected.official_website} />
              <Source title="Fonte settore" value={selected.role_evidence_url} />
              <Source title="Fonte prodotti" value={selected.product_evidence_url} />
              <Source title="Fonte legale" value={selected.legal_identity_evidence_url} />
            </div>
            {selected.product_evidence_summary ? <p className="mt-3 text-sm leading-6 text-[#52635b]">
              {selected.product_evidence_summary}</p> : null}
            {selected.research_note ? <p className="mt-2 text-xs leading-5 text-[#64746a]">
              Note ricerca: {selected.research_note}</p> : null}
            {selected.facilities.length ? <details className="mt-4 border-t pt-3">
              <summary className="cursor-pointer text-sm font-bold text-[#173f35]">
                Luoghi citati nelle fonti ({selected.facilities.length})</summary>
              <div className="mt-2 space-y-2">
                {selected.facilities.map((f,i)=><p key={i} className="text-xs text-[#52635b]">
                  {f.city} · {f.country} · {f.type} · <Source value={f.source_url} title="fonte" />
                </p>)}
              </div>
            </details> : null}
            <div className="mt-4 rounded-xl border border-[#d3e5d9] bg-[#f3faf6] p-4">
              <h3 className="text-sm font-bold text-[#174c35]">I dati saranno gestiti dall&apos;azienda</h3>
              <p className="mt-1 text-xs leading-5 text-[#52635b]">
                Dopo una pubblicazione conforme alle regole sulle fonti, la società potrà
                rivendicare il proprio profilo, dimostrare il controllo tramite un metodo
                attendibile e modificare descrizione, prodotti, contatti e sedi.
                La conferma della proprietà del profilo non certifica il contenuto tecnico.</p>
              <Link href="/network/start"
                className="platform-secondary mt-3 inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-xs font-semibold">
                Percorso Network e claim →</Link>
            </div>
            {selected.history?.length ? <details className="mt-4 border-t pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-[#53675b]">
                Storico legacy ({selected.history.length})</summary>
              <p className="mt-2 text-xs text-[#53675b]">
                Registro storico consultabile, nessun processo di approvazione manuale richiesto.</p>
            </details> : null}
          </>}
        </section>
      </div>
    </>}
  </main>;
}
