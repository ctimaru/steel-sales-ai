import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { getBusinessPlanInvestorCopy } from "@/lib/business-plan-investor-copy";

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-sm leading-6 text-[#52615b]">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d7a45b]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SectionHeader({
  kicker,
  title,
}: {
  kicker: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#1a5144]">{kicker}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#1d2824]">{title}</h2>
    </div>
  );
}

export function BusinessPlanInvestorDetails({
  locale,
}: {
  locale: BusinessPlanLocale;
}) {
  const copy = getBusinessPlanInvestorCopy(locale);
  const d = copy.details;

  return (
    <div className="space-y-8">
      <section className="rounded-[30px] bg-[#123d34] p-6 text-white sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9cc5b7]">
          {locale === "it" ? "Business Plan v2 · Investor narrative" : "Business Plan v2 · Investor narrative"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{d.title}</h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[#d8e5e0] sm:text-base">{d.subtitle}</p>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <SectionHeader kicker={d.executive.kicker} title={d.executive.title} />
        <p className="mt-4 max-w-5xl text-base leading-7 text-[#52615b]">{d.executive.body}</p>
        <div className="mt-6">
          <BulletList items={d.executive.bullets} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[28px] border border-[#dce2df] bg-white p-6">
          <SectionHeader kicker={d.problem.kicker} title={d.problem.title} />
          <div className="mt-5"><BulletList items={d.problem.bullets} /></div>
        </article>
        <article className="rounded-[28px] border border-[#dce2df] bg-white p-6">
          <SectionHeader kicker={d.market.kicker} title={d.market.title} />
          <div className="mt-5"><BulletList items={d.market.bullets} /></div>
        </article>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <SectionHeader kicker={d.product.kicker} title={d.product.title} />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {d.product.cards.map(([title, body], index) => (
            <article key={title} className="rounded-2xl bg-[#eef3f0] p-5">
              <span className="text-xs font-bold text-[#1a5144]">0{index + 1}</span>
              <h3 className="mt-3 text-lg font-semibold text-[#1d2824]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#66736e]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.04fr_0.96fr]">
        <article className="rounded-[28px] bg-[#1d2824] p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#9cc5b7]">{d.moat.kicker}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{d.moat.title}</h2>
          <ul className="mt-6 space-y-3">
            {d.moat.bullets.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-6 text-[#d8e5e0]">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f2cf9c]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
        <article className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
          <SectionHeader kicker={d.gtm.kicker} title={d.gtm.title} />
          <div className="mt-6 flex flex-wrap gap-2">
            {d.gtm.flow.map((item, index) => (
              <div key={item} className="flex items-center gap-2">
                <span className="rounded-full bg-[#eef3f0] px-3 py-2 text-xs font-semibold text-[#345047]">{item}</span>
                {index < d.gtm.flow.length - 1 ? <span className="text-[#9ba7a2]">→</span> : null}
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm leading-6 text-[#66736e]">{d.gtm.note}</p>
        </article>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <SectionHeader kicker={d.monetization.kicker} title={d.monetization.title} />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {d.monetization.cards.map(([title, body]) => (
            <article key={title} className="rounded-2xl border border-[#e2e8e5] bg-[#f8faf9] p-4">
              <h3 className="text-sm font-semibold text-[#1d2824]">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#66736e]">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[28px] border border-[#dce2df] bg-white p-6">
          <SectionHeader kicker={d.economics.kicker} title={d.economics.title} />
          <div className="mt-5"><BulletList items={d.economics.bullets} /></div>
        </article>
        <article className="rounded-[28px] border border-[#dce2df] bg-white p-6">
          <SectionHeader kicker={d.competition.kicker} title={d.competition.title} />
          <div className="mt-5"><BulletList items={d.competition.bullets} /></div>
        </article>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <SectionHeader kicker={d.kpi.kicker} title={d.kpi.title} />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {d.kpi.items.map((item) => (
            <div key={item} className="rounded-2xl bg-[#eef3f0] p-4 text-sm font-semibold text-[#345047]">{item}</div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-6 text-[#66736e]">{d.kpi.note}</p>
      </section>

      <section className="rounded-[28px] border border-[#dce2df] bg-white p-6 sm:p-8">
        <SectionHeader kicker={d.risks.kicker} title={d.risks.title} />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {d.risks.cards.map(([risk, mitigation]) => (
            <article key={risk} className="rounded-2xl border border-[#e2e8e5] p-4">
              <p className="text-sm font-semibold text-[#1d2824]">{risk}</p>
              <p className="mt-2 text-xs leading-5 text-[#66736e]">{mitigation}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-[28px] border border-amber-200 bg-amber-50/50 p-6">
          <SectionHeader kicker={d.team.kicker} title={d.team.title} />
          <div className="mt-5 space-y-3">
            {d.team.cards.map(([title, body]) => (
              <div key={title} className="rounded-2xl bg-white p-4">
                <p className="text-sm font-semibold text-[#1d2824]">{title}</p>
                <p className="mt-2 text-xs leading-5 text-[#66736e]">{body}</p>
              </div>
            ))}
          </div>
          <a
            href={d.team.founderLinkedIn}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-[#345047] hover:bg-amber-50"
          >
            {locale === "it" ? "Profilo LinkedIn del founder" : "Founder LinkedIn profile"}
          </a>
          <p className="mt-4 text-xs leading-5 text-amber-900">{d.team.note}</p>
        </article>
        <article className="rounded-[28px] bg-[#123d34] p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#9cc5b7]">{d.evidence.kicker}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{d.evidence.title}</h2>
          <p className="mt-5 text-sm leading-7 text-[#d8e5e0]">{d.evidence.body}</p>
        </article>
      </section>
    </div>
  );
}
