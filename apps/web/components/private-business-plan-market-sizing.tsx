import {
  calculateMarketModel,
  marketModelGovernance,
  marketModelInputs,
  marketModelVersion,
  pricingMixSensitivity,
  sourceLedger,
} from "@/lib/private-business-plan-market-sizing";
import type { BusinessPlanLocale } from "@/lib/business-plan-locale";

const euro = (amount: number, locale: string, decimals = 0) =>
  new Intl.NumberFormat(locale === "it" ? "it-IT" : "en-GB", {
    style: "currency", currency: "EUR", maximumFractionDigits: decimals, minimumFractionDigits: decimals,
  }).format(amount);

const integer = (amount: number, locale: string) =>
  new Intl.NumberFormat(locale === "it" ? "it-IT" : "en-GB").format(amount);

const fraction = (amount: number, locale: string) =>
  new Intl.NumberFormat(locale === "it" ? "it-IT" : "en-GB", {
    style: "percent", maximumFractionDigits: 0,
  }).format(amount);

const text = {
  it: {
    status: "BOZZA INTERNA · NON VALIDATA",
    title: "TAM → SAM → SOM del SaaS SteelTech",
    subtitle: "Stima bottom-up del software B2B per aziende della filiera acciaio. Organizzazioni uniche (non contatti, siti o dipendenti); abbonamento mensile per organizzazione; ARR solo moduli SaaS.",
    warning: "Le quote di aderenza, raggiungibilità, conversione e numero utenti sono ipotesi interne. I dati associativi non costituiscono un censimento deduplicato. Nessun valore qui rappresenta ricavi realizzati o una previsione approvata.",
    tam: "TAM europeo indicativo",
    tamNote: "770.000 aziende industrial-tech × 15% potenzialmente adatte al caso d’uso. Universo Orgalim ampio, non steel-only.",
    sam: "SAM Italia iniziale",
    samNote: "160.000 aziende clienti della distribuzione × 15% fit RFQ × 40% raggiungibili. Il 40% è potenziale commerciale, NON quota già raggiunta.",
    som: "SOM 36 mesi · scenario base",
    somNote: "Organizzazioni paganti a regime ipotetico dopo 36 mesi: non vendite acquisite né un revenue forecast consolidato.",
    spendCeiling: "Spesa software annua teorica, se il 100% delle organizzazioni filtrate acquistasse: NON ricavi previsti.",
    methodology: "Dal mercato industriale al mercato realmente pagante",
    baseItaly: "Aziende industriali italiane di riferimento",
    baseEurope: "Aziende industry-tech europee di riferimento",
    fitItaly: "Quota con uso ricorrente RFQ / fit prodotto (ipotesi)",
    fitEurope: "Fit per universo europeo (ipotesi)",
    reachable: "Quota serviceable in Italia (ipotesi)",
    qualified: "Aziende italiane potenzialmente eleggibili",
    users: "Utenti potenziali, stima 2,5 per organizzazione",
    pricing: "Prezzi e ARPA coerenti con Business Plan",
    priceExplanation: "Base gratuita, modulo opzionale €15/mese, Plus €39/mese: ricavo medio ponderato in base a un mix ipotetico 40% modulo / 60% Plus. Gli utenti interni NON sono moltiplicatori del fatturato.",
    module: "Modulo",
    plus: "SSS Plus",
    arpa: "ARPA mensile per azienda pagante",
    mixSensitivity: "Sensibilità ricavi per mix di abbonamenti (stesse aziende paganti)",
    funnel: "SOM: tre scenari di penetrazione a 36 mesi",
    scenario: "Scenario",
    activated: "Aziende attivate",
    activation: "Attive / SAM",
    paid: "Aziende paganti",
    attach: "Paganti / attive",
    payingUsers: "Utenti nelle aziende paganti",
    mrr: "MRR ipotetico",
    arr: "ARR ipotetico",
    scenarioWarning: "Attivazione = utilizzo ripetuto di strumenti / RFQ / Network, non sola registrazione. I tassi si applicano sequenzialmente; gli utenti nelle aziende paganti non pagano ulteriormente per seat.",
    roles: "Quattro tipologie, ruoli distinti nella monetizzazione",
    segments: [
      ["Commercianti", "ICP primario: alto volume offerte, memoria commerciale e collaborazione", "Memory+ / SSS Plus"],
      ["Utilizzatori", "Generano RFQ e domanda; Free Base prioritario", "Upgrade solo su valore premium validato"],
      ["Terzisti", "Risposta a RFQ, lavorazioni e capacità produttiva", "Team+ / Marketplace quando liquido"],
      ["Produttori", "Supply intelligence e processi multi-sede", "Enterprise/API dopo validazione"],
    ],
    sourceTitle: "Registro fonti e limiti dei dati",
    sourceLead: "Questi conteggi NON sono additivi: i membri di associazioni si sovrappongono e il numero di stabilimenti non equivale al numero di aziende.",
    calibration: "Prossime validazioni che sostituiranno le ipotesi",
    scope: "Perimetro e rischi economici",
    priceBenchmark: "Controllo disponibilità a pagare: Odoo / Pipedrive adottano prezzi principalmente per utente; il nostro modello da €15–39 per organizzazione è una scelta di posizionamento ancora da validare.",
    source: "Fonte",
  },
  en: {
    status: "INTERNAL DRAFT · UNVALIDATED",
    title: "SteelTech SaaS TAM → SAM → SOM",
    subtitle: "Bottom-up sizing of vertical steel-industry B2B software. Legal organizations (not sites, users or contacts); organization-based monthly subscriptions; recurring SaaS modules only.",
    warning: "Fit, reach, conversion and users/organization are internal hypotheses. Industry association membership is not a deduplicated census. None of these amounts is realized revenue or an approved forecast.",
    tam: "Illustrative European TAM",
    tamNote: "770,000 industrial-technology companies × 15% hypothetical relevant steel-RFQ fit. Broad Orgalim basket, not steel-only.",
    sam: "Italy-first SAM",
    samNote: "160,000 downstream customer companies × 15% recurring RFQ fit × 40% serviceable reach. Reach is potential, NOT achieved.",
    som: "36-month SOM · base case",
    somNote: "Hypothetical annualized subscription run rate at 36 months, not committed forecast or actual revenue.",
    spendCeiling: "Theoretical annual software spend if 100% of filtered companies subscribed; NOT a revenue forecast.",
    methodology: "From industrial footprint to payers",
    baseItaly: "Italian downstream company reference base",
    baseEurope: "European technology-industry reference base",
    fitItaly: "Recurring steel-RFQ fit (hypothesis)",
    fitEurope: "EU basket relevance share (hypothesis)",
    reachable: "Italy-first serviceability (hypothesis)",
    qualified: "Potentially qualified Italian organizations",
    users: "Potential user accounts, 2.5 per organization hypothesis",
    pricing: "Pricing and ARPA consistent with the Business Plan",
    priceExplanation: "Free Base, optional €15/month module and €39/month Plus bundle. Hypothetical blend: 40% modules and 60% Plus. Employee seats DO NOT multiply subscription ARR.",
    module: "Optional module",
    plus: "SSS Plus",
    arpa: "Weighted monthly ARPA per paying org",
    mixSensitivity: "Subscription mix sensitivity (same number of paying companies)",
    funnel: "SOM: three 36-month penetration hypotheses",
    scenario: "Scenario",
    activated: "Activated companies",
    activation: "Active / SAM",
    paid: "Paying companies",
    attach: "Paid / active",
    payingUsers: "Users at paying orgs",
    mrr: "Illustrative MRR",
    arr: "Illustrative ARR",
    scenarioWarning: "Activation means repeated workflows, not registration alone. Rates apply sequentially; staff at paying organizations are not charged per seat.",
    roles: "Four company types, different reasons to pay",
    segments: [
      ["Traders", "Beachhead ICP: quote-heavy workflow, memory and teamwork", "Memory+ / SSS Plus"],
      ["Industrial buyers", "Generate RFQ demand; prioritize the useful free tier", "Premium upsell only after validated value"],
      ["Processors", "RFQ response and capability discovery", "Team+ / Marketplace after liquidity"],
      ["Producers", "Supply intelligence and multi-site needs", "Enterprise/API after validation"],
    ],
    sourceTitle: "Evidence ledger and source limitations",
    sourceLead: "Do NOT add these universes: association memberships overlap, and company sites are not legal companies.",
    calibration: "Evidence needed to replace assumptions",
    scope: "Economic scope and limitations",
    priceBenchmark: "Willingness-to-pay benchmark: Odoo and Pipedrive primarily price per user; our €15–39 per-organization bands remain a positioning hypothesis to validate.",
    source: "Source",
  },
} as const;

export function PrivateBusinessPlanMarketSizing({ locale }: { locale: BusinessPlanLocale }) {
  const c = text[locale];
  const m = calculateMarketModel();
  const base = m.som.find((x) => x.key === "base")!;

  return (
    <div className="space-y-7">
      <section className="rounded-3xl bg-[#123b34] p-6 text-white sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#bee1d0]">{c.status} · {marketModelVersion}</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{c.title}</h2>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-[#e0ece6]">{c.subtitle}</p>
      </section>

      <p role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-950">{c.warning}</p>

      <section aria-label="TAM SAM SOM" className="grid gap-4 lg:grid-cols-3">
        {[
          [c.tam, m.tam.organizations, m.tam.annualSoftwareSpendCeilingEur, c.tamNote],
          [c.sam, m.sam.organizations, m.sam.annualSoftwareSpendCeilingEur, c.samNote],
          [c.som, base.payingOrganizations, base.arrEur, c.somNote],
        ].map(([label, count, arr, note], index) => (
          <article key={label} className="rounded-2xl border border-[#dce5e0] bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.10em] text-[#1f6b5a]">{label}</p>
            <p className="mt-4 text-3xl font-semibold tabular-nums text-[#123b34]">{integer(count as number,locale)} <span className="text-xs font-normal text-[#66736e]">org</span></p>
            <p className="mt-2 text-xl font-semibold tabular-nums text-[#123b34]">{euro(arr as number,locale)} <span className="text-xs font-normal text-[#66736e]">ARR</span></p>
            <p className="mt-3 text-xs leading-6 text-[#66736e]">{note}</p>
            {index < 2 ? <p className="mt-2 border-t border-[#edf2ee] pt-2 text-xs leading-5 text-[#8a5b0f]">{c.spendCeiling}</p> : null}
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-7">
        <h3 className="text-xl font-semibold text-[#123b34]">{c.methodology}</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {[
            [c.baseItaly, integer(marketModelInputs.italianBroadOrganizations,locale)],
            [c.baseEurope, integer(marketModelInputs.europeanBroadOrganizations,locale)],
            [c.fitItaly, fraction(marketModelInputs.italianRelevantShare,locale)],
            [c.fitEurope, fraction(marketModelInputs.europeanRelevantShare,locale)],
            [c.reachable, fraction(marketModelInputs.italianServiceableShare,locale)],
            [c.qualified, integer(m.italyQualified.organizations,locale)],
            [c.users, integer(m.sam.potentialUsers,locale)],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-5 rounded-xl bg-[#f4f7f5] px-4 py-3">
              <span className="text-xs leading-5 text-[#52615b]">{label}</span>
              <strong className="shrink-0 text-sm tabular-nums text-[#123b34]">{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-7">
        <h3 className="text-xl font-semibold text-[#123b34]">{c.pricing}</h3>
        <p className="mt-2 text-sm leading-6 text-[#52615b]">{c.priceExplanation}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#edf4f0] p-4"><p className="text-xs text-[#52615b]">{c.module} · 40%</p><p className="mt-1 text-2xl font-semibold text-[#123b34]">{euro(marketModelInputs.modulePriceEurPerOrganizationMonth,locale)} / mo</p></div>
          <div className="rounded-xl bg-[#edf4f0] p-4"><p className="text-xs text-[#52615b]">{c.plus} · 60%</p><p className="mt-1 text-2xl font-semibold text-[#123b34]">{euro(marketModelInputs.plusPriceEurPerOrganizationMonth,locale)} / mo</p></div>
          <div className="rounded-xl bg-[#123b34] p-4 text-white"><p className="text-xs text-[#dbeae4]">{c.arpa}</p><p className="mt-1 text-2xl font-semibold">{euro(m.paidArpaMonthly,locale,2)} / mo</p></div>
        </div>
        <div className="mt-5 border-t border-[#edf2ee] pt-4">
          <h4 className="text-sm font-semibold text-[#123b34]">{c.mixSensitivity}</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {pricingMixSensitivity(base.payingOrganizations).map((row) => (
              <div key={row.key} className="rounded-xl border border-[#e1e9e5] bg-[#f8faf9] p-3">
                <p className="text-xs font-semibold text-[#345047]">{locale === "it" ? row.labelIt : row.labelEn}</p>
                <p className="mt-1 text-[11px] text-[#66736e]">{fraction(row.moduleShare,locale)} €15 / {fraction(row.plusShare,locale)} €39</p>
                <p className="mt-2 font-semibold tabular-nums text-[#123b34]">{euro(row.monthlyArpaEur,locale,2)} ARPA</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-[#123b34]">{euro(row.arrEur,locale)} ARR</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-xs leading-6 text-[#66736e]">{c.priceBenchmark} <a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.odoo.com/pricing">Odoo ↗</a> · <a className="underline" target="_blank" rel="noopener noreferrer" href="https://support.pipedrive.com/en/article/how-does-pricing-work-in-pipedrive">Pipedrive ↗</a></p>
      </section>

      <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-7">
        <h3 className="text-xl font-semibold text-[#123b34]">{c.funnel}</h3>
        <p className="mt-2 text-xs leading-6 text-[#52615b]">{c.scenarioWarning}</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left text-xs">
            <thead><tr className="border-b border-[#dce5e0] text-[#52615b]">
              {[c.scenario,c.activation,c.activated,c.attach,c.paid,c.payingUsers,c.mrr,c.arr].map((h)=><th key={h} className="px-3 py-3 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>{m.som.map(row => <tr key={row.key} className={row.key === "base" ? "bg-[#edf4f0]" : "border-b border-[#edf2ee]"}>
              <td className="px-3 py-3 font-semibold text-[#123b34]">{locale==="it"?row.labelIt:row.labelEn}</td>
              <td className="px-3 py-3 tabular-nums">{fraction(row.activatedShareOfSam,locale)}</td>
              <td className="px-3 py-3 tabular-nums">{integer(row.activatedOrganizations,locale)}</td>
              <td className="px-3 py-3 tabular-nums">{fraction(row.paidShareOfActivated,locale)}</td>
              <td className="px-3 py-3 font-semibold tabular-nums">{integer(row.payingOrganizations,locale)}</td>
              <td className="px-3 py-3 tabular-nums">{integer(row.usersWithinPayingOrganizations,locale)}</td>
              <td className="px-3 py-3 tabular-nums">{euro(row.mrrEur,locale)}</td>
              <td className="px-3 py-3 font-semibold tabular-nums text-[#123b34]">{euro(row.arrEur,locale)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-7">
        <h3 className="text-xl font-semibold text-[#123b34]">{c.roles}</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2">{c.segments.map((row)=>(
          <article key={row[0]} className="rounded-xl border border-[#e1e9e5] bg-[#f8faf9] p-4">
            <h4 className="text-sm font-semibold text-[#123b34]">{row[0]}</h4><p className="mt-2 text-xs leading-6 text-[#52615b]">{row[1]}</p>
            <p className="mt-3 text-xs font-bold text-[#1f6b5a]">{row[2]}</p>
          </article>
        ))}</div>
      </section>

      <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-7">
        <h3 className="text-xl font-semibold text-[#123b34]">{c.sourceTitle}</h3>
        <p className="mt-2 text-xs leading-6 text-[#66736e]">{c.sourceLead}</p>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {sourceLedger.map(item=><li key={item.label} className="rounded-xl bg-[#f5f8f6] p-4">
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-[#1f6b5a] underline underline-offset-4">{item.label} ↗</a>
            <p className="mt-2 text-xs text-[#345047]">{integer(item.number,locale)} · {item.geography} · {item.unit}</p>
            <p className="mt-2 text-xs leading-6 text-[#66736e]">{item.limitation}</p>
          </li>)}
        </ul>
      </section>

      <section className="rounded-2xl border border-[#dce5e0] bg-white p-5 sm:p-7">
        <h3 className="text-xl font-semibold text-[#123b34]">{c.calibration}</h3>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-7 text-[#52615b]">{marketModelGovernance.calibration.map(item=><li key={item}>{item}</li>)}</ol>
        <p className="mt-5 border-t border-[#edf2ee] pt-4 text-xs leading-6 text-[#66736e]"><strong>{c.scope}:</strong> {marketModelGovernance.economicBasis} {marketModelGovernance.tamCaveat}</p>
      </section>
    </div>
  );
}
