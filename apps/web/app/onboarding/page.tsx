import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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
        "rounded-full px-2.5 py-1 text-[11px] font-bold",
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
      <div className="mt-2">{children}</div>
    </label>
  );
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
    if (teamStateError) throw new Error(teamStateError.message);

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
      <main className="min-h-screen bg-[#f2f4f3] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-3xl">
          <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 shadow-[0_14px_44px_rgba(18,61,52,0.06)] sm:p-8">
            <ProductBrand href="/" />
            <p className="app-kicker mt-8">Workspace aziendale</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">
              Benvenuto in {organization.name}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#66736e]">
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

            <div className="mt-6 rounded-2xl border border-[#dce2df] bg-[#f7f9f8] p-4 text-sm text-[#52615b]">
              <p>
                Permesso: <strong>{membership.role}</strong>
              </p>
              <p className="mt-1">
                Ruolo commerciale:{" "}
                <strong>{membership.business_role ?? "Non assegnato"}</strong>
              </p>
            </div>

            <Link
              href="/dashboard"
              className="app-primary mt-6 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
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

  return (
    <main className="min-h-screen bg-[#f2f4f3] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 shadow-[0_14px_44px_rgba(18,61,52,0.06)] sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <ProductBrand href="/" />
              <p className="app-kicker mt-8">HP7 · Guided company setup</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824] sm:text-4xl">
                Prepara {organization.name} senza bloccare il lavoro
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#66736e] sm:text-base">
                Completa i due elementi essenziali per rendere il profilo utile e autorizzare la
                Commercial Memory. Puoi entrare nel workspace in qualsiasi momento e tornare qui
                quando vuoi.
              </p>
            </div>

            <div className="w-full rounded-2xl border border-[#d9e1dd] bg-[#f7f9f8] p-5 lg:w-[280px]">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
                    Setup essenziale
                  </p>
                  <p className="mt-1 text-3xl font-semibold text-[#1d2824]">
                    {setup.essential_completed_count}/{setup.essential_total_count}
                  </p>
                </div>
                <span className="text-sm font-semibold text-[#1a5144]">
                  {progress}%
                </span>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e1e7e4]">
                <div
                  className="h-full rounded-full bg-[#1a5144]"
                  style={{ width: Math.max(4, progress) + "%" }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#66736e]">
                Il primo valore commerciale viene misurato separatamente dal setup.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <Feedback
              message={
                params.message ??
                (params.invited ? "Invito accettato e membership attivata." : undefined)
              }
              error={params.error}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="app-primary inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
            >
              Entra nel workspace
            </Link>
            {setup.data_ready ? (
              <Link
                href="/operations/uploads"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#c7d5cf] bg-white px-5 text-sm font-semibold text-[#173f35] hover:bg-[#f7f9f8]"
              >
                Importa il primo documento
              </Link>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-[#dce2df] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
                  Essenziale · 01
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                  Rendi utile il profilo azienda
                </h2>
              </div>
              <StepState complete={setup.profile_ready} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Aggiungi almeno un elemento distintivo al profilo Network: sito, nome commerciale,
              descrizione o logo. I dati legali rimangono governati dalla piattaforma.
            </p>
            <Link
              href="/company/profile"
              className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-[#c7d5cf] bg-white px-4 text-sm font-semibold text-[#173f35] hover:bg-[#f7f9f8]"
            >
              {setup.profile_ready ? "Rivedi profilo azienda" : "Completa profilo azienda"}
            </Link>
          </article>

          <article id="commercial-memory" className="scroll-mt-8 rounded-3xl border border-[#dce2df] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
                  Essenziale · 02
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                  Prepara la Commercial Memory
                </h2>
              </div>
              <StepState complete={setup.data_ready} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Scegli le fonti che prevedi di importare e conferma l&apos;autorizzazione al
              trattamento. Fino ad allora il workspace resta navigabile, ma gli import sono
              bloccati.
            </p>

            <form action={completeOnboarding} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <Field label="Settore">
                <Input
                  name="industry"
                  defaultValue={organization.industry ?? "steel"}
                />
              </Field>

              <fieldset>
                <legend className="text-sm font-medium text-[#43524c]">
                  Fonti da utilizzare
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[
                    ["email", "Email"],
                    ["pdf", "PDF / offerte"],
                    ["xlsx", "Excel / listini"],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 rounded-xl border border-[#dce2df] bg-[#f7f9f8] px-3 py-3 text-sm text-[#52615b]"
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

              <label className="flex items-start gap-3 rounded-xl border border-[#dce2df] bg-[#f7f9f8] p-4 text-sm leading-6 text-[#52615b]">
                <input
                  className="mt-1"
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

              <button className="h-11 w-full rounded-xl bg-[#1a5144] text-sm font-semibold text-white hover:bg-[#226657]">
                {setup.data_ready
                  ? "Salva configurazione"
                  : "Abilita Commercial Memory"}
              </button>
            </form>
          </article>
        </section>

        <section className="rounded-3xl border border-[#dce2df] bg-white p-6 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#1a5144]">
                Primo valore
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[#1d2824]">
                Porta dentro il primo dato commerciale reale
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
                Il time-to-first-value parte dall&apos;attivazione dell&apos;azienda e si chiude
                quando compare il primo documento, messaggio, RFQ, offerta o ordine nella memoria
                privata.
              </p>
            </div>
            <StepState complete={setup.first_value_ready} />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {setup.data_ready ? (
              <Link
                href="/operations/uploads"
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]"
              >
                {setup.first_value_ready
                  ? "Apri import documenti"
                  : "Importa il primo documento"}
              </Link>
            ) : (
              <a
                href="#commercial-memory"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#52615b]"
              >
                Configura prima le fonti
              </a>
            )}
            <Link
              href="/commercial/search"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[#d7dfdb] bg-white px-4 text-sm font-semibold text-[#52615b]"
            >
              Apri Commercial Memory
            </Link>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article className="rounded-3xl border border-[#dce2df] bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#87938e]">
                  Consigliato
                </p>
                <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
                  Invita il team
                </h2>
              </div>
              <StepState complete={setup.team_ready} />
            </div>
            <p className="mt-2 text-sm leading-6 text-[#66736e]">
              Non è obbligatorio per entrare nel prodotto. Puoi aggiungere colleghi ora o più
              avanti.
            </p>

            <form action={inviteMember} className="mt-5 space-y-4">
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
                <select
                  name="role"
                  defaultValue="member"
                  className="mt-2 h-10 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm text-[#1d2824]"
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </label>
              <button className="h-10 w-full rounded-xl border border-[#c7d5cf] bg-white text-sm font-semibold text-[#173f35] hover:bg-[#f7f9f8]">
                Invia invito
              </button>
            </form>

            {pendingInvitations.length ? (
              <div className="mt-5 border-t border-[#e2e7e4] pt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#87938e]">
                  Inviti pendenti
                </p>
                <div className="mt-3 space-y-2">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between gap-3 text-xs text-[#66736e]"
                    >
                      <span className="truncate">{invitation.email}</span>
                      <span className="shrink-0">{invitation.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </article>

          <article className="rounded-3xl border border-[#dce2df] bg-white p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#87938e]">
              Persone e ruoli
            </p>
            <h2 className="mt-2 text-lg font-semibold text-[#1d2824]">
              Accessi del workspace
            </h2>
            <div className="mt-5 space-y-3">
              {team.map((member) => (
                <div
                  key={member.user_id}
                  className="rounded-2xl border border-[#e2e7e4] bg-[#f7f9f8] p-4"
                >
                  <p className="truncate text-sm font-semibold text-[#1d2824]">
                    {member.email ?? member.user_id}
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <form action={changeMemberRole}>
                      <input
                        type="hidden"
                        name="user_id"
                        value={member.user_id}
                      />
                      <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#87938e]">
                        Permesso
                        <div className="mt-1 flex gap-2">
                          <select
                            name="role"
                            defaultValue={member.role}
                            className="h-9 min-w-0 flex-1 rounded-lg border border-[#d7dfdb] bg-white px-2 text-xs normal-case tracking-normal text-[#43524c]"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                          <button className="rounded-lg border border-[#d7dfdb] bg-white px-3 text-xs font-semibold normal-case tracking-normal text-[#43524c]">
                            Salva
                          </button>
                        </div>
                      </label>
                    </form>

                    <form action={changeMemberBusinessRole}>
                      <input
                        type="hidden"
                        name="user_id"
                        value={member.user_id}
                      />
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
                          <button className="rounded-lg border border-[#d7dfdb] bg-white px-3 text-xs font-semibold normal-case tracking-normal text-[#43524c]">
                            Salva
                          </button>
                        </div>
                      </label>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
