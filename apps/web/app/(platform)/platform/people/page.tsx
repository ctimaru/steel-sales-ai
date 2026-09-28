import { redirect } from "next/navigation";
import {
  PLATFORM_PERMISSIONS,
  PLATFORM_STAFF_ROLE_TEMPLATES,
  type PlatformStaffRoleKey,
} from "@/lib/platform-access-contract";
import {
  getPlatformStaffDirectory,
  getPlatformStaffInvitations,
  requirePlatformConsoleContext,
} from "@/lib/platform-admin";

import {
  createPlatformStaffInvitation,
  resendPlatformStaffInvitation,
  revokePlatformStaffInvitation,
  setPlatformStaffStatus,
  updatePlatformStaffRoles,
} from "./actions";

const ROLE_COPY: Record<
  PlatformStaffRoleKey,
  { title: string; description: string }
> = {
  registration_admin: {
    title: "Registration Admin",
    description:
      "Gestisce onboarding aziende, richieste di integrazione, approvazione, attivazione e bridge verso il Network.",
  },
  network_operations_admin: {
    title: "Network Operations Admin",
    description:
      "Gestisce Company Discovery, review, pubblicazione controllata ed enrichment dei profili Network.",
  },
  claims_verification_admin: {
    title: "Claims & Ownership Admin",
    description:
      "Gestisce prove di ownership, approvazione, rifiuto e revoca dei company claim; la Network verification resta separata.",
  },
  knowledge_editor: {
    title: "Knowledge Editor",
    description:
      "Prepara e revisiona contenuti Knowledge, senza autorità di pubblicazione.",
  },
  knowledge_publisher: {
    title: "Knowledge Publisher",
    description:
      "Revisiona e pubblica contenuti Knowledge pronti, senza editing di default.",
  },
  network_trust_admin: {
    title: "Network Trust Admin",
    description:
      "Gestisce evidence pubbliche, Network verification, provenance review e identity resolution senza merge automatici né accesso tenant.",
  },
  platform_auditor: {
    title: "Platform Auditor",
    description:
      "Visibilità read-only su staff, audit e principali code operative della piattaforma.",
  },
};

const STATUS_LABELS = {
  active: "Attivo",
  suspended: "Sospeso",
  revoked: "Revocato",
} as const;

function roleLabel(role: PlatformStaffRoleKey) {
  return ROLE_COPY[role]?.title ?? role;
}

function rolePermissions(roleKey: PlatformStaffRoleKey) {
  const role = PLATFORM_STAFF_ROLE_TEMPLATES.find(
    (item) => item.key === roleKey,
  );
  if (!role) return [];

  return role.permissions
    .map((permissionKey) =>
      PLATFORM_PERMISSIONS.find((permission) => permission.key === permissionKey),
    )
    .filter((permission): permission is NonNullable<typeof permission> =>
      Boolean(permission),
    );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status: "active" | "suspended" | "revoked") {
  if (status === "active") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "suspended") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  return "border-slate-200 bg-slate-100 text-slate-600";
}

export default async function PlatformPeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    message?: string;
    warning?: string;
    error?: string;
  }>;
}) {
  const context = await requirePlatformConsoleContext();
  if (!context.is_platform_owner) redirect("/platform");
  const [{ message, warning, error }, staff, invitations] = await Promise.all([
    searchParams,
    getPlatformStaffDirectory(),
    getPlatformStaffInvitations(),
  ]);

  const activeStaff = staff.filter((item) => item.status === "active").length;
  const suspendedStaff = staff.filter(
    (item) => item.status === "suspended",
  ).length;
  const pendingInvitations = invitations.filter(
    (item) => item.status === "pending",
  );
  const invitationHistory = invitations.filter(
    (item) => item.status !== "pending",
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="platform-surface rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="platform-kicker">Platform governance</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#18263d] sm:text-4xl">
              People &amp; Access
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#66768d]">
              Crea e governa gli account amministrativi delegati della piattaforma.
              Ogni persona usa una propria identità, riceve solo role template
              prestabiliti e non ottiene automaticamente accesso alla Commercial
              Memory privata dei tenant.
            </p>
          </div>
          <div className="rounded-2xl border border-[#dbe7f7] bg-[#f1f6ff] px-5 py-4">
            <p className="text-xs font-semibold text-[#71819a]">
              Root authority
            </p>
            <p className="mt-1 text-sm font-semibold text-[#173468]">
              Platform Owner
            </p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-[#71819a]">
              Unico, non delegabile e fuori dal normale lifecycle dello staff.
            </p>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {message}
        </div>
      ) : null}
      {warning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {warning}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Platform Owner", 1],
          ["Staff attivo", activeStaff],
          ["Staff sospeso", suspendedStaff],
          ["Inviti pendenti", pendingInvitations.length],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-[#e1e8f2] bg-white p-5"
          >
            <p className="metric-number text-3xl font-semibold text-[#1e2b45]">
              {Number(value)}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#68788e]">
              {label}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-[#e1e8f2] bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">
            Nuovo account amministrativo
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">
            Invita Platform Staff
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#68788e]">
            L&apos;invito dura 7 giorni. L&apos;utente deve usare esattamente
            l&apos;email invitata e verificare il proprio account.
          </p>

          <form action={createPlatformStaffInvitation} className="mt-6 space-y-5">
            <label className="block text-sm font-semibold text-[#40516a]">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="nome@azienda.it"
                className="mt-2 h-11 w-full rounded-xl border border-[#dbe5f1] bg-white px-3 text-sm outline-none focus:border-[#9bbcf0]"
              />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-[#40516a]">
                Ruoli iniziali
              </legend>
              <p className="mt-1 text-xs leading-5 text-[#7a899d]">
                Puoi assegnare più template. I permessi effettivi saranno
                l&apos;unione dei template selezionati.
              </p>
              <div className="mt-3 space-y-3">
                {PLATFORM_STAFF_ROLE_TEMPLATES.map((role) => (
                  <label
                    key={role.key}
                    className="flex cursor-pointer gap-3 rounded-2xl border border-[#e1e8f2] p-4 hover:border-[#bdd1f4] hover:bg-[#f8fbff]"
                  >
                    <input
                      type="checkbox"
                      name="roles"
                      value={role.key}
                      className="mt-1 h-4 w-4 rounded border-[#b9c8dc]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#1e2b45]">
                        {ROLE_COPY[role.key].title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-[#68788e]">
                        {ROLE_COPY[role.key].description}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {role.permissions.map((permission) => (
                          <span
                            key={permission}
                            className="rounded-full border border-[#dce6f3] bg-white px-2 py-1 text-[10px] font-semibold text-[#64758d]"
                          >
                            {permission}
                          </span>
                        ))}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-semibold text-[#40516a]">
              Nota interna
              <input
                name="reason"
                placeholder="Es. supporto operativo onboarding aziende"
                className="mt-2 h-11 w-full rounded-xl border border-[#dbe5f1] bg-white px-3 text-sm outline-none focus:border-[#9bbcf0]"
              />
            </label>

            <button className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#2f6fed] px-4 text-sm font-semibold text-white hover:bg-[#245ed1]">
              Crea invito e invia email
            </button>
          </form>
        </div>

        <div className="rounded-3xl border border-[#e1e8f2] bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">
            Authority model
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">
            Role template disponibili
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#68788e]">
            Nessun template può contenere permission root-only. La gestione
            staff e le impostazioni globali restano esclusivamente al Platform
            Owner.
          </p>

          <div className="mt-5 space-y-3">
            {PLATFORM_STAFF_ROLE_TEMPLATES.map((role) => {
              const permissions = rolePermissions(role.key);
              const highRisk = permissions.filter(
                (permission) =>
                  permission.risk === "high" || permission.risk === "critical",
              ).length;

              return (
                <details
                  key={role.key}
                  className="rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-4"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1e2b45]">
                          {ROLE_COPY[role.key].title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[#68788e]">
                          {ROLE_COPY[role.key].description}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#68788e]">
                        {permissions.length} permessi
                      </span>
                    </div>
                  </summary>
                  <div className="mt-4 border-t border-[#e2eaf4] pt-4">
                    {highRisk ? (
                      <p className="mb-3 text-xs font-semibold text-amber-700">
                        {highRisk} azioni ad impatto elevato incluse.
                      </p>
                    ) : null}
                    <div className="space-y-2">
                      {permissions.map((permission) => (
                        <div
                          key={permission.key}
                          className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-[#40516a]">
                              {permission.key}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-[#8290a4]">
                              {permission.description}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full border border-[#dce6f3] px-2 py-1 text-[9px] font-bold uppercase text-[#71819a]">
                            {permission.risk}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f6fed]">
              Root account
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#1e2b45]">
              Platform Owner
            </h2>
          </div>
          <span className="rounded-full border border-[#d7e5ff] bg-[#eaf2ff] px-3 py-1.5 text-xs font-semibold text-[#2f6fed]">
            Non delegabile
          </span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <p className="text-sm font-semibold text-[#1e2b45]">
              {context.viewerLabel}
            </p>
            <p className="mt-1 text-xs leading-5 text-[#68788e]">
              Bypass su tutte le permission conosciute. Non può essere sospeso,
              revocato o trasformato in Platform Staff da questa console.
            </p>
          </div>
          <span className="rounded-xl bg-[#173468] px-3 py-2 text-xs font-semibold text-white">
            Root authority
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">
            Delegated administration
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">
            Platform Staff
          </h2>
          <p className="mt-1 text-sm text-[#68788e]">
            {staff.length
              ? String(staff.length) + " identità amministrative registrate."
              : "Nessun account Platform Staff è stato ancora attivato."}
          </p>
        </div>

        {staff.map((member) => (
          <article
            key={member.user_id}
            className="rounded-2xl border border-[#e1e8f2] bg-white p-5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                      statusClass(member.status),
                    ].join(" ")}
                  >
                    {STATUS_LABELS[member.status]}
                  </span>
                  {member.roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-full border border-[#dce6f3] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold text-[#5f718a]"
                    >
                      {roleLabel(role)}
                    </span>
                  ))}
                </div>
                <h3 className="mt-3 break-all text-base font-semibold text-[#1e2b45]">
                  {member.email}
                </h3>
                <p className="mt-1 text-xs text-[#8290a4]">
                  Attivato {formatDate(member.activated_at)} · Ultima modifica{" "}
                  {formatDate(member.updated_at)}
                </p>
              </div>

              {member.status !== "revoked" ? (
                <div className="flex flex-wrap gap-2">
                  <details className="relative">
                    <summary className="cursor-pointer list-none rounded-xl border border-[#dbe5f1] bg-white px-3 py-2 text-xs font-semibold text-[#40516a] hover:border-[#bdd1f4]">
                      Modifica ruoli
                    </summary>
                    <form
                      action={updatePlatformStaffRoles}
                      className="mt-2 w-full min-w-[300px] rounded-2xl border border-[#dbe5f1] bg-[#f8fbff] p-4 shadow-sm sm:w-[420px]"
                    >
                      <input
                        type="hidden"
                        name="user_id"
                        value={member.user_id}
                      />
                      <fieldset className="space-y-2">
                        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#71819a]">
                          Role template
                        </legend>
                        {PLATFORM_STAFF_ROLE_TEMPLATES.map((role) => (
                          <label
                            key={role.key}
                            className="flex items-start gap-2 rounded-xl bg-white px-3 py-2"
                          >
                            <input
                              type="checkbox"
                              name="roles"
                              value={role.key}
                              defaultChecked={member.roles.includes(role.key)}
                              className="mt-0.5 h-4 w-4"
                            />
                            <span>
                              <span className="block text-xs font-semibold text-[#40516a]">
                                {ROLE_COPY[role.key].title}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-[#8290a4]">
                                {ROLE_COPY[role.key].description}
                              </span>
                            </span>
                          </label>
                        ))}
                      </fieldset>
                      <input
                        name="reason"
                        required
                        placeholder="Motivazione modifica ruoli"
                        className="mt-3 h-10 w-full rounded-xl border border-[#dbe5f1] bg-white px-3 text-xs outline-none"
                      />
                      <button className="mt-3 w-full rounded-xl bg-[#2f6fed] px-3 py-2.5 text-xs font-semibold text-white">
                        Salva ruoli
                      </button>
                    </form>
                  </details>

                  <details>
                    <summary className="cursor-pointer list-none rounded-xl border border-[#dbe5f1] bg-white px-3 py-2 text-xs font-semibold text-[#40516a] hover:border-[#bdd1f4]">
                      Accesso
                    </summary>
                    <div className="mt-2 min-w-[280px] rounded-2xl border border-[#dbe5f1] bg-[#f8fbff] p-4">
                      {member.status === "suspended" ? (
                        <form action={setPlatformStaffStatus}>
                          <input
                            type="hidden"
                            name="user_id"
                            value={member.user_id}
                          />
                          <input type="hidden" name="status" value="active" />
                          <input
                            name="reason"
                            required
                            placeholder="Motivazione riattivazione"
                            className="h-10 w-full rounded-xl border border-[#dbe5f1] bg-white px-3 text-xs outline-none"
                          />
                          <button className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
                            Riattiva accesso
                          </button>
                        </form>
                      ) : (
                        <form action={setPlatformStaffStatus}>
                          <input
                            type="hidden"
                            name="user_id"
                            value={member.user_id}
                          />
                          <input
                            type="hidden"
                            name="status"
                            value="suspended"
                          />
                          <input
                            name="reason"
                            required
                            placeholder="Motivazione sospensione"
                            className="h-10 w-full rounded-xl border border-[#dbe5f1] bg-white px-3 text-xs outline-none"
                          />
                          <button className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
                            Sospendi accesso
                          </button>
                        </form>
                      )}

                      <form
                        action={setPlatformStaffStatus}
                        className="mt-4 border-t border-[#e0e8f2] pt-4"
                      >
                        <input
                          type="hidden"
                          name="user_id"
                          value={member.user_id}
                        />
                        <input type="hidden" name="status" value="revoked" />
                        <input
                          name="reason"
                          required
                          placeholder="Motivazione revoca definitiva"
                          className="h-10 w-full rounded-xl border border-rose-200 bg-white px-3 text-xs outline-none"
                        />
                        <button className="mt-2 w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
                          Revoca definitivamente
                        </button>
                      </form>
                    </div>
                  </details>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-[#e1e8f2] bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7f8da3]">
              Invitation lifecycle
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[#1e2b45]">
              Inviti pendenti
            </h2>
          </div>
          <span className="rounded-full bg-[#f1f5fa] px-3 py-1.5 text-xs font-semibold text-[#68788e]">
            {pendingInvitations.length}
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {pendingInvitations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#ccd9e8] bg-[#fafcff] px-5 py-8 text-center text-sm text-[#7a899d]">
              Nessun invito Platform Staff in attesa.
            </div>
          ) : (
            pendingInvitations.map((invitation) => (
              <article
                key={invitation.invitation_id}
                className="rounded-2xl border border-[#e1e8f2] bg-[#f8fbff] p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-semibold text-[#1e2b45]">
                      {invitation.email}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {invitation.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#68788e]"
                        >
                          {roleLabel(role)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-[#8290a4]">
                      Creato {formatDate(invitation.created_at)} · Scade{" "}
                      {formatDate(invitation.expires_at)}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <form action={resendPlatformStaffInvitation}>
                      <input
                        type="hidden"
                        name="email"
                        value={invitation.email}
                      />
                      <button className="w-full rounded-xl border border-[#dbe5f1] bg-white px-3 py-2 text-xs font-semibold text-[#40516a] hover:border-[#bdd1f4]">
                        Reinvia email
                      </button>
                    </form>

                    <form
                      action={revokePlatformStaffInvitation}
                      className="flex gap-2"
                    >
                      <input
                        type="hidden"
                        name="invitation_id"
                        value={invitation.invitation_id}
                      />
                      <input
                        name="reason"
                        required
                        aria-label="Motivazione revoca invito"
                        placeholder="Motivazione"
                        className="h-9 min-w-0 rounded-xl border border-[#dbe5f1] bg-white px-3 text-xs outline-none"
                      />
                      <button className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700">
                        Revoca
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {invitationHistory.length ? (
          <details className="mt-5 border-t border-[#e8eef7] pt-5">
            <summary className="cursor-pointer text-sm font-semibold text-[#40516a]">
              Storico inviti ({invitationHistory.length})
            </summary>
            <div className="mt-3 space-y-2">
              {invitationHistory.slice(0, 20).map((invitation) => (
                <div
                  key={invitation.invitation_id}
                  className="flex flex-col gap-1 rounded-xl bg-[#f8fafc] px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-semibold text-[#40516a]">
                    {invitation.email}
                  </span>
                  <span className="text-[#8290a4]">
                    {invitation.status} ·{" "}
                    {formatDate(
                      invitation.accepted_at ??
                        invitation.revoked_at ??
                        invitation.expired_at ??
                        invitation.created_at,
                    )}
                  </span>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
