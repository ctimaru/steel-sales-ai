import type { Metadata } from "next";
import Link from "next/link";

import { DeskApprovalButtons, DeskAssignSelect, type DeskAssignee } from "@/components/director-desk-controls";
import { dealDeskHref } from "@/lib/commercial-deal-model";
import { loadDirectorDesk } from "@/lib/director-desk";
import { formatEur, type DeskOffice, type DeskPersonOffice } from "@/lib/director-desk-model";
import { formatHubDate } from "@/lib/rfq-hub-overview";
import { appRoutes } from "@/lib/routes";
import { privateNoIndexRobots } from "@/lib/seo";
import { requireWorkspaceAdmin } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Scrivania della Direzione", robots: privateNoIndexRobots };

// DIR-DESK1 (founder decisions, 25 nov 2026): prima voce di «Direzione
// aziendale», solo amministratori. Fase 1: numeri del giorno, i due uffici, le
// persone, il lavoro senza responsabile e le approvazioni in attesa, con valori
// in euro. Rischi, risultati del mese e ponte vendite↔acquisti in fase 2.

const CARD = "rounded-2xl border border-[#bfd0c5] bg-white shadow-[0_1px_3px_rgba(15,46,35,0.08)]";
const officeLabel: Record<string, string> = {
  direction: "Direzione", commercial: "Ufficio commerciale", purchasing: "Ufficio acquisti",
};
const officeOf = (office: DeskPersonOffice) => office ? officeLabel[office] : "Senza profilo";

function Number_({ label, value, detail, href, tone = "plain" }: {
  label: string; value: number; detail?: string; href: string; tone?: "plain" | "urgent" | "review";
}) {
  const accent = value > 0 && tone === "urgent" ? "border-[#e2c27a] bg-[#fffaf0]"
    : value > 0 && tone === "review" ? "border-dashed border-[#c9a85a] bg-white" : "border-[#bfd0c5] bg-white";
  return (
    <Link href={href} data-testid="director-desk-number"
      className={"group flex min-h-[92px] flex-col justify-between rounded-2xl border p-3 shadow-[0_1px_3px_rgba(15,46,35,0.08)] transition hover:border-[#175640] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#175640] sm:p-4 " + accent}>
      <span className="text-xs font-semibold text-[#3f564a]">{label}</span>
      <span className="flex items-end justify-between gap-2">
        <span className="text-3xl font-bold tabular-nums tracking-tight text-[#0f2e23]">{value}</span>
        <span aria-hidden="true" className="text-sm font-bold text-[#175640] transition group-hover:translate-x-0.5">→</span>
      </span>
      {detail ? <span className="text-[11px] text-[#4a6155]">{detail}</span> : null}
    </Link>
  );
}

function OfficeCard({ office, title, valueCaption, href, linkLabel }: {
  office: DeskOffice; title: string; valueCaption: string; href: string; linkLabel: string;
}) {
  const stats: Array<[string, number, string?]> = [
    ["Aperte", office.open], ["Da fare", office.todo, "text-[#8a4b00]"], ["In attesa", office.waiting],
    ["In scadenza", office.due, office.due ? "text-[#9a3412]" : undefined],
  ];
  if (office.key === "commercial") stats.push(["Da verificare", office.review, office.review ? "text-[#6b4a07]" : undefined]);
  return (
    <section aria-label={title} data-testid={"director-desk-office-" + office.key} className={CARD + " flex flex-col p-4"}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-bold text-[#143f30]">{title}</h2>
        <span className="text-xs font-semibold text-[#3f564a]">{office.people === 1 ? "1 persona" : office.people + " persone"}</span>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        {stats.map(([label, value, tone]) => (
          <div key={label} className="rounded-lg bg-[#f3f8f5] px-2.5 py-2">
            <dt className="text-[11px] font-semibold text-[#3f564a]">{label}</dt>
            <dd className={"text-lg font-bold tabular-nums " + (tone ?? "text-[#0f2e23]")}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-[#d3e0d7] pt-3">
        <p className="text-sm text-[#173f35]">
          <span className="text-xl font-bold tabular-nums text-[#0f2e23]">{formatEur(office.valueEur)}</span>
          <span className="ml-1.5 text-xs text-[#3f564a]">{valueCaption}</span>
        </p>
        <Link href={href} className="text-xs font-semibold !text-[#175640] underline underline-offset-2">{linkLabel} →</Link>
      </div>
      {office.valueUnknown ? (
        <p className="mt-1.5 text-[11px] leading-4 text-[#6b4a07]">
          {office.valueUnknown === 1 ? "1 pratica ha" : office.valueUnknown + " pratiche hanno"} prezzi con unità non convertibili (ad es. €/m senza peso): esclusa dal totale, non stimata.
        </p>
      ) : null}
    </section>
  );
}

export default async function DirectorDeskPage() {
  const context = await requireWorkspaceAdmin(appRoutes.commercial.home);
  const desk = await loadDirectorDesk(context.organizationId);
  const n = desk.numbers;
  const assignees: DeskAssignee[] = desk.members
    .filter((m) => m.canWrite)
    .sort((a, b) => (a.office === "commercial" ? 0 : 1) - (b.office === "commercial" ? 0 : 1) || a.email.localeCompare(b.email))
    .map((m) => ({ userId: m.userId, label: m.email, office: officeOf(m.office) }));
  const unavailable = desk.salesUnavailable || desk.purchaseUnavailable;

  return (
    <div className="min-w-0 space-y-4 pb-8" data-testid="director-desk">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-[-0.02em] text-[#0f2e23]">Scrivania della Direzione</h1>
          <p className="mt-0.5 text-sm text-[#3f564a]">Come stanno gli uffici, chi lavora su cosa e cosa aspetta una tua decisione.</p>
        </div>
        <Link href={appRoutes.company.team}
          className="inline-flex min-h-9 items-center rounded-full border border-[#7a9585] bg-white px-3 text-sm font-semibold !text-[#175640] hover:border-[#175640] hover:bg-[#f2f8f4]">
          Team e profili
        </Link>
      </header>

      {unavailable || desk.truncated ? (
        <p role="status" className="rounded-lg border border-[#e6d3ae] bg-[#fffaf0] px-3 py-2 text-xs text-[#795321]">
          {unavailable ? "Alcuni dati non sono leggibili in questo momento: i numeri potrebbero essere incompleti. " : ""}
          {desk.truncated ? "Conto le 200 pratiche più recenti per tipo." : ""}
        </p>
      ) : null}

      <nav aria-label="Numeri del giorno" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Number_ label="Richieste clienti da fare" value={n.salesTodo} tone="urgent" href={dealDeskHref({ filter: "todo" })} />
        <Number_ label="RFQ ai fornitori da gestire" value={n.purchaseTodo} tone="urgent" href={appRoutes.rfqHub.home} />
        <Number_ label="In scadenza entro 7 giorni" value={n.dueSales + n.duePurchase} tone="urgent"
          detail={n.dueSales + " vendite · " + n.duePurchase + " acquisti"} href={dealDeskHref({ filter: "due" })} />
        <Number_ label="Ordini da verificare" value={n.review} tone="review" href={dealDeskHref({ filter: "review" })} />
      </nav>

      <div className="grid gap-4 lg:grid-cols-2">
        <OfficeCard office={desk.offices.commercial} title="Ufficio commerciale"
          valueCaption="offerte inviate e ordini dei clienti aperti" href={appRoutes.commercial.home} linkLabel="Richieste d'offerta" />
        <OfficeCard office={desk.offices.purchasing} title="Ufficio acquisti"
          valueCaption="ordini ai fornitori emessi" href={appRoutes.rfqHub.home} linkLabel="Centro RFQ" />
      </div>

      <section aria-labelledby="director-desk-people" className={CARD + " overflow-hidden"} data-testid="director-desk-people">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#d3e0d7] px-4 py-3">
          <h2 id="director-desk-people" className="text-base font-bold text-[#143f30]">Persone</h2>
          <p className="text-xs text-[#3f564a]">
            {desk.members.length === 1 ? "1 persona attiva" : desk.members.length + " persone attive"}
            {desk.directors ? " · " + desk.directors + " in Direzione" : ""}
          </p>
        </div>
        {desk.members.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="bg-[#f3f8f5] text-left text-[11px] font-bold uppercase tracking-[0.06em] text-[#1a5144]">
                  <th scope="col" className="px-4 py-2">Persona</th>
                  <th scope="col" className="px-3 py-2">Ufficio</th>
                  <th scope="col" className="px-3 py-2 text-right">Aperte</th>
                  <th scope="col" className="px-3 py-2 text-right">Da fare</th>
                  <th scope="col" className="px-3 py-2 text-right">In scadenza</th>
                  <th scope="col" className="px-4 py-2 text-right">Valore aperto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4ece7]">
                {desk.people.map((person) => (
                  <tr key={person.member.userId} data-testid="director-desk-person">
                    <th scope="row" className="max-w-[260px] truncate px-4 py-2.5 text-left font-semibold text-[#143f30]">{person.member.email}</th>
                    <td className="px-3 py-2.5">
                      {person.member.office ? (
                        <span className="text-[#173f35]">{officeOf(person.member.office)}</span>
                      ) : (
                        <Link href={appRoutes.company.team} className="text-xs font-semibold !text-[#8a4b00] underline underline-offset-2">Senza profilo: assegna</Link>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#173f35]">{person.open}</td>
                    <td className={"px-3 py-2.5 text-right tabular-nums " + (person.todo ? "font-semibold text-[#8a4b00]" : "text-[#4a6155]")}>{person.todo}</td>
                    <td className={"px-3 py-2.5 text-right tabular-nums " + (person.due ? "font-semibold text-[#9a3412]" : "text-[#4a6155]")}>{person.due}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#173f35]">
                      {person.valueEur ? formatEur(person.valueEur) : "—"}
                      {person.valueUnknown ? <span className="block text-[10px] text-[#6b4a07]">+{person.valueUnknown} non calcolabili</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-5 text-sm text-[#3f564a]">Nessuna persona attiva: invita il team da «Team e profili».</p>
        )}
      </section>

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-labelledby="director-desk-unassigned" className={CARD + " overflow-hidden"} data-testid="director-desk-unassigned">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#d3e0d7] px-4 py-3">
            <h2 id="director-desk-unassigned" className="text-base font-bold text-[#143f30]">
              Senza responsabile <span className="font-semibold text-[#4a6155]">· {desk.unassignedTotal}</span>
            </h2>
            <p className="text-xs text-[#3f564a]">Richieste, offerte e ordini dei clienti che nessuno ha in carico</p>
          </div>
          {desk.unassigned.length ? (
            <ul className="divide-y divide-[#e4ece7]">
              {desk.unassigned.map(({ deal }) => (
                <li key={deal.key} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
                  <Link href={dealDeskHref({ item: deal.key }, "")} className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#143f30]">{deal.title}</span>
                    <span className="block truncate text-xs text-[#3f564a]">
                      {[deal.reference, deal.counterparty || "Cliente da collegare", deal.action].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                  <DeskAssignSelect kind={deal.kind} id={deal.id} title={deal.title} assignees={assignees} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-5 text-sm text-[#3f564a]">Tutte le pratiche aperte hanno un responsabile.</p>
          )}
          {desk.unassignedTotal > desk.unassigned.length ? (
            <p className="border-t border-[#e4ece7] px-4 py-2 text-xs text-[#3f564a]">
              Mostro le {desk.unassigned.length} più urgenti su {desk.unassignedTotal}.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="director-desk-approvals" className={CARD + " overflow-hidden lg:sticky lg:top-24"} data-testid="director-desk-approvals">
          <div className="border-b border-[#d3e0d7] px-4 py-3">
            <h2 id="director-desk-approvals" className="text-base font-bold text-[#143f30]">
              Approvazioni in attesa <span className="font-semibold text-[#4a6155]">· {desk.approvals.length}</span>
            </h2>
          </div>
          {desk.approvalsUnavailable ? (
            <p className="px-4 py-4 text-xs text-[#795321]">Approvazioni non leggibili in questo momento.</p>
          ) : desk.approvals.length ? (
            <ul className="divide-y divide-[#e4ece7]">
              {desk.approvals.map((approval) => (
                <li key={approval.id} className="space-y-2 px-4 py-3" data-testid="director-desk-approval">
                  <div className="min-w-0">
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
                    {approval.reason ? <p className="mt-1 text-xs text-[#4a6155]">{approval.reason}</p> : null}
                  </div>
                  <DeskApprovalButtons rfqId={approval.rfqId} approvalId={approval.id} ownRequest={approval.requestedBy === context.userId} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-[#3f564a]">Niente da approvare.</p>
          )}
        </section>
      </div>
    </div>
  );
}
