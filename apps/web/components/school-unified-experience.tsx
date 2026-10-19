import Link from "next/link";
import { CALCULATOR_FLAGS, type CalculatorSiteLocale } from "@/lib/international-calculator-landing";
import { SCHOOL_HUB_ROUTES } from "@/lib/school-locales";
import { MARKET_GUIDE_ROUTES } from "@/lib/calculator-market-editorial";
import { MARKET_TOPIC_ROUTES } from "@/lib/calculator-topic-clusters";

/** Only routes with real translated pages appear in localized cards.
 * Italian editorial articles are NOT represented as translated articles.
 */
const copy = {
  it: {
    kicker:"Scuola tecnica",heading:"Un percorso per ogni esigenza",
    intro:"Dalla misura alla richiesta: calcola, consulta e approfondisci con riferimenti tecnici verificabili.",
    action:"Esplora",shape:["Tondo","Quadro","Rettangolare"],disclaimer:"Geometrie schematiche, non in scala. Verifica le dimensioni e la norma applicabile.",
    cards:[
      {tag:"01 · CHS / SHS / RHS",title:"Calcola i pesi",description:"kg/m, barre e tonnellaggio con EN 10210, EN 10219 o geometria libera.",href:"/knowledge/tubes?source=school&surface=home_card#calcolatore-pesi"},
      {tag:"02 · EN",title:"Norme tecniche",description:"Campi di applicazione, famiglie di prodotto e specifiche consultabili.",href:"/knowledge/norme"},
      {tag:"03 · S355",title:"Gradi di acciaio",description:"Designazioni, prodotti e riferimenti da confrontare prima della richiesta.",href:"/knowledge/gradi"},
      {tag:"04 · Guide",title:"Articoli e industria",description:"Storia, produzione e filiera in articoli originali con fonti.",href:"/knowledge/articoli"},
    ],
  },
  en: {
    kicker:"Technical School",heading:"From steel knowledge to a clear RFQ",
    intro:"Use the calculator, consult published standards and grades, and create a structured request.",
    action:"Explore",shape:["Round","Square","Rectangular"],disclaimer:"Schematic geometries, not to scale. Confirm dimensions and the applicable product standard.",
    cards:[
      {tag:"01 · CHS / SHS / RHS",title:"Tube weight calculator",description:"Theoretical kg/m, bar mass and tonnes for EN 10210, EN 10219 and free geometry.",href:"/en/knowledge/tubes"},
      {tag:"02 · EN",title:"Steel tube standards",description:"Published English guides to structural and pressure tube requirements.",href:"/en/knowledge/standards"},
      {tag:"03 · S355",title:"Material grades",description:"Explore English guides to common steel grades and designations.",href:"/en/knowledge/grades"},
      {tag:"04 · RFQ",title:"Bill of materials",description:"Turn dimensions, quantity and grade into a structured enquiry.",href:"/en/distinta"},
    ],
  },
  de: {
    kicker:"Technische Stahlschule",heading:"Von der Berechnung zur Angebotsanfrage",
    intro:"Berechnen Sie Rohrgewichte, vertiefen Sie die Grundlagen und erstellen Sie eine strukturierte Anfrage.",
    action:"Öffnen",shape:["Rund","Quadrat","Rechteck"],disclaimer:"Schematische Querschnitte, nicht maßstabsgetreu. Maße und Produktnorm prüfen.",
    cards:[
      {tag:"01 · CHS / SHS / RHS",title:"Rohrgewicht berechnen",description:"Theoretische kg/m, Stangenmasse und Tonnen mit EN 10210 oder EN 10219.",href:"/de/knowledge/tubes"},
      {tag:"02 · RFQ",title:"Anfrage-Stückliste",description:"Profile, Maße, Mengen und Güte für eine strukturierte Anfrage erfassen.",href:"/de/distinta"},
      {tag:"03 · Grundlagen",title:"Technischer Leitfaden",description:"Lokalisierte Hinweise zu Stahlrohrmassen und Berechnungsmethoden.",href:MARKET_GUIDE_ROUTES.de},
      {tag:"04 · Vertiefung",title:"Geometrien verstehen",description:"Ergänzende Informationen zu Profilen und technischen Einheiten.",href:MARKET_TOPIC_ROUTES.de},
    ],
  },
  fr: {
    kicker:"École technique de l’acier",heading:"Du calcul à la demande de prix",
    intro:"Calculez la masse des tubes, consultez les explications techniques et préparez une demande structurée.",
    action:"Découvrir",shape:["Rond","Carré","Rectangle"],disclaimer:"Sections schématiques, non à l'échelle. Vérifiez les dimensions et la norme produit.",
    cards:[
      {tag:"01 · CHS / SHS / RHS",title:"Calculer le poids des tubes",description:"Masse théorique en kg/m, par barre et en tonnes selon EN 10210 ou EN 10219.",href:"/fr/knowledge/tubes"},
      {tag:"02 · RFQ",title:"Liste de demande de prix",description:"Préparez une demande avec sections, dimensions, nuances et quantités.",href:"/fr/distinta"},
      {tag:"03 · Méthode",title:"Guide technique",description:"Explications en français sur les masses et les hypothèses de calcul.",href:MARKET_GUIDE_ROUTES.fr},
      {tag:"04 · Ressources",title:"Sections et géométries",description:"Approfondissez les sections creuses et les unités de calcul.",href:MARKET_TOPIC_ROUTES.fr},
    ],
  },
  es: {
    kicker:"Escuela técnica del acero",heading:"Del cálculo a la solicitud de oferta",
    intro:"Calcule el peso de los tubos, consulte guías técnicas y prepare una solicitud estructurada.",
    action:"Explorar",shape:["Redondo","Cuadrado","Rectangular"],disclaimer:"Secciones esquemáticas, no a escala. Compruebe medidas y norma del producto.",
    cards:[
      {tag:"01 · CHS / SHS / RHS",title:"Calcular peso de tubos",description:"Masa teórica en kg/m, por barra y toneladas según EN 10210 o EN 10219.",href:"/es/knowledge/tubes"},
      {tag:"02 · RFQ",title:"Lista para solicitar oferta",description:"Incluya geometrías, dimensiones, calidad, cantidades y longitudes.",href:"/es/distinta"},
      {tag:"03 · Método",title:"Guía técnica",description:"Notas en español sobre el cálculo y sus limitaciones.",href:MARKET_GUIDE_ROUTES.es},
      {tag:"04 · Recursos",title:"Geometrías de tubos",description:"Información técnica complementaria sobre perfiles y unidades.",href:MARKET_TOPIC_ROUTES.es},
    ],
  },
} as const;

export function SchoolTechnicalSections({locale}:{locale:CalculatorSiteLocale}){
  const c=copy[locale];
  return <div className="relative overflow-hidden rounded-3xl border border-[#c9dfd4] bg-[#e9f3ee] p-4 sm:p-5"
    role="img" aria-label={c.shape.join(", ")+" — CHS, SHS, RHS"}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#174b3c]">Smart Steel School</p>
      <span className="rounded-lg border border-[#bdd8c9] bg-white px-2.5 py-1 font-mono text-[10px] font-semibold text-[#174b3c]">CHS / SHS / RHS</span>
    </div>
    <svg aria-hidden="true" focusable="false" viewBox="0 0 360 205" className="mt-3 h-auto w-full" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="schoolUnifiedSection" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#cce5d8" /><stop offset="1" stopColor="#80baa2" />
      </linearGradient></defs>
      <g stroke="#c9ded3" strokeWidth="1" opacity=".85">
        <path d="M0 31H360M0 74H360M0 117H360M0 160H360"/>
        <path d="M40 0V205M100 0V205M160 0V205M220 0V205M280 0V205M340 0V205"/>
      </g>
      <circle cx="73" cy="94" r="46" fill="url(#schoolUnifiedSection)" stroke="#195845" strokeWidth="3"/>
      <circle cx="73" cy="94" r="30" fill="#edf6f1" stroke="#195845" strokeWidth="2"/>
      <rect x="147" y="51" width="87" height="87" rx="8" fill="url(#schoolUnifiedSection)" stroke="#195845" strokeWidth="3"/>
      <rect x="161" y="65" width="59" height="59" rx="3" fill="#edf6f1" stroke="#195845" strokeWidth="2"/>
      <rect x="254" y="62" width="99" height="64" rx="7" fill="url(#schoolUnifiedSection)" stroke="#195845" strokeWidth="3"/>
      <rect x="268" y="76" width="71" height="36" rx="2" fill="#edf6f1" stroke="#195845" strokeWidth="2"/>
      <g fill="#174b3c" fontSize="11" fontWeight="700" textAnchor="middle">
        <text x="73" y="167">{c.shape[0]}</text><text x="190" y="167">{c.shape[1]}</text><text x="303" y="167">{c.shape[2]}</text>
      </g>
    </svg>
    <p className="mt-1 text-xs leading-5 text-[#405a4e]">{c.disclaimer}</p>
  </div>;
}

/** Consistent public/private/language interaction rail, no private links in public locales. */
export function SchoolJourney({locale,workspace=false}:{
  locale:CalculatorSiteLocale;workspace?:boolean;
}){
  const c=copy[locale];
  const cards=workspace ? [
    {...copy.it.cards[0],href:"/school/tubes?source=school&surface=home_card#calcolatore-pesi"},
    {...copy.it.cards[1],href:"/school/norme"},
    {...copy.it.cards[2],href:"/school/gradi"},
    {...copy.it.cards[3],title:"Biblioteca pubblica",description:"Articoli originali aperti a tutti, separati dai tuoi documenti aziendali.",href:"/knowledge/articoli"},
  ] : c.cards;
  return <section aria-labelledby="school-unified-journey" className="space-y-4">
    <div>
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#1a5144]">{c.kicker}</p>
      <h2 id="school-unified-journey" className="mt-2 text-2xl font-semibold tracking-tight text-[#173f35]">{c.heading}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-7 text-[#506157]">{c.intro}</p>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(item=><Link key={item.href} href={item.href}
        className="group flex min-h-[182px] flex-col rounded-2xl border border-[#cddfd5] bg-white p-5 text-[#1d2824] shadow-sm transition hover:-translate-y-0.5 hover:border-[#8bb7a3] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174b3c]">
        <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-[#2b7356]">{item.tag}</span>
        <h3 className="mt-3 text-base font-bold text-[#173f35]">{item.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-[#506157]">{item.description}</p>
        <span className="mt-4 text-sm font-bold text-[#174b3c]">{c.action} <span aria-hidden="true">→</span></span>
      </Link>)}
    </div>
    <p className="sr-only">{CALCULATOR_FLAGS[locale].label}</p>
  </section>;
}
