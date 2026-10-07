import Link from "next/link";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { InvestorOutreachCopyCard } from "@/components/investor-outreach-copy-card";
import { InvestorShareLink } from "@/components/investor-share-link";
import { getInvestorAccessInvites } from "@/lib/investor-business-plan";
import {
  getInvestorOutreachBoard,
  type InvestorOutreachPriority,
  type InvestorOutreachStage,
} from "@/lib/investor-outreach";
import { investorOutreachPack } from "@/lib/marketing-investor-outreach-pack";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

import {
  archiveInvestorOutreachTarget,
  logInvestorOutreachEvent,
  upsertInvestorOutreachTarget,
} from "./actions";

export const dynamic = "force-dynamic";

const stages: Array<{ value: InvestorOutreachStage; label: string }> = [
  { value: "target", label: "Target" },
  { value: "contacted", label: "Contattato" },
  { value: "replied", label: "Ha risposto" },
  { value: "meeting", label: "Meeting" },
  { value: "diligence", label: "Diligence" },
  { value: "term_sheet", label: "Term sheet" },
  { value: "committed", label: "Committed" },
  { value: "passed", label: "Pass" },
];

const priorities: Array<{ value: InvestorOutreachPriority; label: string }> = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Bassa" },
];

const eventTypes = [
  ["note", "Nota"],
  ["email_sent", "Email inviata"],
  ["email_received", "Email ricevuta"],
  ["meeting_scheduled", "Meeting pianificato"],
  ["meeting_held", "Meeting svolto"],
  ["deck_shared", "Deck condiviso"],
  ["data_room_granted", "Data Room concessa"],
  ["follow_up", "Follow-up"],
  ["passed", "Pass"],
  ["commitment", "Commitment"],
] as const;

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function stageLabel(value: InvestorOutreachStage) {
  return stages.find((stage) => stage.value === value)?.label ?? value;
}

function priorityClass(value: InvestorOutreachPriority) {
  if (value === "high") return "bg-rose-50 text-rose-700";
  if (value === "medium") return "bg-amber-50 text-amber-800";
  return "bg-[var(--surface-muted)] text-[var(--text-secondary)]";
}

export default async function PlatformFundraisingPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  await requirePlatformSuperadmin();

  const [board, invites, params] = await Promise.all([
    getInvestorOutreachBoard(),
    getInvestorAccessInvites(),
    searchParams,
  ]);

  const activeInvites = invites.filter((invite) => invite.status === "active");

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <section className="rounded-[30px] bg-[var(--brand-deep)] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/60">
          MKT8 · Fundraising Operations
        </p>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Investor Outreach & Data Room
            </h1>
            <p className="mt-3 text-sm leading-7 text-white/70">
              Pipeline fundraising owner-only collegata agli accessi reali della Investor Room.
              Shipped product, traction, working ask e diligence restano governati separatamente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={appRoutes.platform.investorAccess}
              className="rounded-xl border border-white/15 bg-white/[0.08] px-4 py-2.5 text-xs font-semibold text-white"
            >
              Gestisci Data Room
            </Link>
            <Link
              href={appRoutes.platform.marketingInvestorDeck}
              className="rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-[var(--brand-deep)]"
            >
              Apri Investor Deck
            </Link>
          </div>
        </div>
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Target totali", board.summary.total],
          ["Pipeline attiva", board.summary.active],
          ["Follow-up scaduti", board.summary.due_follow_up],
          ["Diligence+", board.summary.diligence_or_later],
        ].map(([label, value]) => (
          <article key={String(label)} className="rounded-2xl border border-[var(--border)] bg-white p-5">
            <p className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{value}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <article className="rounded-[28px] border border-[var(--border)] bg-white p-6">
          <p className="app-kicker">Nuovo target</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            Aggiungi un investor
          </h2>
          <form action={upsertInvestorOutreachTarget} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Investor / partner</span>
              <input name="investor_name" required className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Fondo / società</span>
              <input name="firm_name" className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Email</span>
              <input name="investor_email" type="email" className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Tipo</span>
              <select name="investor_type" defaultValue="vc" className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm">
                <option value="vc">VC</option>
                <option value="corporate_vc">Corporate VC</option>
                <option value="family_office">Family Office</option>
                <option value="angel">Angel</option>
                <option value="strategic">Strategic</option>
                <option value="other">Altro</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Geografia</span>
              <input name="geography" placeholder="Italy / Europe" className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Priorità</span>
              <select name="priority" defaultValue="medium" className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm">
                {priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Stage</span>
              <select name="stage" defaultValue="target" className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm">
                {stages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Thesis fit</span>
              <textarea name="thesis_fit" rows={3} placeholder="Perché questo investor è adatto a Smart Steel Sales?" className="mt-1.5 w-full rounded-xl border border-[var(--border)] p-3 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Fonte</span>
              <input name="source" placeholder="Intro, evento, ricerca..." className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" />
            </label>
            <label>
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Prossimo follow-up</span>
              <input name="next_follow_up_at" type="datetime-local" className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] px-3 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Investor Room</span>
              <select name="invite_id" defaultValue="" className="mt-1.5 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 text-sm">
                <option value="">Non collegata</option>
                {activeInvites.map((invite) => (
                  <option key={invite.id} value={invite.id}>
                    {invite.label}{invite.investor_email ? ` · ${invite.investor_email}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">Note interne</span>
              <textarea name="notes" rows={4} className="mt-1.5 w-full rounded-xl border border-[var(--border)] p-3 text-sm" />
            </label>
            <button className="platform-primary min-h-11 rounded-xl px-4 text-sm font-semibold sm:col-span-2">
              Aggiungi alla pipeline
            </button>
          </form>
        </article>

        <article className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-subtle)] p-6">
          <p className="app-kicker">Outreach strategy</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            Chi contattare prima
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {investorOutreachPack.positioning}
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-[var(--brand-primary-soft)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-deep)]">Fit</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-primary)]">
                {investorOutreachPack.idealInvestor.map((item) => <li key={item}>✓ {item}</li>)}
              </ul>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--semantic-warning)]">Disqualify early</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--text-secondary)]">
                {investorOutreachPack.disqualifiers.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-subtle)] p-6">
        <p className="app-kicker">Investor Outreach Pack</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
          Messaggi governati e copy-ready
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
          Nessun invio automatico in MKT8. Personalizza nome e contesto, poi usa il canale appropriato.
        </p>
        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          {investorOutreachPack.templates.map(({ key, ...template }) => (
            <InvestorOutreachCopyCard key={key} {...template} />
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--border)] bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="app-kicker">Fundraising pipeline</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              Investor targets & diligence
            </h2>
          </div>
          <Link href={appRoutes.platform.investorAccess} className="text-xs font-semibold text-[var(--brand-primary)]">
            Apri access ledger →
          </Link>
        </div>

        <div className="mt-6 space-y-4">
          {board.targets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-subtle)] p-6">
              <p className="font-semibold text-[var(--text-primary)]">Pipeline vuota</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Inserisci i primi target ad alta affinità. Non serve riempire il CRM: serve costruire una sequenza di conversazioni qualificata.
              </p>
            </div>
          ) : (
            board.targets.map((target) => (
              <article key={target.id} className="rounded-2xl border border-[var(--border)] bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                        {target.investor_name}
                        {target.firm_name ? ` · ${target.firm_name}` : ""}
                      </h3>
                      <span className="rounded-full bg-[var(--steel-blue-soft)] px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--steel-blue)]">
                        {stageLabel(target.stage)}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${priorityClass(target.priority)}`}>
                        {target.priority}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                      {target.investor_email ?? "Email non inserita"} · {target.geography ?? "Geografia non inserita"}
                    </p>
                    {target.thesis_fit ? (
                      <p className="mt-3 max-w-4xl text-sm leading-6 text-[var(--text-secondary)]">{target.thesis_fit}</p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-72">
                    <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
                      <span className="block text-[var(--text-tertiary)]">Ultimo contatto</span>
                      <strong className="mt-1 block text-[var(--text-primary)]">{dateLabel(target.last_contacted_at)}</strong>
                    </div>
                    <div className="rounded-xl bg-[var(--surface-subtle)] p-3">
                      <span className="block text-[var(--text-tertiary)]">Follow-up</span>
                      <strong className="mt-1 block text-[var(--text-primary)]">{dateLabel(target.next_follow_up_at)}</strong>
                    </div>
                  </div>
                </div>

                {target.invite ? (
                  <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-primary)]">Data Room linked</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                          {target.invite.label} · {target.invite.status}
                        </p>
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {target.invite.access_count} accessi · ultimo {dateLabel(target.invite.last_accessed_at)} · scade {dateLabel(target.invite.expires_at)}
                        </p>
                      </div>
                      <div className="min-w-0 lg:w-[420px]">
                        <InvestorShareLink shareToken={target.invite.share_token} />
                      </div>
                    </div>
                  </div>
                ) : null}

                <details className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)]">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">
                    Aggiorna target / Data Room
                  </summary>
                  <form action={upsertInvestorOutreachTarget} className="grid gap-3 border-t border-[var(--border)] p-4 md:grid-cols-2 xl:grid-cols-4">
                    <input type="hidden" name="target_id" value={target.id} />
                    <input name="investor_name" defaultValue={target.investor_name} required className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs" />
                    <input name="firm_name" defaultValue={target.firm_name ?? ""} placeholder="Fondo" className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs" />
                    <input name="investor_email" type="email" defaultValue={target.investor_email ?? ""} placeholder="Email" className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs" />
                    <select name="investor_type" defaultValue={target.investor_type} className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs">
                      <option value="vc">VC</option><option value="corporate_vc">Corporate VC</option><option value="family_office">Family Office</option><option value="angel">Angel</option><option value="strategic">Strategic</option><option value="other">Altro</option>
                    </select>
                    <input name="geography" defaultValue={target.geography ?? ""} placeholder="Geografia" className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs" />
                    <input name="source" defaultValue={target.source ?? ""} placeholder="Fonte" className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs" />
                    <select name="stage" defaultValue={target.stage} className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs">
                      {stages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <select name="priority" defaultValue={target.priority} className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs">
                      {priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                    <input name="next_follow_up_at" type="datetime-local" defaultValue={dateTimeLocal(target.next_follow_up_at)} className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs" />
                    <select name="invite_id" defaultValue={target.invite?.id ?? ""} className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs">
                      <option value="">Nessuna Data Room</option>
                      {invites.map((invite) => <option key={invite.id} value={invite.id}>{invite.label} · {invite.status}</option>)}
                    </select>
                    <textarea name="thesis_fit" defaultValue={target.thesis_fit ?? ""} rows={2} placeholder="Thesis fit" className="rounded-lg border border-[var(--border)] bg-white p-3 text-xs md:col-span-2" />
                    <textarea name="notes" defaultValue={target.notes ?? ""} rows={2} placeholder="Note interne" className="rounded-lg border border-[var(--border)] bg-white p-3 text-xs md:col-span-2" />
                    <button className="platform-primary min-h-10 rounded-lg px-3 text-xs font-semibold md:col-span-2 xl:col-span-3">Salva aggiornamenti</button>
                    <ConfirmSubmitButton
                      formAction={archiveInvestorOutreachTarget}
                      name="target_id"
                      value={target.id}
                      title="Archiviare questo target?"
                      description="Il record sparirà dalla pipeline operativa ma resterà conservato nel database."
                      confirmLabel="Archivia"
                      className="min-h-10 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700"
                    >
                      Archivia
                    </ConfirmSubmitButton>
                  </form>
                </details>

                <div className="mt-4 grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
                  <form action={logInvestorOutreachEvent} className="rounded-2xl border border-[var(--border)] p-4">
                    <input type="hidden" name="target_id" value={target.id} />
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Nuovo evento</p>
                    <div className="mt-3 grid gap-3">
                      <select name="event_type" defaultValue="note" className="h-10 rounded-lg border border-[var(--border)] bg-white px-3 text-xs">
                        {eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <textarea name="summary" rows={3} required placeholder="Es. Deck inviato dopo il meeting; richiesto focus su retention e GTM." className="rounded-lg border border-[var(--border)] p-3 text-xs" />
                      <button className="rounded-lg bg-[var(--brand-deep)] px-3 py-2.5 text-xs font-semibold text-white">Registra evento</button>
                    </div>
                  </form>

                  <div className="rounded-2xl border border-[var(--border)] p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Ultimi eventi</p>
                    <div className="mt-3 space-y-2">
                      {target.events.length === 0 ? (
                        <p className="text-xs text-[var(--text-tertiary)]">Nessun evento registrato.</p>
                      ) : target.events.map((event) => (
                        <div key={event.id} className="rounded-xl bg-[var(--surface-subtle)] px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase text-[var(--steel-blue)]">{event.event_type.replaceAll("_", " ")}</span>
                            <span className="text-[10px] text-[var(--text-tertiary)]">{dateLabel(event.occurred_at)}</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{event.summary}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
