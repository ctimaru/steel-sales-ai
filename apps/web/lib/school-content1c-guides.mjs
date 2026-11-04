/**
 * SCHOOL-CONTENT1.C — original educational comparison copy.
 * No normative tables, product approvals, calculations or equivalence inference.
 * Links point to the official publisher's publicly available catalogue summaries.
 */
export const SCHOOL_CONTENT1C_REVIEW_DATE = "2026-11-02";
export const SCHOOL_CONTENT1C_PATH = "/knowledge/articoli/confronti-glossario";

export const schoolComparisons = [
  {
    id: "en-10210-vs-en-10219",
    title: "EN 10210 ed EN 10219: cosa cambia?",
    subtitle: "Due famiglie di profilati cavi strutturali, non due etichette intercambiabili.",
    left: "EN 10210",
    right: "EN 10219",
    rows: [
      { label: "Famiglia", left: "Profilati cavi strutturali finiti a caldo; la via produttiva può prevedere anche formatura a freddo seguita da trattamento per condizioni metallurgiche equivalenti.", right: "Profilati cavi strutturali saldati formati a freddo senza trattamento termico successivo, secondo l'ambito della parte 1." },
      { label: "Condizioni di fornitura", left: "Parte 1: UNI EN 10210-1:2006.", right: "Parte 1: UNI EN 10219-1:2006." },
      { label: "Dimensioni e tolleranze", left: "Parte 2: UNI EN 10210-2:2019; consultare il campo dimensionale della propria sezione.", right: "Parte 2: UNI EN 10219-2:2019; verificare la sezione e l'edizione applicabile." },
      { label: "Decisione pratica", left: "Specificare grado completo, condizione, forma e requisiti di progetto. Non equivale automaticamente a un tubo senza saldatura.", right: "Specificare grado completo, geometria e documenti; non convertire automaticamente un profilo EN 10210 in EN 10219." }
    ],
    takeaway: "Un identico ingombro esterno non garantisce uguali raggi, massa nominale, proprietà di sezione o idoneità strutturale.",
    sources: [
      { label: "UNI EN 10210-1:2006", url: "https://store.uni.com/uni-en-10210-1-2006" },
      { label: "UNI EN 10210-2:2019", url: "https://store.uni.com/uni-en-10210-2-2019" },
      { label: "UNI EN 10219-1:2006", url: "https://store.uni.com/uni-en-10219-1-2006" },
      { label: "UNI EN 10219-2:2019", url: "https://store.uni.com/uni-en-10219-2-2019" }
    ],
    links: [
      { label: "Scheda EN 10210", href: "/knowledge/norme/en-10210" },
      { label: "Scheda EN 10219", href: "/knowledge/norme/en-10219" }
    ]
  },
  {
    id: "documenti-en-10204",
    title: "EN 10204: quali documenti richiedere?",
    subtitle: "Il tipo di documento va concordato nell'ordine e letto insieme alla norma di prodotto.",
    left: "Documento",
    right: "Significato operativo",
    rows: [
      { label: "2.1", left: "Dichiarazione di conformità all'ordine.", right: "Attestazione del produttore senza risultati di prove riportati nel documento." },
      { label: "2.2", left: "Rapporto di prova.", right: "Dichiarazione del produttore con risultati di controllo non specifico." },
      { label: "3.1", left: "Certificato di controllo 3.1.", right: "Risultati di controllo specifico, con validazione del rappresentante autorizzato del produttore indipendente dalla produzione." },
      { label: "3.2", left: "Certificato di controllo 3.2.", right: "Risultati di controllo specifico con validazione del rappresentante del produttore e di un rappresentante autorizzato dell'acquirente o ispettore previsto dalla regolamentazione." }
    ],
    takeaway: "Il certificato 3.1 non è, per definizione, un certificato emesso da un ente terzo. Il 3.2 non sostituisce una verifica progettuale o i requisiti specifici dell'ordine.",
    sources: [
      { label: "UNI EN 10204:2005 — in vigore", url: "https://store.uni.com/uni-en-10204-2005" },
      { label: "British Stainless Steel Association — documenti 2.1–3.2", url: "https://bssa.org.uk/bssa_articles/bsen-10204-test-certificates-for-stainless-steel-products/" }
    ],
    links: [
      { label: "Materiali e gradi", href: "/knowledge/gradi" },
      { label: "Norme di prodotto", href: "/knowledge/norme" }
    ]
  },
  {
    id: "saldato-vs-seamless",
    title: "Tubo saldato o senza saldatura?",
    subtitle: "Prima si individua la norma di prodotto, poi si qualifica la via produttiva.",
    left: "Saldato",
    right: "Senza saldatura",
    rows: [
      { label: "Partenza", left: "Nastro o lamiera formati e uniti con processo di saldatura qualificato per la famiglia di prodotto.", right: "Semilavorato pieno trasformato in corpo cavo mediante foratura e laminazione o altre operazioni idonee." },
      { label: "Tecnologie", left: "ERW/HFI e SAW sono famiglie differenti: il processo va descritto correttamente nell'ordine.", right: "Seamless non significa necessariamente trafilato a freddo: possono seguire lavorazioni e finiture differenti." },
      { label: "Specifiche di pressione", left: "Per esempio EN 10217-1 per categorie definite di tubi saldati a temperatura ambiente.", right: "Per esempio EN 10216-2 per tubi senza saldatura destinati a condizioni specificate a temperatura elevata." },
      { label: "Scelta", left: "Verificare impiego, processo, prove richieste, grado, dimensionali e disponibilità.", right: "Verificare gli stessi requisiti, senza presupporre superiorità universale o sostituibilità." }
    ],
    takeaway: "Un tubo saldato correttamente qualificato non è automaticamente meno idoneo: giudicare secondo requisiti tecnici, progetto e documentazione.",
    sources: [
      { label: "UNI EN 10217-1:2019", url: "https://store.uni.com/uni-en-10217-1-2019" },
      { label: "UNI EN 10216-2:2024", url: "https://store.uni.com/uni-en-10216-2-2024" }
    ],
    links: [
      { label: "Guida ai processi produttivi", href: "/knowledge/articoli/come-si-producono-tubi-acciaio" },
      { label: "Norma EN 10217-1", href: "/knowledge/norme/en-10217-1" }
    ]
  },
  {
    id: "tolleranze-peso-teorico",
    title: "Peso teorico, tolleranze e quantità",
    subtitle: "La massa calcolata aiuta il preventivo; non è un certificato di peso reale.",
    left: "Dato",
    right: "Da controllare",
    rows: [
      { label: "Dimensioni nominali", left: "Diametro o lati, spessore e lunghezza dichiarati.", right: "La norma e la relativa parte dimensionale stabiliscono i controlli e le tolleranze applicabili." },
      { label: "Massa lineare", left: "Un valore in kg/m ottenuto da sezione teorica e densità convenzionale.", right: "Raggi dei raccordi, geometria effettiva e criteri normativi possono cambiare il valore di riferimento." },
      { label: "Barre e tonnellate", left: "Numero barre × lunghezza nominale × kg/m teorici.", right: "Confrontare con misura e documentazione di fornitura; la quantità commerciale non implica massa certificata." }
    ],
    takeaway: "Nella richiesta d'offerta indicare sempre standard, grado, sezione, spessore, lunghezza, barre/metri e unità di prezzo. Non presentare kg/m teorici come massa verificata.",
    sources: [
      { label: "UNI EN 10210-2:2019", url: "https://store.uni.com/uni-en-10210-2-2019" },
      { label: "UNI EN 10219-2:2019", url: "https://store.uni.com/uni-en-10219-2-2019" }
    ],
    links: [
      { label: "Calcolatrice pesi", href: "/knowledge/tubes?source=school&surface=school_section#calcolatore-pesi" },
      { label: "Schede norme", href: "/knowledge/norme" }
    ]
  }
];

export const schoolGlossary = [
  { term: "Barra", category: "Quantità", definition: "Unità fisica di tubo o profilato, con lunghezza da specificare. Il numero delle barre non coincide con i metri totali.", href: "/knowledge/tubes" },
  { term: "CHS", category: "Geometria", definition: "Circular Hollow Section: profilato cavo a sezione circolare.", href: "/knowledge/tubes" },
  { term: "Colata", category: "Tracciabilità", definition: "Lotto metallurgico identificato dal produttore; il riferimento di colata può consentire il collegamento tra materiale, risultati di prova e documenti.", href: "/knowledge/articoli/confronti-glossario#documenti-en-10204" },
  { term: "EN 10204", category: "Documenti", definition: "Norma sui tipi di documenti di controllo dei prodotti metallici. Non definisce da sola grado, tolleranze o idoneità all'uso.", href: "/knowledge/articoli/confronti-glossario#documenti-en-10204" },
  { term: "ERW / HFI", category: "Produzione", definition: "Famiglia di tubi saldati elettricamente; HFI indica una tecnologia ad alta frequenza. La specifica deve individuare il processo realmente richiesto.", href: "/knowledge/articoli/come-si-producono-tubi-acciaio" },
  { term: "kg/m", category: "Quantità", definition: "Chilogrammi per metro: massa lineare. Il valore teorico va distinto da quello effettivamente misurato o documentato.", href: "/knowledge/tubes" },
  { term: "Massa teorica", category: "Quantità", definition: "Stima ricavata da geometria nominale, criterio di sezione e densità assunta; non è il peso verificato di una fornitura.", href: "/knowledge/articoli/confronti-glossario#tolleranze-peso-teorico" },
  { term: "RHS", category: "Geometria", definition: "Rectangular Hollow Section: profilato cavo a sezione rettangolare.", href: "/knowledge/tubes" },
  { term: "SAW", category: "Produzione", definition: "Submerged Arc Welding: saldatura ad arco sommerso, usata tra l'altro in tubi con saldature longitudinali o elicoidali.", href: "/knowledge/articoli/come-si-producono-tubi-acciaio" },
  { term: "Seamless", category: "Produzione", definition: "Tubo senza saldatura longitudinale, ottenuto da un semilavorato pieno. Non indica da solo una classe di qualità superiore.", href: "/knowledge/articoli/come-si-producono-tubi-acciaio" },
  { term: "SHS", category: "Geometria", definition: "Square Hollow Section: profilato cavo a sezione quadrata.", href: "/knowledge/tubes" },
  { term: "Tolleranza", category: "Dimensioni", definition: "Scostamento consentito rispetto al valore nominale secondo condizioni stabilite nella norma pertinente; non è intercambiabile tra famiglie di prodotti.", href: "/knowledge/articoli/confronti-glossario#tolleranze-peso-teorico" },
  { term: "TR1 / TR2", category: "Materiali", definition: "Designazioni di qualità utilizzate in specifiche di tubi per pressione, per esempio EN 10217-1. Il significato e i requisiti dipendono dalla parte applicabile.", href: "/knowledge/norme/en-10217-1" },
  { term: "Certificato 3.1", category: "Documenti", definition: "Documento EN 10204 con risultati di controllo specifico e validazione del rappresentante autorizzato del produttore indipendente dalla fabbricazione.", href: "/knowledge/articoli/confronti-glossario#documenti-en-10204" },
  { term: "Certificato 3.2", category: "Documenti", definition: "Documento EN 10204 con controllo specifico e validazione anche della rappresentanza autorizzata dell'acquirente o dell'ispettore previsto dalle regole.", href: "/knowledge/articoli/confronti-glossario#documenti-en-10204" },
  { term: "Tracciabilità", category: "Documenti", definition: "Capacità di collegare prodotto, identificazione, documenti e risultati di controllo lungo la catena di fornitura; va verificata sulla merce reale.", href: "/knowledge/articoli/confronti-glossario#documenti-en-10204" }
];

export function getSchoolComparison(id) {
  return typeof id === "string" ? schoolComparisons.find(item => item.id === id) ?? null : null;
}

export function getSchoolGlossaryEntry(term) {
  return typeof term === "string" ? schoolGlossary.find(item => item.term === term) ?? null : null;
}
