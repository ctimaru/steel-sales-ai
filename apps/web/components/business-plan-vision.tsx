import type { BusinessPlanLocale } from "@/lib/business-plan-locale";
import { businessPlanVisionCopy } from "@/lib/business-plan-vision-content";

const section = "rounded-[28px] border border-[#dce2df] bg-white p-5 sm:p-8";
const overline = "text-[11px] font-bold uppercase tracking-[0.17em] text-[#1a5144]";

function Heading({eyebrow,title,description}:{eyebrow:string;title:string;description?:string}) {
  return <div className="max-w-4xl"><p className={overline}>{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#1d2824] sm:text-3xl">{title}</h2>{description ? <p className="mt-3 text-sm leading-7 text-[#66736e]">{description}</p> : null}</div>;
}

function Items({items}:{items:readonly string[]}) {
  return <ul className="mt-4 space-y-2">{items.map(item=><li key={item} className="flex gap-2 text-sm leading-6 text-[#52615b]"><span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b99258]"/>{item}</li>)}</ul>;
}

export function BusinessPlanVision({locale}:{locale:BusinessPlanLocale}) {
  const c=businessPlanVisionCopy[locale];
  const it=locale==="it";
  return <div className="space-y-7">
    <section className="overflow-hidden rounded-[34px] bg-[#123d34] text-white">
      <div className="relative grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.22fr_0.78fr] lg:p-12">
        <div className="relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#9cc5b7]">{c.hero.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{c.hero.title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#d8e5e0]">{c.hero.subtitle}</p>
          <div className="mt-7 rounded-2xl border border-[#7fac9f]/40 bg-white/[0.07] p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#e1bb7b]">{it?"La promessa":"The promise"}</p>
            <p className="mt-2 text-lg font-medium leading-7">{c.hero.thesis}</p>
          </div>
        </div>
        <div className="relative flex min-h-[280px] flex-col justify-center">
          <div aria-hidden="true" className="absolute right-[-20%] top-[-10%] h-56 w-56 rounded-full border border-white/15"/>
          <div aria-hidden="true" className="absolute bottom-[-10%] left-[-8%] h-44 w-44 rounded-full border border-white/10"/>
          <div className="relative mx-auto w-full max-w-sm space-y-3">
            {c.pillars.map((p,index)=><div key={p.number} className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-4 backdrop-blur-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d6ae72] font-semibold text-[#183b33]">{p.number}</div>
              <div><p className="text-sm font-semibold">{index===0?"AI":index===1?"Visual":"Super Steel Buyer"}</p><p className="mt-1 text-xs leading-5 text-[#d8e5e0]">{p.subtitle}</p></div>
            </div>)}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-4 text-xs leading-5 text-[#c4d9d2] sm:px-9 lg:px-12">{c.hero.disclaimer}</div>
    </section>

    <nav aria-label={it?"Indice masterplan":"Masterplan contents"} className="flex flex-wrap gap-2">
      {[[ "audit",it?"Audit":"Audit"],["pilastri",it?"3 pilastri":"3 pillars"],["ux","AI → Visual"],["architettura",it?"Architettura":"Architecture"],["buyer","Super Steel Buyer"],["business",it?"Monetizzazione":"Business model"],["roadmap","Roadmap"],["kpi","KPI"],["rischi",it?"Rischi e fonti":"Risks & sources"]].map(([id,label])=><a key={id} className="rounded-xl border border-[#dce2df] bg-white px-3 py-2 text-xs font-semibold text-[#1a5144] hover:bg-[#edf4f0] focus-visible:outline-2 focus-visible:outline-[#1a5144]" href={"#"+id}>{label}</a>)}
    </nav>

    <section id="audit" className={section}>
      <Heading eyebrow="01 · Reality check" title={it?"Da dove partiamo, senza confondere codice e risultati":"Where we stand, without confusing code and results"}/>
      <div className="mt-6 grid gap-3 lg:grid-cols-3">{c.status.map(([title,body],index)=><article key={title} className="rounded-2xl bg-[#f1f5f2] p-5"><p className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#1a5144]">{String(index+1).padStart(2,"0")}</p><h3 className="mt-2 text-base font-semibold text-[#1d2824]">{title}</h3><p className="mt-3 text-sm leading-6 text-[#52615b]">{body}</p></article>)}</div>
    </section>

    <section id="pilastri" className={section}>
      <Heading eyebrow="02 · Platform direction" title={it?"I tre pilastri condividono dati, strumenti e governance":"The three pillars share data, tools and governance"}/>
      <div className="mt-6 grid gap-4 xl:grid-cols-3">{c.pillars.map(p=><article key={p.number} className="flex flex-col rounded-2xl border border-[#dfe8e3] p-5">
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#123d34] text-sm font-semibold text-white">{p.number}</span><p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#66736e]">{p.subtitle}</p></div>
        <h3 className="mt-5 text-xl font-semibold text-[#1d2824]">{p.title}</h3><p className="mt-3 text-sm leading-7 text-[#52615b]">{p.body}</p><div className="mt-auto pt-3"><Items items={p.deliverables}/></div>
      </article>)}</div>
    </section>

    <section id="ux" className={section}>
      <Heading eyebrow="03 · Demonstrable product experience" title={it?"La conversazione trasforma il pensiero in un oggetto visuale":"Conversation turns intention into a visual work object"}/>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[#dae6df] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#1a5144]">{it?"CALCOLATRICE INTELLIGENTE":"INTELLIGENT CALCULATOR"}</p>
          <h3 className="mt-2 text-lg font-semibold text-[#1d2824]">{c.example1.title}</h3>
          <div className="mt-4 rounded-xl bg-[#f1f5f2] p-4 text-sm font-medium text-[#173f35]">{c.example1.prompt}</div>
          <div className="mt-4 flex flex-wrap gap-2">{c.example1.recognized.map(x=><span key={x} className="rounded-lg border border-[#dbe4df] px-3 py-2 text-xs font-medium text-[#345047]">{x}</span>)}</div>
          <p className="mt-4 text-xs font-bold text-[#52615b]">{it?"Da completare:":"Missing:"} {c.example1.missing.join(" · ")}</p>
          <p className="mt-3 rounded-xl bg-[#123d34] p-4 text-sm leading-6 text-white">{c.example1.answer}</p><p className="mt-4 text-xs leading-6 text-[#66736e]">{c.example1.rule}</p>
        </article>
        <article className="rounded-2xl border border-[#dae6df] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#1a5144]">NETWORK GROUNDED DISCOVERY</p>
          <h3 className="mt-2 text-lg font-semibold text-[#1d2824]">{c.example2.title}</h3>
          <div className="mt-4 rounded-xl bg-[#f1f5f2] p-4 text-sm font-medium text-[#173f35]">{c.example2.prompt}</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#dce5df] p-4"><p className="text-[10px] font-bold text-[#87938e]">{it?"AZIENDE NEL NETWORK":"COMPANIES IN NETWORK"}</p><p className="mt-1 text-3xl font-semibold text-[#1a5144]">—</p><p className="mt-2 text-[11px] text-[#66736e]">{it?"Solo query reale":"Real query only"}</p></div>
            <div className="flex items-center justify-center rounded-xl border border-dashed border-[#a5bbae] bg-[#f7faf8] p-3 text-center text-xs font-medium text-[#52615b]">{it?"Mappa e filtri regionali":"Regional map and filters"}</div>
          </div>
          <p className="mt-4 text-sm leading-7 text-[#52615b]">{c.example2.answer}</p><p className="mt-3 text-xs leading-6 text-[#66736e]">{c.example2.rule}</p>
        </article>
      </div>
    </section>

    <section id="architettura" className={section}>
      <Heading eyebrow="04 · Engineering & economics" title={c.model.title} description={c.model.baseline}/>
      <div className="mt-6 grid gap-3 md:grid-cols-5">{c.architecture.map(([name,body],index)=><article key={name} className="rounded-2xl bg-[#eef3f0] p-4"><p className="text-xs font-semibold text-[#1a5144]">{String(index+1).padStart(2,"0")} · {name}</p><p className="mt-2 text-xs leading-6 text-[#52615b]">{body}</p></article>)}</div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div><h3 className="text-base font-semibold text-[#1d2824]">{it?"Strategia modelli":"Model strategy"}</h3><Items items={c.model.variants}/></div>
        <div><h3 className="text-base font-semibold text-[#1d2824]">{it?"Gate per il rollout":"Rollout gates"}</h3><Items items={c.model.constraints}/></div>
      </div>
      <p className="mt-5 border-t border-[#e1e7e4] pt-4 text-xs leading-6 text-[#66736e]">{c.model.note}</p>
    </section>

    <section id="buyer" className={section}>
      <Heading eyebrow="05 · Human-in-the-loop procurement" title={c.buyer.title}/>
      <div className="mt-6 grid grid-cols-2 gap-2 md:grid-cols-4">{c.buyer.stages.map((name,index)=><div key={name} className="rounded-xl bg-[#f1f5f2] p-4"><p className="text-[10px] font-bold text-[#1a5144]">{String(index+1).padStart(2,"0")}</p><p className="mt-2 text-sm font-semibold text-[#1d2824]">{name}</p></div>)}</div>
      <Items items={c.buyer.boundaries}/>
      <div className="mt-7 grid gap-3 lg:grid-cols-3">{c.buyer.monetization.map(([name,body])=><article key={name} className="rounded-2xl border border-[#dfe8e3] p-5"><h3 className="text-base font-semibold text-[#1d2824]">{name}</h3><p className="mt-2 text-sm leading-7 text-[#52615b]">{body}</p></article>)}</div>
      <p className="mt-5 rounded-2xl bg-[#f1f5f2] p-5 text-sm leading-7 text-[#345047]">{c.buyer.unitExample}</p>
      <p className="mt-4 text-sm font-medium leading-6 text-[#1a5144]">{c.buyer.pilot}</p>
    </section>

    <section id="business" className={section}>
      <Heading eyebrow="06 · Revenue architecture" title={it?"Freemium SaaS + servizio Buyer, due economie distinte":"Freemium SaaS + managed Buyer, two distinct economics"}/>
      <div className="mt-6 grid gap-3 lg:grid-cols-3">{c.business.map(([name,body])=><article key={name} className="rounded-2xl bg-[#eef3f0] p-5"><h3 className="text-lg font-semibold text-[#1a5144]">{name}</h3><p className="mt-3 text-sm leading-7 text-[#52615b]">{body}</p></article>)}</div>
    </section>

    <section id="roadmap" className={section}>
      <Heading eyebrow="07 · 90-day execution plan" title={it?"Microblocchi e risultati verificabili":"Milestones and verifiable outcomes"} description={it?"Sequenza indicativa dal 19 ottobre 2026: non un impegno di disponibilità pubblica né una previsione finanziaria.":"Indicative plan starting 19 October 2026: not a public availability promise or financial forecast."}/>
      <div className="mt-6 divide-y divide-[#e2e8e5]">{c.roadmap.map(([id,title,result])=><div key={id} className="grid gap-2 py-4 sm:grid-cols-[88px_1fr_1.3fr] sm:gap-5"><span className="text-xs font-bold text-[#1a5144]">{id}</span><h3 className="text-sm font-semibold text-[#1d2824]">{title}</h3><p className="text-sm leading-6 text-[#66736e]">{result}</p></div>)}</div>
    </section>

    <section id="kpi" className={section}>
      <Heading eyebrow="08 · Investment evidence" title={it?"I KPI che devono trasformare la visione in realtà":"KPIs required to turn vision into evidence"}/>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{c.kpis.map(([metric,description])=><article key={metric} className="rounded-2xl border border-[#dfe8e3] p-4"><p className="text-sm font-semibold text-[#1a5144]">{metric}</p><p className="mt-2 text-xs leading-6 text-[#52615b]">{description}</p></article>)}</div>
      <p className="mt-4 text-xs leading-6 text-[#66736e]">{it?"I target indicati sono criteri di accettazione proposti, non KPI già conseguiti.":"The stated thresholds are proposed acceptance criteria, not achieved metrics."}</p>
    </section>

    <section id="rischi" className={section}>
      <Heading eyebrow="09 · Decisions & provenance" title={it?"Rischi, confini e riferimenti dell'audit":"Risks, boundaries and audit sources"}/>
      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{c.risks.map(([title,body])=><article key={title} className="rounded-xl bg-[#f4f7f5] p-4"><p className="text-sm font-semibold text-[#1d2824]">{title}</p><p className="mt-2 text-xs leading-6 text-[#52615b]">{body}</p></article>)}</div>
      <div className="mt-7 border-t border-[#e1e7e4] pt-6"><h3 className="text-sm font-semibold text-[#1d2824]">{it?"Fonti e verifiche":"Sources and evidence"}</h3><div className="mt-3 flex flex-wrap gap-2">{c.references.map(([label,url])=><a key={url} className="rounded-xl border border-[#dce2df] px-3 py-2 text-xs font-semibold text-[#1a5144] underline-offset-2 hover:underline" href={url} target="_blank" rel="noreferrer">{label} ↗</a>)}</div></div>
      <p className="mt-5 text-xs leading-6 text-[#66736e]">{it?"Questo piano è riservato al superadmin e non compare automaticamente nelle viste condivise Investor Room. La scelta di divulgazione dei dettagli commerciali rimane esplicita.":"This masterplan is superadmin-only and is not automatically included in shared Investor Room views. Disclosure of sensitive details remains deliberate."}</p>
    </section>
  </div>;
}
