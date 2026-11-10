import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requirePlatformPermission } from "@/lib/platform-admin";

const ROOT = "/platform/company-discovery/scale15k";

type Lane = "all" | "ready" | "review_source" | "review_company" | "duplicate" | "hold";

type CompanyRow = {
  candidate_id: string;
  company_name: string;
  domain: string;
  company_website: string;
  source_url: string;
  role: string;
  lane: Lane;
  eligibility_reason: string;
  source_governance: string;
  candidate_governance: string;
  same_domain_count: number;
  catalog_collision: boolean;
};

type SourceGroup = {
  run_id: string;
  source_label: string | null;
  source_type: string;
  source_governance: string;
  terms_status: string;
  rights_status: string;
  pending_candidates: number;
  approved_company_data: number;
  distinct_domains: number;
};

type GrowthSnapshot = {
  contract: string;
  goal: number;
  canonical_published: number;
  published_missing_role: number;
  discovery_all: number;
  private_seed_total: number;
  private_seed_unlinked_domains: number;
  pending: number;
  pending_distinct_domains: number;
  ready: number;
  review_source: number;
  review_company: number;
  duplicate: number;
  hold: number;
  lane: Lane;
  limit: number;
  offset: number;
  rows: CompanyRow[];
  source_groups: SourceGroup[];
};

const lanes: { key: Lane; title: string }[] = [
  { key: "all", title: "Tutte" },
  { key: "ready", title: "Pronte" },
  { key: "review_source", title: "Fonti" },
  { key: "review_company", title: "Aziende" },
  { key: "duplicate", title: "Duplicati" },
  { key: "hold", title: "Da chiarire" },
];

const statusStyle: Record<Lane, string> = {
  all: "border-[#d1e0d5] bg-[#f4f8f5] text-[#315f45]",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  review_source: "border-amber-200 bg-amber-50 text-amber-900",
  review_company: "border-sky-200 bg-sky-50 text-sky-900",
  duplicate: "border-rose-200 bg-rose-50 text-rose-800",
  hold: "border-[#d6d8df] bg-[#f2f3f5] text-[#51566a]",
};

function safeHttps(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function CountCard({ value, label, hint }: { value: number; label: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#d7e6dc] bg-white px-3 py-3">
      <p className="text-[11px] font-semibold leading-4 text-[#536b59]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#15523b]">{value.toLocaleString("it-IT")}</p>
      <p className="mt-1 text-[11px] leading-4 text-[#6b7d70]">{hint}</p>
    </div>
  );
}

export default async function NetItScale15KPage({
  searchParams,
}: {
  searchParams: Promise<{ lane?: string; offset?: string; limit?: string }>;
}) {
  await requirePlatformPermission("discovery.governance_review");
  const params = await searchParams;
  const lane: Lane = lanes.some((x) => x.key === params.lane)
    ? (params.lane as Lane) : "all";
  const offset = Math.max(0, Math.min(15000, Number.parseInt(params.offset ?? "0", 10) || 0));
  const limit = [50, 100, 250].includes(Number(params.limit))
    ? Number(params.limit) : 50;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("net_it_scale15k_readiness", {
    p_lane: lane,
    p_limit: limit,
    p_offset: offset,
  });
  const snap = !error && data && (data as GrowthSnapshot).contract === "net-it-scale15k-readiness-v1"
    ? (data as GrowthSnapshot) : null;
  const published = snap?.canonical_published ?? 0;
  const goal = snap?.goal ?? 15000;
  const left = Math.max(0, goal - published);
  const progress = goal > 0 ? Math.min(100, (published / goal) * 100) : 0;
  const currentTotal = snap ? lane === "all" ? snap.pending : snap[lane] : 0;
  const href = (l: Lane, nextOffset = 0, size = limit) =>
    `${ROOT}?lane=${l}&offset=${nextOffset}&limit=${size}`;

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-3 px-3 py-4 sm:px-5"
      aria-label="Network Italia — obiettivo quindicimila aziende">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/platform/company-discovery" className="text-xs font-semibold text-[#186447] underline underline-offset-4">
          ← Torna a Discovery
        </Link>
        <span className="rounded-full border border-[#d4e4d9] bg-white px-3 py-1 text-[11px] font-semibold text-[#476855]">
          Vista Platform · sola lettura
        </span>
      </div>
      <header className="rounded-2xl border border-[#d3e4d8] bg-white p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#277458]">
          Network italiano · Crescita reale
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#153e31]">Obiettivo 15.000 aziende</h1>
            <p className="mt-1 text-xs leading-5 text-[#597061]">
              Contiamo solo profili italiani pubblicati. Le candidature private non incrementano il traguardo.
            </p>
          </div>
          {snap ? (
            <div className="text-left sm:text-right">
              <p className="text-2xl font-bold tabular-nums text-[#16593e]">
                {published.toLocaleString("it-IT")} <span className="text-sm text-[#62806c]">/ {goal.toLocaleString("it-IT")}</span>
              </p>
              <p className="text-xs text-[#597061]">{left.toLocaleString("it-IT")} ancora da pubblicare</p>
            </div>
          ) : null}
        </div>
        {snap ? (
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e3efe7]" role="progressbar"
            aria-label="Percentuale aziende pubblicate" aria-valuenow={published} aria-valuemin={0} aria-valuemax={goal}>
            <div className="h-full rounded-full bg-[#14724d]" style={{ width: `${progress}%` }} />
          </div>
        ) : null}
      </header>

      {!snap ? (
        <section className="rounded-xl border border-amber-200 bg-white p-4 text-sm text-[#755522]" role="status">
          I dati della crescita Italia non sono ancora disponibili. La funzione protetta di lettura deve essere
          installata e accessibile alla tua sessione Platform. Non mostriamo conteggi ipotetici.
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Indicatori principali">
            <CountCard value={snap.ready} label="Pronte per il rilascio" hint="Ammissibili secondo i controlli esistenti" />
            <CountCard value={snap.review_source} label="Fonti da valutare" hint="Prima la fonte, poi il profilo" />
            <CountCard value={snap.review_company} label="Schede da approvare" hint="Fonte già approvata, identità ancora da rivedere" />
            <CountCard value={snap.duplicate + snap.hold} label="Doppioni o anomalie" hint="Fuori dal flusso rapido" />
          </section>
          <section className="grid gap-2 sm:grid-cols-3" aria-label="Scorte e qualità">
            <CountCard value={snap.discovery_all} label="Candidature raccolte" hint="Include schede con stato già concluso" />
            <CountCard value={snap.private_seed_unlinked_domains} label="Domini di ricerca da trasformare" hint="Non compaiono in Discovery o tra i profili" />
            <CountCard value={snap.published_missing_role} label="Profili online senza ruolo" hint="Da classificare senza creare nuovi duplicati" />
          </section>

          <section className="rounded-2xl border border-[#d7e6dc] bg-white p-3 sm:p-4"
            aria-label="Raccolte da approvare con più aziende">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#173f35]">Fonti da lavorare in gruppo</h2>
                <p className="text-[11px] leading-5 text-[#65796b]">
                  Una verifica motivata della fonte può sbloccare molte candidature,
                  ma l&apos;approvazione dell&apos;identità aziendale resta distinta.
                </p>
              </div>
              <Link href="/platform/company-discovery/governance"
                className="text-xs font-semibold text-[#176447] underline underline-offset-4">
                Apri revisione fonti
              </Link>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dbe6df] text-[11px] text-[#607768]">
                    <th scope="col" className="px-2 py-2">Raccolta</th>
                    <th scope="col" className="px-2 py-2 text-right">Aziende in attesa</th>
                    <th scope="col" className="px-2 py-2">Fonte</th>
                    <th scope="col" className="px-2 py-2">Decisione dati</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.source_groups.map((group) => (
                    <tr key={group.run_id} className="border-b border-[#edf2ed]">
                      <td className="px-2 py-2">
                        <span className="font-semibold text-[#24533d]">{group.source_label ?? "Raccolta senza nome"}</span>
                        <p className="text-[11px] text-[#718274]">
                          {group.distinct_domains} domini distinti · {group.approved_company_data} schede revisionate
                        </p>
                      </td>
                      <td className="px-2 py-2 text-right font-bold tabular-nums text-[#17543c]">
                        {group.pending_candidates}
                      </td>
                      <td className="px-2 py-2 text-[#5e705f]">{group.source_type.replaceAll("_"," ")}</td>
                      <td className="px-2 py-2 text-[#5e705f]">
                        {group.source_governance}
                        <p className="text-[11px] text-[#718274]">
                          {group.terms_status} · {group.rights_status}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2 rounded-2xl border border-[#d7e6dc] bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#173f35]">Coda aziende — prima le eccezioni giuste</h2>
                <p className="text-[11px] text-[#627668]">
                  {snap.pending.toLocaleString("it-IT")} candidature in attesa, {snap.pending_distinct_domains.toLocaleString("it-IT")} domini distinti.
                  Il filtro non cambia né approva alcun dato.
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#526d5b]">
                <span>Righe:</span>
                {[50, 100, 250].map((size) => (
                  <Link key={size} href={href(lane, 0, size)}
                    aria-current={limit === size ? "page" : undefined}
                    className={`rounded-md px-2 py-1 font-bold ${limit === size ? "bg-[#175e42] text-white" : "bg-[#edf5ef] text-[#285b42]"}`}>
                    {size}
                  </Link>
                ))}
              </div>
            </div>
            <nav aria-label="Filtra aziende per stato" className="flex flex-wrap gap-1.5">
              {lanes.map((tab) => (
                <Link key={tab.key} href={href(tab.key)}
                  aria-current={lane === tab.key ? "page" : undefined}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${lane === tab.key ? "border-[#175e42] bg-[#175e42] text-white" : statusStyle[tab.key]}`}>
                  {tab.title}
                </Link>
              ))}
            </nav>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#dbe6df] text-[11px] text-[#607768]">
                    <th scope="col" className="px-2 py-2 font-semibold">Azienda / dominio</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Ruolo osservato</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Stato</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Origine</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Doppioni</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.rows.map((item) => (
                    <tr key={item.candidate_id} className="border-b border-[#edf2ed] align-top">
                      <td className="px-2 py-2.5">
                        <p className="font-semibold text-[#204737]">{item.company_name}</p>
                        <p className="text-[11px] text-[#6b796d]">{item.domain}</p>
                      </td>
                      <td className="px-2 py-2.5 text-[#4b6153]">{item.role.replaceAll("_", " ")}</td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-block rounded-md border px-2 py-1 text-[11px] font-semibold ${statusStyle[item.lane]}`}>
                          {lanes.find((tab) => tab.key === item.lane)?.title ?? "Da chiarire"}
                        </span>
                      </td>
                      <td className="px-2 py-2.5">
                        {safeHttps(item.source_url) ? (
                          <a href={safeHttps(item.source_url) ?? undefined} target="_blank" rel="noopener noreferrer"
                            className="font-semibold text-[#176447] underline underline-offset-4">Fonte aziendale</a>
                        ) : <span className="text-[#93662a]">Fonte da verificare</span>}
                        <p className="mt-1 text-[11px] text-[#6b796d]">{item.source_governance}</p>
                      </td>
                      <td className="px-2 py-2.5 text-[#586f5f]">
                        {item.catalog_collision ? "Già in catalogo" :
                          item.same_domain_count > 1 ? `${item.same_domain_count} candidature sul dominio` :
                          "Nessuna collisione nota"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {snap.rows.length === 0 ? (
                <p className="p-4 text-center text-xs text-[#627668]">Nessun elemento in questo filtro.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-[#6a7d6c]">
                {currentTotal ? offset + 1 : 0}–{Math.min(offset + limit, currentTotal)} di {currentTotal.toLocaleString("it-IT")}
              </p>
              <div className="flex gap-2">
                {offset > 0 ? (
                  <Link className="rounded-lg border border-[#d4e4d9] px-3 py-1.5 text-xs font-semibold text-[#176447]"
                    href={href(lane, Math.max(0, offset - limit))}>Precedenti</Link>
                ) : null}
                {offset + limit < currentTotal ? (
                  <Link className="rounded-lg border border-[#d4e4d9] px-3 py-1.5 text-xs font-semibold text-[#176447]"
                    href={href(lane, offset + limit)}>Successive</Link>
                ) : null}
              </div>
            </div>
          </section>
          <p className="px-1 text-[11px] leading-5 text-[#627668]">
            Questa vista identifica il lavoro da svolgere, ma non abilita la pubblicazione.
            Le fonti e le identità devono essere approvate da un operatore autorizzato;
            duplicati, diritti dubbi e dati personali vanno nella coda eccezioni.
          </p>
        </>
      )}
    </main>
  );
}
