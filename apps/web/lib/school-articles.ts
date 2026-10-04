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

export type SchoolArticleProcessStep = {
  title: string;
  text: string;
};

export type SchoolArticleProcessFlow = {
  title: string;
  subtitle: string;
  steps: SchoolArticleProcessStep[];
};

export type SchoolArticleComparisonRow = {
  label: string;
  welded: string;
  seamless: string;
};

export type SchoolArticleRelatedLink = {
  label: string;
  href: string;
  note: string;
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
  processFlows?: SchoolArticleProcessFlow[];
  comparison?: SchoolArticleComparisonRow[];
  relatedLinks?: SchoolArticleRelatedLink[];
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
  },,
  {
    slug: "come-si-producono-tubi-acciaio",
    category: "Tecnologia",
    title: "Come si producono i tubi d’acciaio? Saldati, seamless e trafilati a freddo",
    description:
      "Dal coil al tubo HFI/ERW, dalla lamiera ai grandi diametri SAW, dal pieno al seamless e dalla madre tubo al cold drawn: processi, differenze e norme da conoscere.",
    lead:
      "Un tubo può partire da un nastro, da una lamiera o da un pieno d’acciaio. Il processo produttivo influenza geometria, tolleranze, gamma dimensionale e applicazioni, ma non esiste una gerarchia semplice in cui “seamless è sempre migliore” o “saldato è sempre meno sicuro”: conta la norma applicabile e la prestazione richiesta.",
    publishedAt: "2026-10-04",
    lastReviewedAt: "2026-10-04",
    readMinutes: 10,
    processFlows: [
      {
        title: "HFI / ERW — dal coil al tubo saldato longitudinale",
        subtitle:
          "La famiglia ERW usa il riscaldamento elettrico dei lembi; HFI è una delle varianti moderne ad alta frequenza più diffuse nelle linee continue.",
        steps: [
          {
            title: "Coil e preparazione",
            text:
              "Il nastro d’acciaio laminato viene svolto, spianato e preparato per una linea continua. Le caratteristiche del coil sono parte integrante delle prestazioni finali del tubo.",
          },
          {
            title: "Formatura",
            text:
              "Una successione di rulli curva progressivamente il nastro fino a creare un tubo aperto con i due lembi longitudinali ravvicinati.",
          },
          {
            title: "Riscaldamento dei lembi",
            text:
              "Nel processo HFI una corrente ad alta frequenza riscalda in modo localizzato i bordi. Nelle tecnologie ERW la saldatura appartiene alla famiglia della resistenza elettrica.",
          },
          {
            title: "Saldatura a pressione",
            text:
              "I rulli di pressione uniscono i lembi senza necessità di un cordone continuo di materiale d’apporto; l’eccesso di materiale della saldatura viene rimosso internamente e/o esternamente secondo il prodotto.",
          },
          {
            title: "Trattamento e calibrazione",
            text:
              "La zona di saldatura può essere sottoposta a trattamento termico dedicato; seguono calibratura, raddrizzatura, taglio e le verifiche richieste dalla specifica.",
          },
        ],
      },
      {
        title: "SAW — grandi diametri con saldatura ad arco sommerso",
        subtitle:
          "LSAW usa una saldatura longitudinale; HSAW/SAWH usa una linea elicoidale. Sono processi tipici per line pipe di diametro e spessore maggiori.",
        steps: [
          {
            title: "Lamiera o coil",
            text:
              "Il materiale di partenza può essere una lamiera pesante per LSAW oppure un coil largo per HSAW/SAWH.",
          },
          {
            title: "Formatura",
            text:
              "Nelle linee longitudinali la lamiera viene piegata fino alla forma cilindrica; nelle linee elicoidali il nastro viene avvolto con un angolo controllato.",
          },
          {
            title: "Pre-saldatura",
            text:
              "La geometria viene stabilizzata con tack welding o altra pre-unione prima della saldatura principale.",
          },
          {
            title: "Submerged Arc Welding",
            text:
              "L’arco elettrico opera sotto uno strato di flusso; il cordone può essere eseguito internamente ed esternamente con materiale d’apporto.",
          },
          {
            title: "Espansione, finitura e controlli",
            text:
              "A seconda della linea seguono espansione/calibrazione, smussatura, prove non distruttive, prova idraulica e controlli dimensionali.",
          },
        ],
      },
      {
        title: "Seamless — dal pieno al corpo cavo",
        subtitle:
          "Il tubo senza saldatura nasce da una billetta piena riscaldata e perforata; la parete viene poi ridotta e calibrata con successive operazioni di laminazione.",
        steps: [
          {
            title: "Billetta piena",
            text:
              "Una barra o billetta cilindrica viene tagliata e riscaldata alla temperatura richiesta per la deformazione a caldo.",
          },
          {
            title: "Rotary piercing",
            text:
              "Rulli inclinati fanno ruotare e avanzare il pieno; le tensioni interne consentono al plug di creare un hollow a parete molto spessa.",
          },
          {
            title: "Allungamento / mandrel mill",
            text:
              "Il corpo cavo viene laminato su mandrino per aumentare la lunghezza e ridurre progressivamente lo spessore di parete.",
          },
          {
            title: "Sizing o stretch reducing",
            text:
              "Ulteriori gabbie definiscono diametro esterno e spessore finale, entro il campo produttivo della linea.",
          },
          {
            title: "Trattamento e finishing",
            text:
              "Raffreddamento, eventuale trattamento termico, raddrizzatura, taglio, lavorazione estremità e collaudi completano il ciclo.",
          },
        ],
      },
      {
        title: "Cold drawn — quando serve più precisione",
        subtitle:
          "La trafilatura a freddo è una lavorazione successiva: la madre tubo può essere seamless oppure saldata.",
        steps: [
          {
            title: "Madre tubo",
            text:
              "Il processo parte da un tubo già esistente, seamless o saldato, selezionato con una geometria adatta alla riduzione successiva.",
          },
          {
            title: "Preparazione superficiale",
            text:
              "Decapaggio, pulizia e lubrificazione preparano la superficie e riducono l’attrito durante la deformazione.",
          },
          {
            title: "Trafila e mandrino",
            text:
              "Il tubo viene tirato attraverso una matrice e, quando previsto, sopra un mandrino: diametro e spessore vengono ridotti in modo controllato.",
          },
          {
            title: "Cicli intermedi",
            text:
              "Per forti riduzioni possono essere necessari più passaggi con trattamenti termici intermedi per ripristinare la lavorabilità.",
          },
          {
            title: "Finitura di precisione",
            text:
              "Trattamento finale, raddrizzatura, taglio e controllo dimensionale portano a tolleranze più strette e superfici più regolari.",
          },
        ],
      },
    ],
    comparison: [
      {
        label: "Materiale di partenza",
        welded: "Coil o lamiera che viene formata e saldata.",
        seamless: "Billetta/barra piena riscaldata e perforata.",
      },
      {
        label: "Presenza di una giunzione longitudinale",
        welded: "Sì, con tecnologia e controlli definiti dalla specifica.",
        seamless: "No: la parete nasce dalla deformazione del pieno.",
      },
      {
        label: "Gamma e produttività",
        welded: "Molto efficiente nelle produzioni continue; ampia gamma da precisione a grandi diametri.",
        seamless: "Processo più articolato; molto usato per pressione, energia, meccanica e OCTG.",
      },
      {
        label: "Tolleranze e finitura",
        welded: "Dipendono dal processo e possono essere ulteriormente migliorate con sizing o cold drawing.",
        seamless: "Dipendono dalla laminazione; anche il seamless può essere cold drawn quando serve maggiore precisione.",
      },
      {
        label: "Regola di scelta",
        welded: "Si sceglie se norma, dimensione, prestazione e processo qualificato lo rendono appropriato.",
        seamless: "Si sceglie quando norma/applicazione richiedono o valorizzano l’assenza della saldatura e la relativa route produttiva.",
      },
    ],
    relatedLinks: [
      {
        label: "EN 10216 — tubi seamless per pressione",
        href: "/knowledge/norme?q=EN%2010216",
        note: "Parti dedicate ai tubi senza saldatura per impieghi a pressione.",
      },
      {
        label: "EN 10217 — tubi saldati per pressione",
        href: "/knowledge/norme?q=EN%2010217",
        note: "Famiglia per tubi saldati, inclusi electric welded e submerged arc welded secondo la parte applicabile.",
      },
      {
        label: "EN 10219 — profilati cavi saldati formati a freddo",
        href: "/knowledge/norme?q=EN%2010219",
        note: "Riferimento chiave per molti hollow sections strutturali cold formed welded.",
      },
      {
        label: "EN 10210 — profilati cavi finiti a caldo",
        href: "/knowledge/norme?q=EN%2010210",
        note: "La famiglia comprende hollow sections hot-finished seamless e welded secondo la parte applicabile.",
      },
      {
        label: "EN 10305 — tubi di precisione",
        href: "/knowledge/norme?q=EN%2010305",
        note: "Famiglia utile per comprendere seamless e welded precision tubes, inclusi prodotti cold drawn.",
      },
      {
        label: "Pesi & dimensioni",
        href: "/knowledge/tubes",
        note: "Confronta pesi pubblicati e calcoli teorici dopo aver identificato la famiglia di prodotto.",
      },
    ],
    sections: [
      {
        heading: "Saldato non significa semplicemente “tubo con una cucitura”",
        paragraphs: [
          "La parola saldato copre processi molto diversi. Un piccolo tubo ERW/HFI prodotto in continuo da coil non segue la stessa route di un grande line pipe LSAW ricavato da lamiera pesante. Cambiano il materiale di partenza, la formatura, il metodo di saldatura, la produttività, il campo dimensionale e i controlli.",
          "Nel moderno HFI, il nastro viene formato a tubo aperto, i lembi vengono riscaldati ad alta frequenza e uniti sotto pressione. Mannesmann Line Pipe descrive poi rimozione del weld upset e trattamento termico della zona saldata per avvicinarne le caratteristiche a quelle del materiale base.",
        ],
      },
      {
        heading: "ERW e HFI: perché i due termini vengono spesso affiancati",
        paragraphs: [
          "ERW indica in senso ampio la saldatura per resistenza elettrica. HFI, high-frequency induction welding, identifica una soluzione ad alta frequenza in cui l’energia viene accoppiata ai lembi per induzione. Nel linguaggio commerciale le sigle possono comparire insieme, ma non sono sinonimi perfetti: HFI descrive una specifica modalità della famiglia dei processi electric-resistance/high-frequency.",
          "Il punto importante per chi compra non è il nome abbreviato da solo, ma la combinazione tra norma, qualifica del processo, materia prima, trattamento della saldatura, NDT, hydrotest e requisiti dimensionali.",
        ],
      },
      {
        heading: "SAW: quando diametro e spessore cambiano il processo",
        paragraphs: [
          "Per grandi line pipe si usano frequentemente processi di submerged arc welding. Nel LSAW la giunzione è longitudinale; nel HSAW/SAWH è elicoidale. Corinth Pipeworks documenta, ad esempio, un processo SAWH in due fasi con formatura/pre-saldatura continua e successiva doppia saldatura ad arco sommerso.",
          "Questi processi usano materiale d’apporto e flusso e consentono di coprire campi dimensionali che sarebbero poco naturali per una classica linea HFI da coil.",
        ],
      },
      {
        heading: "Seamless: il cuore è la perforazione del pieno",
        paragraphs: [
          "Nel seamless non si elimina una saldatura dopo aver formato un nastro: si parte da un pieno e si crea direttamente un corpo cavo. Tenaris descrive il piercing come la trasformazione della barra calda in un hollow mediante due rulli inclinati e un plug; il mandrel mill riduce poi lo spessore fino alla geometria richiesta.",
          "Il processo continua con sizing o stretch reducing, trattamento termico quando previsto, finishing e collaudo. Anche un tubo seamless può quindi attraversare numerose trasformazioni prima di diventare prodotto finito.",
        ],
      },
      {
        heading: "Cold drawn: non è il contrario di welded",
        paragraphs: [
          "La trafilatura a freddo è una fase di precisione, non una categoria alternativa a welded/seamless. Una madre tubo può essere seamless oppure saldata e successivamente trafilata.",
          "ArcelorMittal descrive il cold drawing su mandrino e matrice per ridurre diametro e parete; voestalpine commercializza sia seamless cold drawn secondo EN 10305-1 sia welded cold drawn secondo EN 10305-2. È quindi più corretto pensare a due assi distinti: come nasce il tubo e come viene successivamente finito.",
        ],
      },
      {
        heading: "Quindi: saldato o seamless?",
        paragraphs: [
          "La risposta corretta non è assoluta. Per molte applicazioni un tubo saldato qualificato è esattamente il prodotto previsto dalla norma; in altre applicazioni la route seamless è richiesta o preferita per campo di pressione, temperatura, geometria o servizio.",
          "La scelta tecnica dovrebbe partire da norma di prodotto, grado, dimensione, stato di fornitura, tolleranze, prove e requisiti del progetto. Il processo produttivo è una variabile fondamentale, ma non sostituisce la specifica.",
        ],
        bullets: [
          "Prima identifica la norma e la parte applicabile.",
          "Poi verifica se il processo ammesso è welded, seamless o entrambi.",
          "Controlla grado, stato di fornitura e trattamento termico.",
          "Verifica NDT, hydrotest, tolleranze e certificazione richiesta.",
        ],
      },
    ],
    sources: [
      {
        label: "Mannesmann Line Pipe — HFI welded steel pipe",
        url: "https://magazin.mannesmann-linepipe.com/en/2020/coverstory/multi-talented-hfi-welded-steel-pipe/",
        note: "Formatura da strip, HFI pressure welding, rimozione del weld upset e trattamento termico della saldatura.",
      },
      {
        label: "Tenaris — Dalmine seamless manufacturing specification",
        url: "https://www.tenaris.com/media/uhphcpjn/epd-offshore-and-onshore-seamless-line-pipe-solutions_dalmine.pdf",
        note: "Rotary piercing del pieno, mandrel rolling e sizing nel processo seamless.",
      },
      {
        label: "Corinth Pipeworks — SAWH pipe mill",
        url: "https://www.cpw.gr/en/facilities/thisvi-plant/production/sawh-pipe-mill/",
        note: "Formatura/pre-saldatura e doppia submerged arc welding per tubi elicoidali di grande diametro.",
      },
      {
        label: "Corinth Pipeworks — LSAW pipe mill",
        url: "https://www.cpw.gr/facilities/thisvi-plant/production/lsaw-pipe-mill/",
        note: "LSAW/JCOE da lamiera per grandi diametri e forti spessori.",
      },
      {
        label: "ArcelorMittal — cold drawn seamless process",
        url: "https://northamerica.arcelormittal.com/products/tubular-products/cold-drawn-seamless",
        note: "Trafila su mandrino e matrice, trattamenti successivi, tolleranze e finitura.",
      },
      {
        label: "voestalpine Rotec — EN 10305-2 welded cold drawn",
        url: "https://www.voestalpine.com/rotec/en/products-and-services/Welded-cold-drawn-precision-steel-tubes-in-acc.-with-EN-10305-2/",
        note: "Esempio di tubo saldato successivamente trafilato a freddo per applicazioni di precisione.",
      },
      {
        label: "UNI — EN 10216-1",
        url: "https://store.uni.com/en/uni-en-10216-1-2014",
        note: "Famiglia seamless per impieghi a pressione: condizioni tecniche di fornitura della parte 1.",
      },
      {
        label: "UNI — EN 10217-1",
        url: "https://store.uni.com/en/uni-en-10217-1-2019",
        note: "Famiglia welded per pressione: electric welded e submerged arc welded nella parte 1.",
      },
      {
        label: "UNI — EN 10219-1",
        url: "https://store.uni.com/en/uni-en-10219-1-2006",
        note: "Profilati cavi strutturali saldati formati a freddo.",
      },
      {
        label: "UNI — EN 10210-1",
        url: "https://webstore.uni.com/en/uni-en-10210-1-2006",
        note: "Profilati cavi strutturali finiti a caldo; la famiglia comprende route seamless e welded secondo il prodotto.",
      },
    ],
  },

];

export function getSchoolArticle(slug: string) {
  return schoolArticles.find((article) => article.slug === slug) ?? null;
}
