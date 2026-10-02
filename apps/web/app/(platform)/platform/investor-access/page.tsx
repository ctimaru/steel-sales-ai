import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InvestorShareLink } from "@/components/investor-share-link";
import { getInvestorAccessInvites } from "@/lib/investor-business-plan";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";

import {
  createInvestorAccessInvite,
  revokeInvestorAccessInvite,
  updateInvestorAccessScopes,
} from "./actions";

export const dynamic = "force-dynamic";

function dateLabel(value: string | null) {
  if (!value) return "Mai";
  return new Date(value).toLocaleString("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function defaultExpiry() {
  return new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
}

export default async function PlatformInvestorAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requirePlatformSuperadmin();

  const [invites, params] = await Promise.all([
    getInvestorAccessInvites(),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <section className="rounded-3xl border border-[#dce2df] bg-white p-5 sm:p-6">
        <p className="platform-kicker">Strategy & Investors</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
          Investor Access
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
          Un unico sistema di inviti per Business Plan e KPI. Ogni accesso ha
          scope espliciti, password dedicata, scadenza, revoca e sessione
          temporanea. Nessun invito concede accesso alla Platform Console.
        </p>
      </section>

      {params.message ? (
        <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {params.message}
        </div>
      ) : null}
      {params.error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {params.error}
        </div>
      ) : null}

      <section className="grid gap-8 rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8 xl:grid-cols-[0.78fr_1.22fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">
            Nuovo invito
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
            Crea un accesso dedicato
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#66736e]">
            Scegli cosa può vedere l&apos;investitore. La password viene
            memorizzata solo come hash. Dopo 5 tentativi errati l&apos;invito
            viene bloccato temporaneamente; la sessione dura al massimo 12 ore.
          </p>

          <form action={createInvestorAccessInvite} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-[#52615b]">Nome invito</span>
              <input
                name="label"
                required
                placeholder="es. Investor Meeting · Fondo XYZ"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#52615b]">Email investor · opzionale</span>
              <input
                name="email"
                type="email"
                placeholder="investor@fund.com"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[#52615b]">Password dedicata</span>
              <input
                name="password"
                type="password"
                minLength={12}
                required
                autoComplete="new-password"
                className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
              />
              <span className="mt-1 block text-[11px] text-[#87938e]">
                Minimo 12 caratteri. Condividila separatamente dal link.
              </span>
            </label>

            <fieldset>
              <legend className="text-xs font-semibold text-[#52615b]">Sezioni condivise</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl border border-[#dce2df] bg-[#f8faf9] p-3">
                  <input name="business_plan" type="checkbox" defaultChecked />
                  <span>
                    <span className="block text-sm font-semibold text-[#1d2824]">Business Plan</span>
                    <span className="block text-[11px] text-[#87938e]">Highlights + Details</span>
                  </span>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-[#dce2df] bg-[#f8faf9] p-3">
                  <input name="kpi" type="checkbox" />
                  <span>
                    <span className="block text-sm font-semibold text-[#1d2824]">KPI</span>
                    <span className="block text-[11px] text-[#87938e]">Dashboard investor</span>
                  </span>
                </label>
              </div>
            </fieldset>

            <label className="block">
              <span className="text-xs font-semibold text-[#52615b]">Scadenza accesso</span>
              <input
                name="expires_on"
                type="date"
                required
                defaultValue={defaultExpiry()}
                className="mt-1.5 h-11 w-full rounded-xl border border-[#d7dfdb] bg-white px-3 text-sm"
              />
            </label>

            <button className="platform-primary min-h-11 w-full rounded-xl px-4 text-sm font-semibold">
              Crea accesso investor
            </button>
          </form>
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#87938e]">Access ledger</p>
              <h3 className="mt-1 text-xl font-semibold text-[#1d2824]">Inviti e permessi</h3>
            </div>
            <span className="rounded-full bg-[#f2f4f3] px-3 py-1.5 text-xs font-semibold text-[#596761]">
              {invites.length} inviti
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {invites.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cbd8d3] bg-[#f8faf9] p-6">
                <p className="font-semibold text-[#1d2824]">Nessun accesso investor creato</p>
                <p className="mt-2 text-sm leading-6 text-[#66736e]">
                  Business Plan e KPI restano visibili soltanto al Platform Owner.
                </p>
              </div>
            ) : (
              invites.map((invite) => (
                <article key={invite.id} className="rounded-2xl border border-[#e0e6e3] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-[#1d2824]">{invite.label}</h4>
                        <span
                          className={[
                            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                            invite.status === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : invite.status === "expired"
                                ? "bg-amber-50 text-amber-800"
                                : "bg-rose-50 text-rose-700",
                          ].join(" ")}
                        >
                          {invite.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#87938e]">
                        {invite.investor_email ?? "Nessuna email associata"} · scade {dateLabel(invite.expires_at)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {invite.scopes.map((scope) => (
                          <span key={scope} className="rounded-full bg-[#eef3f0] px-2.5 py-1 text-[10px] font-semibold text-[#345047]">
                            {scope === "business_plan" ? "Business Plan" : "KPI"}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-semibold text-[#345047]">{invite.access_count} accessi</p>
                      <p className="mt-1 text-[11px] text-[#87938e]">Ultimo: {dateLabel(invite.last_accessed_at)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <InvestorShareLink shareToken={invite.share_token} />
                  </div>

                  {invite.status === "active" ? (
                    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                      <form action={updateInvestorAccessScopes} className="flex flex-wrap items-center gap-3 rounded-xl bg-[#f8faf9] p-3">
                        <input type="hidden" name="invite_id" value={invite.id} />
                        <span className="text-xs font-semibold text-[#52615b]">Permessi</span>
                        <label className="flex items-center gap-1.5 text-xs text-[#52615b]">
                          <input
                            name="business_plan"
                            type="checkbox"
                            defaultChecked={invite.scopes.includes("business_plan")}
                          />
                          Business Plan
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[#52615b]">
                          <input
                            name="kpi"
                            type="checkbox"
                            defaultChecked={invite.scopes.includes("kpi")}
                          />
                          KPI
                        </label>
                        <button className="rounded-lg border border-[#cbd8d3] bg-white px-3 py-2 text-xs font-semibold text-[#345047]">
                          Aggiorna
                        </button>
                      </form>

                      <form action={revokeInvestorAccessInvite} className="flex flex-col gap-2 sm:flex-row">
                        <input type="hidden" name="invite_id" value={invite.id} />
                        <input
                          name="reason"
                          placeholder="Motivo revoca"
                          className="h-10 min-w-0 flex-1 rounded-lg border border-[#d7dfdb] px-3 text-xs"
                        />
                        <ConfirmSubmitButton
                          title="Revocare questo accesso investor?"
                          description="Tutte le sessioni attive collegate a questo invito verranno invalidate immediatamente."
                          confirmLabel="Revoca"
                          className="h-10 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700"
                        >
                          Revoca
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
