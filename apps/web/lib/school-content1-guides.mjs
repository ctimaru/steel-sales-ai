/**
 * SCHOOL-CONTENT1.A/B — small editorial overlay on already-published K2 pages.
 * Not a normative database, grade equivalence engine or permission bypass.
 * Verify official editions and manufacturer documentation before real orders.
 */
const reviewDate = "2026-11-02";

const guides = {
  standard: {
    "en-10219": {
      heading: "EN 10219: cosa controllare prima dell’ordine",
      takeaway: "La famiglia EN 10219 riguarda profilati cavi strutturali saldati formati a freddo. Condizioni di fornitura e tolleranze dimensionali sono trattate in parti distinte: non basta indicare «S355» e una misura.",
      checks: [
        "Indicare norma e parte, grado completo (ad esempio S355J2H), forma, dimensioni e lunghezza.",
        "Verificare tolleranze e proprietà di sezione con la parte 2 dell’edizione applicabile, non con un disegno generico.",
        "Concordare documenti di controllo, marcatura ed eventuali requisiti di progetto prima della conferma."
      ],
      editionNote: "UNI riporta UNI EN 10219-1:2006 in vigore in Italia alla verifica del 2 novembre 2026. Esistono lavori di revisione prEN 10219-1:2026: una bozza non è automaticamente la norma vigente in Italia.",
      compare: { label: "Confronta con EN 10210 (finiti a caldo)", href: "/knowledge/norme/en-10210" },
      sources: [
        { label: "UNI — EN 10219-1:2006", url: "https://store.uni.com/uni-en-10219-1-2006" },
        { label: "DIN — pubblicazioni e progetti 10219", url: "https://www.din.de/en/getting-involved/standards-committees/fes/european-committees/68242/wdc-grem%3Adin21%3A148579350%21search-grem-details?masking=true" }
      ]
    },
    "en-10210": {
      heading: "EN 10210: la condizione di fornitura conta",
      takeaway: "La famiglia EN 10210 riguarda profilati cavi strutturali finiti a caldo. Il processo può includere formatura a caldo o formatura a freddo seguita da trattamento idoneo: non equivale semplicemente a «tubo senza saldatura».",
      checks: [
        "Precisare norma, parte, grado completo e condizione di prodotto richiesta.",
        "Per confrontare kg/m, sezioni e tolleranze con EN 10219 usare le rispettive parti 2: i valori non sono automaticamente intercambiabili.",
        "Richiedere conferma delle condizioni di prova, dei documenti e dei vincoli strutturali applicabili."
      ],
      editionNote: "UNI riporta UNI EN 10210-1:2006 in vigore in Italia alla verifica del 2 novembre 2026. Il progetto prEN 10210-1:2026 non va descritto come edizione UNI già recepita.",
      compare: { label: "Confronta con EN 10219 (formati a freddo)", href: "/knowledge/norme/en-10219" },
      sources: [
        { label: "UNI — EN 10210-1:2006", url: "https://store.uni.com/uni-en-10210-1-2006" },
        { label: "DIN — pubblicazioni e progetti 10210", url: "https://www.din.de/en/getting-involved/standards-committees/fes/european-committees/68242/wdc-grem%3Adin21%3A148579350%21search-grem-details?masking=true" }
      ]
    },
    "en-10217-1": {
      heading: "EN 10217-1: identificare la categoria corretta",
      takeaway: "Questa parte riguarda tubi circolari saldati per impieghi a pressione, in acciaio non legato, con proprietà specificate a temperatura ambiente. La destinazione d’uso non dimostra da sola l’idoneità di un componente in pressione.",
      checks: [
        "Verificare che siano richieste le proprietà a temperatura ambiente e la parte 1, non una parte per temperature elevate.",
        "Precisare qualità TR1 o TR2 con grado completo e categoria di prova/documentazione previsti.",
        "Demandare a progettista e fabbricante la verifica dei requisiti PED per l’apparecchiatura specifica."
      ],
      editionNote: "La scheda UNI EN 10217-1:2019 indica lo stato «in vigore» alla verifica del 2 novembre 2026. La conformità del materiale non equivale alla conformità dell’attrezzatura in pressione.",
      compare: { label: "Consulta i gradi per pressione", href: "/knowledge/gradi" },
      sources: [
        { label: "UNI — EN 10217-1:2019", url: "https://store.uni.com/en/uni-en-10217-1-2019" }
      ]
    }
  },
  grade: {
    "s355j2h": {
      heading: "S355J2H: la designazione non basta",
      takeaway: "S355J2H identifica un grado per profilati cavi strutturali; sigla, processo e norma di prodotto vanno letti insieme. Non basta la resistenza nominale per dichiarare equivalenza con altri S355.",
      checks: [
        "Specificare EN 10219 o EN 10210 con edizione e parte richieste; non sostituire una famiglia all’altra senza verifica.",
        "Controllare requisiti di tenacità, spessori e stato di fornitura sul riferimento applicabile.",
        "Confrontare la geometria e le proprietà di sezione effettivamente dichiarate dal produttore."
      ],
      editionNote: "Guida alla designazione; i valori meccanici dipendono da norma, spessore e condizioni di fornitura. Nessuna equivalenza automatica con S355NH.",
      compare: { label: "Confronta con S355NH", href: "/knowledge/gradi/s355nh" },
      sources: [
        { label: "UNI — EN 10219-1", url: "https://store.uni.com/uni-en-10219-1-2006" },
        { label: "Morandi — gamma e designazioni EN 10210", url: "https://www.morandispa.it/en/products/structural-hollow-sections/structural-hollow-section-en-10210/" }
      ]
    },
    "s355nh": {
      heading: "S355NH: attenzione alla condizione normalizzata",
      takeaway: "S355NH è una designazione di acciaio a grano fine per profilati cavi strutturali. La condizione normalizzata è rilevante: non trattare «NH» e «J2H» come sigle identiche.",
      checks: [
        "Controllare norma e condizione di fornitura, non soltanto il livello S355.",
        "Per saldature e impieghi specifici verificare la documentazione tecnica del produttore e il progetto.",
        "In caso di sostituzione, confrontare requisiti meccanici, tenacità, spessori e certificati."
      ],
      editionNote: "Le informazioni di produttore sono esempi commerciali, non una certificazione generale né prova di equivalenza fra gradi.",
      compare: { label: "Confronta con S355J2H", href: "/knowledge/gradi/s355j2h" },
      sources: [
        { label: "UNI — EN 10210-1", url: "https://store.uni.com/uni-en-10210-1-2006" },
        { label: "Tata Steel — Celsius S355NH", url: "https://www.tatasteeluk.com/en-US/construction/products/tube/structural-hollow-sections/celsius" }
      ]
    },
    "p265gh": {
      heading: "P265GH: verificare impiego, processo ed edizione",
      takeaway: "P265GH (numero materiale 1.0425) è un grado usato in specifiche per tubi per pressione. Il solo nome del grado non definisce se un tubo debba essere senza saldatura o saldato.",
      checks: [
        "Precisare norma di prodotto, ad esempio EN 10216-2 per senza saldatura o EN 10217-2 per saldato elettricamente, se pertinenti al progetto.",
        "Verificare temperatura di progetto, requisiti meccanici, prove e categoria di collaudo nella corretta edizione.",
        "Concordare documentazione EN 10204 ed eventuali requisiti PED senza dedurre automaticamente conformità."
      ],
      editionNote: "UNI EN 10216-2:2024 ha un'errata corrige 2025; UNI EN 10217-2:2019 ha aggiornamenti propri. L’edizione va sempre controllata per lo specifico ordine.",
      compare: { label: "Esplora le norme per pressione", href: "/knowledge/norme" },
      sources: [
        { label: "UNI — EN 10216-2:2024", url: "https://store.uni.com/uni-en-10216-2-2024" },
        { label: "UNI — EN 10217-2:2019", url: "https://store.uni.com/uni-en-10217-2-2019" },
        { label: "UNI — errata corrige EN 10216-2", url: "https://store.uni.com/ec-1-2025-uni-en-10216-2-2024" }
      ]
    }
  }
};

export function getSchoolContent1Guide(kind, slug) {
  if ((kind !== "standard" && kind !== "grade") || typeof slug !== "string") return null;
  const catalogue = guides[kind];
  return Object.hasOwn(catalogue, slug) ? catalogue[slug] : null;
}

export const SCHOOL_CONTENT1_REVIEW_DATE = reviewDate;
