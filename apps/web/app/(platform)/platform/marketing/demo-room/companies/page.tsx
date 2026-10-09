import Link from "next/link";

import { demoTestCases, demoTestCompanies, demoTestMeta, demoTestRfq } from "@/lib/demotest1-company-fixtures";
import { requirePlatformSuperadmin } from "@/lib/platform-admin";
import { appRoutes } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function DemoTestCompaniesPage() {
  await requirePlatformSuperadmin();

  return (
    <main className="mx-auto max-w-[1500px] space-y-5" data-testid="demotest1-owner-only">
      <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface-base)] p-5 sm:p-6">
        <p className="platform-kicker">DEMOTEST1 · Multi-Company Acceptance</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">Quattro aziende demo · quattro ruoli Network</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
          Scenario sintetico e di sola lettura. Queste aziende non sono tenant reali, non possono accedere al servizio e non hanno dati di produzione.
        </p>
        <p className="mt-2 text-xs font-bold uppercase tracking-[0.1em] text-[var(--semantic-warning)]">{demoTestMeta.label}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="platform-secondary inline-flex rounded-xl px-4 py-2.5 text-xs font-semibold" href={appRoutes.platform.marketingDemoRoom("network")}>← Demo Room Network</Link>
          <Link className="platform-secondary inline-flex rounded-xl px-4 py-2.5 text-xs font-semibold" href={appRoutes.platform.marketingDemoRoom("rfq-hub")}>Demo RFQ Hub</Link>
        </div>
      </header>

      <section className="grid gap-3 lg:grid-cols-2" aria-label="Aziende sintetiche">
        {demoTestCompanies.map((company) => (
          <article data-testid={company.key} key={company.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{company.roleLabel} · {company.country}</p>
              <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--text-secondary)]">Simulazione · privata</span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{company.legalName}</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{company.business}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{company.capabilities.map((capability) => (
              <span key={capability} className="rounded-full bg-[var(--brand-primary-soft)] px-2.5 py-1 text-[11px] text-[var(--brand-deep)]">{capability}</span>
            ))}</div>
            <p className="mt-4 text-sm text-[var(--text-primary)]">{company.workflow}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]"><strong>Accesso atteso:</strong> {company.expectedAccess}</p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">Contatto fittizio: {company.email}</p>
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              {company.members.map((member) => <p key={member.email} className="text-xs leading-6 text-[var(--text-secondary)]">{member.role}: {member.email}</p>)}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{demoTestRfq.title}</h2>
          <span className="text-xs font-bold text-[var(--text-secondary)]">RFQ sintetica · nessun invio</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="text-[var(--text-secondary)]"><tr><th className="p-3">Norma</th><th className="p-3">Qualità</th><th className="p-3">Dimensione</th><th className="p-3">Barra</th><th className="p-3">Quantità</th><th className="p-3">EN 10204</th></tr></thead>
            <tbody>{demoTestRfq.lines.map((line) => (
              <tr className="border-t border-[var(--border)]" key={line.key}>
                <td className="p-3 font-semibold">{line.standard}</td><td className="p-3">{line.grade}</td><td className="p-3">{line.geometry}</td><td className="p-3">{line.lengthM} m</td><td className="p-3">{line.quantity}</td><td className="p-3">{line.documentation}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {demoTestRfq.quotations.map((quote) => (
            <div key={quote.supplierKey} className="rounded-xl border border-[var(--border)] p-3 text-xs">
              <p className="font-semibold text-[var(--text-primary)]">{demoTestCompanies.find((c) => c.key === quote.supplierKey)?.legalName}</p>
              <p className="mt-1 text-[var(--text-secondary)]">Copertura {quote.coverage} · {quote.eurPerT} €/t · {quote.leadDays} giorni</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Matrice di collaudo</h2>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">“Pending” non significa superato: i test autenticati richiedono sessioni isolate e verifica browser reale.</p>
        <div className="mt-3 divide-y divide-[var(--border)]">
          {demoTestCases.map((item) => (
            <div key={item.id} className="grid gap-1 py-3 text-xs sm:grid-cols-[72px_115px_1fr_150px] sm:gap-3">
              <strong className="text-[var(--text-primary)]">{item.id}</strong>
              <span className="text-[var(--text-secondary)]">{item.area}</span>
              <span className="text-[var(--text-primary)]">{item.scenario}</span>
              <span className="font-semibold text-[var(--text-secondary)]">{item.mode === "fixture_assertion" ? "Fixture verificabile" : "QA pending"}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
