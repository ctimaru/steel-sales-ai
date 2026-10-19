/**
 * Read-only, bounded public evidence surface for future AI orchestration.
 * X-Robots-Tag prevents duplicating the indexed editorial pages.
 */
import { NextResponse } from "next/server";
import { parseSchoolEvidenceQuery, retrieveSchoolTechnicalEvidence } from "@/lib/school-knowledge-evidence";

export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  const input = parseSchoolEvidenceQuery(new URL(request.url).searchParams);
  if (!input) {
    return NextResponse.json({
      schemaVersion: "school-evidence.v1",
      error: "Provide q (2–100 characters), locale (it/en/de/fr/es), optional kind (standards/grades), limit (1–4).",
    }, { status: 400, headers });
  }

  const evidence = await retrieveSchoolTechnicalEvidence(input);
  return NextResponse.json({
    schemaVersion: "school-evidence.v1",
    query: input.query,
    locale: input.locale,
    kind: input.kind ?? "all",
    answerableFromVerifiedSources: evidence.length > 0,
    items: evidence,
    guardrails: {
      useOnlyCitedFacts: true,
      neverInferNormativeEquivalence: true,
      neverAssertProductCertification: true,
      neverInferPricesOrStock: true,
      humanReviewBeforeRFQOrOrder: true,
      absenceDoesNotProveNonexistence: true,
    },
  }, { status: 200, headers });
}
