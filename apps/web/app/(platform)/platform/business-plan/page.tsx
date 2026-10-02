import { BusinessPlanHighlights } from "@/components/business-plan-highlights";
import { BusinessPlanTabs } from "@/components/business-plan-tabs";
import { InvestorShareLink } from "@/components/investor-share-link";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { getInvestorBusinessPlanInvites } from "@/lib/investor-business-plan";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

import {
  createInvestorBusinessPlanInvite,
  revokeInvestorBusinessPlanInvite,
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

export default async function PlatformBusinessPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requirePlatformSuperadmin();

  const [invites, params] = await Promise.all([
    getInvestorBusinessPlanInvites(),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <section className="flex flex-col gap-4 rounded-3xl border border-[#dce2df] bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="platform-kicker">L27.2 · Business Model</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">
            Business Plan · Investor Room
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66736e]">
            Documento visuale vivo per costruire il Business Plan e presentare Smart Steel Sales agli investitori.
            La vista Platform è riservata al Platform Owner; gli accessi esterni sono isolati e revocabili.
          </p>
        </div>
        <a
          href="#investor-access"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]"
        >
          Gestisci accessi investor
        </a>
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

      <BusinessPlanTabs baseHref={appRoutes.platform.businessPlan} active="highlights" />

      <BusinessPlanHighlights />

      <section
        id="investor-access"
        className="scroll-mt-24 rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8"
      >
        <div className="grid gap-8 xl:grid-cols-[0.78fr_1.22fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1a5144]">
              Investor access
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824]">
              Crea un accesso dedicato
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#66736e]">
              Ogni investor riceve un link univoco e una password dedicata. La password viene hashata e non può essere riletta.
              Dopo 5 tentativi errati l&apos;invito viene bloccato per 15 minuti; le sessioni durano al massimo 12 ore.
            </p>

            <form action={createInvestorBusinessPlanInvite} className="mt-6 space-y-4">
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
              <button className="min-h-11 w-full rounded-xl bg-[#1a5144] px-4 text-sm font-semibold text-white hover:bg-[#226657]">
                Crea accesso investor
              </button>
            </form>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#87938e]">Access ledger</p>
                <h3 className="mt-1 text-xl font-semibold text-[#1d2824]">Inviti e utilizzo</h3>
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
                    Il Business Plan resta visibile soltanto al Platform Owner finché non crei il primo invito.
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
                      <form action={revokeInvestorBusinessPlanInvite} className="mt-4 flex flex-col gap-2 sm:flex-row">
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
                          Revoca accesso
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
