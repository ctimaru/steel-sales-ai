import Link from "next/link";
import { getPlatformAccessContext, requirePlatformPermission } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";
import { publishNetItPub1All, reviewNetItPub1Candidate, reviewNetItPub1Source } from "./actions";

type ReviewRow = {
  candidate_id: string;
  run_id: string;
  run_label: string;
  run_source_reference: string | null;
  run_total_candidates: number;
  source_status: string;
  terms_status: string;
  database_rights_status: string;
  personal_data_policy: string;
  candidate_status: string;
  review_status: string;
  personal_data_detected: boolean;
  personal_data_fields: string[];
  quality_flags: string[];
  canonical_domain: string;
  private_legal_name: string;
  proposed_public_name: string | null;
  first_party_name_observed: string | null;
  identity_source: string | null;
  activity_source: string | null;
  locality_unverified: string | null;
  source_rights_not_attested: boolean;
  publisher_eligibility_reason: string | null;
  already_published: boolean;
  canonical_collision: boolean;
};

type ReviewQueue = { contract: string; items: ReviewRow[]; minimal_publisher_enabled?: boolean };
type ReleasePreview = {
  status?: string;
  requested?: number;
  eligible?: number;
  blocked?: number;
  manifest_fingerprint?: string;
  published_now?: number;
};

const selectClass =
  "min-h-10 w-full rounded-lg border border-[#cbdcd2] bg-white px-2.5 py-2 text-xs text-[#173f35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167657]";
const inputClass =
  "min-h-10 w-full rounded-lg border border-[#cbdcd2] bg-white px-2.5 py-2 text-xs text-[#173f35] placeholder:text-[#7f9087] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#167657]";
const buttonClass =
  "min-h-10 rounded-lg bg-[#176447] px-4 py-2 text-xs font-bold text-white hover:bg-[#125238] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#176447]";

function ReviewStatus({ done, title }: { done: boolean; title: string }) {
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${done
      ? "bg-emerald-50 text-emerald-800"
      : "bg-amber-50 text-amber-900"}`}>
      {title}
    </span>
  );
}

function EvidenceLink({ url, label }: { url: string | null; label: string }) {
  if (!url || !/^https:\/\//i.test(url)) {
    return <span className="text-xs text-[#7e8881]">{label} non disponibile</span>;
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="text-xs font-semibold text-[#165f48] underline decoration-[#a3ceba] underline-offset-4 hover:decoration-[#165f48]">
      {label} ↗
    </a>
  );
}

export default async function NetItPub1ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  // No service-role shortcuts: this page only reads through the real user's JWT.
  await requirePlatformPermission("discovery.governance_review");
  const access = await getPlatformAccessContext();
  const canPublish = access?.permissions.includes("discovery.publish") ?? false;
  const params = await searchParams;
  const supabase = await createClient();
  const [queueResult, releaseResult] = await Promise.all([
    supabase.rpc("net_it_pub1_review_queue"),
    supabase.rpc("net_it_pub1_release", { p_commit: false }),
  ]);
  const payload = queueResult.data as ReviewQueue | null;
  const releasePreview = !releaseResult.error
    ? (releaseResult.data as ReleasePreview | null)
    : null;
  const rows = !queueResult.error && payload?.contract === "net-it-pub1-review-v1" &&
    Array.isArray(payload.items) && payload.items.length === 5
      ? payload.items : null;
  const sources = rows ? Array.from(
    new Map(rows.map((row) => [row.run_id, row])).values(),
  ) : [];
  const approved = rows?.filter(
    (row) => row.source_status === "approved" &&
      row.candidate_status === "approved_company_data" &&
      row.publisher_eligibility_reason === "eligible_minimal_preview" &&
      !row.canonical_collision,
  ).length ?? 0;
  const published = rows?.filter((row) => row.already_published).length ?? 0;
  const canRelease = canPublish && rows !== null && published === 0 &&
    releasePreview?.status === "ready_for_attested_commit" &&
    releasePreview?.requested === 5 && releasePreview?.eligible === 5 &&
    typeof releasePreview?.manifest_fingerprint === "string" &&
    /^[a-f0-9]{64}$/.test(releasePreview.manifest_fingerprint);

  return (
    <main className="mx-auto w-full max-w-[1460px] space-y-3 px-2 py-3 sm:px-5 sm:py-5"
      aria-label="Pubblicazione carpenterie italiane - primo lotto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/platform/company-discovery/carpenterie"
          className="text-xs font-semibold text-[#176447] underline underline-offset-4">
          ← Torna alle carpenterie
        </Link>
        <span className="rounded-full border border-[#cbdcd2] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#365f4d]">
          Solo revisori Platform · Nessuna pubblicazione automatica
        </span>
      </div>

      <header className="rounded-2xl border border-[#d7e6dc] bg-white p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#297056]">Network Italia · Prima pubblicazione</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#173e33] sm:text-2xl">Cinque carpenterie da pubblicare</h1>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[#53665c]">
              Verifica le tre raccolte di origine, poi approva soltanto i dati aziendali delle cinque schede.
              Il profilo mostrerà nome, sito e il ruolo industriale di terzista/carpenteria,
              con fonte registrata e stato non verificato. L'azienda potrà rivendicarlo e arricchirlo.
            </p>
          </div>
          <div className="rounded-xl border border-[#c9ded2] bg-[#f5faf7] px-4 py-2 text-center">
            <p className="text-2xl font-bold tabular-nums text-[#175840]">{published} / 5</p>
            <p className="text-[11px] text-[#456b58]">Profili pubblicati</p>
            <p className="text-[11px] text-[#456b58]">{approved} pronti alla pubblicazione</p>
          </div>
        </div>
        <p className="mt-2 text-xs font-medium text-[#8b5714]">
          Il pubblicatore originale rimane disattivato. Solo la conferma finale di un amministratore
          autorizzato può eseguire la pubblicazione atomica delle cinque schede.
          La semplice revisione non pubblica aziende.
        </p>
      </header>

      {params.error ? (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{params.error}</p>
      ) : null}
      {params.message ? (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{params.message}</p>
      ) : null}

      {!rows ? (
        <section className="rounded-2xl border border-amber-200 bg-white p-5 text-sm text-[#6b5331]">
          La vista di revisione non è ancora attiva sul database oppure il lotto non contiene esattamente cinque aziende.
          Nessuna approvazione è consentita finché la migrazione protetta non sarà disponibile.
        </section>
      ) : (
        <>
          <section aria-label="Revisione delle fonti" className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-[#173f35]">1. Le tre fonti di origine</h2>
              <p className="text-[11px] text-[#6b7b70]">
                Ogni decisione riguarda l&apos;intera raccolta, non solo le aziende di questo lotto.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {sources.map((source) => (
                <article key={source.run_id} className="rounded-xl border border-[#d7e6dc] bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold leading-5 text-[#173f35]">{source.run_label}</h3>
                    <ReviewStatus done={source.source_status === "approved"}
                      title={source.source_status === "approved" ? "Fonte approvata" : "Da rivedere"} />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#5d6b61]">
                    {source.run_total_candidates} aziende nella raccolta; {rows.filter((row) => row.run_id === source.run_id).length} nel primo lotto.
                  </p>
                  <p className="mt-1 text-[11px] text-[#76847a]">
                    Riuso: {source.terms_status} · Dati: {source.personal_data_policy}
                  </p>
                  <form action={reviewNetItPub1Source} className="mt-3 space-y-2">
                    <input type="hidden" name="run_id" value={source.run_id}/>
                    <label className="block text-[11px] font-semibold text-[#3b5f4d]">
                      Esito della verifica
                      <select name="decision" required defaultValue="" className={selectClass}>
                        <option value="" disabled>Seleziona dopo la verifica</option>
                        <option value="approved">Approva la fonte</option>
                        <option value="restricted">Utilizzo limitato / da chiarire</option>
                        <option value="blocked">Blocca la fonte</option>
                      </select>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-[11px] font-semibold text-[#3b5f4d]">
                        Termini del sito
                        <select name="terms_status" required defaultValue="" className={selectClass}>
                          <option value="" disabled>Seleziona</option>
                          <option value="allows_limited_reuse">Riuso limitato consentito</option>
                          <option value="allows_reuse">Riuso consentito</option>
                          <option value="unknown">Non determinati</option>
                          <option value="restricts_reuse">Riuso limitato</option>
                        </select>
                      </label>
                      <label className="block text-[11px] font-semibold text-[#3b5f4d]">
                        Diritti sui dati
                        <select name="database_rights_status" required defaultValue="" className={selectClass}>
                          <option value="" disabled>Seleziona</option>
                          <option value="low_risk">Basso rischio</option>
                          <option value="licensed">Autorizzati</option>
                          <option value="unknown">Non accertati</option>
                          <option value="restricted">Restrizioni</option>
                        </select>
                      </label>
                    </div>
                    <label className="block text-[11px] font-semibold text-[#3b5f4d]">
                      Dati utilizzabili
                      <select name="personal_data_policy" required defaultValue="" className={selectClass}>
                        <option value="" disabled>Seleziona</option>
                        <option value="exclude_personal_data">Solo aziendali; escludi personali</option>
                        <option value="company_data_only">Solo dati aziendali</option>
                        <option value="legal_review_required">Ulteriore revisione</option>
                      </select>
                    </label>
                    <label className="block text-[11px] font-semibold text-[#3b5f4d]">
                      Evidenza e motivazione
                      <textarea name="note" required minLength={20} maxLength={4000}
                        placeholder="Descrivi la verifica realmente effettuata..."
                        rows={2} className={inputClass + " resize-y"} />
                    </label>
                    <button type="submit" className={buttonClass}>Registra verifica fonte</button>
                  </form>
                </article>
              ))}
            </div>
          </section>

          <section aria-label="Revisione delle aziende" className="space-y-2">
            <h2 className="text-base font-bold text-[#173f35]">2. Le cinque carpenterie</h2>
            <div className="space-y-2">
              {rows.map((row) => {
                const sourceApproved = row.source_status === "approved";
                const companyApproved = row.candidate_status === "approved_company_data";
                return (
                  <article key={row.candidate_id}
                    className="rounded-xl border border-[#d7e6dc] bg-white p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-[#173f35]">
                          {row.proposed_public_name ?? row.private_legal_name}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-[#5d7064]">
                          {row.canonical_domain} · {row.locality_unverified ?? "Sede da verificare"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <ReviewStatus done={sourceApproved}
                          title={sourceApproved ? "Fonte OK" : "Fonte da approvare"}/>
                        <ReviewStatus done={companyApproved}
                          title={companyApproved ? "Scheda approvata" : "Scheda da approvare"}/>
                        {row.canonical_collision ? (
                          <span className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-800">Possibile duplicato</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <EvidenceLink url={row.identity_source} label="Identità sul sito aziendale"/>
                      <EvidenceLink url={row.activity_source} label="Attività produttiva"/>
                      {row.first_party_name_observed && row.first_party_name_observed !== row.proposed_public_name ? (
                        <span className="text-[11px] text-[#5b6a60]">Nome sul sito: {row.first_party_name_observed}</span>
                      ) : null}
                      {row.proposed_public_name !== row.private_legal_name ? (
                        <span className="text-[11px] text-[#98622b]">
                          Denominazione nel database: {row.private_legal_name}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 border-t border-[#edf2ed] pt-2">
                      {!sourceApproved ? (
                        <p className="text-xs text-[#89631d]">Prima completa la verifica della relativa fonte qui sopra.</p>
                      ) : row.already_published ? (
                        <p className="text-xs font-semibold text-[#176447]">Azienda già collegata a un profilo pubblico.</p>
                      ) : row.canonical_collision ? (
                        <p className="text-xs font-semibold text-rose-700">Identità da riconciliare prima di qualunque pubblicazione.</p>
                      ) : companyApproved ? (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-[#176447]">
                            Dati aziendali approvati. Esito pubblicatore: {row.publisher_eligibility_reason ?? "da verificare"}.
                          </p>
                          <p className="text-xs text-[#51735d]">
                            Questa scheda entra nel lotto di cinque quando tutte le fonti e
                            tutte le identità sono approvate. Non viene pubblicata separatamente.
                          </p>
                        </div>
                      ) : (
                        <form action={reviewNetItPub1Candidate}
                          className="grid gap-2 md:grid-cols-[minmax(170px,1fr)_minmax(250px,1.5fr)_auto] md:items-end">
                          <input type="hidden" name="candidate_id" value={row.candidate_id}/>
                          <label className="text-[11px] font-semibold text-[#3b5f4d]">
                            Decisione sulla scheda
                            <select name="decision" required defaultValue="" className={selectClass}>
                              <option value="" disabled>Seleziona</option>
                              <option value="approved_company_data">Approva soli dati aziendali</option>
                              <option value="needs_legal_review">Richiede altra verifica</option>
                              <option value="blocked">Escludi questa scheda</option>
                            </select>
                          </label>
                          <label className="text-[11px] font-semibold text-[#3b5f4d]">
                            Evidenza e motivazione
                            <input name="note" required minLength={20} maxLength={4000}
                              className={inputClass} placeholder="Motivo e controllo identità effettuato"/>
                          </label>
                          <button className={buttonClass} type="submit">Registra</button>
                          <label className="md:col-span-3 flex items-center gap-2 text-[11px] text-[#506658]">
                            <input type="checkbox" name="personal_data_detected" className="h-4 w-4 accent-[#176447]"/>
                            Sono presenti dati personali da escludere (in questo caso non selezionare «Approva»)
                          </label>
                          <input name="personal_data_fields" maxLength={500} className={inputClass + " md:col-span-3"}
                            placeholder="Se presenti: indica i campi personali separati da virgola"/>
                        </form>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section aria-label="Pubblicazione finale delle cinque aziende"
            className="rounded-xl border border-[#b8d8c4] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-[#173f35]">3. Pubblica le cinque aziende insieme</h2>
              <ReviewStatus done={canRelease || published === 5}
                title={published === 5 ? "Lotto già pubblicato" :
                  canRelease ? "Anteprima pronta" : "Attende approvazioni"} />
            </div>
            <p className="mt-1 text-xs leading-5 text-[#53685a]">
              L&apos;operazione usa il pubblicatore minimale già presente nel Network.
              Se una sola scheda è incompleta, non pubblica nessuna azienda.
              I cinque nuovi profili saranno non rivendicati e non verificati.
            </p>
            <p className="mt-2 text-xs font-semibold text-[#2b5942]">
              Anteprima: {releasePreview?.eligible ?? 0} su {releasePreview?.requested ?? 5} ammissibili.
              {releasePreview?.status === "blocked" ? " Completa prima le approvazioni." : ""}
            </p>
            {canRelease ? (
              <form action={publishNetItPub1All} className="mt-3 space-y-2">
                <input type="hidden" name="manifest_fingerprint"
                  value={releasePreview?.manifest_fingerprint ?? ""}/>
                <label className="block text-xs font-semibold text-[#3b5f4d]">
                  Nota finale della revisione
                  <textarea name="review_note" required minLength={80} maxLength={2000} rows={3}
                    className={inputClass + " mt-1 resize-y"}
                    placeholder="Descrivi quali fonti e denominazioni sono state approvate e perché sono pubblicabili solo dati aziendali essenziali."/>
                </label>
                <label className="flex items-start gap-2 text-xs leading-5 text-[#3c5e4b]">
                  <input type="checkbox" name="attested" required
                    className="mt-1 h-4 w-4 accent-[#176447]"/>
                  Ho controllato le cinque identità, le decisioni sulle fonti,
                  l&apos;assenza di dati personali da pubblicare e l&apos;anteprima del lotto.
                </label>
                <button type="submit" className={buttonClass}>
                  Pubblica 5 profili minimi
                </button>
              </form>
            ) : published === 5 ? (
              <p className="mt-2 text-sm font-semibold text-[#176447]">
                Tutti i cinque candidati risultano collegati a profili pubblici.
                <Link href="/network" className="ml-2 underline underline-offset-4">Apri il Network</Link>
              </p>
            ) : (
              <p className="mt-2 text-xs text-[#86602b]">
                {!releasePreview ? "Funzione di pubblicazione non ancora installata nel database." :
                  !canPublish ? "Non disponi del permesso Platform per pubblicare." :
                  "L'anteprima non è ancora pronta per la conferma."}
              </p>
            )}
            <p className="mt-2 text-[11px] leading-5 text-[#64766b]">
              La categoria terzista/carpenteria sarà registrata con la fonte, ma non attribuita
              come certificazione dell'azienda. Restano esclusi testi copiati, immagini e recapiti personali.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
