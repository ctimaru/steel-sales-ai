/** SCHOOL-UNIFY4: original, market-localized educational summaries; no copyrighted tables.
 * Pages are gated by K2 published public records. Source URLs point to publisher scope overviews.
 */
import type { MarketGuideLocale } from "@/lib/calculator-market-editorial";
export type KnowledgeMarketLocale=MarketGuideLocale;
export type LocalizedTechnicalGuide = {
 slug:string; code:string; title:string;summary:string;covers:string;request:string;caution:string;source:string;
};
export const MARKET_TECHNICAL_RECORDS={
  "de": {
    "standards": [
      {
        "slug": "en-10210",
        "code": "EN 10210",
        "title": "Warmgefertigte Stahlbau-Hohlprofile",
        "summary": "EN 10210 beschreibt technische Lieferbedingungen für warmgefertigte Stahlbau-Hohlprofile. Für die Beschaffung müssen Produktform, Werkstoff und die richtige Normausgabe eindeutig feststehen.",
        "covers": "Teil 1 behandelt die technischen Lieferbedingungen für die zugehörigen Stahlbau-Hohlprofile. Teil 2 regelt Maßtoleranzen, Abmessungen und Querschnittswerte für CHS, SHS und RHS.",
        "request": "EN 10210 mit zutreffendem Teil und Ausgabestand, Stahlgüte, Profilform, Außenabmessungen, Wanddicke, Länge, Menge und erforderliche Prüfbescheinigung angeben.",
        "caution": "EN 10210 und EN 10219 sind verschiedene Herstell- und Lieferfamilien. Gleiche Nennabmessungen beweisen keine Austauschbarkeit, insbesondere nicht bei SHS und RHS.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "en-10219",
        "code": "EN 10219",
        "title": "Kaltgefertigte geschweißte Stahlbau-Hohlprofile",
        "summary": "EN 10219 gilt für kaltgefertigte, geschweißte Stahlbau-Hohlprofile. Die Produktnorm unterscheidet sich von EN 10210 für warmgefertigte Profile.",
        "covers": "Teil 1 enthält technische Lieferbedingungen; Teil 2 behandelt Maßtoleranzen, Abmessungen und Querschnittswerte. Die Herstellung ist Bestandteil der Produktspezifikation.",
        "request": "EN 10219 mit Teil und maßgebender Ausgabe, vollständiger Stahlgüte, CHS/SHS/RHS, Maßen, Dicke, Längen, Stückzahl und Prüfdokumentation nennen.",
        "caution": "Die in EN 10219-2 und EN 10210-2 verwendeten Querschnittswerte für quadratische und rechteckige Profile dürfen nicht stillschweigend gleichgesetzt werden.",
        "source": "https://accord-checkout.bsigroup.com/products/cold-formed-welded-structural-hollow-sections-of-non-alloy-and-fine-grain-steels-technical-delivery-requirements_hard-copy"
      },
      {
        "slug": "en-10216-2",
        "code": "EN 10216-2",
        "title": "Nahtlose Druckrohre für erhöhte Temperaturen",
        "summary": "EN 10216-2 legt technische Lieferbedingungen für nahtlose Rohre aus unlegierten und legierten Stählen mit festgelegten Eigenschaften bei erhöhten Temperaturen fest.",
        "covers": "Die Norm umfasst hauptsächlich nahtlose Rohre mit kreisförmigem Querschnitt und zwei Prüfkategorien. Abweichende Querschnitte erfordern eine Vereinbarung bei Anfrage und Bestellung.",
        "request": "EN 10216-2, maßgebende Ausgabe, Werkstoff wie P265GH, Außendurchmesser, Wanddicke, Menge, Prüfkategorie und gewünschte Dokumente festlegen.",
        "caution": "Eine Materialangabe allein bestätigt weder die Zulässigkeit für ein Druckgerät noch die Gleichwertigkeit mit geschweißten Rohren nach EN 10217.",
        "source": "https://store.uni.com/en-10216-2-2024"
      }
    ],
    "grades": [
      {
        "slug": "s355j2h",
        "code": "S355J2H",
        "title": "Stahlgüte für tragende Hohlprofile",
        "summary": "S355J2H ist eine Stahlbezeichnung für tragende Hohlprofile. Sie beschreibt den Werkstoff, nicht allein die Herstellroute oder den vollständigen Lieferzustand.",
        "covers": "S kennzeichnet Baustahl, 355 die Festigkeitsklasse, J2 eine Zähigkeitskennzeichnung und H den Einsatz als Hohlprofil. Verbindliche Werte hängen von Produktnorm und Dickenbereich ab.",
        "request": "S355J2H vollständig mit EN 10210 oder EN 10219, Profilgeometrie, Maßen, Wanddicke, Menge und Prüfbescheinigung anfragen.",
        "caution": "S355J2H, S355NH und andere S355-Suffixe sind keine automatischen Ersatzgüten. Auch die Herstellnorm ist gesondert zu prüfen.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "p265gh",
        "code": "P265GH",
        "title": "Druckbehälterstahl mit Warmfestigkeitseigenschaften",
        "summary": "P265GH ist eine Werkstoffbezeichnung aus der Familie der Druckstähle für Produkte mit festgelegten Eigenschaften bei höheren Temperaturen.",
        "covers": "P bezeichnet eine Druckstahlfamilie; GH steht für Eigenschaften bei erhöhten Temperaturen. Die Bezeichnung ersetzt nicht die anwendbare Rohrproduktnorm.",
        "request": "P265GH zusammen mit EN 10216-2 für nahtlose Rohre oder einer geeigneten geschweißten Produktnorm, Abmessungen und Prüfunterlagen spezifizieren.",
        "caution": "P265GH und P235GH sind unterschiedliche Werkstoffe. Zulässiger Druck und Einsatztemperatur ergeben sich nicht allein aus der Gütebezeichnung.",
        "source": "https://store.uni.com/en-10216-2-2024"
      }
    ]
  },
  "fr": {
    "standards": [
      {
        "slug": "en-10210",
        "code": "EN 10210",
        "title": "Profils creux de construction finis à chaud",
        "summary": "EN 10210 couvre les profils creux de construction finis à chaud. Le mode de fabrication, la nuance et les dimensions doivent être explicitement définis dans la demande.",
        "covers": "La partie 1 définit les conditions techniques de livraison. La partie 2 traite des tolérances, des dimensions et des caractéristiques de section des profils CHS, SHS et RHS.",
        "request": "Précisez EN 10210, la partie et l’édition applicables, la nuance, la section, les dimensions, l’épaisseur, les longueurs, la quantité et les documents de contrôle.",
        "caution": "EN 10210 et EN 10219 ne désignent pas le même procédé. À dimensions nominales égales, les propriétés de section ne sont pas présumées identiques.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "en-10219",
        "code": "EN 10219",
        "title": "Profils creux de construction soudés formés à froid",
        "summary": "EN 10219 concerne les profils creux de construction soudés et formés à froid. Elle se distingue de la famille des profils finis à chaud EN 10210.",
        "covers": "La partie 1 précise les conditions de livraison et la partie 2 les tolérances, dimensions et caractéristiques des sections.",
        "request": "Indiquez la série EN 10219, la partie et l’édition, la nuance complète, la forme CHS/SHS/RHS, les dimensions, épaisseurs, longueurs et certificats requis.",
        "caution": "Ne remplacez pas implicitement des profils EN 10210 par des profils EN 10219 : les exigences de fabrication et les données de section peuvent différer.",
        "source": "https://accord-checkout.bsigroup.com/products/cold-formed-welded-structural-hollow-sections-of-non-alloy-and-fine-grain-steels-technical-delivery-requirements_hard-copy"
      },
      {
        "slug": "en-10216-2",
        "code": "EN 10216-2",
        "title": "Tubes sans soudure pour pression à température élevée",
        "summary": "EN 10216-2 établit les conditions techniques de livraison des tubes sans soudure en aciers non alliés ou alliés avec caractéristiques spécifiées à température élevée.",
        "covers": "La norme vise essentiellement les tubes sans soudure de section circulaire et prévoit deux catégories d’essai. Une section différente exige un accord contractuel.",
        "request": "Précisez EN 10216-2 et son édition, la nuance telle que P265GH, le diamètre extérieur, l’épaisseur, la quantité, la catégorie d’essai et les documents attendus.",
        "caution": "La nuance ne certifie pas à elle seule la conformité d’un équipement sous pression. Ne confondez pas tubes sans soudure et tubes soudés de la série EN 10217.",
        "source": "https://store.uni.com/en-10216-2-2024"
      }
    ],
    "grades": [
      {
        "slug": "s355j2h",
        "code": "S355J2H",
        "title": "Nuance pour profils creux de construction",
        "summary": "S355J2H désigne une nuance d’acier pour profils creux de construction ; ce code ne spécifie pas à lui seul le procédé ni toutes les conditions de livraison.",
        "covers": "S renvoie à un acier de construction, 355 à une classe de résistance, J2 à une désignation de résilience et H à l’application en profil creux. Les conditions de la norme restent déterminantes.",
        "request": "Indiquez la nuance complète S355J2H et la famille de produit EN 10210 ou EN 10219, avec section, dimensions, épaisseur et document de contrôle.",
        "caution": "Des nuances commençant par S355 ne sont pas automatiquement équivalentes. Vérifiez les suffixes, les conditions de livraison et l’édition applicable.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "p265gh",
        "code": "P265GH",
        "title": "Nuance d’acier pour service sous pression",
        "summary": "P265GH est une désignation d’acier pour applications sous pression avec propriétés spécifiées à température élevée dans certaines normes de produit.",
        "covers": "P identifie une famille d’aciers pour pression ; GH indique des propriétés à température élevée. Le grade n’identifie pas le procédé de fabrication du tube.",
        "request": "Associez P265GH à la norme de produit pertinente, par exemple EN 10216-2 pour les tubes sans soudure, avec dimensions et certificats requis.",
        "caution": "P265GH ne remplace pas P235GH et ne détermine ni une pression de service admissible ni la conformité d’un ensemble.",
        "source": "https://store.uni.com/en-10216-2-2024"
      }
    ]
  },
  "es": {
    "standards": [
      {
        "slug": "en-10210",
        "code": "EN 10210",
        "title": "Perfiles huecos estructurales acabados en caliente",
        "summary": "EN 10210 abarca perfiles huecos estructurales acabados en caliente. La ruta de fabricación, la calidad y las dimensiones deben identificarse en la solicitud.",
        "covers": "La parte 1 se refiere a las condiciones técnicas de suministro y la parte 2 a tolerancias, dimensiones y características de sección de perfiles CHS, SHS y RHS.",
        "request": "Indica EN 10210, parte y edición aplicables, calidad, geometría, dimensiones, espesor, longitudes, cantidad y documentos de inspección.",
        "caution": "EN 10210 y EN 10219 corresponden a familias de fabricación distintas. Dimensiones nominales iguales no garantizan características de sección equivalentes.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "en-10219",
        "code": "EN 10219",
        "title": "Perfiles huecos estructurales soldados conformados en frío",
        "summary": "EN 10219 establece requisitos de suministro de perfiles huecos estructurales soldados conformados en frío, diferentes de los perfiles acabados en caliente EN 10210.",
        "covers": "La parte 1 trata las condiciones técnicas de suministro; la parte 2 cubre tolerancias, dimensiones y propiedades geométricas de las secciones.",
        "request": "Especifica EN 10219 y su edición, calidad completa, sección CHS/SHS/RHS, medidas, espesor, longitud, unidades y certificación.",
        "caution": "No sustituyas automáticamente EN 10210 por EN 10219. En particular, los valores geométricos de secciones cuadradas y rectangulares pueden diferir.",
        "source": "https://accord-checkout.bsigroup.com/products/cold-formed-welded-structural-hollow-sections-of-non-alloy-and-fine-grain-steels-technical-delivery-requirements_hard-copy"
      },
      {
        "slug": "en-10216-2",
        "code": "EN 10216-2",
        "title": "Tubos sin soldadura para presión a temperatura elevada",
        "summary": "EN 10216-2 define las condiciones técnicas de suministro para tubos sin soldadura de acero no aleado y aleado con propiedades especificadas a temperaturas elevadas.",
        "covers": "Se aplica principalmente a tubos sin soldadura de sección circular e incluye dos categorías de ensayo. Otras secciones requieren un acuerdo en el pedido.",
        "request": "Indica EN 10216-2 y edición, calidad como P265GH, diámetro exterior, espesor, cantidad, categoría de ensayo y documentos necesarios.",
        "caution": "La calidad por sí sola no demuestra la conformidad del equipo a presión ni permite equiparar tubos sin soldadura con tubos soldados según EN 10217.",
        "source": "https://store.uni.com/en-10216-2-2024"
      }
    ],
    "grades": [
      {
        "slug": "s355j2h",
        "code": "S355J2H",
        "title": "Calidad de acero para perfiles huecos estructurales",
        "summary": "S355J2H identifica una calidad de acero utilizada en perfiles huecos estructurales. No define por sí sola el método de fabricación ni toda la especificación.",
        "covers": "S designa acero estructural, 355 una clase de resistencia, J2 un requisito de tenacidad y H un producto de perfil hueco. Los valores aplicables dependen de la norma y del espesor.",
        "request": "Solicita S355J2H junto con EN 10210 o EN 10219 según corresponda, sección, dimensiones, espesor y documentación de inspección.",
        "caution": "S355J2H, S355NH y otras designaciones S355 no son sustitutos automáticos; verifica proceso, estado de suministro y exigencias del proyecto.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "p265gh",
        "code": "P265GH",
        "title": "Calidad de acero para tubos de presión",
        "summary": "P265GH es una calidad para productos destinados a presión con propiedades especificadas a temperaturas elevadas en las normas aplicables.",
        "covers": "P identifica el grupo de aceros para presión y GH propiedades a temperatura elevada. La designación no determina si el tubo es soldado o sin soldadura.",
        "request": "Indica P265GH y la norma de producto, por ejemplo EN 10216-2 para tubo sin soldadura, además de medidas, cantidad y certificados.",
        "caution": "P265GH no es equivalente automáticamente a P235GH ni determina la presión máxima admisible del equipo.",
        "source": "https://store.uni.com/en-10216-2-2024"
      }
    ]
  }
} as const satisfies Record<KnowledgeMarketLocale,{
 standards:readonly LocalizedTechnicalGuide[]; grades:readonly LocalizedTechnicalGuide[];
}>;
export const MARKET_TECHNICAL_UI={
  "de": {
    "school": "Stahlschule",
    "standards": "Normen",
    "grades": "Stahlgüten",
    "leadStd": "Fachwissen zu ausgewählten Normen – keine Reproduktion des Normtextes.",
    "leadGrade": "Werkstoffbezeichnungen und Lieferanforderungen richtig lesen.",
    "search": "Norm oder Produkt suchen",
    "searchGrade": "Stahlgüte suchen",
    "go": "Suchen",
    "clear": "Zurücksetzen",
    "noResults": "Keine veröffentlichten Treffer",
    "scope": "Geltungsbereich und Normteile",
    "meaning": "Bezeichnung und Anwendung",
    "request": "Angaben für Ihre Anfrage",
    "warning": "Wichtige Abgrenzungen",
    "resources": "Quellen und Herausgeber",
    "more": "Ressourcen entdecken",
    "sourceNote": "Diese redaktionelle Zusammenfassung ist keine Norm und kein Konformitätsnachweis. Aktuelle Ausgabe und vollständige Anforderungen beim Herausgeber prüfen.",
    "publicRecord": "Veröffentlichter Datensatz",
    "checked": "Quelldatensatz zuletzt geprüft",
    "bill": "Stückliste erstellen",
    "calculator": "Rohrgewicht berechnen",
    "read": "Artikel lesen",
    "related": "Weiterführende Referenzen",
    "back": "Alle Fachartikel",
    "empty": "Nur tatsächlich veröffentlichte Einträge werden angezeigt."
  },
  "fr": {
    "school": "École de l’acier",
    "standards": "Normes",
    "grades": "Nuances d’acier",
    "leadStd": "Guides éditoriaux de normes sélectionnées, sans reproduction des textes normatifs.",
    "leadGrade": "Comprendre les désignations et préparer des achats plus précis.",
    "search": "Rechercher une norme",
    "searchGrade": "Rechercher une nuance",
    "go": "Rechercher",
    "clear": "Effacer",
    "noResults": "Aucune référence publiée",
    "scope": "Portée et parties de la norme",
    "meaning": "Désignation et application",
    "request": "À préciser dans la demande de prix",
    "warning": "Distinctions importantes",
    "resources": "Sources et organismes",
    "more": "Explorer les ressources",
    "sourceNote": "Ce résumé éditorial ne remplace ni la norme officielle ni une preuve de conformité. Vérifiez l’édition et les exigences auprès de l’organisme émetteur.",
    "publicRecord": "Fiche publique publiée",
    "checked": "Dernière vérification de la source",
    "bill": "Créer une liste de demande",
    "calculator": "Calculer le poids",
    "read": "Lire le guide",
    "related": "Références associées",
    "back": "Tous les guides",
    "empty": "Seules les références officiellement publiées dans notre catalogue sont affichées."
  },
  "es": {
    "school": "Escuela del acero",
    "standards": "Normas",
    "grades": "Calidades de acero",
    "leadStd": "Guías editoriales de normas seleccionadas, sin reproducir el texto normativo.",
    "leadGrade": "Comprende designaciones y prepara solicitudes técnicas más precisas.",
    "search": "Buscar una norma",
    "searchGrade": "Buscar una calidad",
    "go": "Buscar",
    "clear": "Limpiar",
    "noResults": "No hay referencias publicadas",
    "scope": "Alcance y partes de la norma",
    "meaning": "Designación y aplicación",
    "request": "Qué indicar en la solicitud",
    "warning": "Distinciones importantes",
    "resources": "Fuentes y organismos",
    "more": "Explorar recursos",
    "sourceNote": "Este resumen editorial no sustituye la norma oficial ni acredita conformidad. Comprueba la edición y los requisitos con el organismo emisor.",
    "publicRecord": "Ficha pública publicada",
    "checked": "Última revisión de la fuente",
    "bill": "Crear lista de oferta",
    "calculator": "Calcular peso",
    "read": "Leer la guía",
    "related": "Referencias relacionadas",
    "back": "Todas las guías",
    "empty": "Solo se muestran fichas realmente publicadas en el catálogo."
  }
} as const;
export function localizedKnowledgeGuide(locale:KnowledgeMarketLocale,kind:"standards"|"grades",slug:string):LocalizedTechnicalGuide|null {
 return MARKET_TECHNICAL_RECORDS[locale][kind].find((x)=>x.slug===slug)??null;
}
export function localizedKnowledgePath(locale:KnowledgeMarketLocale,kind:"standards"|"grades",slug?:string){
 return "/"+locale+"/knowledge/"+kind+(slug?"/"+slug:"");
}
