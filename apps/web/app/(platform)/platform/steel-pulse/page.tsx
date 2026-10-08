import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getPlatformStaffDirectory, getPlatformStaffInvitations, requirePlatformConsoleContext } from "@/lib/platform-admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Steel Pulse · Preparazione editoriale" };
export const dynamic = "force-dynamic";

type Readiness = {
  source_status: string;
  license_basis: string;
  rights_valid: boolean;
  source_review_assigned: boolean;
  independent_legal_reviewer_assigned: boolean;
  policy_registered: boolean;
  approval_evidence_registered: boolean;
  terms_reviewed: boolean;
  rss_registered: boolean;
  public_enabled: boolean;
  items_staged: number;
  cards_published: number;
  ready_to_ingest: boolean;
};

function validReadiness(value: unknown): value is Readiness {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const x = value as Record<string, unknown>;
  return ["rights_valid","source_review_assigned","independent_legal_reviewer_assigned",
    "policy_registered","approval_evidence_registered","terms_reviewed","rss_registered",
    "public_enabled","ready_to_ingest"].every((k) => typeof x[k] === "boolean") &&
    typeof x.source_status === "string" && typeof x.license_basis === "string" &&
    Number.isInteger(x.items_staged) && Number.isInteger(x.cards_published);
}

function Check({ ok, name, explanation }: { ok: boolean; name: string; explanation: string }) {
  return (
    <li className="flex items-start gap-3 border-b border-[#e3ebe6] py-3 last:border-b-0">
      <span aria-hidden="true" className={ok ? "font-bold text-[#176245]" : "font-bold text-[#a3691b]"}>
        {ok ? "✓" : "○"}
      </span>
      <div>
        <p className="text-sm font-semibold text-[#143b2c]">{name}</p>
        <p className="mt-1 text-xs leading-5 text-[#5b6b60]">{explanation}</p>
      </div>
    </li>
  );
}

export default async function SteelPulseReadinessPage() {
  const context = await requirePlatformConsoleContext();
  if (!context.is_platform_owner) redirect("/platform");

  const supabase = await createClient();
  const [staff, invitations, result] = await Promise.all([
    getPlatformStaffDirectory(),
    getPlatformStaffInvitations(),
    supabase.rpc("sp71_pilot_source_readiness"),
  ]);
  const rights = !result.error && validReadiness(result.data) ? result.data : null;
  const active = staff.filter((person) => person.status === "active");
  const authors = active.filter((person) => person.roles.includes("knowledge_editor"));
  const reviewers = active.filter((person) =>
    person.roles.includes("knowledge_editor") || person.roles.includes("knowledge_publisher"));
  const independentReview = authors.some((author) =>
    reviewers.some((reviewer) => reviewer.user_id !== author.user_id));
  const pending = invitations.filter((invitation) => invitation.status === "pending" &&
    invitation.roles.some((role) => role === "knowledge_editor" || role === "knowledge_publisher"));
  const publicOff = rights !== null && !rights.public_enabled;

  return (
    <div className="uxf2-dense-page mx-auto max-w-[1060px] space-y-5">
      <section className="rounded-3xl border border-[#dce7df] bg-white p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-widest text-[#20664b]">SP7.1 · Solo Platform Owner</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#123d34] sm:text-3xl">Steel Pulse · Preparazione editoriale</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#526258]">
          Verifica persone, separazione dei compiti e diritti prima di acquisire o pubblicare la prima notizia.
          Questa schermata non concede autorizzazioni né attiva il feed.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-[#ecf5ee] px-3 py-2 text-[#1e674b]">DG Trade · {rights?.source_status ?? "Verifica non disponibile"}</span>
          <span className="rounded-full bg-[#fff3df] px-3 py-2 text-[#806024]">{publicOff ? "Feed pubblico spento" : "Verificare stato pubblicazione"}</span>
        </div>
        {!rights ? <p role="alert" className="mt-4 text-sm font-semibold text-[#9a6518]">
          Il controllo del database non è disponibile: nessuna fonte può essere considerata pronta.
        </p> : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#dce7df] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#123d34]">1 · Operatori indipendenti</h2>
          <ul className="mt-2">
            <Check ok={authors.length > 0} name="Autore abilitato"
              explanation={authors.length ? String(authors.length) + " Knowledge Editor attivi." : "Invitare almeno un Knowledge Editor reale."}/>
            <Check ok={independentReview} name="Secondo revisore distinto"
              explanation={independentReview ? "Almeno due identità reali disponibili per redazione e revisione." : "Serve una persona distinta dall'autore, con permesso knowledge.review."}/>
            <Check ok={true} name="Controllo legale riservato all'Owner"
              explanation="Il Platform Owner non può essere autore o revisore della medesima notizia."/>
          </ul>
          <p className="mt-3 text-xs text-[#66766b]">{pending.length} inviti editoriali pendenti. Gli inviti non equivalgono ad account attivi.</p>
          <Link href="/platform/people#editorial-staff-invite" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[#1e604a] px-4 text-sm font-semibold text-white">
            Gestisci inviti e ruoli →
          </Link>
        </section>

        <section className="rounded-2xl border border-[#dce7df] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#123d34]">2 · Diritti della fonte</h2>
          <ul className="mt-2">
            <Check ok={!!rights?.rss_registered} name="RSS ufficiale registrato"
              explanation="Da verificare robots.txt, risposta del feed e protezione DNS/SSRF prima di eseguire il crawler."/>
            <Check ok={!!rights?.policy_registered} name="Condizioni UE documentate"
              explanation="La licenza generale non sostituisce la verifica delle eccezioni sul singolo contenuto."/>
            <Check ok={!!rights?.approval_evidence_registered && !!rights?.terms_reviewed}
              name="Evidenza di riutilizzo e termini verificati" explanation="Le decisioni devono essere documentate, con data di riesame."/>
            <Check ok={!!rights?.source_review_assigned && !!rights?.independent_legal_reviewer_assigned}
              name="Doppia revisione diritti" explanation="Revisione editoriale e legale affidate a persone differenti."/>
            <Check ok={!!rights?.rights_valid} name="Fonte autorizzata" explanation="Senza tutti i controlli SP2/SP3 la fonte resta candidata."/>
          </ul>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-[#1b624b]">
            <a href="https://commission.europa.eu/legal-notice_en" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Licenza UE ↗</a>
            <a href="https://policy.trade.ec.europa.eu/node/2/rss_en" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">RSS ↗</a>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-[#dce7df] bg-white p-5">
        <h2 className="text-lg font-semibold text-[#123d34]">3 · Prima scheda pilota</h2>
        <p className="mt-2 text-sm font-medium text-[#183f2f]">Acciaio importato nell'UE: il Paese di fusione e colata.</p>
        <p className="mt-1 text-sm leading-6 text-[#526258]">
          Sintesi originale da sottoporre a fact-check e approvazione item-specifica.
          Non presumere che tutti i tubi rientrino nelle stesse misure doganali.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-[#526258]">
          <span>Item acquisiti: <strong>{rights?.items_staged ?? "—"}</strong></span>
          <span>Card pubblicate: <strong>{rights?.cards_published ?? "—"}</strong></span>
          <span>Ingestione: <strong>{rights?.ready_to_ingest ? "Diritti DB presenti; rete da verificare" : "Bloccata"}</strong></span>
        </div>
        <a className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#1b624b] underline underline-offset-4"
          target="_blank" rel="noopener noreferrer"
          href="https://policy.trade.ec.europa.eu/news/commission-sets-type-evidence-be-provided-importers-prove-country-melt-and-pour-steel-products-2026-08-31_en">
          Apri il comunicato DG Trade originale ↗
        </a>
      </section>
    </div>
  );
}
