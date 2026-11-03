import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PendingSubmitButton } from "@/components/pending-submit-button";
import { ProductBrand } from "@/components/product-brand";
import { Input } from "@/components/ui/input";
import { getCompanySetupState } from "@/lib/company-setup";
import { privateNoIndexRobots } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";

import {
  changeMemberBusinessRole,
  changeMemberRole,
  changeMemberStatus,
  completeOnboarding,
  inviteMember,
  resendInvitation,
  revokeInvitation,
} from "./actions";

export const metadata: Metadata = {
  title: "Setup azienda",
  robots: privateNoIndexRobots,
};

type TeamMember = {
  user_id: string;
  email: string | null;
  role: string;
  business_role: string | null;
  status: string;
  is_default: boolean;
  joined_at?: string;
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
  last_sent_at: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  expired_at: string | null;
  updated_at: string;
};

type TeamState = {
  organization_id: string;
  members: TeamMember[];
  invitations: TeamInvitation[];
};

function StepState({ complete }: { complete: boolean }) {
  return (
    <span
      className={[
        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
        complete
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-800",
      ].join(" ")}
    >
      {complete ? "Pronto" : "Da completare"}
    </span>
  );
}

function Feedback({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return (
    <div
      className={[
        "mt-3 rounded-xl border px-3 py-2 text-sm",
        error
          ? "border-rose-200 bg-rose-50 text-rose-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800",
      ].join(" ")}
    >
      {error ?? message}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-[#43524c]">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function permissionLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "viewer") return "Viewer";
  return "Member";
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

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; invited?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,role,business_role,status,is_default")
    .eq("user_id", auth.user.id)
    .eq("status", "active");

  const membership =
    memberships?.find((row) => row.is_default) ?? memberships?.[0] ?? null;

  if (!membership) {
    const { data: application } = await supabase
      .from("company_registration_applications")
      .select("id,application_status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    redirect(application ? "/registration/status" : "/register");
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select(
      "id,name,country_code,industry,onboarding_status,source_preferences,consent_version,consent_accepted_at",
    )
    .eq("id", membership.organization_id)
    .single();

  if (!organization) {
    redirect("/login?error=Workspace%20non%20disponibile");
  }

  const setup = await getCompanySetupState(organization.id);
  const isAdmin = membership.role === "admin";

  let team: TeamMember[] = [];
  let invitations: TeamInvitation[] = [];

  if (isAdmin) {
    const { data: teamStateData, error: teamStateError } = await supabase.rpc(
      "hp8_team_state",
      { p_organization_id: organization.id },
    );
    if (teamStateError) throw new Error("team_state_unavailable");

    const teamState = (teamStateData ?? {
      organization_id: organization.id,
      members: [],
      invitations: [],
    }) as TeamState;

    team = teamState.members ?? [];
    invitations = teamState.invitations ?? [];
  }

  if (!isAdmin) {
    return (
      <main className="min-h-screen bg-[#f2f4f3] px-4 py-5 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <section className="rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5">
            <ProductBrand href="/" />
            <p className="app-kicker mt-4">Workspace aziendale</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#1d2824]">
              Benvenuto in {organization.name}
            </h1>
            <p className="mt-1 text-sm leading-6 text-[#66736e]">
              Il tuo account è già collegato all&apos;azienda. Il setup iniziale è gestito dagli
              amministratori, ma puoi entrare subito nel workspace con i permessi assegnati.
            </p>

            <Feedback
              message={
                params.invited
                  ? "Invito accettato e accesso al workspace attivato."
                  : params.message
              }
              error={params.error}
            />

            <p className="mt-3 rounded-xl border border-[#dce2df] bg-[#f7f9f8] px-3 py-2 text-sm text-[#52615b]">
              Permesso: <strong>{permissionLabel(membership.role)}</strong> · Ruolo commerciale:{" "}
              <strong>{businessRoleLabel(membership.business_role)}</strong>
            </p>

            <Link
              href="/dashboard"
              className="app-primary mt-4 inline-flex h-10 items-center justify-center rounded-xl px-5 text-sm font-semibold"
            >
              Entra nel workspace
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const actionableInvitations = invitations
    .filter((invitation) =>
      ["pending", "expired", "revoked", "accepted"].includes(invitation.status),
    )
    .slice(0, 8);
  const progress = Math.max(
    0,
    Math.min(100, setup.essential_completion_percentage),
  );

  const card = "rounded-2xl border border-[#dce2df] bg-white p-4 sm:p-5";
  const kicker = "text-[10px] font-bold uppercase tracking-[0.14em] text-[#1a5144]";
  const secondaryButton =
    "inline-flex h-9 items-center justify-center rounded-lg border border-[#c7d5cf] bg-white px-3 text-sm font-semibold text-[#173f35] hover:bg-[#f7f9f8]";
  const select =
    "mt-1 h-9 w-full rounded-lg border border-[#d7dfdb] bg-white px-2 text-sm text-[#1d2824]";

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ProductBrand href="/" />
            <Link
              href="/dashboard"
              className="app-primary inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-semibold"
            >
              Entra nel workspace
            </Link>
          </div>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <p className="app-kicker">Configurazione guidata dell’azienda</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#1d2824]">
                Prepara {organization.name} senza bloccare il lavoro
              </h1>
              <p className="mt-1 text-sm leading-6 text-[#66736e]">
                Due passi essenziali, poi il primo documento. Puoi entrare nel workspace quando vuoi.
              </p>
            </div>

            <div className="w-full shrink-0 md:w-56">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-bold uppercase tracking-[0.12em] text-[#87938e]">
                  Setup essenziale
                </span>
                <span className="font-semibold text-[#1a5144]">
                  {setup.essential_completed_count}/{setup.essential_total_count} · {progress}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e1e7e4]">
                <div
                  className="h-full rounded-full bg-[#1a5144]"
                  style={{ width: Math.max(4, progress) + "%" }}
                />
              </div>
            </div>
          </div>

          <Feedback
            message={
              params.message ??
              (params.invited ? "Invito accettato e membership attivata." : undefined)
            }
            error={params.error}
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            <article className={card}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={kicker}>Passo 1</p>
                  <h2 className="mt-1 text-base font-semibold text-[#1d2824]">
                    Rendi utile il profilo azienda
                  </h2>
                </div>
                <StepState complete={setup.profile_ready} />
              </div>
              <p className="mt-2 text-sm leading-5 text-[#66736e]">
                Aggiungi sito, nome commerciale, descrizione o logo. I dati legali li gestisce la piattaforma.
              </p>
              <Link href="/company/profile" className={secondaryButton + " mt-3"}>
                {setup.profile_ready ? "Rivedi profilo azienda" : "Completa profilo azienda"}
              </Link>
            </article>

            <article className={card}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={kicker}>Primo valore</p>
                  <h2 className="mt-1 text-base font-semibold text-[#1d2824]">
                    Porta dentro il primo dato reale
                  </h2>
                </div>
                <StepState complete={setup.first_value_ready} />
              </div>
              <p className="mt-2 text-sm leading-5 text-[#66736e]">
                Un documento, messaggio, RFQ, offerta o ordine nella tua memoria privata.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {setup.data_ready ? (
                  <Link
                    href="/operations/uploads"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-[#1a5144] px-3 text-sm font-semibold text-white hover:bg-[#226657]"
                  >
                    {setup.first_value_ready
                      ? "Apri import documenti"
                      : "Importa il primo documento"}
                  </Link>
                ) : (
                  <a href="#commercial-memory" className={secondaryButton}>
                    Configura prima le fonti
                  </a>
                )}
                <Link href="/commercial/search" className={secondaryButton}>
                  Apri Commercial Memory
                </Link>
              </div>
            </article>
          </div>

          <article id="commercial-memory" className={card + " scroll-mt-6"}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={kicker}>Passo 2</p>
                <h2 className="mt-1 text-base font-semibold text-[#1d2824]">
                  Prepara la Commercial Memory
                </h2>
              </div>
              <StepState complete={setup.data_ready} />
            </div>
            <p className="mt-2 text-sm leading-5 text-[#66736e]">
              Scegli le fonti e autorizza il trattamento. Fino ad allora il workspace è navigabile ma gli import sono bloccati.
            </p>

            <form action={completeOnboarding} className="mt-3 space-y-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,0.8fr)]">
                <Field label="Nome azienda">
                  <Input
                    name="name"
                    defaultValue={organization.name}
                    minLength={2}
                    required
                  />
                </Field>
                <Field label="Paese">
                  <Input
                    name="country_code"
                    defaultValue={organization.country_code ?? ""}
                    maxLength={2}
                    className="uppercase"
                  />
                </Field>
                <Field label="Settore">
                  <Input
                    name="industry"
                    defaultValue={organization.industry ?? "steel"}
                  />
                </Field>
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-[#43524c]">
                  Fonti da utilizzare
                </legend>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {[
                    ["email", "Email"],
                    ["pdf", "PDF / offerte"],
                    ["xlsx", "Excel / listini"],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 rounded-lg border border-[#dce2df] bg-[#f7f9f8] px-3 py-2 text-sm text-[#52615b]"
                    >
                      <input
                        type="checkbox"
                        name="sources"
                        value={value}
                        defaultChecked={(organization.source_preferences ?? []).includes(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-start gap-2.5 rounded-lg border border-[#dce2df] bg-[#f7f9f8] px-3 py-2.5 text-xs leading-5 text-[#52615b]">
                <input
                  className="mt-0.5"
                  type="checkbox"
                  name="consent"
                  defaultChecked={Boolean(organization.consent_version)}
                  required={!organization.consent_version}
                />
                <span>
                  Confermo di essere autorizzato a importare queste fonti aziendali e che Smart
                  Steel Sales può elaborarle per ricerca, estrazione e memoria commerciale del
                  tenant.
                </span>
              </label>

              <PendingSubmitButton
                pendingLabel="Salvataggio…"
                className="h-10 w-full rounded-lg bg-[#1a5144] text-sm font-semibold text-white hover:bg-[#226657] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {setup.data_ready
                  ? "Salva configurazione"
                  : "Abilita Commercial Memory"}
              </PendingSubmitButton>
            </form>
          </article>
        </section>

        <section id="team-access" className={card + " scroll-mt-6"}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={kicker}>Team</p>
              <h2 className="mt-1 text-base font-semibold text-[#1d2824]">
                Invita il team e gestisci gli accessi
              </h2>
              <p className="mt-1 text-sm leading-5 text-[#66736e]">
                Il permesso decide cosa può fare l&apos;utente; il ruolo commerciale descrive la sua funzione.
              </p>
            </div>
            <StepState complete={setup.team_ready} />
          </div>

          <form
            action={inviteMember}
            className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto] lg:items-end"
          >
            <Field label="Email">
              <Input
                type="email"
                name="email"
                placeholder="collega@azienda.it"
                required
              />
            </Field>
            <label className="block text-sm font-medium text-[#43524c]">
              Permesso
              <select name="role" defaultValue="member" className={select}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-[#43524c]">
              Ruolo commerciale
              <select name="business_role" defaultValue="salesperson" className={select}>
                <option value="">Non assegnato</option>
                <option value="sales_director">Sales Director</option>
                <option value="salesperson">Commerciale</option>
                <option value="operations">Operations</option>
              </select>
            </label>
            <PendingSubmitButton
              pendingLabel="Invio…"
              className="h-10 rounded-lg border border-[#c7d5cf] bg-white px-4 text-sm font-semibold text-[#173f35] hover:bg-[#f7f9f8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Invia invito
            </PendingSubmitButton>
          </form>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#87938e]">
                Persone ({team.length})
              </p>
              <ul className="mt-2 divide-y divide-[#e2e7e4] rounded-xl border border-[#e2e7e4]">
                {team.map((member) => {
                  const isCurrentUser = member.user_id === auth.user.id;
                  const isActive = member.status === "active";

                  return (
                    <li key={member.user_id} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1d2824]">
                            {member.email ?? member.user_id}
                          </p>
                          <p className="text-xs text-[#66736e]">
                            {permissionLabel(member.role)} ·{" "}
                            {businessRoleLabel(member.business_role)}
                            {isCurrentUser ? " · Tu" : ""}
                          </p>
                        </div>
                        <span
                          className={[
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-[#ecefed] text-[#52615b]",
                          ].join(" ")}
                        >
                          {isActive ? "Attivo" : "Sospeso"}
                        </span>
                      </div>

                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs font-semibold text-[#1a5144]">
                          Modifica accesso
                        </summary>
                          {isActive ? (
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <form action={changeMemberRole} className="flex items-end gap-2">
                                <input type="hidden" name="user_id" value={member.user_id} />
                                <label className="min-w-0 flex-1 text-xs text-[#66736e]">
                                  Permesso
                                  <select name="role" defaultValue={member.role} className={select}>
                                    <option value="admin">Admin</option>
                                    <option value="member">Member</option>
                                    <option value="viewer">Viewer</option>
                                  </select>
                                </label>
                                <PendingSubmitButton
                                  pendingLabel="…"
                                  className="h-9 rounded-lg border border-[#d7dfdb] bg-white px-3 text-xs font-semibold text-[#43524c] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Salva
                                </PendingSubmitButton>
                              </form>
                              <form action={changeMemberBusinessRole} className="flex items-end gap-2">
                                <input type="hidden" name="user_id" value={member.user_id} />
                                <label className="min-w-0 flex-1 text-xs text-[#66736e]">
                                  Ruolo commerciale
                                  <select
                                    name="business_role"
                                    defaultValue={member.business_role ?? ""}
                                    className={select}
                                  >
                                    <option value="">Non assegnato</option>
                                    <option value="sales_director">Sales Director</option>
                                    <option value="salesperson">Commerciale</option>
                                    <option value="operations">Operations</option>
                                  </select>
                                </label>
                                <PendingSubmitButton
                                  pendingLabel="…"
                                  className="h-9 rounded-lg border border-[#d7dfdb] bg-white px-3 text-xs font-semibold text-[#43524c] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Salva
                                </PendingSubmitButton>
                              </form>
                            </div>
                          ) : null}
                          {isCurrentUser ? (
                            <p className="mt-2 text-[11px] text-[#87938e]">
                              Il tuo accesso non può essere sospeso da questa sessione.
                            </p>
                          ) : (
                          <form action={changeMemberStatus} className="mt-2">
                            <input type="hidden" name="user_id" value={member.user_id} />
                            <input
                              type="hidden"
                              name="status"
                              value={isActive ? "suspended" : "active"}
                            />
                            <PendingSubmitButton
                              pendingLabel={isActive ? "Sospensione…" : "Riattivazione…"}
                              className={[
                                "text-xs font-semibold hover:underline disabled:cursor-not-allowed disabled:opacity-60",
                                isActive ? "text-[#8a3a30]" : "text-[#173f35]",
                              ].join(" ")}
                            >
                              {isActive ? "Sospendi accesso" : "Riattiva accesso"}
                            </PendingSubmitButton>
                          </form>
                          )}
                        </details>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-1.5 text-[11px] text-[#87938e]">
                Sospendere un accesso non elimina l&apos;account né la cronologia.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#87938e]">
                Inviti{actionableInvitations.length ? ` (ultimi ${actionableInvitations.length})` : ""}
              </p>
              {actionableInvitations.length ? (
                <ul className="mt-2 divide-y divide-[#e2e7e4] rounded-xl border border-[#e2e7e4]">
                  {actionableInvitations.map((invitation) => (
                    <li key={invitation.id} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#1d2824]">
                            {invitation.email}
                          </p>
                          <p className="text-xs text-[#66736e]">
                            {permissionLabel(invitation.role)} ·{" "}
                            {businessRoleLabel(invitation.business_role)} · Invii: {invitation.send_count}
                            {invitation.status === "pending"
                              ? " · Scade " +
                                new Date(invitation.expires_at).toLocaleDateString("it-IT")
                              : ""}
                            {invitation.delivery_mode
                              ? " · " +
                                (invitation.delivery_mode === "magic_link"
                                  ? "account esistente"
                                  : "nuovo account")
                              : ""}
                          </p>
                        </div>
                        <span
                          className={[
                            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                            invitation.status === "accepted"
                              ? "bg-emerald-50 text-emerald-700"
                              : invitation.status === "pending" &&
                                  invitation.delivery_status !== "failed"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-[#ecefed] text-[#52615b]",
                          ].join(" ")}
                        >
                          {invitationStatusLabel(
                            invitation.status,
                            invitation.delivery_status,
                          )}
                        </span>
                      </div>

                      {["pending", "expired"].includes(invitation.status) ? (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <form action={resendInvitation}>
                            <input type="hidden" name="email" value={invitation.email} />
                            <input type="hidden" name="role" value={invitation.role} />
                            <input
                              type="hidden"
                              name="business_role"
                              value={invitation.business_role ?? ""}
                            />
                            <PendingSubmitButton
                              pendingLabel="Invio…"
                              className="h-8 rounded-lg border border-[#c7d5cf] bg-white px-3 text-xs font-semibold text-[#173f35] hover:bg-[#edf5f2] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Reinvia
                            </PendingSubmitButton>
                          </form>

                          {invitation.status === "pending" ? (
                            <form action={revokeInvitation}>
                              <input
                                type="hidden"
                                name="invitation_id"
                                value={invitation.id}
                              />
                              <PendingSubmitButton
                                pendingLabel="Revoca…"
                                className="h-8 rounded-lg border border-[#e1c7c2] bg-white px-3 text-xs font-semibold text-[#8a3a30] hover:bg-[#fff5f3] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Revoca
                              </PendingSubmitButton>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-xl border border-dashed border-[#d7dfdb] px-3 py-2.5 text-xs text-[#7b8782]">
                  Nessun invito ancora inviato.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
