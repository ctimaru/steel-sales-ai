/**
 * CALC-INT4 — Editorial content written for each local market, not translated UI copy.
 * References link to national standards bodies. Descriptions are original summaries,
 * not reproductions of copyrighted normative text.
 */
export type MarketGuideLocale = "de" | "fr" | "es";

type MarketGuide = {
  slug: string;
  title: string;
  description: string;
  kicker: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
  checklistTitle: string;
  checklist: string[];
  exampleTitle: string;
  example: string;
  questions: { question: string; answer: string }[];
  sourcesTitle: string;
  sources: { title: string; url: string }[];
  calculatorCta: string;
  billCta: string;
  warning: string;
  updatedLabel: string;
};

export const MARKET_GUIDES: Record<MarketGuideLocale, MarketGuide> = {
  de: {
    slug: "stahlbau-hohlprofile-din-en-10210-10219",
    title: "Stahlbau-Hohlprofile: DIN EN 10210 und DIN EN 10219 richtig unterscheiden",
    description: "Praxisleitfaden für deutsche Einkäufer und Stahlbauer: warmgefertigte und kaltgeformte Hohlprofile, kg/m, Eckradien und Angaben für eine belastbare Anfrage.",
    kicker: "Technischer Leitfaden · Deutschland",
    intro: "Wer in Deutschland Rund-, Quadrat- oder Rechteckhohlprofile beschafft, muss mehr angeben als eine Außenabmessung. DIN EN 10210 und DIN EN 10219 stehen für unterschiedliche Herstell- und Lieferbedingungen. Dieser Leitfaden erläutert den Zusammenhang mit theoretischer Masse, Stückliste und Angebotsanfrage.",
    sections: [
      {
        heading: "DIN EN 10210 oder DIN EN 10219: Was steht hinter der Bezeichnung?",
        paragraphs: [
          "Die Reihe DIN EN 10210 betrifft warmgefertigte Hohlprofile für den Stahlbau, die Reihe DIN EN 10219 kaltgeformte geschweißte Hohlprofile. In einer Bestellung sollten Profilform (CHS, SHS oder RHS), Außenmaße, Wanddicke, Stahlgüte und die gewünschte Normenreihe eindeutig stehen. Nur „Stahlrohr 100 × 100“ ist als technische Spezifikation unvollständig.",
          "Teil 1 beschreibt die technischen Lieferbedingungen; Teil 2 behandelt Grenzabmaße, Maße und Querschnittswerte. DIN EN 10210-2:2019 und DIN EN 10219-2:2019 sind die veröffentlichten Fassungen für diese Maß- und Querschnittsangaben. Ein 2026 veröffentlichter Entwurf zu Teil 1 ist noch nicht automatisch die anzuwendende veröffentlichte Norm."
        ]
      },
      {
        heading: "Warum kann bei 100 × 100 × 5 mm ein anderes kg/m entstehen?",
        paragraphs: [
          "Bei einem Quadrathohlprofil beeinflussen die modellierten Eckradien die theoretische Querschnittsfläche. Eine bloße Rechnung mit vier scharfkantigen Rechtecken kann deshalb von einer normbezogenen Berechnung abweichen. Die Auswahl zwischen EN 10210 und EN 10219 im Rechner ist nicht nur ein sprachlicher Filter; sie beeinflusst das verwendete Eckmodell.",
          "Das Ergebnis in kg/m ist eine rechnerische Planungsgröße. Es ersetzt weder das Maß- und Toleranzblatt des Herstellers noch das tatsächliche Verwiegungsergebnis. Für Kalkulationen von Transport, Fertigung oder Einkauf sind außerdem Stangenlänge, Stückzahl und eventuelle Zuschnittverluste relevant."
        ]
      },
      {
        heading: "Vom Gewicht zur prüfbaren Angebotsanfrage",
        paragraphs: [
          "Eine präzise Anfrage nennt beispielsweise „RHS 120 × 80 × 6 mm, DIN EN 10219, gewünschte Stahlgüte, 12 m Stangen, 40 Stück“. So bleiben Außenmaße, Nennwanddicke und Stückzahl nachvollziehbar. Die verbindliche Lieferbarkeit einzelner Kombinationen ist beim Anbieter zu prüfen.",
          "Die rechnerische Tonnage unterstützt die Einkaufsplanung, sollte aber nicht als zertifizierte Liefermasse bezeichnet werden. Klären Sie vor Bestellung Güte, Herstellverfahren, Toleranzen, Oberflächenzustand, Längenvorgabe sowie erforderliche Dokumentation und Nachweise."
        ]
      },
      {
        heading: "Normenstand 2026: Entwurf und gültige Ausgabe trennen",
        paragraphs: [
          "Bei DIN Media sind im März 2026 Entwürfe für DIN EN 10210-1 und DIN EN 10219-1 aufgeführt. Ein Norm-Entwurf ist kein Beleg dafür, dass die zuvor veröffentlichte Ausgabe schon zurückgezogen oder ersetzt wurde. Für die konkrete Bestellung ist der aktuelle Veröffentlichungsstand der einschlägigen Ausgaben zu kontrollieren.",
          "Vermeiden Sie deshalb die pauschale Aussage, ein Profil sei „nach DIN EN“ normgerecht, allein weil sein theoretisches Gewicht zum Rechner passt. Die Produktdokumentation muss den für den Auftrag geltenden normativen und vertraglichen Anforderungen entsprechen."
        ]
      }
    ],
    checklistTitle: "Checkliste für Einkauf und Stahlbau",
    checklist: [
      "Profiltyp CHS / SHS / RHS sowie Außenmaße und Wanddicke",
      "DIN EN 10210 oder DIN EN 10219 und gewünschte Stahlgüte",
      "Stangenlänge, Stückzahl, Lieferort und Bearbeitungsbedarf",
      "Toleranzen, technische Nachweise und Dokumentationsumfang"
    ],
    exampleTitle: "Berechnungsbeispiel für ein Rundhohlprofil",
    example: "Für ein idealisiertes Rundrohr mit D = 114,3 mm und t = 5 mm beträgt die Querschnittsfläche π × t × (D − t). Mit 7.850 kg/m³ Dichte ergibt das rund 13,48 kg/m. Eine 12-m-Stange wiegt rechnerisch rund 161,7 kg. Dies ist kein zugesichertes Liefergewicht.",
    questions: [
      { question: "Sind DIN EN 10210 und DIN EN 10219 austauschbar?", answer: "Nein. Beide betreffen Stahlbau-Hohlprofile, unterscheiden sich aber bei Herstell- und Lieferbedingungen und bei den Rechenannahmen für Querschnittswerte." },
      { question: "Ist ein 2026er Norm-Entwurf bereits verbindlich?", answer: "Nicht allein durch seine Veröffentlichung als Entwurf. Prüfen Sie die aktuell veröffentlichte Ausgabe und die konkrete vertragliche Referenz." }
    ],
    sourcesTitle: "Fachliche Quellen und Normenstatus",
    sources: [
      { title: "DIN: veröffentlichte Normen und Entwürfe zu EN 10210/10219", url: "https://www.din.de/de/mitwirken/normenausschuesse/fes/europaeische-gremien/72366/wdc-grem%3Adin21%3A148579350%21search-grem-details?masking=true" },
      { title: "DIN Media: DIN EN 10219-2:2019-07", url: "https://www.dinmedia.de/de/norm/din-en-10219-2/306846734" }
    ],
    calculatorCta: "Stahlrohrgewicht berechnen",
    billCta: "Anfrage-Stückliste öffnen",
    warning: "Der Rechner liefert theoretische Massen. Normkonformität, verfügbare Güten und Liefergewichte bestätigt ausschließlich der Anbieter bzw. die Produktdokumentation. Die öffentliche Stückliste sendet keine Anfrage automatisch ab.",
    updatedLabel: "Fachlich geprüft am 16.10.2026"
  },
  fr: {
    slug: "profils-creux-nf-en-10210-10219",
    title: "Profils creux en acier : choisir NF EN 10210 ou NF EN 10219 pour un devis",
    description: "Guide technique pour les achats en France : différence entre profils creux finis à chaud et formés à froid, masse théorique, tolérances et préparation d'une demande de prix.",
    kicker: "Guide technique · France",
    intro: "En construction métallique, le poids au mètre d'un profil creux n'est qu'une partie du dossier d'achat. Une demande de prix exploitable précise aussi la série normative, la nuance d'acier, les dimensions et les justificatifs attendus. Voici comment articuler NF EN 10210, NF EN 10219 et un calcul de masse.",
    sections: [
      {
        heading: "NF EN 10210 et NF EN 10219 : deux familles à ne pas confondre",
        paragraphs: [
          "NF EN 10210 concerne les profils creux de construction finis à chaud, alors que NF EN 10219 porte sur les profils creux soudés formés à froid. Les deux familles couvrent des formes circulaires, carrées et rectangulaires. Le sigle CHS désigne une section circulaire, SHS une section carrée et RHS une section rectangulaire.",
          "La partie 1 traite des conditions techniques de livraison ; la partie 2 porte sur les tolérances, les dimensions et les caractéristiques de section. Pour les profils finis à chaud, AFNOR référence notamment NF EN 10210-2 publiée en mai 2019. La désignation du produit ne se réduit donc pas à une valeur de kg/m."
        ]
      },
      {
        heading: "Calculer la masse théorique sans la présenter comme un poids certifié",
        paragraphs: [
          "Pour un tube rond idéal, la section d'acier est A = π × e × (D − e), avec D et e en millimètres. La masse linéique est alors A × 0,00785 en kg/m pour une masse volumique de 7 850 kg/m³. Cette relation géométrique ne décrit pas toutes les particularités de fabrication ni les tolérances d'un produit livré.",
          "Pour les profils carrés et rectangulaires, les rayons d'angle du modèle ont une influence sur la section théorique. Sélectionner EN 10210 ou EN 10219 dans l'outil permet de ne pas confondre cette estimation avec un simple contour à angles vifs. Les valeurs du fournisseur et la documentation de livraison restent à vérifier."
        ]
      },
      {
        heading: "Construire une demande de prix claire pour un distributeur ou un fabricant",
        paragraphs: [
          "Une nomenclature utile peut indiquer « profil creux RHS 120 × 80 × 6 mm ; NF EN 10219 ; nuance à confirmer ; barres de 12 m ; 40 pièces ». Elle doit ensuite préciser le besoin réel : livraison en longueurs commerciales ou débitées, tolérances attendues, quantité et destination.",
          "Le service achats gagnera à demander explicitement les documents de contrôle nécessaires au dossier, les conditions de livraison et la disponibilité. Le calculateur transmet les dimensions dans une liste de demande de prix à copier : aucune offre n'est expédiée automatiquement et aucune nuance n'est certifiée par le calcul."
        ]
      },
      {
        heading: "Point de vigilance : les projets de révision 2026",
        paragraphs: [
          "AFNOR a publié des consultations sur les projets PR NF EN 10210-1 et PR NF EN 10219-1 en 2026. Il s'agit de textes en enquête publique, pas d'une preuve que les projets sont déjà des normes publiées. Le statut de chaque référence doit être contrôlé avant la rédaction d'une spécification contractuelle.",
          "Pour la réception et la conception, distinguez la masse théorique, les caractéristiques de section et les exigences liées au produit livré. Les annexes ou tableaux normatifs ne sont pas reproduits ici ; leur consultation relève des documents officiels."
        ]
      }
    ],
    checklistTitle: "Avant de lancer une consultation fournisseur",
    checklist: [
      "Section CHS / SHS / RHS, dimensions extérieures et épaisseur nominale",
      "Référence NF EN 10210 ou NF EN 10219 et nuance demandée",
      "Longueurs, nombre de barres, lieu de livraison et éventuel débit",
      "Tolérances, documents de contrôle et exigences du chantier"
    ],
    exampleTitle: "Exemple de prévision de tonnage",
    example: "Pour un tube circulaire idéal de diamètre extérieur 114,3 mm et d'épaisseur 5 mm, A = π × 5 × (114,3 − 5), soit environ 1 717 mm². À 7 850 kg/m³, on obtient environ 13,48 kg/m et 161,7 kg pour une barre de 12 m. Masse calculée, non certifiée.",
    questions: [
      { question: "Le poids calculé suffit-il pour commander un profil creux ?", answer: "Non. La série normative, la nuance, les dimensions, les tolérances et les documents exigés doivent également figurer dans la consultation." },
      { question: "NF EN 10210-2 décrit-elle les conditions de livraison ?", answer: "La partie 2 traite surtout des tolérances, dimensions et propriétés de section ; les conditions techniques de livraison relèvent de la partie 1." }
    ],
    sourcesTitle: "Références techniques vérifiables",
    sources: [
      { title: "AFNOR : NF EN 10210-2 (édition 2019)", url: "https://www.boutique.afnor.org/fr-fr/norme/nf-en-102102/profils-creux-de-construction-finis-a-chaud-en-aciers-partie-2-tolerances-d/fa171253/83605" },
      { title: "AFNOR : consultation PR NF EN 10219-1 (2026)", url: "https://norminfo.afnor.org/consultation/pr-nf-en-10219-1/profils-creux-de-construction-en-aciers-soudes-formes-a-froid-partie-1-conditions-techniques-de-livraison/355989" }
    ],
    calculatorCta: "Calculer le poids d'un tube acier",
    billCta: "Préparer une liste de demande de prix",
    warning: "Les masses sont des estimations théoriques et ne constituent ni une certification, ni une déclaration de conformité. Le fournisseur confirme normes, nuances, disponibilité et masse livrée. La liste publique ne transmet aucune demande automatiquement.",
    updatedLabel: "Contenu vérifié le 16/10/2026"
  },
  es: {
    slug: "perfiles-huecos-une-en-10210-10219",
    title: "Perfiles huecos UNE-EN 10210 y UNE-EN 10219: peso y pedido de material",
    description: "Guía para compras y estructuras metálicas en España: perfiles conformados en frío y acabados en caliente, peso kg/m, normas UNE y datos para pedir presupuesto.",
    kicker: "Guía técnica · España",
    intro: "Cuando se prepara una medición o un pedido de perfiles huecos de acero, conocer los kg/m es útil pero insuficiente. La documentación española UNE-EN diferencia los perfiles acabados en caliente de los soldados conformados en frío. Esta guía conecta esa distinción con el cálculo de peso y la solicitud de oferta.",
    sections: [
      {
        heading: "Cómo interpretar UNE-EN 10210 y UNE-EN 10219",
        paragraphs: [
          "La serie UNE-EN 10210 se refiere a perfiles huecos de acero acabados en caliente para construcción. La serie UNE-EN 10219 cubre perfiles huecos soldados conformados en frío. En ambos casos conviene identificar si se trata de un tubo redondo (CHS), cuadrado (SHS) o rectangular (RHS), así como dimensiones exteriores, espesor nominal y calidad de acero.",
          "La parte 1 establece condiciones técnicas de suministro; la parte 2 trata tolerancias, dimensiones y características del perfil. UNE indica que UNE-EN 10219-2:2019 sigue vigente y corresponde a EN 10219-2:2019. También recoge UNE-EN 10210-2:2020, edición nacional de EN 10210-2:2019. No debe confundirse el año de adopción nacional con una fórmula de peso distinta."
        ]
      },
      {
        heading: "Del cálculo en kg/m a las barras y toneladas",
        paragraphs: [
          "Para una sección circular ideal se emplea A = π × e × (D − e), con dimensiones en mm. La masa lineal aproximada se obtiene multiplicando A por 0,00785, con densidad convencional de acero de 7 850 kg/m³. Es una estimación geométrica: las tolerancias de fabricación y la masa real suministrada requieren confirmación.",
          "En perfiles cuadrados y rectangulares los radios de las esquinas modifican la sección calculada. Por eso se debe escoger la serie EN apropiada en lugar de aplicar siempre una aproximación de esquinas vivas. El resultado en kg/m permite calcular kg por barra y toneladas para el número de barras indicado."
        ]
      },
      {
        heading: "Qué debe incluir una solicitud de presupuesto en España",
        paragraphs: [
          "Una línea de pedido clara puede expresarse como «perfil hueco RHS 120 × 80 × 6 mm, UNE-EN 10219, calidad a confirmar, barras de 12 m, 40 unidades». El documento comercial debe añadir cantidades, lugar de entrega, necesidad de corte y condiciones de suministro cuando proceda.",
          "El peso total ayuda a estimar logística y presupuesto, pero no demuestra que una combinación dimensional esté disponible. Antes de cerrar el pedido, el suministrador debe confirmar grado de acero, tolerancias, plazo y documentación de inspección solicitada. La herramienta pública solo permite preparar y copiar una lista: no envía ofertas."
        ]
      },
      {
        heading: "Cómo revisar la versión de la norma y evitar errores",
        paragraphs: [
          "Consulte la ficha oficial UNE y su estado vigente cuando redacte pliegos o pedidos. El identificador europeo EN y la edición española UNE-EN pueden tener años distintos debido a la publicación nacional. Una referencia genérica a «EN 10219» no sustituye la identificación concreta del producto y de los requisitos aplicables.",
          "No confunda el peso teórico obtenido en una calculadora con una medición certificada ni con las propiedades completas de la sección para cálculo estructural. Los valores oficiales, certificados y prestaciones deben contrastarse con las normas y los documentos del fabricante."
        ]
      }
    ],
    checklistTitle: "Lista rápida para una petición de oferta",
    checklist: [
      "Tipo de perfil CHS / SHS / RHS, medidas y espesor",
      "Serie UNE-EN 10210 o UNE-EN 10219 y calidad solicitada",
      "Longitud comercial o a medida, barras y tonelaje previsto",
      "Entrega, tolerancias, certificado e información de trazabilidad"
    ],
    exampleTitle: "Ejemplo de cálculo preliminar",
    example: "Un tubo circular ideal de D = 114,3 mm y espesor 5 mm tiene un área aproximada de 1.717 mm². Con densidad 7.850 kg/m³ pesa alrededor de 13,48 kg/m. Una barra de 12 m equivale a unos 161,7 kg teóricos; 10 barras equivaldrían a aproximadamente 1,62 toneladas.",
    questions: [
      { question: "¿Es lo mismo UNE-EN 10210 que UNE-EN 10219?", answer: "No. Describen familias de fabricación diferentes; además, el modelo de radios de esquina puede cambiar las características teóricas de sección." },
      { question: "¿Por qué UNE-EN 10210-2:2020 cita EN 10210-2:2019?", answer: "La norma europea y su adopción nacional pueden publicarse en años diferentes. Hay que revisar la edición vigente en el catálogo oficial." }
    ],
    sourcesTitle: "Fuentes oficiales y estado normativo",
    sources: [
      { title: "UNE: UNE-EN 10219-2:2019 y equivalencia europea", url: "https://www.une.org/encuentra-tu-norma/busca-tu-norma/norma?TermId=64d4ad9d-ede1-4acd-915c-be64ad2a132d&TermSetId=68b35e67-1409-448a-b93c-10dd69a44760&TermStoreId=30422a6b-6877-4e28-82d6-96d5dac7e3b1&c=norma-une-en-10219-2-2019-n0062916" },
      { title: "UNE: catálogo oficial de normas", url: "https://www.une.org/encuentra-tu-norma/busca-tu-norma" }
    ],
    calculatorCta: "Calcular peso de tubos de acero",
    billCta: "Preparar lista para presupuesto",
    warning: "Los resultados son masas teóricas, no pesos certificados ni pruebas de conformidad. El proveedor debe validar la norma, la calidad, las tolerancias y la masa suministrada. La lista pública no envía automáticamente solicitudes de oferta.",
    updatedLabel: "Revisado el 16/10/2026"
  }
};

export const MARKET_GUIDE_ROUTES: Record<MarketGuideLocale, string> = {
  de: "/de/knowledge/tubes/stahlbau-hohlprofile-din-en-10210-10219",
  fr: "/fr/knowledge/tubes/profils-creux-nf-en-10210-10219",
  es: "/es/knowledge/tubes/perfiles-huecos-une-en-10210-10219"
};
