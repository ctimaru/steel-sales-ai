import Link from "next/link";
import { CALCULATOR_ROUTES, type CalculatorSiteLocale } from "@/lib/international-calculator-landing";
import { MARKET_GUIDE_ROUTES } from "@/lib/calculator-market-editorial";
import { MARKET_TOPIC_ROUTES } from "@/lib/calculator-topic-clusters";
import { SCHOOL_HUB_ROUTES } from "@/lib/school-locales";
import { schoolWorkspaceHref } from "@/lib/school-workspace-i18n";
import {localizedKnowledgePath} from "@/lib/localized-steel-knowledge";

type Scope = "public"|"workspace";
/** Preserve consent-aware School → calculator funnel attribution on public entry. */
const calculatorFromSchool=(locale:CalculatorSiteLocale)=>CALCULATOR_ROUTES[locale]+"?source=school&surface=school_nav";

const billRoute:Record<CalculatorSiteLocale,string> = {
  it:"/distinta",en:"/en/distinta",de:"/de/distinta",fr:"/fr/distinta",es:"/es/distinta",
};

/** One concise navigation model, always pointing to existing resources. 
 * EN/DE/FR/ES article translations are not inferred from the Italian library. */
const translations={
  it:{public:"Scuola aperta",private:"Area aziendale",navigate:"Navigazione Scuola",
    home:"Scuola",calculator:"Calcolatore",standards:"Norme",grades:"Materiali",
    guides:"Guide",topics:"Approfondimenti",bill:"Distinta",documents:"Documenti",
    enter:"Area aziendale",publicLabel:"Scuola pubblica",
    pathway:"Dalla conoscenza alla richiesta",step1:"Consulta",step2:"Calcola",step3:"Prepara la distinta",
    hint:"Una richiesta precisa nasce da misure, norma e grado verificati. La distinta prepara i dati per una RFQ; non invia automaticamente una richiesta.",
    next:"Crea la distinta",privacy:"I documenti aziendali restano riservati.",
  },
  en:{public:"Open School",private:"Company workspace",navigate:"School navigation",
    home:"School",calculator:"Calculator",standards:"Standards",grades:"Grades",
    guides:"Guides",topics:"Technical topics",bill:"RFQ bill",documents:"Documents",
    enter:"Company workspace",publicLabel:"Public School",
    pathway:"From knowledge to a structured enquiry",step1:"Explore",step2:"Calculate",step3:"Prepare a bill",
    hint:"Verify dimensions, standard and grade before preparing your RFQ. A bill captures requirements; it does not submit an order automatically.",
    next:"Create an RFQ bill",privacy:"Company documents remain private.",
  },
  de:{public:"Öffentliche Stahlschule",private:"Firmen-Workspace",navigate:"Navigation Stahlschule",
    home:"Stahlschule",calculator:"Rechner",standards:"Normen",grades:"Werkstoffe",
    guides:"Leitfaden",topics:"Fachartikel",bill:"Stückliste",documents:"Firmendokumente",
    enter:"Firmen-Workspace",publicLabel:"Öffentliche Stahlschule",
    pathway:"Vom Fachwissen zur Anfrage",step1:"Informieren",step2:"Berechnen",step3:"Stückliste erstellen",
    hint:"Maße, Norm und Stahlgüte vor der Anfrage prüfen. Eine Stückliste erfasst Angaben, versendet aber keine Bestellung.",
    next:"Stückliste erstellen",privacy:"Firmendokumente bleiben privat.",
  },
  fr:{public:"École publique",private:"Espace entreprise",navigate:"Navigation de l’École",
    home:"École",calculator:"Calculateur",standards:"Normes",grades:"Nuances",
    guides:"Guide",topics:"Ressources",bill:"Liste de demande",documents:"Documents privés",
    enter:"Espace entreprise",publicLabel:"École publique",
    pathway:"Du savoir à la demande de prix",step1:"Consulter",step2:"Calculer",step3:"Créer la liste",
    hint:"Vérifiez les dimensions, la norme et la nuance. La liste prépare la demande, sans envoyer automatiquement une commande.",
    next:"Créer la liste",privacy:"Les documents d’entreprise restent privés.",
  },
  es:{public:"Escuela pública",private:"Espacio empresarial",navigate:"Navegación de la Escuela",
    home:"Escuela",calculator:"Calculadora",standards:"Normas",grades:"Calidades",
    guides:"Guía",topics:"Recursos",bill:"Lista de oferta",documents:"Documentos privados",
    enter:"Espacio empresarial",publicLabel:"Escuela pública",
    pathway:"Del conocimiento a la solicitud",step1:"Consultar",step2:"Calcular",step3:"Preparar lista",
    hint:"Comprueba las dimensiones, norma y calidad antes de solicitar oferta. La lista organiza los requisitos, no envía un pedido.",
    next:"Crear lista de oferta",privacy:"Los documentos de empresa siguen privados.",
  },
} as const;

function schoolNavigationItems(locale:CalculatorSiteLocale,scope:Scope){
  const t=translations[locale];
  if(scope==="workspace") return [
    {label:t.home,href:schoolWorkspaceHref("/school",locale)},
    {label:t.calculator,href:locale==="it"?"/school/tubes?source=school&surface=school_nav":calculatorFromSchool(locale)},
    {label:t.standards,href:schoolWorkspaceHref("/school/norme",locale)},
    {label:t.grades,href:schoolWorkspaceHref("/school/gradi",locale)},
    {label:t.documents,href:schoolWorkspaceHref("/school/explorer",locale)},
    {label:t.bill,href:billRoute[locale]},
  ];
  const other=locale==="it"?[
    {label:t.standards,href:"/knowledge/norme"},
    {label:t.grades,href:"/knowledge/gradi"},
    {label:t.guides,href:"/knowledge/articoli"},
  ]:locale==="en"?[
    {label:t.standards,href:"/en/knowledge/standards"},
    {label:t.grades,href:"/en/knowledge/grades"},
  ]:[
    {label:t.standards,href:localizedKnowledgePath(locale,"standards")},
    {label:t.grades,href:localizedKnowledgePath(locale,"grades")},
    {label:t.guides,href:MARKET_GUIDE_ROUTES[locale]},
    {label:t.topics,href:MARKET_TOPIC_ROUTES[locale]},
  ];
  return [
    {label:t.home,href:SCHOOL_HUB_ROUTES[locale]},
    {label:t.calculator,href:calculatorFromSchool(locale)},
    ...other,
    {label:t.bill,href:billRoute[locale]},
  ];
}

/** Same interface contract on all five public hubs and private School home.
 * The final workspace entry is clearly gated by the existing login and RLS. */
export function SchoolUnifiedNavigation({locale,scope}:{
  locale:CalculatorSiteLocale;scope:Scope;
}){
  const t=translations[locale];
  const entries=schoolNavigationItems(locale,scope);
  return <nav aria-label={t.navigate} lang={locale}
    className="rounded-2xl border border-[#c9ddd1] bg-white px-3 py-3 shadow-sm sm:px-4">
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[.11em] text-[#246047]">
        <span aria-hidden="true" className="mr-2 inline-block h-2 w-2 rounded-full bg-[#2a8262]"/>
        {scope==="public"?t.public:t.private}
      </p>
      {scope==="public"
        ? <Link href={schoolWorkspaceHref("/school",locale)}
            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#bed5c7] bg-[#edf5f0] px-3 text-xs font-bold text-[#174b3c] transition hover:border-[#2f7e60] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
            <span aria-hidden="true">🔒</span>{t.enter}<span aria-hidden="true">↗</span>
          </Link>
        : <Link href={SCHOOL_HUB_ROUTES[locale]} hrefLang={locale}
            className="inline-flex min-h-9 items-center gap-2 text-xs font-bold text-[#174b3c] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
            {t.publicLabel} ↗
          </Link>}
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map((item,index)=><Link key={item.href} href={item.href}
        aria-current={index===0?"page":undefined}
        className={"inline-flex min-h-10 items-center rounded-xl border px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c] "+
        (index===0?"border-[#a9cfbc] bg-[#e8f4ec] text-[#174b3c]":"border-transparent bg-[#f4f7f5] text-[#355448] hover:border-[#b8d5c3] hover:bg-[#e8f4ec]")}>
        {item.label}
      </Link>)}
    </div>
  </nav>;
}

/** The same user journey on public and private home; no automatic RFQ promises. */
export function SchoolConversionPath({locale}: {locale:CalculatorSiteLocale}){
  const t=translations[locale];
  return <section className="rounded-2xl border border-[#b9d4c4] bg-[#eaf4ee] px-4 py-4 sm:px-6 sm:py-5"
    aria-label={t.pathway} lang={locale}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#1b6349]">Smart Steel Sales · RFQ</p>
        <h2 className="mt-1 text-lg font-semibold text-[#153d31]">{t.pathway}</h2>
      </div>
      <Link href={billRoute[locale]} className="school-primary-action shrink-0">
        {t.next} <span aria-hidden="true">→</span>
      </Link>
    </div>
    <ol className="mt-4 grid gap-2 sm:grid-cols-3">
      {[t.step1,t.step2,t.step3].map((step,i)=><li key={step}
        className="flex items-center gap-2 rounded-xl border border-[#cce0d3] bg-white px-3 py-2 text-sm font-semibold text-[#244d3d]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#174b3c] text-xs font-bold text-white">{i+1}</span>
        {step}
      </li>)}
    </ol>
    <p className="mt-3 max-w-4xl text-xs leading-5 text-[#476255]">{t.hint} {t.privacy}</p>
  </section>;
}
