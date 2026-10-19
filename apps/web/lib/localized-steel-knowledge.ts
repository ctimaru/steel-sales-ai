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
      },
      {
        "slug": "en-10217-1",
        "code": "EN 10217-1",
        "title": "Geschweißte Druckrohre für Raumtemperatur",
        "summary": "EN 10217-1 regelt die technischen Lieferbedingungen für elektrisch und unter Pulver geschweißte Rohre aus unlegierten Stählen mit festgelegten Eigenschaften bei Raumtemperatur.",
        "covers": "Erfasst kreisförmige geschweißte Rohre mit den Qualitätsstufen TR1 und TR2. Prüfungen, Herstellverfahren und Lieferangaben müssen der passenden Normausgabe entsprechen.",
        "request": "EN 10217-1 und Teil/Ausgabe, Schweißverfahren, Stahlgüte einschließlich TR1/TR2, Durchmesser, Wanddicke, Länge, Prüfkategorie und Prüfbescheinigung angeben.",
        "caution": "TR1 und TR2 sind unterschiedliche Qualitätsstufen; eine Ersetzung oder Eignung nach Druckgeräterichtlinie ergibt sich nicht allein aus der Normbezeichnung.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "en-10217-2",
        "code": "EN 10217-2",
        "title": "Elektrisch geschweißte Druckrohre für erhöhte Temperaturen",
        "summary": "EN 10217-2 spezifiziert technische Lieferbedingungen für elektrisch geschweißte Rohre aus unlegierten und legierten Stählen mit Eigenschaften bei erhöhten Temperaturen.",
        "covers": "Die Produktfamilie behandelt elektrisch geschweißte Druckrohre mit kreisförmigem Querschnitt und Anforderungen an Werkstoffe, Prüfungen und Lieferung.",
        "request": "EN 10217-2 mit Ausgabe, elektrischer Schweißroute, Werkstoff, Außenmaß, Dicke, geforderten Prüfungen und Dokumenten anfragen.",
        "caution": "EN 10216-2 beschreibt nahtlose Produkte. Gleiche Gütebezeichnungen begründen keine automatische Austauschbarkeit der Herstellverfahren.",
        "source": "https://knowledge.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-non-alloy-and-alloy-steel-tubes-with-specified-elevated-temperature-properties-1"
      },
      {
        "slug": "en-10224",
        "code": "EN 10224",
        "title": "Stahlrohre und Formstücke für Wasserleitungen",
        "summary": "EN 10224 beschreibt Lieferbedingungen für nicht legierte Stahlrohre und Formstücke zum Transport von Wasser und anderen wässrigen Flüssigkeiten.",
        "covers": "Es handelt sich um ein eigenes Anwendungsspektrum mit nahtlosen oder geschweißten Rohren, Formstücken und Anforderungen für Wasserleitungen.",
        "request": "EN 10224 mit Ausgabe, Rohr- oder Formstücktyp, Abmessungen, Verbindung, Auskleidung/Beschichtung, Projektbedingungen und Bescheinigungen nennen.",
        "caution": "Eine Wasserleitungs-Spezifikation ist kein Ersatz für EN 10210 oder eine Druckrohrnorm. Trinkwasserkontakt und Beschichtungen gegebenenfalls separat klären.",
        "source": "https://knowledge.bsigroup.com/products/non-alloy-steel-tubes-and-fittings-for-the-conveyance-of-water-and-other-aqueous-liquids-technical-delivery-conditions"
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
      },
      {
        "slug": "s355nh",
        "code": "S355NH",
        "title": "Normalisierter Baustahl für Hohlprofile",
        "summary": "S355NH bezeichnet eine Güte für tragende Hohlprofile mit spezieller normalisierender Lieferbedingung im zutreffenden Normumfang.",
        "covers": "Die Kennzeichnung NH hat technische Bedeutung: Festigkeitsklasse und Liefer-/Zähigkeitsanforderungen werden erst zusammen mit der Produktnorm vollständig.",
        "request": "Die vollständige Bezeichnung S355NH mit EN-Produktnorm, Profilform, Wanddicke, Länge, gefordertem Lieferzustand und Prüfdokumentation vorgeben.",
        "caution": "S355NH nicht allein wegen der gemeinsamen S355-Bezeichnung gegen S355J2H oder S355NLH austauschen.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "s355nlh",
        "code": "S355NLH",
        "title": "Feinkorn-Stahlgüte für tragende Hohlprofile",
        "summary": "S355NLH ist eine gesonderte Werkstoffbezeichnung für tragende Hohlprofile mit eigener Zähigkeits-/Lieferzustandsklasse.",
        "covers": "Die vollständigen Suffixe N, L und H beeinflussen die Spezifikation; verbindliche Anforderungen ergeben sich aus Produktnorm und Abmessungsbereich.",
        "request": "S355NLH vollständig zusammen mit EN 10210, Profilgeometrie, Wanddicke und erforderlicher Prüfung dokumentieren.",
        "caution": "S355NLH und S355NH sind nicht automatisch gleichwertig. Prüfbedingungen und projektspezifische Freigabe beachten.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "p235gh",
        "code": "P235GH",
        "title": "Druckstahl für erhöhte Temperaturen",
        "summary": "P235GH bezeichnet einen Druckstahl für Produkte mit Eigenschaften bei erhöhten Temperaturen; die Güte allein legt keine Rohrfertigung fest.",
        "covers": "Der Suffix GH kennzeichnet den Temperaturbezug der Werkstofffamilie. Die konkrete Produkt- und Prüfanforderung ergibt sich aus der jeweiligen Norm.",
        "request": "P235GH mit der zutreffenden EN 10216-2 (nahtlos) oder EN 10217-2 (geschweißt), Maßen und Prüfbescheinigungen kombinieren.",
        "caution": "P235GH nicht ohne Abgleich mit P265GH ersetzen; Temperatur- und Druckgrenzen ergeben sich aus Konstruktion und vollständiger Materialprüfung.",
        "source": "https://store.uni.com/en-10216-2-2024"
      },
      {
        "slug": "16mo3",
        "code": "16Mo3",
        "title": "Molybdänlegierter Stahl für Druckanwendungen",
        "summary": "16Mo3 ist eine niedriglegierte Stahlgüte für bestimmte Druck- und Temperaturbeanspruchungen, unter anderem in passenden nahtlosen Rohrprodukten.",
        "covers": "Die chemisch orientierte Bezeichnung beschreibt keine zulässige Einsatztemperatur oder nachgewiesene Lebensdauer des Bauteils.",
        "request": "16Mo3, EN-Produktnorm wie EN 10216-2, Außenmaß, Wandstärke, Liefer- und Prüfbedingungen in der Anfrage nennen.",
        "caution": "16Mo3 ist kein direkter Ersatz für P235GH oder P265GH; Material-/Prozesszulassung gesondert prüfen.",
        "source": "https://store.uni.com/en-10216-2-2024"
      },
      {
        "slug": "p235tr1",
        "code": "P235TR1",
        "title": "Druckrohrstahl mit Qualität TR1",
        "summary": "P235TR1 benennt eine Druckrohr-Stahlgüte für Raumtemperatur mit definierter Qualitätsvariante TR1.",
        "covers": "TR1 ist Teil der vollständigen Werkstoffbezeichnung. Die Produktnorm und deren Prüfumfang bleiben für die Anfrage maßgeblich.",
        "request": "P235TR1 vollständig mit EN 10217-1, der Fertigungsroute, Abmessungen und erforderlicher Dokumentation spezifizieren.",
        "caution": "Eine TR1-Qualität darf nicht ohne Prüfung durch TR2 oder eine andere P-Güte ersetzt werden.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "p235tr2",
        "code": "P235TR2",
        "title": "Druckrohrstahl mit Qualität TR2",
        "summary": "P235TR2 ist die TR2-Qualitätsvariante in einer Druckrohrfamilie mit Eigenschaften bei Raumtemperatur.",
        "covers": "TR2 hat eigene Anforderungen und muss in der Anfrage und beim Materialnachweis ausdrücklich enthalten sein.",
        "request": "P235TR2, EN 10217-1, geschweißte Fertigung, Dimensionen und Prüf-/Nachweisanforderungen nennen.",
        "caution": "P235TR1 und P235TR2 sind nicht automatisch austauschbar; der Einsatz im Druckgerät erfordert zusätzliche Bewertung.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "p265tr1",
        "code": "P265TR1",
        "title": "P265-Druckrohrstahl mit TR1-Qualität",
        "summary": "P265TR1 ist eine Druckrohr-Stahlbezeichnung mit Qualitätsstufe TR1 für den einschlägigen Raumtemperatur-Normbereich.",
        "covers": "Die Festigkeitsklassifikation P265 und der Zusatz TR1 sind beide Bestandteile der Materialidentität.",
        "request": "P265TR1 in voller Schreibweise mit EN 10217-1, Schweißprozess, Abmessungen und Prüfdokumentation anfordern.",
        "caution": "Kein pauschaler Ersatz für P235TR1 oder P265TR2; Material- und Qualitätsunterschiede bleiben relevant.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "p265tr2",
        "code": "P265TR2",
        "title": "P265-Druckrohrstahl mit TR2-Qualität",
        "summary": "P265TR2 ist die TR2-Qualitätsvariante der P265-Rohrstahlfamilie im einschlägigen Raumtemperatur-Normbereich.",
        "covers": "Der TR2-Zusatz beschreibt eigenständige Qualitätsanforderungen innerhalb der Produktnorm.",
        "request": "P265TR2 mit EN 10217-1, Schweißprozess, Maßen, Menge und Prüfbescheinigung vollständig ausschreiben.",
        "caution": "P265TR1 und P265TR2 nicht ohne technische Prüfung gleichsetzen; keine pauschale Druckgerätezulassung ableiten.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
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
      },
      {
        "slug": "en-10217-1",
        "code": "EN 10217-1",
        "title": "Tubes soudés pour pression à température ambiante",
        "summary": "EN 10217-1 précise les conditions de livraison des tubes soudés électriquement ou à l'arc sous flux en acier non allié, avec propriétés à température ambiante.",
        "covers": "Cette partie couvre des tubes circulaires soudés de qualités TR1 et TR2. Les exigences de livraison et d'essai dépendent de l'édition applicable.",
        "request": "Indiquez EN 10217-1 et son édition, le procédé de soudage, la nuance et le suffixe TR1/TR2, le diamètre, l'épaisseur et les certificats.",
        "caution": "TR1 et TR2 sont deux niveaux distincts. La conformité d'un équipement sous pression ne se déduit pas automatiquement de la nuance.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "en-10217-2",
        "code": "EN 10217-2",
        "title": "Tubes soudés électriquement pour pression à température élevée",
        "summary": "EN 10217-2 décrit les conditions techniques de livraison des tubes soudés électriquement en aciers non alliés ou alliés, avec propriétés à température élevée.",
        "covers": "Le périmètre concerne des tubes circulaires soudés électriquement pour service sous pression et les essais associés.",
        "request": "Précisez EN 10217-2 et l'édition, le procédé, la nuance, les dimensions, la longueur, les essais et la documentation.",
        "caution": "EN 10216-2 concerne les tubes sans soudure. Une même nuance n'établit pas l'équivalence entre ces procédés.",
        "source": "https://knowledge.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-non-alloy-and-alloy-steel-tubes-with-specified-elevated-temperature-properties-1"
      },
      {
        "slug": "en-10224",
        "code": "EN 10224",
        "title": "Tubes et raccords pour le transport d'eau",
        "summary": "EN 10224 définit des conditions de livraison pour tubes et raccords en acier non allié destinés à l'eau et aux autres liquides aqueux.",
        "covers": "La famille inclut certains tubes sans soudure ou soudés et des raccords. Les conditions de projet, les protections et les joints sont à préciser.",
        "request": "Mentionnez EN 10224 et l'édition, tubes ou raccords, diamètre, épaisseur, revêtement, préparation des extrémités, quantité et contrôles.",
        "caution": "Les applications pour l'eau ne se confondent ni avec les profils structurels ni avec les tubes de pression industriels. L'aptitude au contact d'eau potable peut exiger d'autres vérifications.",
        "source": "https://knowledge.bsigroup.com/products/non-alloy-steel-tubes-and-fittings-for-the-conveyance-of-water-and-other-aqueous-liquids-technical-delivery-conditions"
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
      },
      {
        "slug": "s355nh",
        "code": "S355NH",
        "title": "Acier normalisé pour profils creux de construction",
        "summary": "S355NH identifie une nuance structurale de profils creux avec conditions de livraison spécifiques dans le référentiel applicable.",
        "covers": "Les suffixes NH ne sont pas accessoires : propriétés de livraison et de résilience doivent être reliées à la bonne norme de produit.",
        "request": "Spécifiez S355NH, EN 10210, géométrie, épaisseur, état de livraison et documents d'inspection.",
        "caution": "S355NH ne remplace pas automatiquement S355J2H ou S355NLH sur la seule base de la classe S355.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "s355nlh",
        "code": "S355NLH",
        "title": "Nuance de profils creux à classe de résilience distincte",
        "summary": "S355NLH appartient à la famille des nuances structurales pour profils creux avec des conditions de résilience et de livraison particulières.",
        "covers": "La dénomination complète N-L-H doit être conservée pour identifier la qualité commandée.",
        "request": "Indiquez S355NLH en entier, la norme EN 10210, la section, l'épaisseur et les certificats requis.",
        "caution": "S355NLH et S355NH ne sont pas équivalents par défaut; vérifiez les essais applicables.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "p235gh",
        "code": "P235GH",
        "title": "Nuance de pression pour température élevée",
        "summary": "P235GH désigne une famille de nuances pour pression avec propriétés spécifiées à température élevée dans les normes produits pertinentes.",
        "covers": "GH renvoie à la tenue spécifiée à température élevée sans préciser à lui seul la fabrication du tube.",
        "request": "Associez P235GH à EN 10216-2 pour tube sans soudure ou à EN 10217-2 pour un produit soudé pertinent, avec dimensions et certificats.",
        "caution": "P235GH diffère de P265GH; la nuance ne fixe pas la pression admissible d'un appareil.",
        "source": "https://store.uni.com/en-10216-2-2024"
      },
      {
        "slug": "16mo3",
        "code": "16Mo3",
        "title": "Acier allié au molybdène pour pression",
        "summary": "16Mo3 est un acier faiblement allié utilisé dans certaines applications de tubes sous pression à température élevée.",
        "covers": "Le nom de la nuance n'indique pas une limite de température, de pression ou une durée de vie certifiée.",
        "request": "Précisez 16Mo3, la norme de produit appropriée comme EN 10216-2, les dimensions, les essais et le dossier matière.",
        "caution": "16Mo3 n'est pas substituable automatiquement à P235GH ou P265GH; vérifier les exigences de projet.",
        "source": "https://store.uni.com/en-10216-2-2024"
      },
      {
        "slug": "p235tr1",
        "code": "P235TR1",
        "title": "Acier de tube pour pression, qualité TR1",
        "summary": "P235TR1 est une nuance de tube pour pression à température ambiante comportant le niveau de qualité TR1.",
        "covers": "TR1 fait partie de la désignation, avec les conditions de la norme produit applicable.",
        "request": "Indiquez la nuance P235TR1 complète avec EN 10217-1, dimensions, procédé et documents de contrôle.",
        "caution": "TR1 et TR2 ne sont pas interchangeables sans validation des spécifications.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "p235tr2",
        "code": "P235TR2",
        "title": "Acier de tube pour pression, qualité TR2",
        "summary": "P235TR2 désigne la variante de qualité TR2 pour certains tubes de pression à température ambiante.",
        "covers": "La qualité TR2 implique des exigences distinctes, à vérifier dans la norme produit et le contrat.",
        "request": "Précisez P235TR2 et EN 10217-1, le type de tube, le diamètre, l'épaisseur et les certificats.",
        "caution": "La nuance ne garantit pas à elle seule la conformité d'un équipement ni l'équivalence avec P235TR1.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "p265tr1",
        "code": "P265TR1",
        "title": "Nuance P265 pour pression, qualité TR1",
        "summary": "P265TR1 désigne une nuance pour tube de pression avec suffixe TR1, dans le périmètre des produits à température ambiante.",
        "covers": "P265 et TR1 identifient ensemble la qualité commandée.",
        "request": "Précisez P265TR1, EN 10217-1, le procédé, les dimensions et la documentation matière.",
        "caution": "P265TR1 n'est pas automatiquement équivalent à P235TR1 ou P265TR2.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "p265tr2",
        "code": "P265TR2",
        "title": "Nuance P265 pour pression, qualité TR2",
        "summary": "P265TR2 est une qualité TR2 de la famille des aciers P265 pour tubes de pression à température ambiante.",
        "covers": "Le suffixe TR2 distingue les conditions requises de celles de TR1.",
        "request": "Indiquez P265TR2, la norme et l'édition, le procédé soudé, les dimensions et les certificats.",
        "caution": "La proximité des noms de nuance ne permet ni substitution ni certification automatique.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
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
      },
      {
        "slug": "en-10217-1",
        "code": "EN 10217-1",
        "title": "Tubos soldados para presión a temperatura ambiente",
        "summary": "EN 10217-1 recoge condiciones de suministro para tubos soldados eléctricamente o por arco sumergido, de acero no aleado y con propiedades a temperatura ambiente.",
        "covers": "Cubre tubos soldados de sección circular con calidades TR1 y TR2; los ensayos y condiciones dependen de la edición aplicable.",
        "request": "Especifica EN 10217-1 y edición, método de soldadura, calidad y variante TR1/TR2, diámetro, espesor y certificados.",
        "caution": "TR1 y TR2 no son idénticos; la aptitud de un equipo a presión requiere comprobaciones independientes.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "en-10217-2",
        "code": "EN 10217-2",
        "title": "Tubos soldados eléctricamente para presión a temperatura elevada",
        "summary": "EN 10217-2 establece condiciones técnicas de suministro para tubos soldados eléctricamente de acero no aleado y aleado con propiedades a alta temperatura.",
        "covers": "La familia corresponde a tubos de sección circular soldados eléctricamente y a sus requisitos de ensayo para presión.",
        "request": "Incluye EN 10217-2 y edición, proceso, calidad, dimensiones, longitud, pruebas y documentación de inspección.",
        "caution": "EN 10216-2 corresponde a tubos sin soldadura. Tener la misma calidad no demuestra intercambiabilidad de procesos.",
        "source": "https://knowledge.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-non-alloy-and-alloy-steel-tubes-with-specified-elevated-temperature-properties-1"
      },
      {
        "slug": "en-10224",
        "code": "EN 10224",
        "title": "Tubos y accesorios de acero para conducción de agua",
        "summary": "EN 10224 trata condiciones de suministro de tubos y accesorios de acero no aleado para conducción de agua y otros líquidos acuosos.",
        "covers": "Incluye determinadas familias de tubos soldados y sin soldadura y accesorios de conexión; el proyecto debe definir las protecciones necesarias.",
        "request": "Indica EN 10224 y edición, tipo de tubo o accesorio, diámetro, espesor, conexión, revestimiento, cantidades y certificados.",
        "caution": "No se debe equiparar automáticamente una especificación de agua con una norma estructural o de presión. La aptitud para agua potable puede requerir otras aprobaciones.",
        "source": "https://knowledge.bsigroup.com/products/non-alloy-steel-tubes-and-fittings-for-the-conveyance-of-water-and-other-aqueous-liquids-technical-delivery-conditions"
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
      },
      {
        "slug": "s355nh",
        "code": "S355NH",
        "title": "Calidad de acero estructural normalizado para perfiles huecos",
        "summary": "S355NH identifica una calidad estructural para perfiles huecos con condiciones de suministro específicas.",
        "covers": "Los sufijos NH forman parte de la designación y de los requisitos de suministro y tenacidad de la norma correspondiente.",
        "request": "Solicita S355NH con EN 10210, forma y dimensiones, espesor, condición de suministro y certificados.",
        "caution": "S355NH no sustituye automáticamente a S355J2H o S355NLH por compartir S355.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "s355nlh",
        "code": "S355NLH",
        "title": "Calidad estructural para perfiles huecos de tenacidad diferenciada",
        "summary": "S355NLH es una designación estructural con requisitos particulares de entrega y tenacidad para perfiles huecos.",
        "covers": "Los sufijos N, L y H deben mantenerse en la especificación completa del material.",
        "request": "Especifica S355NLH, norma de producto EN 10210, geometría, espesor e inspección.",
        "caution": "No es equivalente por defecto a S355NH; verifica las condiciones de entrega y ensayos.",
        "source": "https://landingpage.bsigroup.com/LandingPage/Series?UPI=BS+EN+10210"
      },
      {
        "slug": "p235gh",
        "code": "P235GH",
        "title": "Acero para presión con propiedades a temperatura elevada",
        "summary": "P235GH identifica una calidad de acero para presión con propiedades especificadas a temperaturas elevadas en ciertas normas de producto.",
        "covers": "GH sitúa la calidad en una familia destinada a temperatura elevada, pero no define cómo se fabrica el tubo.",
        "request": "Combina P235GH con EN 10216-2 para sin soldadura o una norma soldada adecuada como EN 10217-2, con dimensiones y documentación.",
        "caution": "P235GH no es automáticamente intercambiable con P265GH; tampoco define la presión máxima del equipo.",
        "source": "https://store.uni.com/en-10216-2-2024"
      },
      {
        "slug": "16mo3",
        "code": "16Mo3",
        "title": "Acero aleado con molibdeno para servicio a presión",
        "summary": "16Mo3 es una calidad de acero aleado utilizada en determinados tubos para presión a temperatura elevada.",
        "covers": "La designación no establece por sí misma una temperatura ni una presión de servicio admisible.",
        "request": "Indica 16Mo3, norma de producto como EN 10216-2, diámetro, espesor, ensayos y certificados.",
        "caution": "16Mo3 no es un sustituto automático de P235GH o P265GH; comprueba la especificación del proyecto.",
        "source": "https://store.uni.com/en-10216-2-2024"
      },
      {
        "slug": "p235tr1",
        "code": "P235TR1",
        "title": "Acero para tubos de presión, variante TR1",
        "summary": "P235TR1 es una designación de acero para tubos con propiedades a temperatura ambiente y nivel de calidad TR1.",
        "covers": "TR1 forma parte de la designación de calidad y de las exigencias de la norma del producto.",
        "request": "Indica P235TR1 y EN 10217-1, proceso, dimensiones y documentación de inspección.",
        "caution": "TR1 no se puede sustituir por TR2 sin examinar los requisitos técnicos.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "p235tr2",
        "code": "P235TR2",
        "title": "Acero para tubos de presión, variante TR2",
        "summary": "P235TR2 identifica una variante de calidad TR2 en tubos para presión a temperatura ambiente.",
        "covers": "La variante TR2 tiene exigencias diferenciadas de TR1 dentro del ámbito de la norma.",
        "request": "Especifica P235TR2 con EN 10217-1, tipo de soldadura, dimensiones y certificados.",
        "caution": "No se puede concluir equivalencia con P235TR1 ni conformidad del equipo a presión solo a partir del nombre.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "p265tr1",
        "code": "P265TR1",
        "title": "Acero P265 para tubos de presión, variante TR1",
        "summary": "P265TR1 es una calidad para tubos de presión con sufijo TR1 y propiedades especificadas a temperatura ambiente.",
        "covers": "La designación completa incluye la familia P265 y el nivel TR1.",
        "request": "Pide P265TR1 con EN 10217-1, método de fabricación, dimensiones y control documental.",
        "caution": "P265TR1 no equivale automáticamente a P235TR1 o P265TR2.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
      },
      {
        "slug": "p265tr2",
        "code": "P265TR2",
        "title": "Acero P265 para tubos de presión, variante TR2",
        "summary": "P265TR2 identifica una calidad TR2 para tubos de presión de la familia P265.",
        "covers": "TR2 constituye una designación de calidad distinta de TR1 y debe conservarse en pedidos y certificados.",
        "request": "Indica P265TR2, norma de producto EN 10217-1, fabricación, medidas y documentación.",
        "caution": "Las calidades P265TR1/P265TR2 no son equivalentes por defecto y no prueban aptitud de un equipo.",
        "source": "https://shop-checkout.bsigroup.com/products/welded-steel-tubes-for-pressure-purposes-technical-delivery-conditions-electric-welded-and-submerged-arc-welded-non-alloy-steel-tubes-with-specified-room-temperature-properties"
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
