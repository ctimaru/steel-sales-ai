import Link from "next/link";
import { notFound } from "next/navigation";

import {
  getPlatformAccessContext,
  requirePlatformPermission,
} from "@/lib/platform-admin";
import {
  getPlatformKnowledgePage,
  type KnowledgeContentType,
  type KnowledgeDraftPayload,
} from "@/lib/platform-knowledge";

import {
  publishKnowledgePage,
  reviewKnowledgeDraft,
  saveKnowledgeDraft,
  submitKnowledgeReview,
} from "../../actions";

function pretty(value: unknown) {
  return JSON.stringify(value ?? [], null, 2);
}

function text(value: string | null | undefined) {
  return value ?? "";
}

function publicHref(type: KnowledgeContentType, slug: string) {
  return type === "standard"
    ? `/knowledge/norme/${slug}`
    : `/knowledge/gradi/${slug}`;
}

function readonlyField(label: string, value: string | null | undefined) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-[#91a0b2]">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#40516a]">
        {value || "—"}
      </p>
    </div>
  );
}

function DraftReadOnly({
  type,
  payload,
}: {
  type: KnowledgeContentType;
  payload: KnowledgeDraftPayload;
}) {
  return (
    <div className="space-y-5">
      {readonlyField("SEO title", payload.seo_title)}
      {readonlyField("SEO description", payload.seo_description)}
      {readonlyField("Introduzione", payload.intro)}
      {type === "standard"
        ? readonlyField("Cosa copre", payload.what_it_covers)
        : readonlyField(
            "Spiegazione designazione",
            payload.designation_explanation,
          )}
      {type === "standard"
        ? readonlyField("Come leggere", payload.how_to_read)
        : null}
      {readonlyField("Applicazioni tipiche", payload.typical_applications)}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#91a0b2]">
          Sezioni editoriali
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-[#f6f8fb] p-4 text-xs leading-5 text-[#40516a]">
          {pretty(payload.editorial_sections)}
        </pre>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#91a0b2]">
          FAQ
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-[#f6f8fb] p-4 text-xs leading-5 text-[#40516a]">
          {pretty(payload.faq)}
        </pre>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-[#91a0b2]">
          Fonti
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-[#f6f8fb] p-4 text-xs leading-5 text-[#40516a]">
          {pretty(payload.source_references)}
        </pre>
      </div>
      {readonlyField(
        "Related slugs",
        (payload.related_slugs ?? []).join("\n"),
      )}
    </div>
  );
}

export default async function PlatformKnowledgeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requirePlatformPermission("knowledge.read_drafts");
  const [{ type: rawType, id }, query, access] = await Promise.all([
    params,
    searchParams,
    getPlatformAccessContext(),
  ]);

  if (rawType !== "standard" && rawType !== "grade") notFound();
  const type = rawType as KnowledgeContentType;
  const page = await getPlatformKnowledgePage(type, id);
  if (!page) notFound();

  const permissions = access?.permissions ?? [];
  const canEdit = permissions.includes("knowledge.edit");
  const canReview = permissions.includes("knowledge.review");
  const canPublish = permissions.includes("knowledge.publish");
  const canEditNow =
    canEdit && page.workflow_status !== "in_review";
  const canSubmit =
    canEdit &&
    page.ready &&
    ["draft", "changes_requested"].includes(page.workflow_status);
  const canReviewNow =
    canReview && page.workflow_status === "in_review";
  const hasUnpublishedApprovedDraft =
    page.workflow_status === "approved" &&
    (page.page_status !== "published" ||
      page.draft_version !== page.live_version);
  const canPublishNow = canPublish && hasUnpublishedApprovedDraft;
  const canUnpublish = canPublish && page.page_status === "published";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <Link
          href="/platform/knowledge"
          className="text-xs font-semibold text-[#2f6fed]"
        >
          ← Knowledge Operations
        </Link>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="platform-kicker">
              {type === "standard" ? "Standard editoriale" : "Grado editoriale"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
              {page.label}
            </h1>
            <p className="mt-2 text-sm text-[#66768d]">
              {page.subtitle || page.slug}
            </p>
          </div>
          <Link
            href={publicHref(type, page.slug)}
            className="platform-secondary inline-flex h-10 items-center rounded-xl px-4 text-sm font-semibold"
          >
            Apri pagina pubblica ↗
          </Link>
        </div>
      </section>

      {query.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {query.message}
        </div>
      ) : null}
      {query.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {query.error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Workflow", page.workflow_status.replaceAll("_", " ")],
          ["Live", page.page_status],
          ["Draft version", page.draft_version],
          ["Live version", page.live_version],
          ["Readiness", page.ready ? "ready" : "blocked"],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[#e1e8f2] bg-white p-4"
          >
            <p className="text-lg font-semibold text-[#1e2b45]">
              {String(value)}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#8fa1a9]">
              {label}
            </p>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
        <strong>Boundary SA7:</strong> salvare o revisionare questa bozza non
        modifica la pagina pubblica. Solo una pubblicazione esplicita con
        <code className="mx-1 rounded bg-white/70 px-1.5 py-0.5">
          knowledge.publish
        </code>
        copia la bozza approvata nella versione live.
      </div>

      {!page.ready ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Publication blockers</p>
          <p className="mt-1">{page.blockers.join(", ")}</p>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <section className="rounded-2xl border border-[#e1e8f2] bg-white p-5 sm:p-6">
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">
              Draft v{page.draft_version}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1e2b45]">
              Copia editoriale
            </h2>
            {page.workflow_status === "in_review" ? (
              <p className="mt-2 text-sm text-[#68788e]">
                Bozza congelata in revisione. Un Editor potrà modificarla di nuovo
                dopo una richiesta di modifiche oppure dopo la pubblicazione del
                ciclo corrente.
              </p>
            ) : null}
          </div>

          {canEditNow ? (
            <form action={saveKnowledgeDraft} className="space-y-5">
              <input type="hidden" name="content_type" value={type} />
              <input type="hidden" name="page_id" value={page.page_id} />

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  SEO title
                </span>
                <input
                  name="seo_title"
                  defaultValue={text(page.draft_payload.seo_title)}
                  className="mt-2 h-11 w-full rounded-xl border border-[#dbe5f1] px-3 text-sm outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  SEO description
                </span>
                <textarea
                  name="seo_description"
                  rows={3}
                  defaultValue={text(page.draft_payload.seo_description)}
                  className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 text-sm leading-6 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  Introduzione
                </span>
                <textarea
                  name="intro"
                  rows={6}
                  defaultValue={text(page.draft_payload.intro)}
                  className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 text-sm leading-6 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                />
              </label>

              {type === "standard" ? (
                <>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                      Cosa copre
                    </span>
                    <textarea
                      name="what_it_covers"
                      rows={7}
                      defaultValue={text(page.draft_payload.what_it_covers)}
                      className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 text-sm leading-6 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                      Come leggere
                    </span>
                    <textarea
                      name="how_to_read"
                      rows={6}
                      defaultValue={text(page.draft_payload.how_to_read)}
                      className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 text-sm leading-6 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                    />
                  </label>
                </>
              ) : (
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                    Spiegazione designazione
                  </span>
                  <textarea
                    name="designation_explanation"
                    rows={7}
                    defaultValue={text(
                      page.draft_payload.designation_explanation,
                    )}
                    className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 text-sm leading-6 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  Applicazioni tipiche
                </span>
                <textarea
                  name="typical_applications"
                  rows={5}
                  defaultValue={text(page.draft_payload.typical_applications)}
                  className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 text-sm leading-6 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  Sezioni editoriali · JSON
                </span>
                <textarea
                  name="editorial_sections_json"
                  rows={12}
                  defaultValue={pretty(page.draft_payload.editorial_sections)}
                  className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  FAQ · JSON
                </span>
                <textarea
                  name="faq_json"
                  rows={10}
                  defaultValue={pretty(page.draft_payload.faq)}
                  className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  Fonti · JSON
                </span>
                <textarea
                  name="source_references_json"
                  rows={9}
                  defaultValue={pretty(page.draft_payload.source_references)}
                  className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  Related slugs · uno per riga
                </span>
                <textarea
                  name="related_slugs"
                  rows={5}
                  defaultValue={(page.draft_payload.related_slugs ?? []).join(
                    "\n",
                  )}
                  className="mt-2 w-full rounded-xl border border-[#dbe5f1] px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                  Nota modifica
                </span>
                <input
                  name="note"
                  placeholder="Motivo o contesto della revisione"
                  className="mt-2 h-11 w-full rounded-xl border border-[#dbe5f1] px-3 text-sm outline-none focus:border-[#7aa7f6] focus:ring-4 focus:ring-[#eaf2ff]"
                />
              </label>

              <button
                type="submit"
                className="rounded-xl bg-[#2f6fed] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Salva bozza
              </button>
            </form>
          ) : (
            <DraftReadOnly type={type} payload={page.draft_payload} />
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">
              Workflow
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[#1e2b45]">
              Controlli editoriali
            </h2>

            {page.review_note ? (
              <div className="mt-4 rounded-xl bg-[#f8fafd] p-3 text-xs leading-5 text-[#68788e]">
                <strong>Ultima nota review:</strong> {page.review_note}
              </div>
            ) : null}

            {canSubmit ? (
              <form action={submitKnowledgeReview} className="mt-4 space-y-3">
                <input type="hidden" name="content_type" value={type} />
                <input type="hidden" name="page_id" value={page.page_id} />
                <input
                  name="note"
                  placeholder="Nota per il reviewer"
                  className="h-10 w-full rounded-xl border border-[#dbe5f1] px-3 text-sm outline-none"
                />
                <button className="w-full rounded-xl bg-cyan-700 px-3 py-2.5 text-sm font-semibold text-white">
                  Invia in revisione
                </button>
              </form>
            ) : null}

            {canReviewNow ? (
              <form action={reviewKnowledgeDraft} className="mt-4 space-y-3">
                <input type="hidden" name="content_type" value={type} />
                <input type="hidden" name="page_id" value={page.page_id} />
                <textarea
                  name="note"
                  rows={3}
                  placeholder="Nota di revisione"
                  className="w-full rounded-xl border border-[#dbe5f1] px-3 py-2 text-sm outline-none"
                />
                <div className="grid gap-2">
                  <button
                    name="decision"
                    value="approve"
                    className="rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white"
                  >
                    Approva bozza
                  </button>
                  <button
                    name="decision"
                    value="changes_requested"
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900"
                  >
                    Richiedi modifiche
                  </button>
                </div>
              </form>
            ) : null}

            {canPublishNow ? (
              <form action={publishKnowledgePage} className="mt-4 space-y-3">
                <input type="hidden" name="content_type" value={type} />
                <input type="hidden" name="page_id" value={page.page_id} />
                <input type="hidden" name="slug" value={page.slug} />
                <input
                  name="note"
                  placeholder="Nota pubblicazione"
                  className="h-10 w-full rounded-xl border border-[#dbe5f1] px-3 text-sm outline-none"
                />
                <button
                  name="action"
                  value="publish"
                  className="w-full rounded-xl bg-[#2f6fed] px-3 py-2.5 text-sm font-semibold text-white"
                >
                  Pubblica draft v{page.draft_version}
                </button>
              </form>
            ) : null}

            {canUnpublish ? (
              <form action={publishKnowledgePage} className="mt-3 space-y-3">
                <input type="hidden" name="content_type" value={type} />
                <input type="hidden" name="page_id" value={page.page_id} />
                <input type="hidden" name="slug" value={page.slug} />
                <input
                  name="note"
                  placeholder="Motivo rimozione dal pubblico"
                  className="h-10 w-full rounded-xl border border-rose-200 px-3 text-sm outline-none"
                />
                <button
                  name="action"
                  value="unpublish"
                  className="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-semibold text-rose-700"
                >
                  Rimuovi dal pubblico
                </button>
              </form>
            ) : null}

            {!canSubmit &&
            !canReviewNow &&
            !canPublishNow &&
            !canUnpublish ? (
              <p className="mt-4 text-sm leading-6 text-[#7a899d]">
                Nessuna transizione disponibile con il tuo profilo e lo stato
                corrente.
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#e1e8f2] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a899d]">
              Versioning
            </p>
            <dl className="mt-3 space-y-2 text-sm text-[#68788e]">
              <div className="flex justify-between gap-3">
                <dt>Draft</dt>
                <dd className="font-semibold text-[#34445c]">
                  v{page.draft_version}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Live</dt>
                <dd className="font-semibold text-[#34445c]">
                  v{page.live_version}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Last review</dt>
                <dd className="text-right font-semibold text-[#34445c]">
                  {page.last_reviewed_at || "—"}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
