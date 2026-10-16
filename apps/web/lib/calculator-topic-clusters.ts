/**
 * CALC-INT4.1 — Intent-driven satellite topics, one distinct search job per market.
 * Search phrases below are editorial hypotheses, NOT measured GSC traffic.
 * All norm links point to publicly readable publisher/catalog descriptions,
 * not copyrighted technical tables. No normative tolerance figures invented.
 */
import type { MarketGuide, MarketGuideLocale } from "./calculator-market-editorial";

export const MARKET_TOPIC_INTENT: Record<MarketGuideLocale, {
  audience: string; primaryQuery: string; secondaryQueries: readonly string[];
  intent: "informational-to-procurement"; evidence: "editorial-hypothesis";
  purpose: string; measurement: string;
}> = {
  de: {
    audience: "Stahlbau Einkauf / technische Arbeitsvorbereitung",
    primaryQuery: "DIN EN 10219-2 Toleranzen Hohlprofile",
    secondaryQueries: ["DIN EN 10210-2 Maße Hohlprofile", "Quadratrohr Maßtoleranzen", "RHS SHS Querschnittswerte"],
    intent: "informational-to-procurement", evidence: "editorial-hypothesis",
    purpose: "Understand which part of the standard governs dimensions and tolerances before requesting a compliant offer.",
    measurement: "DE query and landing impressions; clicks to calculator and bill, separated by consent."
  },
  fr: {
    audience: "Acheteurs et responsables qualité de construction métallique",
    primaryQuery: "certificat matière 3.1 EN 10204 profil creux",
    secondaryQueries: ["NF EN 10204 documents de contrôle", "demande de prix profils creux certificat", "NF EN 10219 documents de réception"],
    intent: "informational-to-procurement", evidence: "editorial-hypothesis",
    purpose: "Separate the steel profile product specification from the requested inspection document.",
    measurement: "FR page/query search impressions and qualified calculator-to-public-bill navigation."
  },
  es: {
    audience: "Compras técnicas / taller de estructuras metálicas",
    primaryQuery: "UNE EN 10210 10219 diferencias perfiles huecos",
    secondaryQueries: ["UNE EN 10219 peso por metro", "perfiles huecos pedido medidas", "UNE EN 10210 2 2020"],
    intent: "informational-to-procurement", evidence: "editorial-hypothesis",
    purpose: "Distinguish UNE-EN national adopted edition and buying specification from theoretical mass.",
    measurement: "ES page and query impressions, CTR, and public bill visits with available consented analytics."
  }
};

export const MARKET_TOPIC_GUIDES: Record<MarketGuideLocale, MarketGuide> = {
  de: {
    slug: "din-en-10219-2-toleranzen-masse-hohlprofile",
    title: "DIN EN 10219-2: Maße, Toleranzen und Querschnittswerte von Hohlprofilen",
    description: "Was regelt DIN EN 10219-2? Praxiswissen zu Maßen, Grenzabmaßen und Querschnittswerten für SHS, RHS und CHS – mit Checkliste für technische Anfragen.",
    kicker: "Fachwissen · Hohlprofile · Deutschland",
    intro: "Ein Hohlprofil lässt sich nicht allein durch seine theoretische Masse beurteilen. Wer Rohre oder Hohlprofile für den Stahlbau einkauft, sollte verstehen, welche Angaben in einer Maßnorm stehen, welche Anforderungen den technischen Lieferbedingungen zuzuordnen sind und welche Daten ein Lieferant bestätigen muss.",
    sections: [
      { heading: "Wofür steht Teil 2 der DIN EN 10219?",
        paragraphs: [
          "DIN EN 10219-2:2019-07 behandelt Grenzabmaße, Maße und statische Werte kaltgeformter geschweißter Stahlbau-Hohlprofile. Sie adressiert die Geometrie von Kreis-, Quadrat-, Rechteck- und auch Ellipsenprofilen innerhalb der in der Norm angegebenen Anwendungsbereiche. Verbindliche Werte und Messmethoden sind dem offiziellen Normtext zu entnehmen.",
          "Die technischen Lieferbedingungen werden nicht aus Teil 2 allein abgeleitet. Bei der Beschaffung sind die zutreffende Normenreihe, der relevante Teil 1, die Stahlgüte und gegebenenfalls weitere Spezifikationen gemeinsam zu betrachten. Eine pauschale Angabe wie „DIN-Rohr“ ist kein eindeutiger Bestelltext."
        ] },
      { heading: "DIN EN 10210-2 ist nicht einfach eine andere Zahl für kg/m",
        paragraphs: [
          "DIN EN 10210-2:2019-07 beschreibt Maße, Grenzabmaße und Querschnittswerte warmgefertigter Stahlbau-Hohlprofile. DIN EN 10219-2 bezieht sich dagegen auf kaltgeformte geschweißte Profile. Der Unterschied betrifft die Produktfamilie, nicht nur die Benennung im Einkaufsprogramm oder in einem Online-Rechner.",
          "Für Quadrat- und Rechteckhohlprofile ändern sich mit dem modellierten Eckverlauf die rechnerischen Querschnittsflächen. Rechnerische kg/m können daher bei gleichem Außenmaß und derselben Nennwanddicke differieren. Das ist kein eigenständiger Nachweis, dass ein geliefertes Profil die Maßtoleranzen der gewählten Norm einhält."
        ] },
      { heading: "Welche Angaben gehören in die Maßprüfung?",
        paragraphs: [
          "Der technische Abgleich beginnt mit Profilform, Außenabmessungen, Nennwanddicke und Länge. Zu einer vollständigen Prüfung können weitere für die konkrete Profilform relevante Maß- und Formmerkmale gehören. Die erforderlichen Messbedingungen und Grenzwerte dürfen nicht aus einem frei verfügbaren Gewichtsrechner abgeleitet werden.",
          "Beispielsweise kann eine Anfrage „SHS 100 × 100 × 5 mm, DIN EN 10219, 12-m-Stangen“ die grobe Geometrie definieren. Für einen freigegebenen Einkauf fehlen damit aber noch die vereinbarte Stahlgüte, Lieferdetails und eventuell die Dokumentationspflicht. Prüfen Sie die individuelle Maß- und Lieferfähigkeit mit dem Anbieter."
        ] },
      { heading: "Vom rechnerischen Profilgewicht zur überprüfbaren Bestellung",
        paragraphs: [
          "Der öffentliche Rechner von Smart Steel Sales verwendet für EN 10219 und EN 10210 ein jeweils passendes vereinfachtes Querschnittsmodell und zeigt die theoretische Masse in kg/m sowie die Masse je Stange. Die gewählte Norm beeinflusst bei Hohlprofilen mit Ecken das Rechenmodell; dadurch eignet sich der Wert als Planungshilfe für eine Stückliste.",
          "Übernehmen Sie die Geometrie in die Angebots-Stückliste und ergänzen Sie danach die fehlenden kaufmännischen und technischen Merkmale. Der öffentlich zugängliche Vorgang erzeugt eine kopierbare Anfrage, aber keine automatisch versandte RFQ und keine Herstellerbescheinigung. Maßkonformität erfordert Unterlagen des Lieferanten."
        ] }
    ],
    checklistTitle: "Checkliste vor Angebotsfreigabe",
    checklist: [
      "Kreis / Quadrat / Rechteck mit Außenmaßen, Wanddicke und Stangenlänge präzisieren",
      "DIN EN 10219 oder DIN EN 10210, gültige Ausgabe und gewünschte Stahlgüte festlegen",
      "Verbindliche Maßtoleranzen und Dokumentation anhand der Originalnorm bzw. Bestellung prüfen",
      "Liefermenge, Zuschnitt, Verfügbarkeit und erforderliche Prüfunterlagen bestätigen"
    ],
    exampleTitle: "Praxisfall: 40 Stück RHS 120 × 80 × 6 mm",
    example: "Bei 40 Rechteckhohlprofilen zu je 12 m werden insgesamt 480 m Material angefragt. Die theoretische Gesamtmasse ergibt sich aus dem zum gewählten Berechnungsmodell gehörenden kg/m-Wert mal 480 m. Die zulässigen Maßabweichungen ergeben sich nicht aus dieser Multiplikation und müssen separat geprüft werden.",
    questions: [
      { question: "Liefert DIN EN 10219-2 allein die Bedingungen für die Bestellung?", answer: "Nein. Teil 2 behandelt Maße und Querschnittsmerkmale; zusätzliche Lieferbedingungen, Stahlgüte, Dokumentation und vertragliche Anforderungen bleiben zu spezifizieren." },
      { question: "Sind die auf der Website berechneten kg/m eine Toleranzbestätigung?", answer: "Nein. Sie sind theoretische Planungswerte. Eine Norm- und Maßkonformität ist produktbezogen durch Herstellerangaben und einschlägige Nachweise zu prüfen." }
    ],
    sourcesTitle: "Veröffentlichte Normen – Originalquellen",
    sources: [
      { title: "DIN Media: DIN EN 10219-2:2019-07, gültige Ausgabe", url: "https://www.dinmedia.de/en/standard/din-en-10219-2/306846734" },
      { title: "DIN Media: DIN EN 10210-2:2019-07, gültige Ausgabe", url: "https://www.dinmedia.de/en/standard/din-en-10210-2/306846700" }
    ],
    calculatorCta: "kg/m von Hohlprofilen berechnen", billCta: "Stückliste für Anfrage vorbereiten",
    warning: "Keine Wiedergabe normativer Maßtabellen. Theoretische Querschnittswerte ersetzen weder den offiziellen Normtext noch Herstellerbestätigungen zu Toleranzen, Güte und Konformität. Die öffentliche Stückliste sendet keine Nachricht an Lieferanten.",
    updatedLabel: "Quellenabgleich: 16.10.2026"
  },
  fr: {
    slug: "certificat-matiere-en-10204-31-profils-creux",
    title: "Certificat matière EN 10204 type 3.1 : que demander pour des profils creux ?",
    description: "Demande de prix de profils creux : distinguer NF EN 10210/10219 et certificat matière NF EN 10204, préciser le document 3.1 et contrôler la réception.",
    kicker: "Documentation fournisseur · France",
    intro: "Un certificat matière de type 3.1 ne remplace pas la désignation d'un profil creux et une valeur de masse en kg/m ne remplace pas son contrôle. Pour rédiger une consultation fournisseur utile, séparez les spécifications du produit, les dimensions et la documentation de contrôle exigée.",
    sections: [
      { heading: "NF EN 10204 et NF EN 10219 : deux sujets différents",
        paragraphs: [
          "La NF EN 10204 décrit les catégories de documents de contrôle à remettre à l'acheteur pour les produits métalliques. Elle ne définit pas les dimensions d'un profil creux ni ses nuances disponibles. Pour ces caractéristiques, il faut se reporter aux normes de produit pertinentes, par exemple NF EN 10219 pour les profils creux soudés formés à froid.",
          "Dans la famille NF EN 10219, les conditions techniques de livraison sont traitées dans la partie 1, tandis que la partie 2 décrit dimensions, tolérances et caractéristiques de section. Le document de contrôle demandé doit donc être associé à une référence produit explicite et à une commande suffisamment détaillée."
        ] },
      { heading: "Pourquoi préciser le type de document à la consultation ?",
        paragraphs: [
          "Les dénominations « attestation », « relevé de contrôle » ou « certificat » ne sont pas interchangeables. La norme NF EN 10204 distingue plusieurs catégories, dont le document 3.1, fondé sur des contrôles spécifiques. Pour le détail des responsabilités, des contrôles et de la validation, il faut consulter l'édition officielle en vigueur.",
          "Si le dossier technique impose un certificat de réception 3.1, indiquez-le dès la demande de prix et non après l'expédition. Le fournisseur pourra confirmer si le produit proposé, la disponibilité documentaire et les conditions commerciales répondent aux exigences ; évitez de supposer qu'un document sera fourni automatiquement."
        ] },
      { heading: "Composer une ligne de demande de prix traçable",
        paragraphs: [
          "Une description exploitable peut mentionner « RHS 120 × 80 × 6 mm, NF EN 10219, nuance à valider, barres de 12 m, 40 pièces, document de contrôle demandé : NF EN 10204 type 3.1 ». Ce modèle montre la structure d'une consultation, sans présumer de la disponibilité réelle d'une combinaison de nuance et dimensions.",
          "Ajoutez selon le besoin le lieu de livraison, le débit, les tolérances et les exigences de traçabilité. En cas de fabrication ou de lot multiples, vérifiez avec le fournisseur comment les documents reçus se rattachent aux matériaux livrés. La validation documentaire relève du processus achats/qualité."
        ] },
      { heading: "Poids théorique, certificat et réception : trois contrôles séparés",
        paragraphs: [
          "Le calcul de masse théorique aide à comparer les quantités : kg/m multipliés par la longueur totale, puis conversion en tonnes. Le résultat sert de base à l'estimation logistique et au devis, mais ne certifie ni la composition, ni les propriétés mécaniques, ni les résultats d'essais du produit réellement fourni.",
          "Après réception, confrontez la désignation de la commande, les éléments de livraison et le type de document de contrôle prévu. La liste d'achat publique de Smart Steel Sales peut être copiée pour solliciter un fournisseur ; elle ne transmet pas de demande automatiquement et ne génère aucun certificat."
        ] }
    ],
    checklistTitle: "À inclure dans votre demande de prix",
    checklist: [
      "Profil CHS / SHS / RHS, dimensions extérieures, épaisseur et longueurs",
      "NF EN 10210 ou NF EN 10219, nuance et conditions spécifiques de fourniture",
      "Si nécessaire, document demandé explicitement : NF EN 10204 type 3.1",
      "Quantité, livraison, traçabilité et vérification documentaire à réception"
    ],
    exampleTitle: "Cas pratique : commande avec certificat 3.1",
    example: "Pour 40 barres RHS de 12 m, le volume de commande représente 480 mètres linéaires. Le poids théorique peut être estimé dans le calculateur pour préparer un budget. La ligne de consultation doit mentionner séparément la nuance, la référence produit et l'exigence du document NF EN 10204 type 3.1 ; aucun poids théorique ne prouve la conformité documentaire.",
    questions: [
      { question: "La NF EN 10204 fixe-t-elle les poids de profils creux ?", answer: "Non. Elle concerne les documents de contrôle des produits métalliques. Les dimensions et caractéristiques des profils doivent être précisées dans les normes de produit concernées." },
      { question: "Peut-on demander un certificat 3.1 après la livraison ?", answer: "Les exigences documentaires doivent être convenues avant commande. Leur disponibilité et leur adéquation pour le produit proposé doivent être confirmées par le fournisseur." }
    ],
    sourcesTitle: "Normes publiques à consulter",
    sources: [
      { title: "AFNOR : NF EN 10204, types de documents de contrôle, édition en vigueur", url: "https://www.boutique.afnor.org/fr-fr/norme/nf-en-10204/produits-metalliques-types-de-documents-de-controle/fa111300/24547" },
      { title: "AFNOR : NF EN 10219-2, dimensions et tolérances", url: "https://www.boutique.afnor.org/fr-fr/norme/nf-en-102192/profils-creux-de-construction-soudes-formes-a-froid-en-aciers-partie-2-tole/fa177343/83616" }
    ],
    calculatorCta: "Calculer la masse linéique", billCta: "Préparer une demande de prix",
    warning: "Cette fiche ne remplace pas les normes payantes, les contrôles contractuels ni la validation qualité. Le document 3.1 n'est jamais généré par le calculateur ; la liste publique peut être copiée, mais n'envoie aucune consultation.",
    updatedLabel: "Sources contrôlées le 16/10/2026"
  },
  es: {
    slug: "une-en-10210-10219-ediciones-peso-pedido",
    title: "UNE-EN 10210 y UNE-EN 10219: ediciones vigentes, peso y pedido de perfiles",
    description: "Diferencias prácticas entre UNE-EN 10210-2:2020 y UNE-EN 10219-2:2019: perfiles huecos, kilos por metro, tolerancias y solicitud de presupuesto.",
    kicker: "Normativa y compras · España",
    intro: "En un presupuesto de estructuras metálicas pueden aparecer dos años distintos para normas europeas de perfiles huecos. La diferencia entre la edición UNE y la edición EN, además del proceso de fabricación, afecta a cómo identificar el producto, pero no convierte un cálculo teórico de peso en un certificado.",
    sections: [
      { heading: "Edición nacional UNE y equivalencia europea",
        paragraphs: [
          "La ficha del catálogo AENOR identifica UNE-EN 10219-2:2019 como edición española de EN 10219-2:2019 para perfiles huecos soldados conformados en frío. Según la fuente oficial, consta vigente y confirmada en enero de 2025. Su parte 2 se refiere a dimensiones, tolerancias y características de sección, no a un precio comercial por tonelada.",
          "Por otra parte, la edición nacional UNE-EN 10210-2:2020 es idéntica a EN 10210-2:2019 según AENOR y cubre perfiles huecos acabados en caliente. Por eso una ficha española puede mostrar el año 2020 mientras cita la norma europea de 2019. Conviene citar la designación completa aplicable a cada producto."
        ] },
      { heading: "Perfil conformado en frío o acabado en caliente",
        paragraphs: [
          "La serie UNE-EN 10219 aborda perfiles huecos soldados conformados en frío, mientras que UNE-EN 10210 se refiere a perfiles huecos acabados en caliente. La elección no depende solo del diámetro y del espesor: debe responder a las necesidades del proyecto, las condiciones de suministro y la especificación técnica.",
          "En las secciones cuadradas y rectangulares, el modelo de esquinas influye en el área calculada. Por tanto, dos cálculos con idénticas dimensiones exteriores y espesor nominal pueden mostrar masas teóricas distintas. No atribuya esa diferencia automáticamente a un error de báscula o a incumplimiento normativo."
        ] },
      { heading: "Cómo trasladar kg/m a una medición útil",
        paragraphs: [
          "Para una primera previsión de peso, defina CHS, SHS o RHS, medidas exteriores, espesor y método de cálculo. El resultado en kg/m se multiplica por la longitud de cada barra y el número de barras, obteniendo una masa teórica total. Las tolerancias, el corte y las diferencias entre peso nominal y suministrado se verifican por separado.",
          "El dato en toneladas ayuda a planificar el transporte o comparar presupuestos. Para una compra técnicamente completa, no basta con el total: añada la norma UNE-EN seleccionada, calidad, longitud, cantidad, acabado cuando proceda, requisitos documentales y dirección de entrega."
        ] },
      { heading: "Evitar errores habituales en el pedido",
        paragraphs: [
          "Escriba la referencia como conjunto: familia de perfil, sección exterior, espesor, norma y calidad solicitada, longitud y unidades. Por ejemplo, «SHS 100 × 100 × 5 mm, UNE-EN 10219, calidad a confirmar, 12 m, 25 barras». El proveedor debe validar la disponibilidad y la documentación antes de convertirlo en pedido definitivo.",
          "No copie tablas normativas de origen desconocido ni use un resultado geométrico como demostración de tolerancias. Consulte las fichas oficiales para saber si la edición sigue vigente. El módulo público de Smart Steel Sales permite calcular, organizar líneas y copiar una solicitud, pero no envía la oferta al proveedor."
        ] }
    ],
    checklistTitle: "Antes de solicitar presupuesto",
    checklist: [
      "Seleccionar sección CHS / SHS / RHS y dimensiones nominales",
      "Comprobar UNE-EN 10219-2:2019 o UNE-EN 10210-2:2020 según el producto",
      "Especificar calidad, longitud, número de barras y destino de entrega",
      "Distinguir masa calculada, tolerancias y certificados que debe confirmar el suministrador"
    ],
    exampleTitle: "De la longitud a las toneladas",
    example: "Para 25 barras de 12 m, la medición contiene 300 m lineales. Si el modelo seleccionado muestra M kg/m, el total teórico será 300 × M kg, o 0,3 × M toneladas. Este cálculo facilita la previsión de cantidad, pero ni el valor M ni la multiplicación acreditan el peso realmente entregado.",
    questions: [
      { question: "¿Por qué UNE-EN 10210-2:2020 corresponde a EN 10210-2:2019?", answer: "El año de publicación nacional puede diferir del europeo. Según AENOR, se trata de una adopción idéntica de EN 10210-2:2019." },
      { question: "¿Basta con indicar kg/m en la solicitud de oferta?", answer: "No. También hacen falta la norma aplicable, la calidad, medidas, cantidad, longitudes y los requisitos de suministro y documentación." }
    ],
    sourcesTitle: "Catálogo oficial AENOR",
    sources: [
      { title: "AENOR: UNE-EN 10219-2:2019, en vigor", url: "https://tienda.aenor.com/p/norma-une-en-10219-2-2019-n0062916" },
      { title: "AENOR: UNE-EN 10210-2:2020, equivalente a EN 10210-2:2019", url: "https://tienda.aenor.com/p/norma-une-en-10210-2-2020-n0063229" }
    ],
    calculatorCta: "Calcular el peso de perfiles", billCta: "Preparar lista para presupuesto",
    warning: "No se publican tablas protegidas de tolerancias. El resultado teórico del cálculo no demuestra conformidad ni disponibilidad. Las ediciones aplicables, calidad y documentación contractual deben confirmarse con la fuente oficial y el suministrador. La lista pública no envía solicitudes automáticamente.",
    updatedLabel: "Fuentes consultadas el 16/10/2026"
  }
};

export const MARKET_TOPIC_ROUTES: Record<MarketGuideLocale,string> = {
  de: "/de/knowledge/tubes/din-en-10219-2-toleranzen-masse-hohlprofile",
  fr: "/fr/knowledge/tubes/certificat-matiere-en-10204-31-profils-creux",
  es: "/es/knowledge/tubes/une-en-10210-10219-ediciones-peso-pedido"
};
