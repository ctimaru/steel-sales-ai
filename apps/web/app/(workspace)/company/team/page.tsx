import type { Metadata } from "next";

import {
  changeMemberBusinessRole,
  changeMemberRole,
  changeMemberStatus,
  inviteMember,
  resendInvitation,
  revokeInvitation,
} from "@/app/onboarding/actions";
import { FocusHeader, FocusPage } from "@/components/focus-ui";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { Input } from "@/components/ui/input";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team e accessi",
  robots: privateNoIndexRobots,
};

type TeamMember = {
  user_id: string;
  email: string | null;
  role: string;
  business_role: string | null;
  status: string;
  is_default: boolean;
};

type TeamInvitation = {
  id: string;
  email: string;
  role: string;
  business_role: string | null;
  status: string;
  delivery_status: string;
  delivery_mode: string | null;
  send_count: number;
  expires_at: string;
};

type TeamState = {
  organization_id: string;
  members: TeamMember[];
  invitations: TeamInvitation[];
};

function permissionLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "viewer") return "Sola lettura";
  return "Membro";
}

function businessRoleLabel(role: string | null) {
  if (role === "sales_director") return "Sales Director";
  if (role === "salesperson") return "Commerciale";
  if (role === "operations") return "Operations";
  return "Non assegnato";
}

function invitationStatusLabel(status: string, deliveryStatus: string) {
  if (status === "accepted") return "Accettato";
  if (status === "revoked") return "Revocato";
  if (status === "expired") return "Scaduto";
  if (deliveryStatus === "failed") return "Invio da riprovare";
  return "In attesa";
}

function Feedback({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;

  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3 text-sm",
        error
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      ].join(" ")}
    >
      {error ?? message}
    </div>
  );
}

function ReturnTo() {
  return <input type="hidden" name="return_to" value="/company/team" />;
}

export default async function CompanyTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const params = await searchParams;
  const context = await requireWorkspaceAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("hp8_team_state", {
    p_organization_id: context.organizationId,
  });
  if (error) throw new Error("team_state_unavailable");

  const state = (data ?? {
    organization_id: context.organizationId,
    members: [],
    invitations: [],
  }) as TeamState;

  const invitations = (state.invitations ?? [])
    .filter((item) =>
      ["pending", "expired", "revoked", "accepted"].includes(item.status),
    )
    .slice(0, 12);

  return (
    <FocusPage className="max-w-[1120px]">
      <FocusHeader
        eyebrow="Azienda"
        title="Team e accessi"
        description="Invita persone, assegna i permessi del workspace e mantieni separato il ruolo operativo dalla funzione commerciale."
      />

      <Feedback message={params.message} error={params.error} />

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
            Nuovo accesso
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Invita una persona
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Il permesso decide cosa può fare nel workspace. Il ruolo commerciale descrive la sua funzione nel team.
          </p>

          <form action={inviteMember} className="mt-5 space-y-4">
            <ReturnTo />
            <label className="block text-sm font-medium text-[#43524c]">
              Email
              <Input
                className="mt-2"
                type="email"
                name="email"
                placeholder="collega@azienda.it"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#43524c]">
                Permesso
                <select
                  name="role"
                  defaultValue="member"
                  className="mt-2 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824]"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Membro</option>
                  <option value="viewer">Sola lettura</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-[#43524c]">
                Ruolo commerciale
                <select
                  name="business_role"
                  defaultValue="salesperson"
                  className="mt-2 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824]"
                >
                  <option value="">Non assegnato</option>
                  <option value="sales_director">Sales Director</option>
                  <option value="salesperson">Commerciale</option>
                  <option value="operations">Operations</option>
                </select>
              </label>
            </div>

            <PendingSubmitButton
              pendingLabel="Invio…"
              className="app-primary h-10 w-full rounded-xl text-sm font-semibold"
            >
              Invia invito
            </PendingSubmitButton>
          </form>

          <div className="mt-6 border-t border-[#e2e7e4] pt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#87938e]">
              Inviti recenti
            </p>

            <div className="mt-3 space-y-3">
              {invitations.length ? (
                invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1d2824]">
                          {invitation.email}
                        </p>
                        <p className="mt-1 text-xs text-[#66736e]">
                          {permissionLabel(invitation.role)} ·{" "}
                          {businessRoleLabel(invitation.business_role)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#52615b]">
                        {invitationStatusLabel(
                          invitation.status,
                          invitation.delivery_status,
                        )}
                      </span>
                    </div>

                    {["pending", "expired"].includes(invitation.status) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={resendInvitation}>
                          <ReturnTo />
                          <input type="hidden" name="email" value={invitation.email} />
                          <input type="hidden" name="role" value={invitation.role} />
                          <input
                            type="hidden"
                            name="business_role"
                            value={invitation.business_role ?? ""}
                          />
                          <PendingSubmitButton
                            pendingLabel="Invio…"
                            className="h-9 rounded-lg border border-[#c7d5cf] bg-white px-3 text-xs font-semibold text-[#173f35]"
                          >
                            Reinvia
                          </PendingSubmitButton>
                        </form>

                        {invitation.status === "pending" ? (
                          <form action={revokeInvitation}>
                            <ReturnTo />
                            <input
                              type="hidden"
                              name="invitation_id"
                              value={invitation.id}
                            />
                            <PendingSubmitButton
                              pendingLabel="Revoca…"
                              className="h-9 rounded-lg border border-[#e1c7c2] bg-white px-3 text-xs font-semibold text-[#8a3a30]"
                            >
                              Revoca
                            </PendingSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-[#d7dfdb] px-4 py-3 text-xs text-[#7b8782]">
                  Nessun invito ancora inviato.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#87938e]">
            Persone e ruoli
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
            Accessi del workspace
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#66736e]">
            Sospendere un accesso non elimina l&apos;account o la cronologia. L&apos;amministrazione della piattaforma resta separata dai ruoli aziendali.
          </p>

          <div className="mt-5 space-y-3">
            {(state.members ?? []).map((member) => {
              const isCurrentUser = member.user_id === context.userId;
              const active = member.status === "active";

              return (
                <div
                  key={member.user_id}
                  className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1d2824]">
                        {member.email ?? "Utente workspace"}
                      </p>
                      <p className="mt-1 text-xs text-[#66736e]">
                        {permissionLabel(member.role)} ·{" "}
                        {businessRoleLabel(member.business_role)}
                        {isCurrentUser ? " · Tu" : ""}
                      </p>
                    </div>
                    <span
                      className={
                        active
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
                          : "rounded-full bg-[#ecefed] px-2.5 py-1 text-[10px] font-bold text-[#52615b]"
                      }
                    >
                      {active ? "Attivo" : "Sospeso"}
                    </span>
                  </div>

                  {active ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <form action={changeMemberRole}>
                        <ReturnTo />
                        <input type="hidden" name="user_id" value={member.user_id} />
                        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
                          Permesso
                          <div className="mt-1 flex gap-2">
                            <select
                              name="role"
                              defaultValue={member.role}
                              className="h-9 min-w-0 flex-1 rounded-lg border border-[#d7dfdb] bg-white px-2 text-xs normal-case tracking-normal text-[#43524c]"
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Membro</option>
                              <option value="viewer">Sola lettura</option>
                            </select>
                            <PendingSubmitButton
                              pendingLabel="…"
                              className="rounded-lg border border-[#d7dfdb] bg-white px-3 text-xs font-semibold normal-case tracking-normal text-[#43524c]"
                            >
                              Salva
                            </PendingSubmitButton>
                          </div>
                        </label>
                      </form>

                      <form action={changeMemberBusinessRole}>
                        <ReturnTo />
                        <input type="hidden" name="user_id" value={member.user_id} />
                        <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
                          Ruolo commerciale
                          <div className="mt-1 flex gap-2">
                            <select
                              name="business_role"
                              defaultValue={member.business_role ?? ""}
                              className="h-9 min-w-0 flex-1 rounded-lg border border-[#d7dfdb] bg-white px-2 text-xs normal-case tracking-normal text-[#43524c]"
                            >
                              <option value="">Non assegnato</option>
                              <option value="sales_director">Sales Director</option>
                              <option value="salesperson">Commerciale</option>
                              <option value="operations">Operations</option>
                            </select>
                            <PendingSubmitButton
                              pendingLabel="…"
                              className="rounded-lg border border-[#d7dfdb] bg-white px-3 text-xs font-semibold normal-case tracking-normal text-[#43524c]"
                            >
                              Salva
                            </PendingSubmitButton>
                          </div>
                        </label>
                      </form>
                    </div>
                  ) : null}

                  {!isCurrentUser ? (
                    <form action={changeMemberStatus} className="mt-3">
                      <ReturnTo />
                      <input type="hidden" name="user_id" value={member.user_id} />
                      <input
                        type="hidden"
                        name="status"
                        value={active ? "suspended" : "active"}
                      />
                      <PendingSubmitButton
                        pendingLabel="Aggiornamento…"
                        className={
                          active
                            ? "h-9 rounded-lg border border-[#e1c7c2] bg-white px-3 text-xs font-semibold text-[#8a3a30]"
                            : "h-9 rounded-lg border border-[#c7d5cf] bg-white px-3 text-xs font-semibold text-[#173f35]"
                        }
                      >
                        {active ? "Sospendi accesso" : "Riattiva accesso"}
                      </PendingSubmitButton>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </FocusPage>
  );
}
