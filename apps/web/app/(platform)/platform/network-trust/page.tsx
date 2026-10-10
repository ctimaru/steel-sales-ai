import { GovernanceWorkspaceNav } from "@/components/governance-workspace-nav";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  getPlatformAccessContext,
  requirePlatformPermission,
} from "@/lib/platform-admin";
import { getNetworkTrustQueue } from "@/lib/platform-network-trust";

import {
  createNetworkTrustAssertion,
  decideNetworkChangeReview,
  openNetworkChangeReview,
  recordNetworkVerification,
  refreshNetworkIdentityCandidates,
  reviewNetworkIdentityCandidate,
} from "./actions";

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(Number(value) * 100)}%`;
}

export default async function PlatformNetworkTrustPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requirePlatformPermission("network_trust.read");
  const [queue, access, params] = await Promise.all([
    getNetworkTrustQueue(),
    getPlatformAccessContext(),
    searchParams,
  ]);

  const permissions = access?.permissions ?? [];
  const canAssert = permissions.includes("network_trust.assert");
  const canVerify = permissions.includes("network_trust.verify");
  const canRevoke = permissions.includes("network_trust.revoke");
  const canReviewChanges = permissions.includes("network_trust.review_changes");
  const canRefreshIdentity = permissions.includes(
    "network_trust.identity_refresh",
  );
  const canReviewIdentity = permissions.includes(
    "network_trust.identity_review",
  );
  const readOnly =
    !canAssert &&
    !canVerify &&
    !canRevoke &&
    !canReviewChanges &&
    !canRefreshIdentity &&
    !canReviewIdentity;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <GovernanceWorkspaceNav current="trust" permissions={access?.permissions ?? []} />
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <p className="platform-kicker">SA8 · Network Trust</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
          Verification &amp; Moderation
        </h1>
        <p className="mt-3 max-w-4xl text-sm leading-6 text-[#66736e]">
          Governa evidenze pubbliche, verification state, conflitti di
          provenance e identity resolution. Un match confermato resta solo
          evidenza: SA8 non esegue merge automatici e non concede accesso alla
          Commercial Memory dei tenant.
        </p>
      </section>

      {params.message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          {params.message}
        </div>
      ) : null}
      {params.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          {params.error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Evidence accettate", queue.counts.accepted_evidence],
          ["Verification correnti", queue.counts.current_verifications],
          ["Change review aperte", queue.counts.open_change_reviews],
          ["Identity candidate", queue.counts.open_identity_candidates],
          ["Aziende unverified", queue.counts.unverified_companies],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[#dce2df] bg-white p-4"
          >
            <p className="text-2xl font-semibold text-[#1d2824]">
              {String(value)}
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#8fa1a9]">
              {label}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a899d]">
          Autorità effettiva
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["Evidence", canAssert],
            ["Verify", canVerify],
            ["Revoke", canRevoke],
            ["Change review", canReviewChanges],
            ["Identity refresh", canRefreshIdentity],
            ["Identity review", canReviewIdentity],
          ].map(([label, enabled]) => (
            <span
              key={String(label)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-semibold",
                enabled
                  ? "bg-[#e1ece8] text-[#1a5144]"
                  : "bg-[#f1f4f8] text-[#87938e]",
              ].join(" ")}
            >
              {label}: {enabled ? "abilitato" : "no"}
            </span>
          ))}
        </div>
      </section>

      {readOnly ? (
        <div className="rounded-2xl border border-[#d7dfdb] bg-[#f8fafd] p-4 text-sm text-[#66736e]">
          Accesso in sola lettura: puoi ispezionare evidence, verification,
          provenance review e identity candidate, ma non modificarne lo stato.
        </div>
      ) : null}

      {canAssert ? (
        <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
            Evidence ledger
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
            Aggiungi evidenza verificabile
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            L&apos;assertion è append-only. Lo staff può usare soltanto fonti
            pubbliche, documentali, platform-curated o manual-review.
          </p>
          <form
            action={createNetworkTrustAssertion}
            className="mt-5 grid gap-4 lg:grid-cols-2"
          >
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                Entity type
              </span>
              <select
                name="entity_type"
                className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                defaultValue="company"
              >
                <option value="company">Company</option>
                <option value="facility">Facility</option>
                <option value="facility_capability">Facility capability</option>
                <option value="company_certification">
                  Company certification
                </option>
              </select>
            </label>
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                Entity ID
              </span>
              <input
                name="entity_id"
                required
                placeholder="UUID target"
                className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm"
              />
            </label>
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                Field path
              </span>
              <input
                name="field_path"
                required
                placeholder="legal_name, website_domain, certification..."
                className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm"
              />
            </label>
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                Confidence 0–1
              </span>
              <input
                name="confidence"
                type="number"
                min="0"
                max="1"
                step="0.0001"
                placeholder="0.95"
                className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm"
              />
            </label>
            <label className="lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                Asserted value · JSON
              </span>
              <textarea
                name="asserted_value_json"
                required
                rows={4}
                placeholder={'"Example value"'}
                className="mt-2 w-full rounded-xl border border-[#d7dfdb] px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="lg:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                Source reference
              </span>
              <input
                name="source_reference"
                required
                placeholder="https://... oppure riferimento documento"
                className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm"
              />
            </label>
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                Source type
              </span>
              <select
                name="source_type"
                defaultValue="public_web"
                className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
              >
                <option value="public_web">Public web</option>
                <option value="document">Document</option>
                <option value="platform_curated">Platform curated</option>
                <option value="manual_review">Manual review</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-bold uppercase tracking-wide text-[#7a899d]">
                Review state
              </span>
              <select
                name="review_state"
                defaultValue="accepted"
                className="mt-2 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
              >
                <option value="accepted">Accepted</option>
                <option value="pending">Pending</option>
              </select>
            </label>
            <input
              type="hidden"
              name="ownership_type"
              value="platform_curated"
            />
            <div className="lg:col-span-2">
              <button className="platform-primary h-11 rounded-xl px-5 text-sm font-semibold">
                Registra evidence assertion
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
          Verification evidence
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
          Evidenze accettate
        </h2>
        <div className="mt-5 space-y-3">
          {queue.evidence.length === 0 ? (
            <p className="text-sm text-[#7a899d]">
              Nessuna evidenza disponibile.
            </p>
          ) : (
            queue.evidence.slice(0, 60).map((item) => (
              <article
                key={item.assertion_id}
                className="rounded-2xl border border-[#e6ecf4] bg-[#f9fbfd] p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#e1ece8] px-2.5 py-1 text-[11px] font-bold uppercase text-[#1a5144]">
                        {item.verification_scope}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[#66736e]">
                        {item.target_verification_status || "unverified"}
                      </span>
                    </div>
                    <h3 className="mt-3 font-semibold text-[#1d2824]">
                      {item.target_label}
                    </h3>
                    <p className="mt-1 text-xs text-[#7a899d]">
                      {item.field_path} · {item.source_type} · confidence{" "}
                      {formatScore(item.confidence)}
                    </p>
                    <pre className="mt-3 max-h-32 overflow-auto rounded-xl bg-white p-3 text-xs leading-5 text-[#43524c]">
                      {pretty(item.asserted_value)}
                    </pre>
                    {item.source_reference.startsWith("http://") ||
                    item.source_reference.startsWith("https://") ? (
                      <a
                        href={item.source_reference}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-block break-all text-xs font-semibold text-[#1a5144]"
                      >
                        Apri fonte ↗
                      </a>
                    ) : (
                      <p className="mt-2 break-all text-xs text-[#7a899d]">
                        {item.source_reference}
                      </p>
                    )}
                  </div>

                  {canVerify ? (
                    <form
                      action={recordNetworkVerification}
                      className="w-full shrink-0 space-y-2 rounded-xl border border-[#d7dfdb] bg-white p-3 xl:w-72"
                    >
                      <input
                        type="hidden"
                        name="scope"
                        value={item.verification_scope}
                      />
                      <input
                        type="hidden"
                        name="target_id"
                        value={item.target_id}
                      />
                      <input
                        type="hidden"
                        name="evidence_assertion_id"
                        value={item.assertion_id}
                      />
                      <select
                        name="status"
                        defaultValue="verified"
                        className="h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                      >
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                        <option value="pending">Pending</option>
                      </select>
                      <input
                        name="note"
                        placeholder="Nota verification"
                        className="h-10 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm"
                      />
                      <input
                        name="expires_at"
                        type="datetime-local"
                        className="h-10 w-full rounded-xl border border-[#d7dfdb] px-3 text-sm"
                      />
                      <button className="w-full rounded-xl bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white">
                        Registra stato
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a899d]">
          Current verification state
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
          Verification correnti
        </h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {queue.current_verifications.length === 0 ? (
            <p className="text-sm text-[#7a899d]">
              Nessuna verification corrente.
            </p>
          ) : (
            queue.current_verifications.map((item) => (
              <article
                key={item.verification_id}
                className="rounded-xl border border-[#e6ecf4] bg-[#f9fbfd] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#1a5144]">
                      {item.scope} · {item.status}
                    </p>
                    <h3 className="mt-2 font-semibold text-[#1d2824]">
                      {item.target_label}
                    </h3>
                    <p className="mt-1 text-xs text-[#7a899d]">
                      Evidence: {item.evidence_field_path || "—"} ·{" "}
                      {item.evidence_source_type || "—"}
                    </p>
                  </div>
                  {canRevoke && item.status !== "revoked" ? (
                    <form action={recordNetworkVerification}>
                      <input type="hidden" name="scope" value={item.scope} />
                      <input
                        type="hidden"
                        name="target_id"
                        value={item.target_id}
                      />
                      <input
                        type="hidden"
                        name="evidence_assertion_id"
                        value={item.evidence_assertion_id}
                      />
                      <input type="hidden" name="status" value="revoked" />
                      <input
                        type="hidden"
                        name="note"
                        value="SA8 explicit verification revocation"
                      />
                      <ConfirmSubmitButton
                        title="Revocare questa Network verification?"
                        description="La verification corrente verrà chiusa come revocata. L’evidence originale resta disponibile per audit, ma il target non risulterà più verificato tramite questo record."
                        confirmLabel="Revoca verification"
                        pendingLabel="Revoca…"
                        className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Revoca
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
          Provenance moderation
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
          Change review
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
          Una decisione accettata registra il giudizio di governance ma non
          sovrascrive silenziosamente l&apos;evidence originale.
        </p>

        {canReviewChanges ? (
          <form
            action={openNetworkChangeReview}
            className="mt-5 grid gap-3 rounded-2xl border border-[#e6ecf4] bg-[#f9fbfd] p-4 lg:grid-cols-2"
          >
            <input
              name="network_company_id"
              required
              placeholder="Network company UUID"
              className="h-10 rounded-xl border border-[#d7dfdb] px-3 text-sm"
            />
            <input
              name="assertion_id"
              required
              placeholder="Company assertion UUID"
              className="h-10 rounded-xl border border-[#d7dfdb] px-3 text-sm"
            />
            <input
              name="field_path"
              required
              placeholder="Field path"
              className="h-10 rounded-xl border border-[#d7dfdb] px-3 text-sm"
            />
            <div />
            <textarea
              name="previous_value_json"
              required
              rows={4}
              placeholder='Previous value JSON, es. "old"'
              className="rounded-xl border border-[#d7dfdb] px-3 py-2 font-mono text-xs"
            />
            <textarea
              name="proposed_value_json"
              required
              rows={4}
              placeholder='Proposed value JSON, es. "new"'
              className="rounded-xl border border-[#d7dfdb] px-3 py-2 font-mono text-xs"
            />
            <div className="lg:col-span-2">
              <button className="rounded-xl bg-[#1a5144] px-4 py-2.5 text-sm font-semibold text-white">
                Apri change review
              </button>
            </div>
          </form>
        ) : null}

        <div className="mt-5 space-y-3">
          {queue.change_reviews.length === 0 ? (
            <p className="text-sm text-[#7a899d]">
              Nessun change review aperto.
            </p>
          ) : (
            queue.change_reviews.map((review) => (
              <article
                key={review.review_id}
                className="rounded-xl border border-[#e6ecf4] bg-[#f9fbfd] p-4"
              >
                <p className="text-xs font-bold uppercase text-[#1a5144]">
                  {review.company_legal_name} · {review.field_path}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <pre className="overflow-auto rounded-xl bg-white p-3 text-xs">
                    {pretty(review.previous_value)}
                  </pre>
                  <pre className="overflow-auto rounded-xl bg-white p-3 text-xs">
                    {pretty(review.proposed_value)}
                  </pre>
                </div>
                <p className="mt-2 break-all text-xs text-[#7a899d]">
                  {review.source_type} · {review.source_reference}
                </p>
                {canReviewChanges ? (
                  <form
                    action={decideNetworkChangeReview}
                    className="mt-4 flex flex-col gap-2 sm:flex-row"
                  >
                    <input
                      type="hidden"
                      name="review_id"
                      value={review.review_id}
                    />
                    <input
                      name="note"
                      placeholder="Nota review"
                      className="h-10 flex-1 rounded-xl border border-[#d7dfdb] px-3 text-sm"
                    />
                    <button
                      name="decision"
                      value="accepted"
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                    >
                      Accetta
                    </button>
                    <button
                      name="decision"
                      value="rejected"
                      className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700"
                    >
                      Rifiuta
                    </button>
                    <button
                      name="decision"
                      value="superseded"
                      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800"
                    >
                      Superseded
                    </button>
                  </form>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#1a5144]">
              Identity moderation
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
              Identity resolution candidates
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Il motore usa segnali deterministici. Confermare un match produce
              solo evidenza per una futura resolution: <strong>nessun merge viene
              eseguito da SA8</strong>.
            </p>
          </div>
          {canRefreshIdentity ? (
            <form action={refreshNetworkIdentityCandidates}>
              <button className="platform-secondary h-10 rounded-xl px-4 text-sm font-semibold">
                Refresh candidates
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          {queue.identity_candidates.length === 0 ? (
            <p className="text-sm text-[#7a899d]">
              Nessun identity candidate attivo.
            </p>
          ) : (
            queue.identity_candidates.map((candidate) => (
              <article
                key={candidate.candidate_id}
                className="rounded-xl border border-[#e6ecf4] bg-[#f9fbfd] p-4"
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                  <div>
                    <p className="font-semibold text-[#1d2824]">
                      {candidate.company_a_legal_name}
                    </p>
                    <p className="mt-1 text-xs text-[#7a899d]">
                      {candidate.company_a_domain || candidate.company_a_id}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-[#1a5144]">
                      {formatScore(candidate.match_score)}
                    </p>
                    <p className="mt-1 text-[11px] uppercase text-[#87938e]">
                      {candidate.signals.join(" · ")}
                    </p>
                  </div>
                  <div className="lg:text-right">
                    <p className="font-semibold text-[#1d2824]">
                      {candidate.company_b_legal_name}
                    </p>
                    <p className="mt-1 text-xs text-[#7a899d]">
                      {candidate.company_b_domain || candidate.company_b_id}
                    </p>
                  </div>
                </div>

                {candidate.status === "open" && canReviewIdentity ? (
                  <form
                    action={reviewNetworkIdentityCandidate}
                    className="mt-4 flex flex-col gap-2 border-t border-[#e6ecf4] pt-4 sm:flex-row"
                  >
                    <input
                      type="hidden"
                      name="candidate_id"
                      value={candidate.candidate_id}
                    />
                    <input
                      name="note"
                      placeholder="Nota identity review"
                      className="h-10 flex-1 rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
                    />
                    <button
                      name="decision"
                      value="confirmed_match"
                      className="rounded-xl bg-[#1a5144] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Conferma match
                    </button>
                    <button
                      name="decision"
                      value="dismissed"
                      className="rounded-xl border border-[#d7dfdb] bg-white px-4 py-2 text-sm font-semibold text-[#53637a]"
                    >
                      Dismiss
                    </button>
                  </form>
                ) : (
                  <p className="mt-4 text-xs font-semibold uppercase text-[#7a899d]">
                    Stato: {candidate.status}
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
