import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlatformAccessContext, requirePlatformPermission } from "@/lib/platform-admin";
import { publishScale15KReadyWave, setScale15KAgentDelegation, setScale15KFactPolicy } from "./actions";

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

type FactPolicy = {
 contract: string;
 enabled: boolean;
 active: boolean;
 expires_at: string | null;
 daily_cap: number;
 published_today: number;
 published_total: number;
};
type AgentEvidenceStatus = {
 contract: string;
 reviewed: number;
 identity_supported: number;
 needs_human: number;
 blocked: number;
};

type AgentDelegation = {
  contract: string;
  enabled: boolean;
  active: boolean;
  expires_at: string | null;
  daily_cap: number;
  published_today: number;
  published_all: number;
};

type BatchPreview = {
  contract?: string;
  status?: string;
  requested?: number;
  eligible?: number;
  blocked?: number;
  published_now?: number;
  manifest_fingerprint?: string;
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
  searchParams: Promise<{ lane?: string; offset?: string; limit?: string; message?: string; error?: string }>;
}) {
  await requirePlatformPermission("discovery.governance_review");
  const params = await searchParams;
  const access = await getPlatformAccessContext();
  const canPublish = access?.permissions.includes("discovery.publish") ?? false;
  const canDelegate = access?.is_platform_owner === true;
  const lane: Lane = lanes.some((x) => x.key === params.lane)
    ? (params.lane as Lane) : "all";
  const offset = Math.max(0, Math.min(15000, Number.parseInt(params.offset ?? "0", 10) || 0));
  const limit = [50, 100, 250].includes(Number(params.limit))
    ? Number(params.limit) : 50;
  const supabase = await createClient();
  const [{ data, error }, { data: readyData, error: readyError }, { data: agentData }, { data: factsData }, { data: aiData }] = await Promise.all([
    supabase.rpc("net_it_scale15k_readiness", {
      p_lane: lane, p_limit: limit, p_offset: offset,
    }),
    supabase.rpc("net_it_scale15k_readiness", {
      p_lane: "ready", p_limit: 100, p_offset: 0,
    }),
    supabase.rpc("net_it_auto1_status"),
    supabase.rpc("net_it_auto3_status"),
    supabase.rpc("net_it_auto2_status"),
  ]);
  const factPolicy = factsData &&
    (factsData as FactPolicy).contract === "net-it-auto3-policy-v1"
      ? (factsData as FactPolicy) : null;
  const aiStatus = aiData &&
    (aiData as AgentEvidenceStatus).contract === "net-it-auto2-status-v1"
      ? (aiData as AgentEvidenceStatus) : null;
  const agent = agentData &&
    (agentData as AgentDelegation).contract === "net-it-auto1-delegation-v1"
    ? (agentData as AgentDelegation) : null;
  const snap = !error && data && (data as GrowthSnapshot).contract === "net-it-scale15k-readiness-v1"
    ? (data as GrowthSnapshot) : null;
  const readySnap = !readyError && readyData &&
    (readyData as GrowthSnapshot).contract === "net-it-scale15k-readiness-v1"
      ? (readyData as GrowthSnapshot) : null;
  const readyCandidates = readySnap?.rows ?? [];
  const readyIds = readyCandidates.map((company) => company.candidate_id);
  const { data: batchData, error: batchError } =
    canPublish && readyIds.length > 0
      ? await supabase.rpc("net_it_scale15k_bulk_publish", {
          p_candidate_ids: readyIds,
          p_commit: false,
        })
      : { data: null, error: null };
  const preview = !batchError && batchData &&
    (batchData as BatchPreview).contract === "net-it-scale15k-bulk-publish-v1"
      ? (batchData as BatchPreview) : null;
  const canCommit = canPublish && readyIds.length > 0 &&
    preview?.status === "ready_for_attested_commit" &&
    preview.eligible === readyIds.length &&
    typeof preview.manifest_fingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(preview.manifest_fingerprint);
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
          Vista Platform · pubblicazione protetta
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

      <section className="rounded-2xl border border-[#b9dac8] bg-white p-3 sm:p-4"
        aria-label="Delega revocabile all'agente Network Italia">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#277458]">
              Pubblicazioni continue · NET-IT-AUTO1
            </p>
            <h2 className="mt-1 text-base font-bold text-[#173f35]">Autorizza una volta, senza ripetere ogni conferma</h2>
            <p className="mt-1 text-xs leading-5 text-[#627668]">
              L'agente può pubblicare in serie solo aziende italiane con <strong>fonte e identità già approvate</strong>.
              Nessuna fonte sconosciuta viene dichiarata approvata, nessun dato personale o descrizione viene copiato.
              Ogni inserimento è registrato come azione automatica, distinto dalle tue decisioni.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${
            agent?.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
            "border-[#d9e2dc] bg-[#f3f5f4] text-[#51685b]"
          }`}>
            {agent?.active ? "Delega attiva" : "Delega disattivata"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[#48624f]">
          <span>Oggi: <strong className="tabular-nums">{agent?.published_today ?? 0}</strong> pubblicate dall'agente</span>
          <span>Limite giornaliero: <strong className="tabular-nums">{agent?.daily_cap ?? "—"}</strong></span>
          <span>Scadenza: <strong>{agent?.expires_at ? new Date(agent.expires_at).toLocaleDateString("it-IT", { timeZone:"Europe/Rome" }) : "—"}</strong></span>
        </div>
        {canDelegate && agent ? (
          agent.active ? (
            <form className="mt-3" action={setScale15KAgentDelegation}>
              <input type="hidden" name="enabled" value="false" />
              <button type="submit" className="min-h-11 rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                Revoca subito la delega
              </button>
            </form>
          ) : (
            <form action={setScale15KAgentDelegation}
              className="mt-3 grid gap-3 rounded-xl border border-[#cfe5d6] bg-[#f9fcfa] p-3">
              <input type="hidden" name="enabled" value="true" />
              <label className="text-xs font-semibold text-[#345b43]">
                Aziende massime pubblicabili dall'agente al giorno (1–500)
                <input name="daily_cap" type="number" min={1} max={500} defaultValue={150} required
                  className="mt-1 block w-32 rounded-lg border border-[#bfd8c7] bg-white p-2.5 text-xs text-[#173f35]" />
              </label>
              <label className="text-xs font-semibold text-[#345b43]">
                Motivazione della delega (obbligatoria, minimo 80 caratteri)
                <textarea name="policy_note" required minLength={80} maxLength={2000} rows={3}
                  placeholder="Autorizzo per 30 giorni la pubblicazione automatica di profili minimi italiani soltanto quando fonte e identità sono già state approvate, con registrazione separata dell'agente, un limite giornaliero e revoca immediata."
                  className="mt-1 w-full rounded-lg border border-[#bfd8c7] bg-white p-3 text-xs text-[#173f35]" />
              </label>
              <label className="flex items-start gap-2 text-xs leading-5 text-[#345b43]">
                <input type="checkbox" name="attested" required className="mt-0.5 h-4 w-4 accent-[#176447]" />
                Autorizzo per 30 giorni solo l'esecuzione automatica delle pubblicazioni
                precedentemente approvate; capisco che fonti e identità dubbie restano sospese,
                che l'agente non usa la mia identità e che posso revocare subito.
              </label>
              <div>
                <button type="submit" className="min-h-11 rounded-lg bg-[#176447] px-4 py-2 text-xs font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                  Attiva delega per 30 giorni
                </button>
              </div>
            </form>
          )
        ) : (
          <p className="mt-3 rounded-lg border border-[#dee8e0] bg-[#f7faf8] p-3 text-xs text-[#627668]">
            {canDelegate
              ? "La funzione di delega deve ancora essere installata. Nessuna autorizzazione è stata attivata."
              : "Solo il proprietario Platform può attivare o revocare questa delega."}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-5 text-[#697d6e]">
          La verifica automatica di nuove fonti richiederà prove separate e non sarà
          attivata con questa delega. Nessun controllo sulle fonti esistenti viene saltato.
        </p>
      </section>

      <section className="rounded-2xl border border-[#bbddc8] bg-white p-3 sm:p-4"
        aria-label="Verifica AI e delega pubblicazione aziendale autonoma">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#26714d]">
              AUTO2 + AUTO3 · Super Intelligence Network
            </p>
            <h2 className="mt-1 text-base font-bold text-[#163f30]">
              Verifica automatica dal sito ufficiale e pubblicazione dei soli fatti minimi
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#617568]">
              L'agente verifica nome, dominio e anomalie. Le schede dubbie restano sospese.
              Solo una tua delega separata permette di pubblicare aziende societarie con
              prove recenti e robuste, senza copiare contatti, testi, prodotti non verificati o marchi.
              La presenza pubblica di una pagina non viene registrata come licenza.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${
            factPolicy?.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" :
            "border-[#dae3df] bg-[#f3f5f4] text-[#56695e]"
          }`}>
            {factPolicy?.active ? "Autonomia attiva" : "Autonomia non attivata"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Siti controllati",aiStatus?.reviewed ?? 0],
            ["Identità sostenute",aiStatus?.identity_supported ?? 0],
            ["Eccezioni",aiStatus?.needs_human ?? 0],
            ["Pubblicate dall'agente",factPolicy?.published_total ?? 0],
          ].map(([label,value]) => (
            <div key={String(label)} className="rounded-lg border border-[#e1e9e4] bg-[#fafcfa] p-2.5">
              <p className="text-[10px] font-medium text-[#617668]">{String(label)}</p>
              <p className="text-lg font-bold tabular-nums text-[#176447]">{Number(value).toLocaleString("it-IT")}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#657569]">
          Limite: {factPolicy?.daily_cap ?? "—"} al giorno ·
          Pubblicate oggi: {factPolicy?.published_today ?? 0} ·
          Scadenza: {factPolicy?.expires_at
            ? new Date(factPolicy.expires_at).toLocaleDateString("it-IT",{timeZone:"Europe/Rome"})
            : "—"}
        </p>
        {canDelegate && factPolicy ? (
          factPolicy.active ? (
            <form action={setScale15KFactPolicy} className="mt-3">
              <input type="hidden" name="enabled" value="false" />
              <button className="min-h-11 rounded-lg border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-800" type="submit">
                Revoca subito l'autonomia AI
              </button>
            </form>
          ) : (
            <form action={setScale15KFactPolicy} className="mt-3 grid gap-3 rounded-xl border border-[#d9e9dd] bg-[#fafdfa] p-3">
              <input type="hidden" name="enabled" value="true" />
              <label className="text-xs font-semibold text-[#355a44]">
                Limite di pubblicazioni automatiche al giorno
                <input type="number" name="daily_cap" min={1} max={300} defaultValue={100} required
                  className="mt-1 block w-28 rounded-lg border border-[#c1d9c6] bg-white p-2.5" />
              </label>
              <label className="text-xs font-semibold text-[#355a44]">
                Motivazione e regola aziendale (minimo 100 caratteri)
                <textarea name="policy_note" required minLength={100} maxLength={2000} rows={3}
                  placeholder="Autorizzo per 30 giorni la pubblicazione di soli fatti societari minimi rilevati da siti ufficiali HTTPS, con verifica recente di nome e dominio, senza contatti o testi copiati, esclusione dei duplicati, limiti giornalieri, registro macchina e revoca immediata."
                  className="mt-1 w-full rounded-lg border border-[#c1d9c6] bg-white p-2.5" />
              </label>
              <label className="flex items-start gap-2 text-xs leading-5 text-[#355a44]">
                <input type="checkbox" name="attested" required className="mt-0.5 h-4 w-4 accent-[#176447]" />
                Autorizzo soltanto la pubblicazione dei fatti societari minimi comprovati.
                Comprendo che il sito pubblico non implica licenza sui contenuti:
                l'agente non copia contenuti protetti, non dichiara fonti legalmente approvate,
                non usa la mia identità e sospende aziende o diritti dubbi.
                Posso revocare subito questa delega di 30 giorni.
              </label>
              <div><button type="submit" className="min-h-11 rounded-lg bg-[#176447] px-4 py-2 text-xs font-bold text-white">
                Autorizza la pubblicazione AI dei fatti essenziali
              </button></div>
            </form>
          )
        ) : (
          <p className="mt-3 text-xs text-[#647768]">
            {canDelegate
              ? "La funzione AI autonoma non è ancora installata in produzione. Nessuna delega attiva."
              : "La delega ai fatti aziendali è riservata al proprietario Platform."}
          </p>
        )}
        <p className="mt-2 text-[11px] text-[#677c6d]">
          Il verificatore gira ogni sei ore solo dopo l'attivazione del servizio Railway.
          Le aziende che non superano i controlli restano private e non incrementano il contatore.
        </p>
      </section>

      {params.message ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          {params.message}
        </p>
      ) : null}
      {params.error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
          {params.error}
        </p>
      ) : null}

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

          <section aria-label="Pubblica il prossimo lotto italiano"
            className="space-y-3 rounded-2xl border border-[#b6dac4] bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#153f32]">
                  Pubblica il prossimo gruppo di aziende approvate
                </h2>
                <p className="mt-1 text-xs leading-5 text-[#62776a]">
                  Fino a 100 profili per conferma. Le fonti e le identità devono essere già approvate;
                  duplicati e anomalie vengono respinti dal database. Nessuna pubblicazione parziale.
                </p>
              </div>
              <span className="rounded-full border border-[#c4e0ce] bg-[#f0f8f2] px-3 py-1 text-xs font-bold text-[#196040]">
                {readyIds.length} pronte nel prossimo gruppo
              </span>
            </div>
            {readyCandidates.length > 0 ? (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[#e2eee6] bg-[#f9fcfa] p-2">
                {readyCandidates.map((company) => (
                  <div key={company.candidate_id} className="flex flex-wrap justify-between gap-1 border-b border-[#e7efe9] px-2 py-1.5 text-xs last:border-b-0">
                    <span className="font-semibold text-[#22523d]">{company.company_name}</span>
                    <span className="text-[#688272]">{company.domain}</span>
                    {safeHttps(company.source_url) ? (
                      <a className="font-semibold text-[#176447] underline underline-offset-4"
                        target="_blank" rel="noopener noreferrer"
                        href={safeHttps(company.source_url) ?? undefined}>Verifica fonte ↗</a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-[#e0e8e1] bg-[#f9fcfa] p-3 text-xs text-[#627668]">
                Nessun gruppo interamente idoneo: approva prima le fonti e le identità nella coda sottostante.
              </p>
            )}
            {canCommit ? (
              <form action={publishScale15KReadyWave} className="space-y-3 rounded-xl border border-[#cee4d3] bg-[#f7fbf8] p-3">
                {readyIds.map((id) => (
                  <input type="hidden" name="candidate_id" value={id} key={id} />
                ))}
                <input type="hidden" name="manifest_fingerprint"
                  value={preview?.manifest_fingerprint ?? ""}/>
                <p className="text-xs font-semibold text-[#206046]">
                  Anteprima: {preview?.eligible} / {preview?.requested} ammissibili. Il catalogo verrà aggiornato
                  soltanto dopo la conferma; il pubblicatore generale tornerà disattivato.
                </p>
                <label className="block text-xs font-semibold text-[#345b43]">
                  Nota sul controllo svolto (obbligatoria)
                  <textarea name="review_note" required minLength={80} maxLength={2000} rows={3}
                    className="mt-1 w-full rounded-lg border border-[#c4d8ca] bg-white p-3 text-xs text-[#193f32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176447]"
                    placeholder="Indica le fonti approvate, l'identità delle aziende e il motivo del riuso dei soli dati aziendali essenziali." />
                </label>
                <label className="flex items-start gap-2 text-xs leading-5 text-[#345b43]">
                  <input name="attested" type="checkbox" required
                    className="mt-0.5 h-4 w-4 accent-[#176447]"/>
                  Ho esaminato questo gruppo, i siti aziendali e le decisioni già registrate;
                  autorizzo la pubblicazione dei soli profili minimi non verificati.
                </label>
                <button type="submit"
                  className="min-h-11 rounded-lg bg-[#176447] px-4 py-2 text-xs font-bold text-white hover:bg-[#125238] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176447]">
                  Pubblica {readyIds.length} aziende
                </button>
              </form>
            ) : (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {!canPublish
                  ? "Per pubblicare serve il permesso Platform di pubblicazione."
                  : readyIds.length === 0
                  ? "Completa la revisione delle aziende ammissibili."
                  : batchError || !preview
                  ? "Il pubblicatore in serie non è ancora installato o accessibile: nessuna azienda modificata."
                  : `Lotto bloccato: ${preview.blocked ?? readyIds.length} schede richiedono una verifica ulteriore.`}
              </p>
            )}
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
