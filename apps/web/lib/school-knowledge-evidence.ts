/**
 * SCHOOL-UNIFY5 — bounded, citation-first public technical knowledge retrieval.
 * No LLM, embeddings, tenant reads, certification claims, or inferred equivalences.
 * Records and relationships remain gated by anonymous-safe K2 published RPCs.
 */
import {
  getPublicGrade, getPublicStandard, listPublicGrades, listPublicStandards,
  type PublicKnowledgeGrade, type PublicKnowledgeStandard,
} from "@/lib/public-knowledge";
import { englishGradeForSlug, englishStandardForSlug } from "@/lib/international-steel-knowledge";
import { localizedKnowledgeGuide, localizedKnowledgePath, type KnowledgeMarketLocale } from "@/lib/localized-steel-knowledge";
import { TECHNICAL_RELATED_SLUGS, SCHOOL_EDITORIAL_DRAFT_DATE } from "@/lib/school-technical-editorial-trust";
import { absoluteUrl } from "@/lib/site";

export type SchoolEvidenceLocale = "it" | "en" | KnowledgeMarketLocale;
export type SchoolEvidenceKind = "standards" | "grades";
export type SchoolEvidenceQuery = { query: string; locale: SchoolEvidenceLocale; kind?: SchoolEvidenceKind; limit?: number };
type CitationRole = "public_page" | "publisher_scope" | "k2_public_reference";
export type SchoolEvidenceCitation = { url: string; label: string; role: CitationRole };
export type SchoolTechnicalEvidence = {
  schemaVersion: "school-evidence.v1";
  id: string; kind: SchoolEvidenceKind; slug: string; code: string; locale: SchoolEvidenceLocale;
  title: string; summary: string; technicalContext: string; rfqGuidance: string | null;
  caution: string | null;
  provenance: { status: "k2_published"; publishedAt: string; k2LastReviewedAt: string; editorialPreparedAt: string | null };
  citations: SchoolEvidenceCitation[];
  relatedForDiscovery: string[];
  reviewRequired: true;
};

const MAX_RESULTS = 4;
const MAX_QUERY_LENGTH = 100;
const allowedLocales: readonly SchoolEvidenceLocale[] = ["it", "en", "de", "fr", "es"];
export function isSchoolEvidenceLocale(value: string): value is SchoolEvidenceLocale {
  return allowedLocales.includes(value as SchoolEvidenceLocale);
}
export function parseSchoolEvidenceQuery(params: URLSearchParams): SchoolEvidenceQuery | null {
  const locale = params.get("locale") ?? "it";
  const kind = params.get("kind") ?? undefined;
  const query = (params.get("q") ?? "").trim();
  const rawLimit = params.get("limit");
  if (!isSchoolEvidenceLocale(locale) || (kind !== undefined && kind !== "standards" && kind !== "grades")) return null;
  if (query.length < 2 || query.length > MAX_QUERY_LENGTH || /[\u0000-\u001f]/.test(query)) return null;
  if (rawLimit !== null && !/^[1-4]$/.test(rawLimit)) return null;
  return { locale, kind: kind as SchoolEvidenceKind | undefined, query, limit: rawLimit ? Number(rawLimit) : MAX_RESULTS };
}

type Editorial = { title: string; summary: string; technicalContext: string; rfqGuidance: string | null; caution: string | null; publisherScopeUrl?: string; editorialPreparedAt: string | null };
type Published = PublicKnowledgeStandard | PublicKnowledgeGrade;
function editorialFor(locale: SchoolEvidenceLocale, kind: SchoolEvidenceKind, slug: string, record: Published): Editorial | null {
  if (locale === "it") {
    if (kind === "standards") {
      const value = record as PublicKnowledgeStandard;
      return { title: value.title, summary: value.short_explanation || value.seo_description,
        technicalContext: value.what_it_covers, rfqGuidance: value.how_to_read,
        caution: null, editorialPreparedAt: null };
    }
    const value = record as PublicKnowledgeGrade;
    return { title: value.seo_title, summary: value.short_description || value.seo_description,
      technicalContext: value.designation_explanation, rfqGuidance: null,
      caution: null, editorialPreparedAt: null };
  }
  if (locale === "en") {
    if (kind === "standards") {
      const guide = englishStandardForSlug(slug);
      return guide ? { title: guide.title, summary: guide.summary, technicalContext: guide.covers,
        rfqGuidance: guide.procurement, caution: guide.distinction, editorialPreparedAt: null } : null;
    }
    const guide = englishGradeForSlug(slug);
    return guide ? { title: guide.title, summary: guide.summary, technicalContext: guide.designationMeaning,
      rfqGuidance: guide.procurement, caution: guide.difference, editorialPreparedAt: null } : null;
  }
  const guide = localizedKnowledgeGuide(locale, kind, slug);
  return guide ? { title: guide.title, summary: guide.summary, technicalContext: guide.covers,
    rfqGuidance: guide.request, caution: guide.caution, publisherScopeUrl: guide.source,
    editorialPreparedAt: SCHOOL_EDITORIAL_DRAFT_DATE } : null;
}

function knowledgePath(locale: SchoolEvidenceLocale, kind: SchoolEvidenceKind, slug: string): string {
  if (locale === "it") return "/knowledge/" + (kind === "standards" ? "norme" : "gradi") + "/" + slug;
  if (locale === "en") return "/en/knowledge/" + kind + "/" + slug;
  return localizedKnowledgePath(locale, kind, slug);
}
function normalized(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function compact(value: string) { return normalized(value).replace(/\s/g, ""); }
function rank(query: string, code: string, slug: string, title: string, summary: string): number {
  const needle = normalized(query), flat = compact(query), identity = compact(code);
  if (flat === identity || flat === compact(slug)) return 120;
  if (flat.includes(identity) && identity.length >= 5) return 100;
  const hay = normalized(code + " " + title + " " + summary);
  if (hay.includes(needle)) return 60;
  const terms = needle.split(" ").filter(term => term.length >= 4);
  if (!terms.length) return 0;
  const matches = terms.filter(term => hay.includes(term)).length;
  return matches >= Math.min(2, terms.length) ? matches * 10 : 0;
}
function candidateSearchText(locale: SchoolEvidenceLocale, kind: SchoolEvidenceKind, slug: string, fallback: { title: string; summary: string }) {
  if (locale === "it") return fallback;
  if (locale === "en") {
    const guide = kind === "standards" ? englishStandardForSlug(slug) : englishGradeForSlug(slug);
    return guide ? { title: guide.title, summary: guide.summary } : null;
  }
  const guide = localizedKnowledgeGuide(locale, kind, slug);
  return guide ? { title: guide.title, summary: guide.summary } : null;
}
function uniqueCitations(citations: SchoolEvidenceCitation[]) {
  return citations.filter((value, index) => citations.findIndex(item => item.url === value.url) === index);
}
function makeEvidence(
  locale: SchoolEvidenceLocale, kind: SchoolEvidenceKind, slug: string,
  record: Published, editorial: Editorial, available: { standards: Set<string>; grades: Set<string> },
): SchoolTechnicalEvidence {
  const code = kind === "standards" ? (record as PublicKnowledgeStandard).code : (record as PublicKnowledgeGrade).designation;
  const relatedKind = kind === "standards" ? "grades" : "standards";
  const sourceCitations: SchoolEvidenceCitation[] = record.source_references
    .filter(source => /^https:\/\//i.test(source.url))
    .slice(0, 8).map(source => ({ url: source.url, label: source.label, role: "k2_public_reference" as const }));
  const citations = uniqueCitations([
    { url: absoluteUrl(knowledgePath(locale, kind, slug)), label: code + " — Smart Steel School", role: "public_page" },
    ...(editorial.publisherScopeUrl && /^https:\/\//i.test(editorial.publisherScopeUrl)
      ? [{ url: editorial.publisherScopeUrl, label: "Publisher scope overview", role: "publisher_scope" as const }] : []),
    ...sourceCitations,
  ]);
  return {
    schemaVersion: "school-evidence.v1", id: kind + ":" + slug, kind, slug, code, locale,
    title: editorial.title, summary: editorial.summary, technicalContext: editorial.technicalContext,
    rfqGuidance: editorial.rfqGuidance, caution: editorial.caution,
    provenance: { status: "k2_published", publishedAt: record.published_at,
      k2LastReviewedAt: record.last_reviewed_at, editorialPreparedAt: editorial.editorialPreparedAt },
    citations,
    relatedForDiscovery: (TECHNICAL_RELATED_SLUGS[kind][slug] ?? [])
      .filter(item => available[relatedKind].has(item))
      .filter(item => locale === "it" || (locale === "en"
        ? Boolean(relatedKind === "standards" ? englishStandardForSlug(item) : englishGradeForSlug(item))
        : Boolean(localizedKnowledgeGuide(locale, relatedKind, item))))
      .map(item => relatedKind + ":" + item),
    reviewRequired: true,
  };
}

/**
 * The caller receives evidence to cite, NOT an AI-generated answer or an approved RFQ.
 * No results means "no verified evidence available", not proof a grade/standard does not exist.
 */
export async function retrieveSchoolTechnicalEvidence(input: SchoolEvidenceQuery): Promise<SchoolTechnicalEvidence[]> {
  const limit = Math.min(MAX_RESULTS, Math.max(1, Math.floor(input.limit ?? MAX_RESULTS)));
  if (!isSchoolEvidenceLocale(input.locale) || typeof input.query !== "string" ||
      input.query.trim().length < 2 || input.query.length > MAX_QUERY_LENGTH) return [];

  const [standardList, gradeList] = await Promise.all([listPublicStandards(), listPublicGrades()]);
  const published = { standards: new Set(standardList.map(item => item.slug)),
    grades: new Set(gradeList.map(item => item.slug)) };
  const ranked = [
    ...(!input.kind || input.kind === "standards" ? standardList.map(item =>
      ({ kind: "standards" as const, slug: item.slug, code: item.code, title: item.title,
        summary: item.short_explanation || item.seo_description })) : []),
    ...(!input.kind || input.kind === "grades" ? gradeList.map(item =>
      ({ kind: "grades" as const, slug: item.slug, code: item.designation, title: item.seo_title,
        summary: item.short_description || item.seo_description })) : []),
  ].map(item => {
    const authored = candidateSearchText(input.locale, item.kind, item.slug, item);
    return authored ? { ...item, score: rank(input.query, item.code, item.slug, authored.title, authored.summary) } : null;
  }).filter((item): item is NonNullable<typeof item> => item !== null && item.score > 0)
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    .slice(0, Math.max(12, limit * 4)); // cap K2 detail RPCs per request

  const output: SchoolTechnicalEvidence[] = [];
  for (const item of ranked) {
    if (output.length >= limit) break;
    // K2 detail RPC must independently confirm publication before any editorial text is returned.
    const detail = item.kind === "standards" ? await getPublicStandard(item.slug) : await getPublicGrade(item.slug);
    if (!detail) continue;
    const editorial = editorialFor(input.locale, item.kind, item.slug, detail);
    if (!editorial) continue;
    output.push(makeEvidence(input.locale, item.kind, item.slug, detail, editorial, published));
  }
  return output;
}
