import type { Metadata } from "next";
import Link from "next/link";

import { DeskApprovalButtons, DeskAssignSelect, type DeskAssignee } from "@/components/director-desk-controls";
import { dealDeskHref } from "@/lib/commercial-deal-model";
import { loadDirectorDesk } from "@/lib/director-desk";
import {
  deskDueLabel, deskInitials, deskOfficeSegments, deskShare, deskToday, formatEur,
  type DeskDueTone, type DeskMember, type DeskOffice, type DeskPersonOffice,
} from "@/lib/director-desk-model";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import { appRoutes } from "@/lib/routes";
import { privateNoIndexRobots } from "@/lib/seo";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scrivania della Direzione", robots: privateNoIndexRobots };

// DIR-DESK1 (founder decisions, 25 nov 2026): prima voce di «Direzione
// aziendale», solo amministratori. Numeri del giorno, i due uffici, le persone,
// il lavoro senza responsabile e le approvazioni in attesa, con valori in euro.
// DIR-DESK2 (26 nov 2026): nuova grafica approvata dal founder. Prima ciò che
// aspetta una decisione (approvazioni, senza responsabile con scadenza), poi gli
// uffici con il valore come titolo e la barra degli stati, poi il carico del
// team. I quattro riquadri numerici sono assorbiti dalle schede degli uffici.
// TEAM-PROFILES2: niente pulsante «Team e profili» nell'intestazione, è già
// la voce successiva del menu di Direzione aziendale.

const CARD = "rounded-2xl border border-[#bfd0c5] bg-white shadow-[0_1px_3px_rgba(15,46,35,0.08)]";
const COUNT = "rounded-full px-2 py-px text-xs font-bold tabular-nums";
const officeLabel: Record<string, string> = {
  direction: "Direzione", commercial: "Ufficio commerciale", purchasing: "Ufficio acquisti",
};
const officeOf = (office: DeskPersonOffice) => office ? officeLabel[office] : "Senza profilo";
const dueTone: Record<DeskDueTone, string> = {
  late: "text-[#9a3412]", soon: "text-[#8a4b00]", later: "text-[#3f564a]", none: "text-[#4a6155]",
};
const SEG = { todo: "bg-[#d9922e]", waiting: "bg-[#2f7a5c]", review: "bg-[#e6cf94]", rest: "bg-[#b9cfc2]" };

function Avatar({ email, size = "md" }: { email: string; size?: "sm" | "md" }) {
  return (
    <span aria-hidden="true" title={email}
      className={"inline-flex shrink-0 items-center justify-center rounded-full bg-[#d9e8df] font-bold text-[#173f35] " +
        (size === "sm" ? "-ml-1.5 h-7 w-7 border-2 border-white text-[10px] first:ml-0" : "h-8 w-8 text-[11px]")}>
      {deskInitials(email)}
    </span>
  );
}

function Chip({ href, label, value, swatch, tone = "plain" }: {
  href: string; label: string; value: number; swatch?: string; tone?: "plain" | "urgent" | "due" | "review";
}) {
  const look = tone === "urgent" && value ? "border-[#e2c27a] bg-[#fff4d6] !text-[#6b4a07] hover:bg-[#ffedc0]"
    : tone === "due" && value ? "border-transparent bg-[#fdeee6] !text-[#9a3412] hover:bg-[#fbe2d5]"
    : tone === "review" && value ? "border-dashed border-[#c9a85a] bg-white !text-[#6b4a07] hover:bg-[#fffaf0]"
    : "border-[#d6e5db] bg-white !text-[#3f5c4c] hover:bg-[#f2f8f4]";
  return (
    <Link href={href} data-testid="director-desk-chip"
      className={"inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] " + look}>
      {swatch ? <span aria-hidden="true" className={"h-2 w-2 rounded-[2px] " + swatch} /> : null}
      {label} <span className="font-bold tabular-nums">{value}</span>
    </Link>
  );
}

function OfficeCard({ office, title, valueCaption, members, href, linkLabel, links }: {
  office: DeskOffice; title: string; valueCaption: string; members: readonly DeskMember[]; href: string; linkLabel: string;
  links: { todo: string; waiting: string; due: string; review: string; rest: string };
}) {
  const seg = deskOfficeSegments(office);
  const shown = members.slice(0, 4);
  return (
    <section aria-label={title} data-testid={"director-desk-office-" + office.key} className={CARD + " flex flex-col gap-3.5 p-4 sm:p-5"}>
      <div className="flex items-center gap-2.5">
        <h2 className="text-base font-bold text-[#143f30]">{title}</h2>
        <span className="ml-auto flex items-center">
          {shown.map((m) => <Avatar key={m.userId} email={m.email} size="sm" />)}
          {members.length > shown.length ? <span className="ml-1 text-[11px] font-semibold text-[#3f564a]">+{members.length - shown.length}</span> : null}
        </span>
        <span className="text-xs font-semibold text-[#3f564a]">{office.people === 1 ? "1 persona" : office.people + " persone"}</span>
      </div>
      <div>
        <p className="text-3xl font-extrabold tabular-nums tracking-[-0.02em] text-[#0f2e23]">{formatEur(office.valueEur)}</p>
        <p className="mt-0.5 text-xs text-[#3f564a]">
          {valueCaption} · <strong className="font-semibold text-[#0f2e23]">{office.open === 1 ? "1 pratica aperta" : office.open + " pratiche aperte"}</strong>
        </p>
        {office.valueUnknown ? (
          <p className="mt-1 text-[11px] leading-4 text-[#6b4a07]">
            {office.valueUnknown === 1 ? "1 pratica ha" : office.valueUnknown + " pratiche hanno"} prezzi con unità non convertibili (ad es. €/m senza peso): esclusa dal totale, non stimata.
          </p>
        ) : null}
      </div>
      <div aria-hidden="true" className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#e4ece7]">
        {(["todo", "waiting", "review", "rest"] as const).map((key) => seg[key] ? (
          <span key={key} className={SEG[key]} style={{ width: deskShare(seg[key], office.open) }} />
        ) : null)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip href={links.todo} label="Da fare" value={office.todo} swatch={SEG.todo} tone="urgent" />
        <Chip href={links.waiting} label="In attesa" value={office.waiting} swatch={SEG.waiting} />
        {office.key === "commercial" ? <Chip href={links.review} label="Da verificare" value={office.review} swatch={SEG.review} tone="review" /> : null}
        <Chip href={links.rest} label="Altre" value={seg.rest} swatch={SEG.rest} />
        <Chip href={links.due} label="In scadenza 7 gg" value={office.due} tone="due" />
      </div>
      <Link href={href} className="mt-auto border-t border-[#e4ece7] pt-3 text-sm font-semibold !text-[#175640] hover:underline">{linkLabel} →</Link>
    </section>
  );
}

export default async function DirectorDeskPage() {
  const context = await requireWorkspaceAdmin(appRoutes.commercial.home);
  const desk = await loadDirectorDesk(context.organizationId);
  const now = Date.now();
  const assignees: DeskAssignee[] = desk.members
    .filter((m) => m.canWrite)
    .sort((a, b) => (a.office === "commercial" ? 0 : 1) - (b.office === "commercial" ? 0 : 1) || a.email.localeCompare(b.email))
    .map((m) => ({ userId: m.userId, label: m.email, office: officeOf(m.office) }));
  const unavailable = desk.salesUnavailable || desk.purchaseUnavailable;
  const approvals = desk.approvalsUnavailable ? 0 : desk.approvals.length;
  const maxOpen = Math.max(1, ...desk.people.map((p) => p.open));
  const waiting: string[] = [];
  if (approvals) waiting.push(approvals === 1 ? "1 approvazione" : approvals + " approvazioni");
  if (desk.unassignedTotal) waiting.push(desk.unassignedTotal === 1 ? "1 pratica senza responsabile" : desk.unassignedTotal + " pratiche senza responsabile");

  return (
    <div className="min-w-0 space-y-5 pb-8" data-testid="director-desk">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#3f564a]">{deskToday(now)}</p>
          <h1 className="mt-0.5 text-2xl font-extrabold tracking-[-0.02em] text-[#0f2e23]">Scrivania della Direzione</h1>
          <p className="mt-1 text-sm text-[#3f564a]" data-testid="director-desk-summary">
            {waiting.length ? (
              <><strong className="font-semibold text-[#8a4b00]">{waiting.join(" e ")}</strong> {waiting.length > 1 || approvals > 1 || desk.unassignedTotal > 1 ? "aspettano" : "aspetta"} una tua decisione.</>
            ) : "Niente aspetta una tua decisione: ogni pratica aperta ha un responsabile."}
          </p>
        </div>
      </header>

      {unavailable || desk.truncated ? (
        <p role="status" className="rounded-lg border border-[#e6d3ae] bg-[#fffaf0] px-3 py-2 text-xs text-[#795321]">
          {unavailable ? "Alcuni dati non sono leggibili in questo momento: i numeri potrebbero essere incompleti. " : ""}
          {desk.truncated ? "Conto le 200 pratiche più recenti per tipo." : ""}
        </p>
      ) : null}

      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" aria-label="Aspetta te" role="group">
        <section aria-labelledby="director-desk-approvals-h" data-testid="director-desk-approvals"
          className={"overflow-hidden rounded-2xl border bg-white shadow-[0_1px_3px_rgba(15,46,35,0.08)] " + (approvals ? "border-[#e2c27a]" : "border-[#bfd0c5]")}>
          <div className={"flex items-center gap-2 border-b px-4 py-3 " + (approvals ? "border-[#f0dfb8] bg-[#fffaf0]" : "border-[#d3e0d7]")}>
            <h2 id="director-desk-approvals-h" className="text-base font-bold text-[#143f30]">Approvazioni in attesa</h2>
            <span className={COUNT + " " + (approvals ? "bg-[#8a4b00] text-white" : "bg-[#eef3f0] text-[#143f30]")}>{approvals}</span>
          </div>
          {desk.approvalsUnavailable ? (
            <p className="px-4 py-4 text-xs text-[#795321]">Approvazioni non leggibili in questo momento.</p>
          ) : desk.approvals.length ? (
            <ul className="divide-y divide-[#eef3f0]">
              {desk.approvals.map((approval) => (
                <li key={approval.id} className="space-y-2 px-4 py-3.5" data-testid="director-desk-approval">
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#1a5144]">
                    {approval.action === "award" ? "Aggiudicazione" : "Emissione ordine al fornitore"}
                  </p>
                  <Link href={appRoutes.rfqHub.campaign(approval.rfqId)} className="block truncate text-sm font-semibold !text-[#143f30] hover:underline">
                    {approval.rfqTitle}
                  </Link>
                  <p className="text-xs text-[#3f564a]">
                    {approval.requestedByEmail ? "Chiesta da " + approval.requestedByEmail : "Richiesta"}
                    {approval.requestedAt ? " il " + formatHubDate(approval.requestedAt) : ""}
                    {approval.expiresAt ? " · scade il " + formatHubDate(approval.expiresAt) : ""}
                  </p>
                  {approval.reason ? <p className="text-xs text-[#4a6155]">{approval.reason}</p> : null}
                  <DeskApprovalButtons rfqId={approval.rfqId} approvalId={approval.id} ownRequest={approval.requestedBy === context.userId} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-5 text-sm text-[#3f564a]">Niente da approvare.</p>
          )}
        </section>

        <section aria-labelledby="director-desk-unassigned-h" className={CARD + " overflow-hidden"} data-testid="director-desk-unassigned">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#d3e0d7] px-4 py-3">
            <h2 id="director-desk-unassigned-h" className="text-base font-bold text-[#143f30]">Senza responsabile</h2>
            <span className={COUNT + " bg-[#eef3f0] text-[#143f30]"}>{desk.unassignedTotal}</span>
            <span className="ml-auto text-xs text-[#3f564a]">Richieste, offerte e ordini dei clienti · le più urgenti prima</span>
          </div>
          {desk.unassigned.length ? (
            <ul className="divide-y divide-[#eef3f0]">
              {desk.unassigned.map(({ deal }) => {
                const due = deskDueLabel(deal.dueAt, now);
                return (
                  <li key={deal.key} className="grid gap-x-3 gap-y-1.5 px-4 py-3 sm:grid-cols-[96px_minmax(0,1fr)_220px] sm:items-center">
                    <span className={"text-xs font-bold " + dueTone[due.tone]} data-testid="director-desk-due">{due.label}</span>
                    <Link href={dealDeskHref({ item: deal.key }, "")} className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#143f30]">{deal.title}</span>
                      <span className="block truncate text-xs text-[#3f564a]">
                        {[deal.reference, deal.counterparty || "Cliente da collegare", deal.action].filter(Boolean).join(" · ")}
                      </span>
                    </Link>
                    <DeskAssignSelect kind={deal.kind} id={deal.id} title={deal.title} assignees={assignees} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-5 text-sm text-[#3f564a]">Tutte le pratiche aperte hanno un responsabile.</p>
          )}
          {desk.unassignedTotal > desk.unassigned.length ? (
            <p className="border-t border-[#eef3f0] px-4 py-2.5 text-xs text-[#3f564a]">
              Mostro le {desk.unassigned.length} più urgenti su {desk.unassignedTotal}.
            </p>
          ) : null}
        </section>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <OfficeCard office={desk.offices.commercial} title="Ufficio commerciale"
          members={desk.members.filter((m) => m.office === "commercial")}
          valueCaption="offerte inviate e ordini dei clienti aperti" href={appRoutes.commercial.home} linkLabel="Richieste d'offerta"
          links={{
            todo: dealDeskHref({ filter: "todo" }), waiting: dealDeskHref({ filter: "waiting" }), due: dealDeskHref({ filter: "due" }),
            review: dealDeskHref({ filter: "review" }), rest: dealDeskHref({}),
          }} />
        <OfficeCard office={desk.offices.purchasing} title="Ufficio acquisti"
          members={desk.members.filter((m) => m.office === "purchasing")}
          valueCaption="ordini ai fornitori emessi" href={appRoutes.rfqHub.home} linkLabel="Centro RFQ"
          links={{
            todo: appRoutes.rfqHub.attention, waiting: appRoutes.rfqHub.home, due: appRoutes.rfqHub.home,
            review: appRoutes.rfqHub.home, rest: appRoutes.rfqHub.home,
          }} />
      </div>

      <section aria-labelledby="director-desk-people-h" className={CARD + " overflow-hidden"} data-testid="director-desk-people">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[#d3e0d7] px-4 py-3">
          <h2 id="director-desk-people-h" className="text-base font-bold text-[#143f30]">Carico del team</h2>
          <p className="text-xs text-[#3f564a]">
            {desk.members.length === 1 ? "1 persona attiva" : desk.members.length + " persone attive"}
            {desk.directors ? " · " + desk.directors + " in Direzione" : ""}
          </p>
        </div>
        {desk.members.length ? (
          <div className="overflow-x-auto">
            <ul className="min-w-[720px] divide-y divide-[#eef3f0]">
              {desk.people.map((person) => (
                <li key={person.member.userId} data-testid="director-desk-person"
                  className="grid grid-cols-[minmax(200px,1.3fr)_150px_minmax(180px,1.4fr)_150px_120px] items-center gap-4 px-4 py-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar email={person.member.email} />
                    <span className="truncate text-sm font-semibold text-[#143f30]">{person.member.email}</span>
                  </span>
                  {person.member.office ? (
                    <span className="text-xs font-semibold text-[#1a5144]">{officeOf(person.member.office)}</span>
                  ) : (
                    <Link href={appRoutes.company.team} className="text-xs font-semibold !text-[#8a4b00] underline underline-offset-2">Senza profilo: assegna</Link>
                  )}
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden="true" className="flex h-2 flex-1 overflow-hidden rounded-full bg-[#eef3f0]">
                      <span className={SEG.todo} style={{ width: deskShare(person.todo, maxOpen) }} />
                      <span className={SEG.waiting} style={{ width: deskShare(person.open - person.todo, maxOpen) }} />
                    </span>
                    <span className="w-16 text-xs font-semibold tabular-nums text-[#173f35]">{person.open === 1 ? "1 aperta" : person.open + " aperte"}</span>
                  </span>
                  <span className="text-xs text-[#3f564a]">
                    <strong className={person.todo ? "text-[#8a4b00]" : "font-normal"}>{person.todo}</strong> da fare ·{" "}
                    <strong className={person.due ? "text-[#9a3412]" : "font-normal"}>{person.due}</strong> in scad.
                  </span>
                  <span className="text-right text-sm font-bold tabular-nums text-[#0f2e23]">
                    {person.valueEur ? formatEur(person.valueEur) : "—"}
                    {person.valueUnknown ? <span className="block text-[10px] font-normal text-[#6b4a07]">+{person.valueUnknown} non calcolabili</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="px-4 py-5 text-sm text-[#3f564a]">Nessuna persona attiva: invita il team da «Team e profili».</p>
        )}
      </section>
    </div>
  );
}
