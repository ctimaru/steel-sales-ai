import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductBrand } from "@/components/product-brand";
import { SchoolJourney, SchoolTechnicalSections } from "@/components/school-unified-experience";
import { SchoolInternationalReferences } from "@/components/school-international-references";
import { SchoolUnifiedNavigation, SchoolConversionPath } from "@/components/school-unified-navigation";
import { SchoolPageLanguageSelector, PUBLIC_HOME_LOCALE_ROUTES } from "@/components/calculator-page-language-selector";
import { SCHOOL_HUB_ROUTES } from "@/lib/school-locales";
import { isNewCalculatorLocale, type CalculatorLandingLocale } from "@/lib/international-calculator-landing";
import { absoluteUrl } from "@/lib/site";

const editorial: Record<CalculatorLandingLocale,{
  title:string;description:string;eyebrow:string;lead:string;free:string;privacy:string;
  explore:string;calculator:string;disclaimer:string;reference:string;back:string;
}> = {
  de:{
    title:"Stahlwissen und Rohrgewichte — Smart Steel School",
    description:"Kostenlose technische Stahlschule: Rohrgewicht nach EN 10210/10219 berechnen, Anfragen strukturieren und fachliche Leitfäden lesen.",
    eyebrow:"SMART STEEL SCHOOL · KOSTENLOS",lead:"Berechnen Sie Stahlrohrmassen, erstellen Sie Stücklisten und vertiefen Sie technische Grundlagen. Die Scuola ist öffentlich; betriebliche Daten bleiben getrennt.",
    free:"Frei zugängliche Ressourcen",privacy:"Öffentliche Daten · getrennt von Firmendokumenten",
    explore:"Technische Werkzeuge erkunden",calculator:"Rohrgewicht berechnen",disclaimer:"Berechnungen sind theoretisch und kein Konformitätsnachweis. Prüfen Sie Normen, Güten und Toleranzen mit dem Lieferanten.",
    reference:"Veröffentlichte Inhalte in deutscher Sprache: Rechner, Anfrage-Stückliste und ausgewählte Leitfäden. Nicht alle italienischen Artikel sind übersetzt.",
    back:"Zur Startseite",
  },
  fr:{
    title:"Connaissances acier et poids des tubes — Smart Steel School",
    description:"École technique gratuite : calculez le poids des tubes selon EN 10210/10219, préparez une liste de demande de prix et découvrez les guides français.",
    eyebrow:"SMART STEEL SCHOOL · GRATUIT",lead:"Calculez les masses des tubes acier, préparez une demande de prix et consultez les explications techniques. Les données des entreprises restent privées.",
    free:"Ressources publiques gratuites",privacy:"Savoir public · documents professionnels séparés",
    explore:"Explorer les outils techniques",calculator:"Calculer le poids des tubes",
    disclaimer:"La masse calculée est théorique et ne prouve pas la conformité du produit. Vérifiez normes, nuances et tolérances avec le fournisseur.",
    reference:"Contenus disponibles en français : calculateur, liste de demande de prix et guides sélectionnés. Les articles italiens ne sont pas tous traduits.",
    back:"Retour à l’accueil",
  },
  es:{
    title:"Conocimiento del acero y peso de tubos — Smart Steel School",
    description:"Escuela técnica gratuita: cálculo del peso de tubos según EN 10210/10219, listas para solicitar oferta y guías de acero en español.",
    eyebrow:"SMART STEEL SCHOOL · GRATIS",lead:"Calcule masas de tubos de acero, prepare solicitudes de oferta y consulte guías técnicas. Los documentos empresariales permanecen privados.",
    free:"Recursos técnicos públicos",privacy:"Conocimiento abierto · datos privados separados",
    explore:"Explorar herramientas técnicas",calculator:"Calcular peso de tubos",
    disclaimer:"Los resultados son masas teóricas y no certifican la conformidad. Confirme normas, calidades y tolerancias con el proveedor.",
    reference:"Recursos disponibles en español: calculadora, lista de oferta y guías seleccionadas. No se afirma que todos los artículos italianos estén traducidos.",
    back:"Volver al inicio",
  },
};

const locales = ["de","fr","es"] as const;
const localizedAlternates = () => Object.fromEntries(
  Object.entries(SCHOOL_HUB_ROUTES).map(([key,path])=>[key,absoluteUrl(path)]),
);

export function generateStaticParams(){return locales.map(locale=>({locale}));}

export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{
  const {locale}=await params;
  if(!isNewCalculatorLocale(locale))notFound();
  const info=editorial[locale];
  const path=SCHOOL_HUB_ROUTES[locale];
  return {
    title:info.title,description:info.description,
    alternates:{canonical:absoluteUrl(path),languages:localizedAlternates()},
    robots:{index:true,follow:true},
    openGraph:{type:"website",title:info.title,description:info.description,url:absoluteUrl(path),locale},
  };
}

export default async function LocalizedSchoolHome({params}:{params:Promise<{locale:string}>}){
  const {locale}=await params;
  if(!isNewCalculatorLocale(locale))notFound();
  const t=editorial[locale],path=SCHOOL_HUB_ROUTES[locale];
  const schema={"@context":"https://schema.org","@type":"CollectionPage",
    name:t.title,description:t.description,inLanguage:locale,
    url:absoluteUrl(path),isAccessibleForFree:true,
  };
  return <main className="school-shell min-h-screen bg-[#f2f4f3] text-[#1d2824]">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema)}} />
    <a href="#school-main" className="skip-link">{t.explore}</a>
    <header className="border-b border-[#dce2df] bg-white">
      <div className="mx-auto flex min-h-[72px] max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <ProductBrand href={PUBLIC_HOME_LOCALE_ROUTES[locale]} compact/>
        <div className="flex items-center gap-3">
          <SchoolPageLanguageSelector locale={locale}/>
          <Link href={PUBLIC_HOME_LOCALE_ROUTES[locale]} className="hidden text-xs font-bold text-[#174b3c] underline underline-offset-4 sm:block">
            {t.back}
          </Link>
        </div>
      </div>
    </header>
    <div id="school-main" className="mx-auto max-w-[1180px] space-y-7 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <SchoolUnifiedNavigation locale={locale} scope="public" />
      <section className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        aria-label="Smart Steel School">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#1a5144]">{t.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-[#173f35] sm:text-[2.65rem]">{t.title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[#506157] sm:text-base">{t.lead}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[t.free,t.privacy].map(label=><span key={label}
              className="rounded-full border border-[#c7d9cd] bg-white px-3 py-1.5 text-xs font-semibold text-[#174b3c]">{label}</span>)}
          </div>
          <Link href={"/"+locale+"/knowledge/tubes"} className="school-primary-action mt-5">
            {t.calculator} <span aria-hidden="true">→</span>
          </Link>
        </div>
        <SchoolTechnicalSections locale={locale}/>
      </section>
      <SchoolJourney locale={locale}/>
      <SchoolInternationalReferences locale={locale}/>
      <SchoolConversionPath locale={locale}/>
      <aside className="rounded-2xl border border-[#d4e2d8] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-[#173f35]">{t.privacy}</h2>
        <p className="mt-2 text-sm leading-7 text-[#506157]">{t.disclaimer}</p>
        <p className="mt-2 text-sm leading-7 text-[#506157]">{t.reference}</p>
      </aside>
    </div>
    <footer className="mx-auto flex max-w-[1180px] justify-between gap-4 border-t border-[#dce2df] px-4 py-6 text-xs text-[#52615b] sm:px-6">
      <span>Smart Steel Sales · Super Intelligence Ready</span>
      <Link href={PUBLIC_HOME_LOCALE_ROUTES[locale]} className="font-semibold text-[#174b3c]">{t.back}</Link>
    </footer>
  </main>;
}
