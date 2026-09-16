import Link from "next/link";
import { redirect } from "next/navigation";

import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";

import { changeMemberRole, completeOnboarding, createOrganization, inviteMember } from "./actions";

type TeamMember = {
  user_id: string;
  email: string | null;
  role: string;
  status: string;
  is_default: boolean;
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string; invited?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  await supabase.rpc("claim_pending_organization_invitations");
  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id,role,status,is_default")
    .eq("user_id", auth.user.id)
    .eq("status", "active");

  const membership = memberships?.find((row) => row.is_default) ?? memberships?.[0] ?? null;

  if (!membership) {
    return (
      <OnboardingShell step="1 di 2" title="Crea il workspace della tua azienda" description="Definiamo il tenant che conterrà email, offerte, prezzi e memoria commerciale. Tu diventerai il primo admin.">
        <Feedback message={params.message} error={params.error} />
        <form action={createOrganization} className="mt-8 space-y-5">
          <Field label="Ragione sociale / nome azienda">
            <Input name="name" placeholder="es. Steel Trading S.r.l." minLength={2} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Paese (ISO 2 lettere)">
              <Input name="country_code" placeholder="IT" maxLength={2} className="uppercase" />
            </Field>
            <Field label="Settore">
              <Input name="industry" placeholder="Tubi in acciaio" />
            </Field>
          </div>
          <button className="h-11 w-full rounded-lg bg-slate-950 text-sm font-semibold text-white hover:bg-slate-800">
            Crea workspace
          </button>
        </form>
      </OnboardingShell>
    );
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id,name,slug,country_code,industry,onboarding_status,source_preferences,consent_version,consent_accepted_at")
    .eq("id", membership.organization_id)
    .single();

  if (!organization) redirect("/login?error=Workspace%20non%20disponibile");

  let team: TeamMember[] = [];
  let invitations: Array<{ id: string; email: string; role: string; status: string; expires_at: string }> = [];
  if (membership.role === "admin") {
    const { data: teamRows } = await supabase.rpc("organization_team_members", {
      p_organization_id: organization.id,
    });
    team = (teamRows ?? []) as TeamMember[];
    const { data: inviteRows } = await supabase
      .from("organization_invitations")
      .select("id,email,role,status,expires_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false });
    invitations = inviteRows ?? [];
  }

  const complete = organization.onboarding_status === "completed";
  if (complete && membership.role !== "admin") {
    return (
      <OnboardingShell step="Pronto" title={`Benvenuto in ${organization.name}`} description="Il tuo account è collegato al workspace. I permessi sono già applicati in base al ruolo assegnato dall’admin.">
        <Feedback message={params.invited ? "Invito accettato e membership attivata." : params.message} error={params.error} />
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          Ruolo: <strong>{membership.role}</strong>
        </div>
        <Link href="/dashboard" className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">
          Entra in Steel Sales AI
        </Link>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      step={complete ? "Workspace attivo" : "2 di 2"}
      title={complete ? `Gestisci ${organization.name}` : "Configura la memoria commerciale"}
      description={complete ? "Profilo, fonti e ruoli del tenant." : "Scegli le fonti iniziali e conferma il trattamento dei dati. Potrai importare i documenti nel blocco successivo."}
      wide
    >
      <Feedback message={params.message ?? (params.invited ? "Invito accettato." : undefined)} error={params.error} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-950">Profilo e fonti</h2>
          <p className="mt-1 text-sm text-slate-500">Le fonti selezionate preparano il prossimo step di bulk import.</p>
          <form action={completeOnboarding} className="mt-6 space-y-5">
            <input type="hidden" name="organization_id" value={organization.id} />
            <Field label="Nome azienda"><Input name="name" defaultValue={organization.name} minLength={2} required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Paese"><Input name="country_code" defaultValue={organization.country_code ?? ""} maxLength={2} className="uppercase" /></Field>
              <Field label="Settore"><Input name="industry" defaultValue={organization.industry ?? ""} /></Field>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Fonti da collegare</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  ["email", "Email"],
                  ["pdf", "PDF / offerte"],
                  ["xlsx", "Excel / listini"],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-700">
                    <input type="checkbox" name="sources" value={value} defaultChecked={(organization.source_preferences ?? []).includes(value)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <input className="mt-1" type="checkbox" name="consent" defaultChecked={Boolean(organization.consent_version)} required={!organization.consent_version} />
              <span>Confermo di essere autorizzato a importare queste fonti aziendali e che Steel Sales AI può elaborarle per ricerca, estrazione e memoria commerciale del tenant.</span>
            </label>
            <button className="h-11 w-full rounded-lg bg-slate-950 text-sm font-semibold text-white">
              {complete ? "Salva configurazione" : "Completa onboarding"}
            </button>
          </form>
        </section>

        <section className="space-y-6">
          {membership.role === "admin" ? (
            <>
              <div className="rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-950">Invita il team</h2>
                <form action={inviteMember} className="mt-5 space-y-4">
                  <input type="hidden" name="organization_id" value={organization.id} />
                  <Field label="Email"><Input type="email" name="email" placeholder="collega@azienda.it" required /></Field>
                  <label className="block text-sm font-medium text-slate-700">
                    Ruolo
                    <select name="role" defaultValue="member" className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>
                  <button className="h-10 w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800">Invia invito</button>
                </form>
                {invitations.filter((invite) => invite.status === "pending").length ? (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Inviti pendenti</p>
                    <div className="mt-3 space-y-2">
                      {invitations.filter((invite) => invite.status === "pending").map((invite) => (
                        <div key={invite.id} className="flex items-center justify-between text-xs text-slate-600">
                          <span>{invite.email}</span><span>{invite.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 p-6">
                <h2 className="text-lg font-semibold text-slate-950">Ruoli utente</h2>
                <div className="mt-4 space-y-3">
                  {team.map((member) => (
                    <form action={changeMemberRole} key={member.user_id} className="rounded-xl bg-slate-50 p-3">
                      <input type="hidden" name="organization_id" value={organization.id} />
                      <input type="hidden" name="user_id" value={member.user_id} />
                      <p className="truncate text-sm font-medium text-slate-800">{member.email ?? member.user_id}</p>
                      <div className="mt-2 flex gap-2">
                        <select name="role" defaultValue={member.role} className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button className="rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold">Salva</button>
                      </div>
                    </form>
                  ))}
                </div>
              </div>
            </>
          ) : null}
          {complete ? <Link href="/dashboard" className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white">Torna alla dashboard</Link> : null}
        </section>
      </div>
    </OnboardingShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<div className="mt-2">{children}</div></label>;
}

function Feedback({ message, error }: { message?: string; error?: string }) {
  if (!message && !error) return null;
  return <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ?? message}</div>;
}

function OnboardingShell({ step, title, description, wide = false, children }: { step: string; title: string; description: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 sm:px-8">
      <div className={`mx-auto ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-bold tracking-[0.16em] text-slate-400">STEEL SALES AI · P1</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{step}</span>
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
