import type { Metadata } from "next";

import {
  changeMemberRole,
  changeMemberStatus,
  inviteMember,
  resendInvitation,
  revokeInvitation,
} from "@/app/onboarding/actions";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { TeamMemberProfileForm, type TeamProfileOption } from "@/components/team-member-profile-form";
import { deskInitials } from "@/lib/director-desk-model";
import {
  businessRoleLabel, officeProfileLabels, teamProfileHints, teamProfileOf,
  type TeamProfile, type TeamProfileChoice,
} from "@/lib/office-profiles";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team e profili",
  robots: privateNoIndexRobots,
};

// HP8 / OFFICE-PROFILES1: la Direzione aziendale invita e assegna i profili.
// TEAM-PROFILES2 (founder decisions, 26 nov 2026): stessa grafica del
// Commerciale, persone raggruppate per ufficio, un solo campo «Profilo»
// (Direzione aziendale = amministratore), «Sola lettura» e «Sospendi accesso»
// nel menu della persona. «Direzione commerciale» e «Operations» non si
// assegnano più: restano visibili come «vecchio profilo» finché non si sceglie.

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

const CARD = "rounded-2xl border border-[#bfd0c5] bg-white shadow-[0_1px_3px_rgba(15,46,35,0.08)]";
const PILL = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold";
const OPTIONS: TeamProfileOption[] = [
  { value: "commercial", label: officeProfileLabels.commercial },
  { value: "purchasing", label: officeProfileLabels.purchasing },
  { value: "direction", label: officeProfileLabels.direction },
];
const GROUPS: TeamProfileChoice[] = ["direction", "commercial", "purchasing"];

function profileLabel(profile: TeamProfile, businessRole: string | null) {
  if (profile === "legacy") return "Vecchio profilo: " + businessRoleLabel(businessRole);
  return profile ? officeProfileLabels[profile] : "Da assegnare";
}

function Feedback({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return (
    <p role={error ? "alert" : "status"}
      className={"rounded-lg border px-3 py-2 text-sm font-semibold " +
        (error ? "border-[#e6c4b8] bg-[#fdf1ec] text-[#9a3412]" : "border-[#bfd9c9] bg-[#eff8f2] text-[#1f5e45]")}>
      {error ?? message}
    </p>
  );
}

function ReturnTo() {
  return <input type="hidden" name="return_to" value="/company/team" />;
}

function MemberMenu({ member, profile }: { member: TeamMember; profile: TeamProfile }) {
  const viewer = member.role === "viewer";
  return (
    <details className="group relative" data-testid="team-member-menu">
      <summary aria-label={"Altre azioni per " + (member.email ?? "questa persona")}
        className="inline-flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-[#d6e5db] bg-white text-base font-bold !text-[#175640] hover:bg-[#f2f8f4] [&::-webkit-details-marker]:hidden">
        ⋯
      </summary>
      <div className="absolute right-0 top-[calc(100%+6px)] z-30 flex w-[240px] flex-col gap-1 rounded-xl border border-[#d6e5db] bg-white p-2 shadow-lg">
        {profile !== "direction" ? (
          <form action={changeMemberRole}>
            <ReturnTo />
            <input type="hidden" name="user_id" value={member.user_id} />
            <input type="hidden" name="role" value={viewer ? "member" : "viewer"} />
            <PendingSubmitButton pendingLabel="…"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[#173f35] hover:bg-[#f2f8f4]">
              {viewer ? "Togli «Sola lettura»" : "Metti in sola lettura"}
            </PendingSubmitButton>
          </form>
        ) : null}
        <form action={changeMemberStatus}>
          <ReturnTo />
          <input type="hidden" name="user_id" value={member.user_id} />
          <input type="hidden" name="status" value="suspended" />
          <PendingSubmitButton pendingLabel="…"
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#9a3412] hover:bg-[#fdf1ec]">
            Sospendi accesso
          </PendingSubmitButton>
        </form>
        <p className="px-3 pb-1 text-[11px] leading-4 text-[#4a6155]">Sospendere non elimina l&apos;account né la cronologia.</p>
      </div>
    </details>
  );
}

function MemberRow({ member, me }: { member: TeamMember; me: boolean }) {
  const profile = teamProfileOf(member.role, member.business_role);
  const email = member.email ?? "Utente workspace";
  const notes = [me ? "Tu" : null, member.role === "viewer" ? "Sola lettura" : null,
    profile === "legacy" ? profileLabel(profile, member.business_role) : null].filter(Boolean);
  return (
    <li className="grid items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(200px,280px)_40px]" data-testid="team-member">
      <span className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d9e8df] text-[11px] font-bold text-[#173f35]">
          {deskInitials(email)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-[#143f30]">{email}</span>
          {notes.length ? <span className="block truncate text-xs text-[#4a6155]">{notes.join(" · ")}</span> : null}
        </span>
      </span>
      {me ? (
        <span className="text-sm font-semibold text-[#173f35]">{profileLabel(profile, member.business_role)}</span>
      ) : (
        <TeamMemberProfileForm userId={member.user_id} email={email}
          current={profile && profile !== "legacy" ? profile : ""}
          currentLabel={profile === "legacy" ? profileLabel(profile, member.business_role) : "Scegli un ufficio…"}
          readOnly={member.role === "viewer"} options={OPTIONS} />
      )}
      {me ? <span aria-hidden="true" /> : <MemberMenu member={member} profile={profile} />}
    </li>
  );
}

function invitationStatus(invitation: TeamInvitation): { label: string; tone: string } {
  if (invitation.status === "expired") return { label: "Scaduto", tone: "bg-[#eef3f0] text-[#3f564a]" };
  if (invitation.delivery_status === "failed") return { label: "Invio da riprovare", tone: "bg-[#fdeee6] text-[#9a3412]" };
  return { label: "In attesa · scade il " + formatHubDate(invitation.expires_at), tone: "bg-[#fff4d6] text-[#6b4a07]" };
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

  const members = state.members ?? [];
  const active = members.filter((m) => m.status === "active");
  const suspended = members.filter((m) => m.status !== "active");
  const profileOf = (m: TeamMember) => teamProfileOf(m.role, m.business_role);
  const toAssign = active.filter((m) => { const p = profileOf(m); return p === null || p === "legacy"; });
  const invitations = (state.invitations ?? [])
    .filter((item) => ["pending", "expired"].includes(item.status))
    .slice(0, 12);
  const pendingInvites = invitations.filter((item) => item.status === "pending").length;

  return (
    <div className="min-w-0 space-y-5 pb-8" data-testid="team-profiles">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 max-w-[680px]">
          <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-[#0f2e23]">Team e profili</h1>
          <p className="mt-1 text-sm text-[#3f564a]">
            Chi lavora in azienda e in quale ufficio. Ogni ufficio consulta anche l&apos;altro: il profilo decide dove si può modificare.
          </p>
        </div>
      </header>

      <Feedback message={params.message} error={params.error} />

      <details className={"group " + CARD} data-testid="team-invite">
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold !text-[#175640] [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#175640] text-base !text-white">+</span>
          Invita una persona
          <span aria-hidden="true" className="ml-auto transition group-open:rotate-180">▾</span>
        </summary>
        <form action={inviteMember} className="grid gap-3 border-t border-[#e4ece7] p-4 md:grid-cols-[minmax(220px,2fr)_minmax(180px,1.2fr)_auto_auto] md:items-end">
          <ReturnTo />
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#3f564a]">
            Email
            <input type="email" name="email" required placeholder="collega@azienda.it"
              className="h-10 rounded-lg border border-[#bfd0c5] bg-white px-3 text-sm text-[#143f30] placeholder:text-[#7a9184] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640]" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#3f564a]">
            Profilo
            <select name="profile" defaultValue="commercial"
              className="h-10 rounded-lg border border-[#bfd0c5] bg-white px-2 text-sm font-semibold text-[#173f35]">
              {OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 text-sm text-[#173f35]">
            <input type="checkbox" name="read_only" className="h-4 w-4 accent-[#175640]" /> Sola lettura
          </label>
          <PendingSubmitButton pendingLabel="Invio…"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#175640] px-5 text-sm font-bold text-white hover:bg-[#104632]">
            Invia invito
          </PendingSubmitButton>
        </form>
      </details>

      <div className="flex flex-wrap gap-2 text-xs font-semibold" data-testid="team-summary">
        <span className="rounded-full border border-[#d6e5db] bg-white px-3 py-1.5 text-[#3f5c4c]">
          {active.length === 1 ? "1 persona attiva" : active.length + " persone attive"}
        </span>
        {toAssign.length ? (
          <span className="rounded-full border border-[#e2c27a] bg-[#fff4d6] px-3 py-1.5 font-bold text-[#6b4a07]">{toAssign.length} da assegnare</span>
        ) : null}
        {pendingInvites ? <span className="rounded-full border border-[#d6e5db] bg-white px-3 py-1.5 text-[#3f5c4c]">{pendingInvites === 1 ? "1 invito in attesa" : pendingInvites + " inviti in attesa"}</span> : null}
        {suspended.length ? <span className="rounded-full border border-[#d6e5db] bg-white px-3 py-1.5 text-[#3f5c4c]">{suspended.length === 1 ? "1 accesso sospeso" : suspended.length + " accessi sospesi"}</span> : null}
      </div>

      {toAssign.length ? (
        <section aria-labelledby="team-group-assign" className="rounded-2xl border border-[#e2c27a] bg-white shadow-[0_1px_3px_rgba(15,46,35,0.08)]" data-testid="team-group-assign">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-t-2xl border-b border-[#f0dfb8] bg-[#fffaf0] px-4 py-3">
            <h2 id="team-group-assign" className="text-base font-bold text-[#143f30]">Da assegnare</h2>
            <span className="text-xs font-bold tabular-nums text-[#3f564a]">{toAssign.length}</span>
            <span className="text-xs text-[#3f564a]">· scegli un ufficio: finché manca, la persona può modificare ovunque</span>
          </div>
          <ul className="divide-y divide-[#eef3f0]">
            {toAssign.map((m) => <MemberRow key={m.user_id} member={m} me={m.user_id === context.userId} />)}
          </ul>
        </section>
      ) : null}

      {GROUPS.map((group) => {
        const people = active.filter((m) => profileOf(m) === group);
        return (
          <section key={group} aria-labelledby={"team-group-" + group} className={CARD} data-testid={"team-group-" + group}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-[#e4ece7] px-4 py-3">
              <h2 id={"team-group-" + group} className="text-base font-bold text-[#143f30]">{officeProfileLabels[group]}</h2>
              <span className="text-xs font-bold tabular-nums text-[#3f564a]">{people.length}</span>
              <span className="text-xs text-[#3f564a]">· {teamProfileHints[group]}</span>
            </div>
            {people.length ? (
              <ul className="divide-y divide-[#eef3f0]">
                {people.map((m) => <MemberRow key={m.user_id} member={m} me={m.user_id === context.userId} />)}
              </ul>
            ) : (
              <p className="px-4 py-3.5 text-sm text-[#4a6155]">Nessuno in questo ufficio.</p>
            )}
          </section>
        );
      })}

      <section aria-labelledby="team-invitations" className={CARD + " overflow-hidden"} data-testid="team-invitations">
        <div className="flex flex-wrap items-baseline gap-2 border-b border-[#e4ece7] px-4 py-3">
          <h2 id="team-invitations" className="text-base font-bold text-[#143f30]">Inviti</h2>
          <span className="text-xs text-[#3f564a]">{pendingInvites === 1 ? "· 1 in attesa" : "· " + pendingInvites + " in attesa"}</span>
        </div>
        {invitations.length ? (
          <ul className="divide-y divide-[#eef3f0]">
            {invitations.map((invitation) => {
              const status = invitationStatus(invitation);
              const profile = teamProfileOf(invitation.role, invitation.business_role);
              return (
                <li key={invitation.id} className="grid items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_170px_auto_auto]">
                  <span className="truncate text-sm font-semibold text-[#143f30]">{invitation.email}</span>
                  <span className="text-xs text-[#3f564a]">
                    {profileLabel(profile, invitation.business_role)}{invitation.role === "viewer" ? " · Sola lettura" : ""}
                  </span>
                  <span className={PILL + " justify-self-start " + status.tone}>{status.label}</span>
                  <span className="flex gap-2">
                    <form action={resendInvitation}>
                      <ReturnTo />
                      <input type="hidden" name="email" value={invitation.email} />
                      <input type="hidden" name="role" value={invitation.role} />
                      <input type="hidden" name="business_role" value={invitation.business_role ?? ""} />
                      <PendingSubmitButton pendingLabel="Invio…"
                        className="inline-flex h-9 items-center rounded-lg border border-[#c7d5cf] bg-white px-3 text-xs font-semibold text-[#173f35] hover:bg-[#f2f8f4]">
                        Reinvia
                      </PendingSubmitButton>
                    </form>
                    {invitation.status === "pending" ? (
                      <form action={revokeInvitation}>
                        <ReturnTo />
                        <input type="hidden" name="invitation_id" value={invitation.id} />
                        <PendingSubmitButton pendingLabel="Revoca…"
                          className="inline-flex h-9 items-center rounded-lg border border-[#e1c7c2] bg-white px-3 text-xs font-semibold text-[#8a3a30] hover:bg-[#fdf1ec]">
                          Revoca
                        </PendingSubmitButton>
                      </form>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-4 py-3.5 text-sm text-[#4a6155]">Nessun invito in attesa.</p>
        )}
      </section>

      {suspended.length ? (
        <details className={CARD + " group"} data-testid="team-suspended">
          <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 text-sm font-semibold !text-[#175640] [&::-webkit-details-marker]:hidden">
            Accessi sospesi · {suspended.length}
            <span aria-hidden="true" className="ml-auto transition group-open:rotate-180">▾</span>
          </summary>
          <ul className="divide-y divide-[#eef3f0] border-t border-[#e4ece7]">
            {suspended.map((member) => (
              <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="min-w-0 truncate text-sm text-[#143f30]">
                  {member.email ?? "Utente workspace"} · <span className="text-[#3f564a]">{profileLabel(profileOf(member), member.business_role)}</span>
                </span>
                <form action={changeMemberStatus}>
                  <ReturnTo />
                  <input type="hidden" name="user_id" value={member.user_id} />
                  <input type="hidden" name="status" value="active" />
                  <PendingSubmitButton pendingLabel="…"
                    className="inline-flex h-9 items-center rounded-lg border border-[#c7d5cf] bg-white px-3 text-xs font-semibold text-[#173f35] hover:bg-[#f2f8f4]">
                    Riattiva
                  </PendingSubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
