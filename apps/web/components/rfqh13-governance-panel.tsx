"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  decideRfqh13Approval,
  recoverRfqh13StaleDispatch,
  setRfqh13TeamMember,
  updateRfqh13Governance,
} from "@/app/(workspace)/marketplace/rfq-hub/[rfqId]/governance-actions";
import type { Rfqh13GovernanceState, Rfqh13TeamRole } from "@/lib/rfqh13-governance";

function count(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        aria-hidden="true"
        className={
          "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold " +
          (ok ? "bg-[#e5f3ed] text-[#185b48]" : "bg-[#f1f3f2] text-[#718078]")
        }
      >
        {ok ? "✓" : "·"}
      </span>
      <span className={ok ? "text-[#33413c]" : "text-[#66736e]"}>{children}</span>
    </div>
  );
}

export function Rfqh13GovernancePanel({
  rfqId,
  currentUserId,
  state,
}: {
  rfqId: string;
  currentUserId: string | null;
  state: Rfqh13GovernanceState | null;
}) {
  if (!state) {
    return (
      <section className="rounded-3xl border border-[#dce2df] bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
          RFQH13 · Production Hardening
        </p>
        <p className="mt-2 text-sm text-[#66736e]">
          Governance procurement non disponibile per questa RFQ.
        </p>
      </section>
    );
  }

  return (
    <Rfqh13GovernancePanelReady
      rfqId={rfqId}
      currentUserId={currentUserId}
      state={state}
    />
  );
}

function Rfqh13GovernancePanelReady({
  rfqId,
  currentUserId,
  state,
}: {
  rfqId: string;
  currentUserId: string | null;
  state: Rfqh13GovernanceState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const governance = state.governance;
  const activeTeam = state.team.filter((member) => member.status === "active");
  const pendingApprovals = state.approvals.filter((approval) => approval.status === "pending");
  const canExecuteCritical = state.current_user.role === "owner";

  const [awardApproval, setAwardApproval] = useState(governance.require_award_approval);
  const [poApproval, setPoApproval] = useState(governance.require_po_approval);
  const [expiryHours, setExpiryHours] = useState(String(governance.approval_expiry_hours));
  const [eventRetention, setEventRetention] = useState(String(governance.operational_event_retention_days));
  const [webhookRetention, setWebhookRetention] = useState(String(governance.webhook_payload_retention_days));
  const [commercialRetention, setCommercialRetention] = useState(
    governance.commercial_record_retention_days == null
      ? ""
      : String(governance.commercial_record_retention_days),
  );
  const [memberId, setMemberId] = useState(state.available_members[0]?.user_id ?? "");
  const [teamRole, setTeamRole] = useState<Rfqh13TeamRole>("collaborator");
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

  function saveGovernance() {
    setFeedback(null);
    startTransition(async () => {
      const result = await updateRfqh13Governance({
        rfqId,
        organizationId: state.organization_id,
        requireAwardApproval: awardApproval,
        requirePoApproval: poApproval,
        approvalExpiryHours: Math.max(1, Number(expiryHours) || 168),
        operationalEventRetentionDays: Math.max(30, Number(eventRetention) || 730),
        webhookPayloadRetentionDays: Math.max(7, Number(webhookRetention) || 90),
        commercialRecordRetentionDays:
          commercialRetention.trim() === "" ? null : Math.max(365, Number(commercialRetention) || 365),
      });
      setFeedback(result.ok ? "Governance procurement aggiornata." : result.error ?? "Aggiornamento non riuscito.");
      if (result.ok) router.refresh();
    });
  }

  function setMember(status: "active" | "revoked", userId: string, role: Rfqh13TeamRole) {
    setFeedback(null);
    startTransition(async () => {
      const result = await setRfqh13TeamMember({ rfqId, userId, role, status });
      setFeedback(
        result.ok
          ? status === "active"
            ? "Membro RFQ aggiornato."
            : "Accesso RFQ revocato."
          : result.error ?? "Aggiornamento team non riuscito.",
      );
      if (result.ok) router.refresh();
    });
  }

  function decide(approvalId: string, decision: "approved" | "rejected") {
    setFeedback(null);
    startTransition(async () => {
      const result = await decideRfqh13Approval({
        rfqId,
        approvalId,
        decision,
        note: decisionNotes[approvalId] ?? null,
      });
      setFeedback(
        result.ok
          ? decision === "approved"
            ? "Approvazione registrata. L'owner può ora eseguire l'azione approvata."
            : "Richiesta respinta."
          : result.error ?? "Decisione non riuscita.",
      );
      if (result.ok) router.refresh();
    });
  }

  function recover(dispatchId: string) {
    setFeedback(null);
    startTransition(async () => {
      const result = await recoverRfqh13StaleDispatch({
        rfqId,
        dispatchId,
        reason: "Dispatch senza evidenza provider oltre la soglia RFQH13",
      });
      setFeedback(
        result.ok
          ? "Dispatch portato in failed in modo auditabile. L'owner può usare il retry governato."
          : result.error ?? "Recovery non riuscito.",
      );
      if (result.ok) router.refresh();
    });
  }

  const healthy =
    count(state.health.stale_dispatches) === 0 &&
    count(state.health.po_delivery_failures) === 0 &&
    count(state.health.expired_approvals) === 0;

  return (
    <section className="overflow-hidden rounded-3xl border border-[#b8d2c8] bg-white">
      <div className="border-b border-[#dce7e2] bg-[#f5faf8] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#1a5144]">
              RFQH13 · Production Hardening &amp; Pilot Acceptance
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#1d2824]">
              Governance, recovery e readiness della RFQ
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
              Owner, collaboratori e approver lavorano sulla stessa RFQ. Le approvazioni,
              se abilitate, sono legate al fingerprint esatto dell&apos;award o del PO:
              una modifica invalida l&apos;approvazione precedente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase text-[#173f35] ring-1 ring-inset ring-[#cddbd6]">
              {state.current_user.role}
            </span>
            <span
              className={
                "rounded-full px-3 py-1 text-[10px] font-bold uppercase " +
                (healthy ? "bg-[#e5f3ed] text-[#185b48]" : "bg-[#fff4e8] text-[#81572b]")
              }
            >
              {healthy ? "health ok" : "attenzione"}
            </span>
          </div>
        </div>
        {!canExecuteCritical ? (
          <p className="mt-3 rounded-xl border border-[#dce2df] bg-white px-4 py-3 text-xs text-[#52615b]">
            Il tuo ruolo può consultare la RFQ
            {state.current_user.can_manage ? ", collaborare e preparare richieste di approvazione" : ""}
            {state.current_user.can_approve ? ", approvare o respingere richieste altrui" : ""}.
            Launch, award definitivo ed emissione PO restano azioni dell&apos;owner.
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-2">
        <div className="space-y-5">
          <div className="rounded-2xl border border-[#dce2df] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
              Team RFQ
            </p>
            <div className="mt-3 space-y-2">
              {activeTeam.length === 0 ? (
                <p className="text-sm text-[#718078]">Nessun collaboratore o approver aggiunto.</p>
              ) : (
                activeTeam.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f9f8] px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#1d2824]">{member.email}</p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase text-[#718078]">
                        {member.role}
                      </p>
                    </div>
                    {state.current_user.can_manage_team ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setMember("revoked", member.user_id, member.role)}
                        className="text-xs font-bold text-[#7d4c43] underline underline-offset-4 disabled:opacity-50"
                      >
                        Revoca
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {state.current_user.can_manage_team && state.available_members.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_150px_auto]">
                <select
                  value={memberId}
                  onChange={(event) => setMemberId(event.target.value)}
                  className="h-10 rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs"
                >
                  {state.available_members.map((member) => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.email}
                    </option>
                  ))}
                </select>
                <select
                  value={teamRole}
                  onChange={(event) => setTeamRole(event.target.value as Rfqh13TeamRole)}
                  className="h-10 rounded-xl border border-[#cfd8d4] bg-white px-3 text-xs"
                >
                  <option value="collaborator">Collaboratore</option>
                  <option value="approver">Approver</option>
                </select>
                <button
                  type="button"
                  disabled={pending || !memberId}
                  onClick={() => setMember("active", memberId, teamRole)}
                  className="min-h-10 rounded-xl bg-[#173f35] px-4 text-xs font-bold text-white disabled:opacity-50"
                >
                  Aggiungi
                </button>
              </div>
            ) : null}

            {state.current_user.can_manage_team && state.available_members.length === 0 ? (
              <p className="mt-3 text-xs leading-5 text-[#718078]">
                Nessun altro membro attivo dell&apos;organizzazione disponibile. Prima di
                rendere obbligatoria una seconda approvazione aggiungi almeno un altro utente al team aziendale.
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#dce2df] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
                Approval gate
              </p>
              <span className="text-[10px] text-[#718078]">
                scadenza {governance.approval_expiry_hours}h
              </span>
            </div>

            {pendingApprovals.length === 0 ? (
              <p className="mt-3 text-sm text-[#718078]">Nessuna approvazione in attesa.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {pendingApprovals.map((approval) => {
                  const ownRequest = currentUserId === approval.requested_by;
                  return (
                    <article key={approval.id} className="rounded-xl bg-[#fffaf1] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-[#5f512d]">
                            {approval.action_type === "award" ? "Award RFQ" : "Emissione PO"}
                          </p>
                          <p className="mt-1 text-[10px] text-[#7c714f]">
                            richiesta {dateTime(approval.requested_at)} · scade {dateTime(approval.expires_at)}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase text-[#6f612f]">
                          pending
                        </span>
                      </div>
                      {approval.reason ? (
                        <p className="mt-2 text-xs text-[#5f5a49]">{approval.reason}</p>
                      ) : null}
                      {state.current_user.can_approve && !ownRequest ? (
                        <>
                          <input
                            value={decisionNotes[approval.id] ?? ""}
                            onChange={(event) =>
                              setDecisionNotes((current) => ({
                                ...current,
                                [approval.id]: event.target.value,
                              }))
                            }
                            placeholder="Nota decisione (obbligatoria per rifiuto)"
                            className="mt-3 h-9 w-full rounded-lg border border-[#dfd5b5] bg-white px-3 text-xs"
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => decide(approval.id, "approved")}
                              className="rounded-lg bg-[#173f35] px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                            >
                              Approva
                            </button>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => decide(approval.id, "rejected")}
                              className="rounded-lg border border-[#d8bdb8] bg-white px-3 py-2 text-xs font-bold text-[#7d4c43] disabled:opacity-50"
                            >
                              Rifiuta
                            </button>
                          </div>
                        </>
                      ) : ownRequest ? (
                        <p className="mt-2 text-[10px] font-semibold text-[#7c714f]">
                          Separazione delle responsabilità: non puoi decidere una richiesta creata da te.
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-[#dce2df] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
              Policy azienda
            </p>
            {state.current_user.is_org_admin ? (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl bg-[#f7f9f8] p-3 text-xs font-semibold text-[#52615b]">
                    <input
                      type="checkbox"
                      checked={awardApproval}
                      onChange={(event) => setAwardApproval(event.target.checked)}
                    />
                    Approva award prima della conferma
                  </label>
                  <label className="flex items-center gap-2 rounded-xl bg-[#f7f9f8] p-3 text-xs font-semibold text-[#52615b]">
                    <input
                      type="checkbox"
                      checked={poApproval}
                      onChange={(event) => setPoApproval(event.target.checked)}
                    />
                    Approva PO prima dell&apos;emissione
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-[10px] font-semibold text-[#66736e]">
                    Validità approval (h)
                    <input value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)} inputMode="numeric" className="mt-1 h-9 w-full rounded-lg border border-[#cfd8d4] px-2 text-xs" />
                  </label>
                  <label className="text-[10px] font-semibold text-[#66736e]">
                    Eventi operativi (gg)
                    <input value={eventRetention} onChange={(e) => setEventRetention(e.target.value)} inputMode="numeric" className="mt-1 h-9 w-full rounded-lg border border-[#cfd8d4] px-2 text-xs" />
                  </label>
                  <label className="text-[10px] font-semibold text-[#66736e]">
                    Payload webhook (gg)
                    <input value={webhookRetention} onChange={(e) => setWebhookRetention(e.target.value)} inputMode="numeric" className="mt-1 h-9 w-full rounded-lg border border-[#cfd8d4] px-2 text-xs" />
                  </label>
                  <label className="text-[10px] font-semibold text-[#66736e]">
                    Record commerciali (gg)
                    <input value={commercialRetention} onChange={(e) => setCommercialRetention(e.target.value)} inputMode="numeric" placeholder="Non definito" className="mt-1 h-9 w-full rounded-lg border border-[#cfd8d4] px-2 text-xs" />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={saveGovernance}
                  disabled={pending}
                  className="mt-3 rounded-xl border border-[#b8d2c8] bg-white px-4 py-2.5 text-xs font-bold text-[#173f35] disabled:opacity-50"
                >
                  Salva policy
                </button>
              </>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-[#f7f9f8] p-3 text-xs text-[#52615b]">
                  Award approval: <strong>{governance.require_award_approval ? "obbligatoria" : "non richiesta"}</strong>
                </div>
                <div className="rounded-xl bg-[#f7f9f8] p-3 text-xs text-[#52615b]">
                  PO approval: <strong>{governance.require_po_approval ? "obbligatoria" : "non richiesta"}</strong>
                </div>
              </div>
            )}
            <p className="mt-3 text-[10px] leading-4 text-[#718078]">
              La retention qui è una policy governata, non una cancellazione automatica. I record
              commerciali e gli audit non vengono eliminati silenziosamente.
            </p>
          </div>

          <div className="rounded-2xl border border-[#dce2df] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
              Health &amp; recovery
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ["Dispatch bloccati", state.health.stale_dispatches],
                ["Invii failed", state.health.failed_dispatches],
                ["Bounce / complaint", state.health.bounced_or_complained],
                ["Email soppresse", state.health.suppressed_recipients],
                ["PO delivery failed", state.health.po_delivery_failures],
                ["Approval scadute", state.health.expired_approvals],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl bg-[#f7f9f8] p-3">
                  <p className="text-[9px] font-bold uppercase text-[#718078]">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-[#1d2824]">{count(value)}</p>
                </div>
              ))}
            </div>

            {state.stale_dispatches.length > 0 ? (
              <div className="mt-3 space-y-2">
                {state.stale_dispatches.map((dispatch) => (
                  <div key={dispatch.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ead9c0] bg-[#fffaf1] p-3">
                    <div>
                      <p className="text-xs font-semibold text-[#5f512d]">Dispatch {dispatch.id.slice(0, 8)}…</p>
                      <p className="mt-1 text-[10px] text-[#7c714f]">
                        {dispatch.status} · ultimo tentativo {dateTime(dispatch.last_attempt_at ?? dispatch.queued_at)}
                      </p>
                    </div>
                    {state.current_user.can_manage ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => recover(dispatch.id)}
                        className="rounded-lg border border-[#d8c79a] bg-white px-3 py-2 text-xs font-bold text-[#6f612f] disabled:opacity-50"
                      >
                        Marca failed per retry
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#cddbd6] bg-[#f8faf9] p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#1a5144]">
              Pilot acceptance
            </p>
            <div className="mt-3 space-y-2">
              <Check ok={state.acceptance.supplier_count > 0}>
                Supplier target presente ({state.acceptance.supplier_count})
              </Check>
              <Check ok={state.acceptance.submitted_quote_count > 0}>
                Almeno una quote strutturata ricevuta ({state.acceptance.submitted_quote_count})
              </Check>
              <Check ok={state.acceptance.award_confirmed}>Award confermato</Check>
              <Check
                ok={
                  state.acceptance.po_count > 0 &&
                  state.acceptance.po_confirmed_count === state.acceptance.po_count
                }
              >
                PO confermati dal supplier ({state.acceptance.po_confirmed_count}/{state.acceptance.po_count})
              </Check>
              <Check ok={healthy}>Nessun blocker operativo RFQH13</Check>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={
                  "rounded-full px-3 py-1.5 text-[10px] font-bold uppercase " +
                  (state.acceptance.e2e_complete && healthy
                    ? "bg-[#dff1e9] text-[#185b48]"
                    : "bg-white text-[#66736e] ring-1 ring-inset ring-[#dce2df]")
                }
              >
                {state.acceptance.e2e_complete && healthy ? "E2E accepted" : "E2E da completare"}
              </span>
              <a
                href={"/api/rfqh13/audit/" + encodeURIComponent(rfqId)}
                className="text-xs font-bold text-[#173f35] underline underline-offset-4"
              >
                Scarica audit JSON
              </a>
            </div>
          </div>
        </div>
      </div>

      {feedback ? (
        <div className="border-t border-[#e7ece9] bg-[#fbfcfb] px-5 py-3 text-xs font-semibold text-[#52615b] sm:px-6">
          {feedback}
        </div>
      ) : null}
    </section>
  );
}
