import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PrivateDiscountProfilesPanel } from "@/components/private-discount-profiles-panel";
import { PublicPriceListExplorer } from "@/components/public-price-list-explorer";
import {
  getPriceListExplorerItems,
  getPriceListExplorerVersion,
  getPriceListPublicationReadiness,
  getPriceListPublicNotices,
  getPriceListSourceRightsReview,
  getPrivatePricingContext,
} from "@/lib/price-list-explorer-server";
import { absoluteUrl } from "@/lib/site";

type Params = Promise<{ versionId: string }>;
type SearchParams = Promise<{ preview?: string }>;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatDate(value: string | null) {
  if (!value) return "Data non indicata";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value + "T00:00:00Z"));
}

function readinessIssueLabel(code: string) {
  if (code === "publication_rights_not_approved") {
    return "Diritti di ripubblicazione pubblica dei dati strutturati non ancora approvati.";
  }
  if (code === "delivery_term_conflict") {
    return "Termine di resa incoerente nella fonte: copertina FCA, tabelle Ex-Work.";
  }
  if (code === "version_not_verified") {
    return "La versione deve completare la review e passare allo stato verified.";
  }
  if (code === "publication_scope_not_public") {
    return "La visibilità della versione è ancora internal.";
  }
  if (code === "commercial_price_incomplete") {
    return "Una o più righe non hanno Base + Extra €/m governati.";
  }
  if (code === "immutable_source_missing") {
    return "La fonte immutabile SHA-256 non è disponibile.";
  }
  if (code === "import_errors_present") {
    return "L'import promosso contiene ancora righe in errore.";
  }
  return code.replaceAll("_", " ");
}

function readinessWarningLabel(code: string, count?: number) {
  const suffix = typeof count === "number" ? " (" + count.toLocaleString("it-IT") + ")" : "";
  if (code === "partial_eur_t_coverage") return "Copertura €/t parziale" + suffix;
  if (code === "bounded_technical_review_rows") return "Righe con identità tecnica ancora in review" + suffix;
  if (code === "unresolved_standard") return "Norma non risolta/ambigua" + suffix;
  if (code === "no_compatible_weight_reference") return "Peso governato compatibile non disponibile" + suffix;
  if (code === "special_shape_without_weight") return "Profili speciali senza peso governato" + suffix;
  if (code === "non_automated_source_rules") return "Condizioni fonte non automatizzate" + suffix;
  if (code === "source_grade_label_conflict") return "Conflitti di etichetta grado preservati dalla fonte" + suffix;
  return code.replaceAll("_", " ") + suffix;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { versionId } = await params;
  const query = await searchParams;
  const includeInternal = query.preview === "1";

  if (!isUuid(versionId)) {
    return {
      title: "Listino non disponibile",
      robots: { index: false, follow: false },
    };
  }

  const version = await getPriceListExplorerVersion(versionId, includeInternal);
  if (!version) {
    return {
      title: "Listino non disponibile",
      robots: { index: false, follow: false },
    };
  }

  const canonicalPath = "/listini/" + version.version_id;
  return {
    title: version.list_name + " · " + version.manufacturer_version_code,
    description:
      "Listino interattivo " +
      version.list_name +
      ": filtra articoli, applica uno sconto temporaneo e calcola netto €/m e €/t dove il peso è governato.",
    alternates: {
      canonical: absoluteUrl(canonicalPath),
    },
    robots: version.is_internal_preview
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: version.list_name + " · " + version.manufacturer_version_code,
      description:
        "Listino produttore strutturato con Base, Extra, sconto temporaneo, netto €/m e €/t governato.",
      url: absoluteUrl(canonicalPath),
      type: "website",
    },
  };
}

export default async function PriceListExplorerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { versionId } = await params;
  const query = await searchParams;
  const includeInternal = query.preview === "1";

  if (!isUuid(versionId)) notFound();

  const [version, items, privatePricing, publicNotices] = await Promise.all([
    getPriceListExplorerVersion(versionId, includeInternal),
    getPriceListExplorerItems(versionId, includeInternal),
    getPrivatePricingContext(versionId),
    getPriceListPublicNotices(versionId, includeInternal),
  ]);

  if (!version) {
    if (includeInternal && !privatePricing.authenticated) {
      redirect(
        "/login?next=" +
          encodeURIComponent("/listini/" + versionId + "?preview=1"),
      );
    }
    notFound();
  }

  const [publicationReadiness, sourceRightsReview] = version.is_internal_preview
    ? await Promise.all([
        getPriceListPublicationReadiness(versionId),
        getPriceListSourceRightsReview(versionId),
      ])
    : [null, null];

  const readyPct =
    version.item_count > 0
      ? Math.round((version.price_per_t_ready_count / version.item_count) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-[1320px] space-y-5 px-3 py-5 sm:px-5 sm:py-7 lg:px-6">
      <nav className="text-xs font-semibold text-[#66736e]" aria-label="Breadcrumb">
        <Link href="/listini" className="hover:text-[#173f35]">
          Listini
        </Link>
        <span className="mx-2">/</span>
        <span className="text-[#1d2824]">{version.manufacturer_version_code}</span>
      </nav>

      {version.is_internal_preview ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Anteprima interna · questa versione è in stato <strong>{version.version_status}</strong> e non è
          visibile né indicizzabile per il pubblico.
        </div>
      ) : null}

      {publicationReadiness ? (
        <section
          className={[
            "rounded-2xl border p-4 sm:p-5",
            publicationReadiness.ready_to_publish
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50",
          ].join(" ")}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#173f35]">
                PP1 · Publication Readiness
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
                {publicationReadiness.ready_to_publish
                  ? "Pronto per la pubblicazione"
                  : "Pubblicazione bloccata"}
              </h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-[#66736e]">
                Questo controllo è visibile solo nell&apos;anteprima interna e non modifica automaticamente
                lo stato del listino.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-white/80 px-3 py-2">
                <p className="text-[10px] text-[#718078]">€/m</p>
                <p className="mt-0.5 text-sm font-bold text-[#173f35]">
                  {publicationReadiness.metrics.price_per_m_ready.toLocaleString("it-IT")}
                </p>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-2">
                <p className="text-[10px] text-[#718078]">€/t</p>
                <p className="mt-0.5 text-sm font-bold text-[#173f35]">
                  {publicationReadiness.metrics.price_per_t_coverage_pct.toLocaleString("it-IT")}%
                </p>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-2">
                <p className="text-[10px] text-[#718078]">Articoli</p>
                <p className="mt-0.5 text-sm font-bold text-[#173f35]">
                  {publicationReadiness.metrics.item_count.toLocaleString("it-IT")}
                </p>
              </div>
            </div>
          </div>

          {publicationReadiness.blockers.length > 0 ? (
            <div className="mt-4 border-t border-amber-200 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900">
                Blocker
              </p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 text-amber-950">
                {publicationReadiness.blockers.map((issue) => (
                  <li key={issue.code}>• {readinessIssueLabel(issue.code)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {publicationReadiness.warnings.length > 0 ? (
            <div className="mt-4 border-t border-amber-200 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#66736e]">
                Warning governati
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {publicationReadiness.warnings.map((issue) => (
                  <span
                    key={issue.code}
                    className="rounded-full border border-[#d8dfdc] bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-[#596761]"
                  >
                    {readinessWarningLabel(issue.code, issue.count ?? issue.missing)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {sourceRightsReview ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-900">
                PP1.1 · Publication Rights
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
                Autorizzazione scritta richiesta prima della pubblicazione
              </h2>
              <p className="mt-2 text-xs leading-5 text-[#66736e]">
                Citare Padana Tubi come fonte non costituisce, da solo, un&apos;autorizzazione alla
                riproduzione o al reimpiego pubblico del listino strutturato. La decisione corrente è{" "}
                <strong>{sourceRightsReview.decision}</strong> e i dati restano{" "}
                <strong>{sourceRightsReview.structured_data_visibility}</strong>.
              </p>
              {sourceRightsReview.evidence_snapshot.public_linking_policy ? (
                <p className="mt-2 text-xs leading-5 text-[#66736e]">
                  {sourceRightsReview.evidence_snapshot.public_linking_policy}
                </p>
              ) : null}
            </div>

            {sourceRightsReview.terms_reference ? (
              <a
                href={sourceRightsReview.terms_reference}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-900 hover:bg-rose-100"
              >
                Note legali della fonte
              </a>
            ) : null}
          </div>

          {sourceRightsReview.evidence_snapshot.required_next_evidence ? (
            <div className="mt-4 border-t border-rose-200 pt-3 text-xs leading-5 text-rose-950">
              <strong>Per sbloccare:</strong>{" "}
              {sourceRightsReview.evidence_snapshot.required_next_evidence}
            </div>
          ) : null}
        </section>
      ) : null}

      <header className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              {version.list_code} · {formatDate(version.source_date)}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1d2824] sm:text-4xl">
              {version.list_name}
            </h1>
            <p className="mt-2 text-base font-medium text-[#52615b]">
              {version.manufacturer_version_code}
              {version.manufacturer_revision_code
                ? " · " + version.manufacturer_revision_code
                : ""}
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#66736e]">
              Il listino applica esclusivamente la formula commerciale strutturata per questa versione.
              Puoi usare uno sconto temporaneo oppure, con un account aziendale, applicare profili sconto
              privati salvati per produttore, listino, versione, grado o finitura.
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[260px]">
            <div className="rounded-xl bg-[#f7f9f8] p-3">
              <p className="text-xs text-[#7a8781]">Articoli</p>
              <p className="mt-1 text-xl font-semibold text-[#1d2824]">
                {version.item_count.toLocaleString("it-IT")}
              </p>
            </div>
            <div className="rounded-xl bg-[#edf5f2] p-3">
              <p className="text-xs text-[#527268]">€/t disponibile</p>
              <p className="mt-1 text-xl font-semibold text-[#173f35]">
                {readyPct}%
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-[#edf0ee] pt-4">
          {version.grade_codes.slice(0, 10).map((grade) => (
            <span
              key={grade}
              className="rounded-full border border-[#dce2df] bg-[#f8faf9] px-2.5 py-1 text-[10px] font-semibold text-[#596761]"
            >
              {grade}
            </span>
          ))}
        </div>
      </header>

      {publicNotices.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-[#fffaf0] p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-900">
            Condizioni della fonte non automatizzate
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[#1d2824]">
            Il calcolo automatico non sostituisce tutte le condizioni d&apos;ordine
          </h2>
          <div className="mt-3 grid gap-2">
            {publicNotices.map((notice) => (
              <div key={notice.notice_code} className="rounded-xl border border-amber-100 bg-white px-3 py-3">
                <p className="text-xs font-bold text-[#43524c]">{notice.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#66736e]">{notice.body}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <PrivateDiscountProfilesPanel
        versionId={versionId}
        items={items}
        context={privatePricing}
      />

      <PublicPriceListExplorer
        version={version}
        items={items}
        privatePricing={privatePricing}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Formula commerciale
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Base scontata + Extra fisso
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Netto €/m = Base €/m × (1 − sconto) + Extra €/m. Il frontend non applica lo
            sconto all&apos;Extra quando il contratto del listino lo dichiara non scontabile.
          </p>
        </div>

        <div className="rounded-2xl border border-[#dce2df] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
            Peso e €/t
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Nessun peso viene inventato
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Il prezzo €/t appare solo quando l&apos;articolo possiede un kg/m accettato nel layer
            governato. Se norma o geometria non sono risolte, il listino continua a funzionare
            in €/m e mostra esplicitamente il motivo dell&apos;assenza di €/t.
          </p>
        </div>
      </section>

      {version.source_terms_raw ? (
        <details className="rounded-2xl border border-[#dce2df] bg-[#f7f9f8]">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[#43524c]">
            Condizioni e note della fonte
          </summary>
          <div className="border-t border-[#e2e7e4] px-5 py-4 text-sm leading-6 text-[#66736e]">
            {version.source_terms_raw}
          </div>
        </details>
      ) : null}
    </div>
  );
}
