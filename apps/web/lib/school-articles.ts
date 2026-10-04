export type SchoolArticleSource = {
  label: string;
  url: string;
  note: string;
};

export type SchoolArticleTimelineItem = {
  year: string;
  title: string;
  text: string;
};

export type SchoolArticleSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type SchoolArticle = {
  slug: string;
  category: "Storia" | "Industria" | "Tecnologia";
  title: string;
  description: string;
  lead: string;
  publishedAt: string;
  lastReviewedAt: string;
  readMinutes: number;
  timeline?: SchoolArticleTimelineItem[];
  sections: SchoolArticleSection[];
  sources: SchoolArticleSource[];
};

export const schoolArticles: SchoolArticle[] = [
  {
    slug: "storia-tubi-acciaio",
    category: "Storia",
    title: "Quando sono nati i tubi? Dalle condotte antiche al tubo d’acciaio moderno",
    description:
      "Perché l’uomo ha iniziato a usare tubi, dove nasce il tubo d’acciaio industriale e come acqua, gas, vapore e meccanica hanno accelerato la sua evoluzione.",
    lead:
      "Il tubo non nasce in un solo momento. Le condotte sono antiche quanto il bisogno di spostare acqua, ma il tubo d’acciaio moderno è figlio dell’industrializzazione europea dell’Ottocento e di un salto tecnologico decisivo: la laminazione del tubo senza saldatura.",
    publishedAt: "2026-10-04",
    lastReviewedAt: "2026-10-04",
    readMinutes: 7,
    timeline: [
      {
        year: "Antichità",
        title: "Portare acqua dove serve",
        text:
          "Pietra, terracotta, legno e piombo vengono usati per creare condotte. A Pergamo, in età ellenistica, esistevano anche linee in pressione con tubi di piombo.",
      },
      {
        year: "1845",
        title: "La produzione industriale saldata",
        text:
          "In Germania Albert Poensgen avvia a Mauel un laminatoio per tubi longitudinalmente saldati in ferro battuto, in un mercato spinto soprattutto dalla crescita delle reti del gas.",
      },
      {
        year: "1885–1886",
        title: "Il tubo d’acciaio senza saldatura",
        text:
          "A Remscheid, Reinhard e Max Mannesmann brevettano il primo processo di laminazione per tubi senza saldatura; nel 1886 viene laminato il primo tubo.",
      },
      {
        year: "1890s",
        title: "Il processo diventa industriale",
        text:
          "Il successivo sviluppo del pilger rolling rende il processo Mannesmann realmente competitivo e apre nuove applicazioni in piping, macchine e veicoli.",
      },
    ],
    sections: [
      {
        heading: "Prima dell’acciaio: il problema viene prima del prodotto",
        paragraphs: [
          "La necessità fondamentale è semplice: trasferire un fluido da un punto a un altro in modo controllato. Acqua potabile, irrigazione e scarichi hanno quindi prodotto sistemi di condotte molto prima della siderurgia moderna.",
          "Il principio tecnico del tubo — una parete che contiene e guida un fluido — precede di secoli il tubo metallico industriale. Con l’aumento delle pressioni e delle distanze, però, materiali e giunzioni diventano il limite del sistema.",
        ],
      },
      {
        heading: "L’Ottocento: gas, vapore e città chiedono più tubi",
        paragraphs: [
          "Con la rivoluzione industriale crescono le reti urbane del gas, gli impianti idrici, le macchine a vapore e le caldaie. Servono quantità maggiori di tubi, diametri più piccoli per le derivazioni e soprattutto prodotti più regolari e affidabili di quelli ottenuti con tecniche artigianali.",
          "I tubi saldati in ferro e poi in acciaio rispondono per primi alla domanda di scala. Ma le saldature dell’epoca diventano un punto critico quando aumentano pressione, temperatura e requisiti di sicurezza.",
        ],
        bullets: [
          "Distribuzione di acqua e gas nelle città.",
          "Caldaie e linee di vapore.",
          "Macchine industriali e mezzi di trasporto.",
          "Prime pipeline a lunga distanza.",
        ],
      },
      {
        heading: "Remscheid, 1885: la svolta Mannesmann",
        paragraphs: [
          "Il passaggio simbolico al tubo d’acciaio moderno avviene in Germania. Reinhard e Max Mannesmann sviluppano nella fabbrica di lime del padre a Remscheid un processo capace di trasformare un pieno d’acciaio in un corpo cavo mediante laminazione.",
          "La domanda di brevetto viene depositata nel 1885 e il brevetto è concesso nel 1886, anno in cui viene laminato il primo tubo senza saldatura. Negli anni Novanta dell’Ottocento il pilger rolling completa il salto verso una produzione economicamente industriale.",
        ],
      },
      {
        heading: "Perché il seamless cambia il mercato",
        paragraphs: [
          "Eliminare la saldatura longitudinale permette di affrontare applicazioni in cui integrità, pressione e sollecitazioni sono decisive. Il tubo diventa così non soltanto una condotta, ma anche un componente strutturale e meccanico.",
          "Da qui si sviluppano famiglie sempre più specializzate: line pipe, boiler tubes, tubi meccanici, OCTG, precision tubes e, parallelamente, processi saldati sempre più affidabili come ERW/HFI e SAW.",
        ],
      },
    ],
    sources: [
      {
        label: "Salzgitter AG — Mannesmann history",
        url: "https://geschichte.salzgitter-ag.com/en/history-of-the-business-units-and-sites/steel-processing-business-unit/it-began-with-a-revolutionary-invention.html",
        note: "Brevetto 1885, primo tubo seamless 1886, sviluppo del pilger rolling e nascita a Remscheid.",
      },
      {
        label: "Salzgitter AG — Mannesmann Line Pipe history",
        url: "https://geschichte.salzgitter-ag.com/en/history-of-the-business-units-and-sites/steel-processing-business-unit/mannesmann-line-pipe-gmbh.html",
        note: "Evoluzione dei tubi saldati, applicazioni per acqua e pipeline.",
      },
      {
        label: "Mannesmann — HFI Global historical review",
        url: "https://www.mannesmann.com/fileadmin/footage/MEDIA/gesellschaften/mannesmann/documents/mlp/HFI_Global_02_en_Web.pdf",
        note: "Crescita della domanda di gas pipes e produzione saldata industriale nell’Ottocento.",
      },
      {
        label: "The Metropolitan Museum of Art — Pergamon",
        url: "https://resources.metmuseum.org/resources/metpublications/pdf/Pergamon_and_the_Hellenistic_Kingdoms_of_the_Ancient_World.pdf",
        note: "Esempio documentato di condotte antiche in pressione e tubi di piombo.",
      },
    ],
  },
  {
    slug: "produttori-tubi-europa",
    category: "Industria",
    title: "Chi produce tubi in Europa? Una mappa dei principali gruppi industriali",
    description:
      "Panoramica non esaustiva dei gruppi che producono tubi d’acciaio in Europa, con distinzione tra seamless, saldati, precisione e specialità.",
    lead:
      "Il mercato europeo dei tubi non è un blocco unico: cambia radicalmente tra tubi strutturali, line pipe, seamless per pressione, precisione automotive e inox. Questa guida parte dai produttori con presenza industriale verificabile e fonti pubbliche aggiornate.",
    publishedAt: "2026-10-04",
    lastReviewedAt: "2026-10-04",
    readMinutes: 8,
    sections: [
      {
        heading: "Come leggere la mappa",
        paragraphs: [
          "Essere un grande produttore di acciaio non significa necessariamente produrre ogni famiglia di tubo. Per questo la lista è organizzata per presenza industriale e specializzazione, non come classifica per fatturato o capacità.",
          "La selezione è volutamente non esaustiva e viene revisionata nel tempo. Per acquisti e qualifica fornitori fanno sempre fede gamma, certificazioni, stabilimenti e disponibilità dichiarate dal produttore.",
        ],
      },
      {
        heading: "ArcelorMittal Tubular Products Europe",
        paragraphs: [
          "ArcelorMittal descrive la propria divisione Tubular Products Europe come un produttore paneuropeo con attività manifatturiere in sei paesi e 15 mills. La gamma copre tubi seamless e saldati, precision tubes e prodotti per costruzioni, energia, engineering e automotive.",
        ],
      },
      {
        heading: "Tenaris / Dalmine e Silcotub",
        paragraphs: [
          "Tenaris mantiene un’importante base produttiva europea. In Italia il sito di Dalmine produce tubi seamless, affiancato da Costa Volpino e Arcore; in Romania il gruppo opera il tubificio seamless TenarisSilcotub di Zalău.",
          "Nel 2026 Tenaris ha inoltre annunciato l’accordo per acquisire Artrom Steel Tubes in Romania: alla data di revisione dell’articolo l’operazione è annunciata ma soggetta alle autorizzazioni previste, quindi non viene trattata come acquisizione già completata.",
        ],
      },
      {
        heading: "Mannesmann / Salzgitter",
        paragraphs: [
          "Il gruppo Salzgitter riunisce nella Steel Processing Business Unit diverse attività tubi con il marchio Mannesmann. La divisione serve prodotti seamless e saldati e mantiene stabilimenti in Europa e Nord America.",
        ],
      },
      {
        heading: "voestalpine Tubulars",
        paragraphs: [
          "A Kindberg, in Austria, voestalpine Tubulars produce tubi seamless ad alta tecnologia. Il sito dichiara diametri esterni da 26,70 a 203,20 mm e una capacità massima di circa 420.000 tonnellate annue.",
        ],
      },
      {
        heading: "Marcegaglia",
        paragraphs: [
          "Marcegaglia opera una vasta divisione tubi saldati al carbonio e una presenza importante nell’inox. Il gruppo identifica Gazoldo degli Ippoliti come riferimento della tube division e Forlì come sito chiave per i tubi saldati in acciaio inossidabile.",
        ],
      },
      {
        heading: "Perché una lista di produttori non basta",
        paragraphs: [
          "Per un buyer il nome del gruppo è solo il primo filtro. Occorre poi distinguere processo produttivo, norma, grado, diametro, spessore, lunghezza, tolleranze, certificazioni, testing e stabilimento qualificato.",
          "Nella Scuola questa pagina resta un contenuto editoriale pubblico. Il Network Smart Steel Sales rimane invece il prodotto privato dove potranno vivere filtri, relazioni commerciali ed enrichment aziendale.",
        ],
      },
    ],
    sources: [
      {
        label: "ArcelorMittal Europe — Our Company",
        url: "https://tubulareurope.arcelormittal.com/about-us/our-company",
        note: "15 mills in Europe, manufacturing in six countries and product scope.",
      },
      {
        label: "Tenaris — Around the world",
        url: "https://www.tenaris.com/en/contact/tenaris-around-the-world",
        note: "European manufacturing centers including Dalmine, Arcore, Costa Volpino and Zalău.",
      },
      {
        label: "Tenaris — announced Artrom acquisition (2026)",
        url: "https://www.tenaris.com/en/news/2026/tenaris-to-acquire-artrom-steel-tubes-sa",
        note: "Announced transaction and disclosed Romanian capacities; subject to regulatory approvals at review date.",
      },
      {
        label: "Salzgitter AG — Steel Processing Business Unit",
        url: "https://www.salzgitter-ag.com/en/company/business-units/steel-processing.html",
        note: "Mannesmann tube activities and seamless/welded European footprint.",
      },
      {
        label: "voestalpine Tubulars — Production",
        url: "https://www.voestalpine.com/tubulars/en/company/production/",
        note: "Kindberg seamless production range and stated capacity.",
      },
      {
        label: "Marcegaglia — Plants / Tube division",
        url: "https://www.plants.marcegaglia.com/Categoria%20Stabilimento/headquarters/",
        note: "Tube division and European production sites.",
      },
    ],
  },
];

export function getSchoolArticle(slug: string) {
  return schoolArticles.find((article) => article.slug === slug) ?? null;
}
