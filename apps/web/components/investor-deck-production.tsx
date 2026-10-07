import type { ReactNode } from "react";

import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { investorDeckRelease, investorDeckReleaseFooter } from "@/lib/marketing-investor-deck-release";
import { getPitchDeckSlides, type ClaimStatus } from "@/lib/marketing-fundraising-assets";
import {
  getFundraisingReadiness,
  type EvidenceReadiness,
} from "@/lib/marketing-fundraising-readiness";

function claimLabel(status: ClaimStatus) {
  return status.toUpperCase();
}

function readinessClass(value: EvidenceReadiness) {
  if (value === "ready") return "bg-[var(--brand-primary-soft)] text-[var(--brand-deep)]";
  if (value === "partial") return "bg-[var(--steel-blue-soft)] text-[var(--steel-blue)]";
  return "bg-red-50 text-[var(--semantic-error)]";
}

function metric(value: string, label: string, note?: string) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-base)] p-5">
      <p className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">{label}</p>
      {note ? <p className="mt-2 text-xs leading-5 text-[var(--text-tertiary)]">{note}</p> : null}
    </div>
  );
}

function chip(text: string) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--surface-base)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
      {text}
    </span>
  );
}

function SlideFrame({
  number,
  title,
  thesis,
  readiness,
  claimStatus,
  children,
  footer,
  dark = false,
  investorMode = false,
}: {
  number: number;
  title: string;
  thesis: string;
  readiness: EvidenceReadiness;
  claimStatus: ClaimStatus;
  children: ReactNode;
  footer?: ReactNode;
  dark?: boolean;
  investorMode?: boolean;
}) {
  return (
    <section
      className={[
        "relative aspect-[16/9] w-full overflow-hidden rounded-[30px] border p-7 shadow-[0_18px_55px_rgba(15,23,32,0.08)] sm:p-9 lg:p-11 print:break-after-page print:rounded-none print:shadow-none",
        dark
          ? "border-[var(--brand-deep)] bg-[var(--brand-deep)] text-white"
          : "border-[var(--border)] bg-[var(--surface-base)] text-[var(--text-primary)]",
      ].join(" ")}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-6">
          <div className="max-w-4xl">
            <p className={[
              "text-[10px] font-bold uppercase tracking-[0.16em]",
              dark ? "text-white/60" : "text-[var(--steel-blue)]",
            ].join(" ")}>
              {String(number).padStart(2, "0")} · {title}
            </p>
            <h2 className={[
              "mt-3 max-w-4xl text-3xl font-semibold tracking-[-0.045em] sm:text-4xl lg:text-5xl",
              dark ? "text-white" : "text-[var(--text-primary)]",
            ].join(" ")}>
              {thesis}
            </h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={[
              "rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em]",
              dark ? "bg-white/10 text-white/75" : "bg-[var(--surface-muted)] text-[var(--text-secondary)]",
            ].join(" ")}>
              {claimLabel(claimStatus)}
            </span>
            {!investorMode ? (
              <span className={[
                "rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em]",
                dark ? "bg-white/10 text-white" : readinessClass(readiness),
              ].join(" ")}>
                {readiness}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-7 flex-1">{children}</div>

        <div className={[
          "mt-5 flex items-end justify-between gap-5 border-t pt-4 text-[10px]",
          dark ? "border-white/10 text-white/45" : "border-[var(--border)] text-[var(--text-tertiary)]",
        ].join(" ")}>
          <span>
            {investorMode
              ? `Smart Steel Sales · Confidential Investor Deck · ${investorDeckRelease.version}`
              : "Smart Steel Sales · Investor Deck Draft · MKT5"}
          </span>
          <span className="max-w-[60%] text-right">{footer}</span>
        </div>
      </div>
    </section>
  );
}

export function InvestorDeckProduction({
  locale = "it",
  investorMode = false,
}: {
  locale?: BusinessPlanLocale;
  investorMode?: boolean;
}) {
  const slides = getPitchDeckSlides(locale);
  const readiness = getFundraisingReadiness(locale);
  const evidence = new Map(readiness.evidencePack.map((item) => [item.slide, item]));
  const slide = (number: number) => slides.find((item) => item.number === number)!;
  const ev = (number: number) => evidence.get(number)!;
  const isIt = locale === "it";
  const footerFor = (number: number, internal: ReactNode) =>
    investorMode ? investorDeckReleaseFooter(number, locale) : internal;

  const visualApproved = readiness.screenshots.filter((item) => item.readiness === "approved_for_deck");

  return (
    <div className="space-y-8 print:space-y-0">
      <SlideFrame
        investorMode={investorMode}
        number={1}
        title={slide(1).title}
        thesis={slide(1).thesis}
        readiness={ev(1).readiness}
        claimStatus={slide(1).status}
        dark
        footer={footerFor(1, isIt ? "Pre-launch · pilot readiness" : "Pre-launch · pilot readiness")}
      >
        <div className="flex h-full flex-col justify-between">
          <div className="grid max-w-4xl gap-3 sm:grid-cols-3">
            {[
              isIt ? "Commercial Memory" : "Commercial Memory",
              "RFQ Hub",
              isIt ? "Steel Industry Network" : "Steel Industry Network",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm font-semibold text-white/90">
                {item}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {visualApproved.filter((item) => item.slideTargets.includes(1)).map((item) => (
              <span key={item.key} className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10px] font-semibold text-white/70">
                {investorMode ? "Public visual validated" : <>Visual approved · {item.surface}</>}
              </span>
            ))}
          </div>
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={2}
        title={slide(2).title}
        thesis={slide(2).thesis}
        readiness={ev(2).readiness}
        claimStatus={slide(2).status}
        footer={footerFor(2, ev(2).gap)}
      >
        <div className="grid h-full gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <div className="grid grid-cols-2 gap-3">
            {["Email", "Excel", "PDF", "ERP"].map((item) => (
              <div key={item} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5 text-center text-lg font-semibold text-[var(--text-primary)]">
                {item}
              </div>
            ))}
          </div>
          <div className="hidden text-3xl text-[var(--steel-blue)] lg:block">→</div>
          <div className="rounded-3xl bg-[var(--steel-blue-soft)] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--steel-blue)]">
              {isIt ? "Costo della frammentazione" : "Cost of fragmentation"}
            </p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
              <li>• {isIt ? "recupero lento di prezzi e precedenti" : "slow retrieval of prices and precedents"}</li>
              <li>• {isIt ? "dipendenza dalla memoria individuale" : "dependence on individual memory"}</li>
              <li>• {isIt ? "procurement e vendita poco connessi" : "weak connection between procurement and sales"}</li>
            </ul>
          </div>
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={3}
        title={slide(3).title}
        thesis={slide(3).thesis}
        readiness={ev(3).readiness}
        claimStatus={slide(3).status}
        footer={footerFor(3, ev(3).nextAction)}
      >
        <div className="grid h-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["01", "Document understanding"],
            ["02", "Search & retrieval"],
            ["03", "Normalization"],
            ["04", "Decision support"],
          ].map(([n, item]) => (
            <div key={item} className="flex flex-col justify-between rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <span className="text-xs font-bold text-[var(--steel-blue)]">{n}</span>
              <p className="mt-8 text-lg font-semibold text-[var(--text-primary)]">{item}</p>
            </div>
          ))}
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={4}
        title={slide(4).title}
        thesis={slide(4).thesis}
        readiness={ev(4).readiness}
        claimStatus={slide(4).status}
        footer={footerFor(4, ev(4).nextAction)}
      >
        <div className="grid h-full grid-cols-2 gap-3 lg:grid-cols-3">
          {[
            ["Commercial Memory", isIt ? "Ricerca e storico privato" : "Private search and history"],
            ["RFQ Hub", isIt ? "Multi-fornitore & comparison" : "Multi-supplier & comparison"],
            ["Procurement Intelligence", isIt ? "Follow-up e decision support" : "Follow-up and decision support"],
            ["Network", isIt ? "Discovery & company graph" : "Discovery & company graph"],
            ["Marketplace", isIt ? "Interaction layer" : "Interaction layer"],
            ["Scuola", isIt ? "Public utility & organic discovery" : "Public utility & organic discovery"],
          ].map(([name, desc]) => (
            <div key={name} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <p className="text-lg font-semibold text-[var(--text-primary)]">{name}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{desc}</p>
            </div>
          ))}
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={5}
        title={slide(5).title}
        thesis={slide(5).thesis}
        readiness={ev(5).readiness}
        claimStatus={slide(5).status}
        footer={footerFor(5, ev(5).gap)}
      >
        <div className="flex h-full flex-wrap content-center items-center gap-2">
          {[
            isIt ? "Utility pubblica" : "Public utility",
            isIt ? "Workflow privato" : "Private workflow",
            isIt ? "Adozione team" : "Team adoption",
            "Company graph",
            isIt ? "Interazioni network" : "Network interactions",
            "Intelligence",
          ].map((item, index, arr) => (
            <div key={item} className="contents">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 text-sm font-semibold text-[var(--text-primary)]">
                {item}
              </div>
              {index < arr.length - 1 ? <span className="text-xl text-[var(--steel-blue)]">→</span> : null}
            </div>
          ))}
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={6}
        title={slide(6).title}
        thesis={slide(6).thesis}
        readiness={ev(6).readiness}
        claimStatus={slide(6).status}
        footer={footerFor(6, ev(6).nextAction)}
      >
        <div className="grid h-full gap-4 lg:grid-cols-2">
          <div className="rounded-3xl bg-[var(--brand-primary-soft)] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--brand-deep)]">Beachhead</p>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[var(--brand-deep)]">Italy</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {isIt ? "Validare ICP, pricing, retention e GTM prima dell'espansione." : "Validate ICP, pricing, retention and GTM before expansion."}
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--steel-blue)]">Expansion</p>
            <p className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">Europe</p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
              {isIt ? "Espansione soltanto dopo playbook italiano ripetibile." : "Expansion only after the Italian playbook becomes repeatable."}
            </p>
          </div>
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={7}
        title={slide(7).title}
        thesis={slide(7).thesis}
        readiness={ev(7).readiness}
        claimStatus={slide(7).status}
        footer={footerFor(7, ev(7).gap)}
      >
        <div className="grid h-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Free", "€0", isIt ? "Utility reale" : "Real utility"],
            ["Memory+", "~€15", isIt ? "Working hypothesis" : "Working hypothesis"],
            ["AI+ / Team+", "~€15", isIt ? "Working hypothesis" : "Working hypothesis"],
            ["SSS Plus", "~€39", isIt ? "Working hypothesis" : "Working hypothesis"],
          ].map(([name, price, note]) => (
            <div key={name} className="rounded-3xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">{name}</p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{price}</p>
              <p className="mt-3 text-xs text-[var(--text-tertiary)]">{note}</p>
            </div>
          ))}
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={8}
        title={slide(8).title}
        thesis={slide(8).thesis}
        readiness={ev(8).readiness}
        claimStatus={slide(8).status}
        footer={footerFor(8, ev(8).gap)}
      >
        <div className="grid h-full gap-3 sm:grid-cols-2">
          {[
            ["01", "Steel domain model"],
            ["02", "Structured commercial data"],
            ["03", "Industry graph"],
            ["04", "Interaction / network data"],
          ].map(([number, item]) => (
            <div key={item} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <p className="text-xs font-bold text-[var(--steel-blue)]">{number}</p>
              <p className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{item}</p>
            </div>
          ))}
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={9}
        title={slide(9).title}
        thesis={slide(9).thesis}
        readiness={ev(9).readiness}
        claimStatus={slide(9).status}
        footer={footerFor(9, isIt ? "Estimate · replacement cost ≠ valuation" : "Estimate · replacement cost ≠ valuation")}
      >
        <div className="grid h-full gap-4 sm:grid-cols-3">
          {metric("~280–400 h", isIt ? "AI-assisted operative" : "AI-assisted operating")}
          {metric("~2.460–3.200 h", isIt ? "Engineering equivalent" : "Engineering equivalent")}
          {metric("~€250–300k", "Replacement cost", isIt ? "Stima, non valuation" : "Estimate, not valuation")}
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={10}
        title={slide(10).title}
        thesis={isIt ? "Non inventiamo una traction slide prima della traction." : "We do not invent a traction slide before traction exists."}
        readiness={ev(10).readiness}
        claimStatus={slide(10).status}
        footer={footerFor(10, ev(10).nextAction)}
      >
        <div className="grid h-full items-center gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--semantic-error)]">{investorMode ? "PRE-LAUNCH" : "BLOCKED"}</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">
              {isIt ? "Pre-launch baseline only" : "Pre-launch baseline only"}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              isIt ? "5 paying organizations" : "5 paying organizations",
              isIt ? "3 retained dopo 60 giorni" : "3 retained after 60 days",
              isIt ? "30/90d retention misurata" : "Measured 30/90d retention",
              isIt ? "Network liquidity misurata" : "Measured network liquidity",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-dashed border-[var(--border-strong)] p-4 text-sm font-semibold text-[var(--text-secondary)]">
                Gate · {item}
              </div>
            ))}
          </div>
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={11}
        title={slide(11).title}
        thesis={slide(11).thesis}
        readiness={ev(11).readiness}
        claimStatus={slide(11).status}
        footer={footerFor(11, ev(11).gap)}
      >
        <div className="flex h-full flex-wrap content-center items-center gap-2">
          {[
            "Scuola / SEO",
            "Company pages / claim",
            "Useful Free Base",
            "Self-service paid",
            "RFQ / Network activation",
            "Expansion",
          ].map((item, index, arr) => (
            <div key={item} className="contents">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4 text-sm font-semibold text-[var(--text-primary)]">
                {item}
              </div>
              {index < arr.length - 1 ? <span className="text-xl text-[var(--steel-blue)]">→</span> : null}
            </div>
          ))}
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={12}
        title={slide(12).title}
        thesis={slide(12).thesis}
        readiness={ev(12).readiness}
        claimStatus={slide(12).status}
        footer={footerFor(12, isIt ? "Operating milestones, not guaranteed forecast" : "Operating milestones, not guaranteed forecast")}
      >
        <div className="grid h-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {readiness.milestonePhases.map((phase) => (
            <div key={phase.key} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--steel-blue)]">{phase.window}</p>
              <p className="mt-3 text-lg font-semibold text-[var(--text-primary)]">{phase.title}</p>
              <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{phase.targets[0]}</p>
            </div>
          ))}
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={13}
        title={slide(13).title}
        thesis={slide(13).thesis}
        readiness={ev(13).readiness}
        claimStatus={slide(13).status}
        footer={footerFor(13, ev(13).nextAction)}
      >
        <div className="grid h-full gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex items-center justify-center rounded-3xl bg-[var(--brand-deep)] p-6 text-white">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Founder / CEO</p>
              <p className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
                {isIt ? "Industry-first product ownership" : "Industry-first product ownership"}
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {[
              isIt ? "Esperienza commerciale diretta steel/tube" : "Direct steel/tube commercial experience",
              isIt ? "Conoscenza dei workflow di vendita e procurement" : "Sales and procurement workflow familiarity",
              isIt ? "Ownership diretta di prodotto e GTM" : "Direct product and GTM ownership",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-subtle)] p-5 text-sm font-semibold text-[var(--text-primary)]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </SlideFrame>

      <SlideFrame
        investorMode={investorMode}
        number={14}
        title={slide(14).title}
        thesis={slide(14).thesis}
        readiness={ev(14).readiness}
        claimStatus={slide(14).status}
        dark
        footer={footerFor(14, isIt ? "Working recommendation · valuation & terms TBD" : "Working recommendation · valuation & terms TBD")}
      >
        <div className="grid h-full gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">{isIt ? "Seed target" : "Seed target"}</p>
            <p className="mt-3 text-6xl font-semibold tracking-[-0.06em] text-white">€1,0M</p>
            <p className="mt-4 text-sm leading-6 text-white/70">
              {isIt ? "€0,8–1,2M corridor · €400–700k lead/co-lead · ~24 mesi runway" : "€0.8–1.2M corridor · €400–700k lead/co-lead · ~24 months runway"}
            </p>
          </div>
          <div className="grid content-center gap-2">
            {readiness.useOfFunds.slice(0, 4).map((item) => (
              <div key={item.key} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
                <span className="text-xs font-semibold text-white/75">{item.label}</span>
                <span className="text-sm font-semibold text-white">{item.percent}%</span>
              </div>
            ))}
            <div className="mt-2 flex flex-wrap gap-2">
              {chip(isIt ? "5-person core team" : "5-person core team")}
              {chip(isIt ? "€130k reserve" : "€130k reserve")}
              {chip(isIt ? "evidence > headcount" : "evidence > headcount")}
            </div>
          </div>
        </div>
      </SlideFrame>
    </div>
  );
}
