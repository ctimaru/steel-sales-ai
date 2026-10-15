/**
 * CALC-INT3E.1 — indexable EU mass calculator landing pages.
 * Existing Italian/English URLs stay untouched. These localized public pages
 * use the exact same CALC-INT2 pure numerical engine and EU RFQ v1 bridge.
 * The US pipe/HSS product UI has not been translated in this release.
 */
export type CalculatorLandingLocale = "de" | "fr" | "es";
export type CalculatorSiteLocale = "it" | "en" | CalculatorLandingLocale;
export const CALCULATOR_ROUTES: Record<CalculatorSiteLocale,string> = {
  it:"/knowledge/tubes",
  en:"/en/knowledge/tubes",
  de:"/de/knowledge/tubes",
  fr:"/fr/knowledge/tubes",
  es:"/es/knowledge/tubes",
};
export const CALCULATOR_FLAGS:Record<CalculatorSiteLocale,{label:string;flag:string}> = {
  it:{label:"Italiano",flag:"🇮🇹"},
  en:{label:"English",flag:"🇬🇧"},
  de:{label:"Deutsch",flag:"🇩🇪"},
  fr:{label:"Français",flag:"🇫🇷"},
  es:{label:"Español",flag:"🇪🇸"},
};
export const CALCULATOR_LANGUAGE_ORDER:readonly CalculatorSiteLocale[] = ["it","en","de","fr","es"];
export const isNewCalculatorLocale = (value:string):value is CalculatorLandingLocale =>
  value==="de"||value==="fr"||value==="es";
export const localizedHrefLangPaths = () => ({...CALCULATOR_ROUTES});
export const LOCALE_HTML_TAG:Record<CalculatorLandingLocale,string>={de:"de",fr:"fr",es:"es"};

type LandingCopy={
 title:string;description:string;eyebrow:string;intro:string;
 shape:string;standard:string;round:string;square:string;rectangular:string;
 cold:string;hot:string;geometric:string;diameter:string;width:string;height:string;
 wall:string;density:string;length:string;bars:string;
 result:string;perBar:string;totalKg:string;totalTonnes:string;
 copy:string;copied:string;copyFailed:string;addBill:string;addFailed:string;
 invalid:string;disclaimer:string;methodTitle:string;methodText:string;
 readMore:string;rfqEnglish:string;noLogin:string;
 faqTitle:string;faq:[{q:string;a:string},{q:string;a:string},{q:string;a:string}];
};
export const CALCULATOR_TRANSLATIONS: Record<CalculatorLandingLocale,LandingCopy>={
 de:{
  title:"Stahlrohr-Gewichtsrechner – kg/m für Rund-, Quadrat- und Rechteckrohre",
  description:"Stahlrohrgewicht kostenlos berechnen: CHS, SHS und RHS nach EN 10219 oder EN 10210 sowie freie Geometrie. Ergebnisse in kg/m, kg je Stange und Tonnen.",
  eyebrow:"Kostenloses technisches Werkzeug · Stahlwissen",
  intro:"Berechnen Sie die theoretische Masse von Stahlhohlprofilen. Wählen Sie das Profil, die Berechnungsmethode und die Abmessungen. Das Ergebnis lässt sich kopieren oder in eine Stückliste für eine Angebotsanfrage übernehmen.",
  shape:"Querschnitt",standard:"Berechnungsmethode",round:"Rundrohr (CHS)",square:"Quadratrohr (SHS)",rectangular:"Rechteckrohr (RHS)",
  cold:"EN 10219 · kaltgeformt",hot:"EN 10210 · warmgefertigt",geometric:"Freie geometrische Berechnung",
  diameter:"Außendurchmesser D (mm)",width:"Außenbreite B (mm)",height:"Außenhöhe H (mm)",
  wall:"Wanddicke t (mm)",density:"Dichte (kg/m³)",length:"Stangenlänge (m)",bars:"Anzahl Stangen",
  result:"Theoretische Masse pro Meter",perBar:"Masse je Stange",totalKg:"Gesamtmasse",totalTonnes:"Gesamttonnage",
  copy:"Ergebnis kopieren",copied:"Ergebnis kopiert.",copyFailed:"Kopieren nicht möglich.",
  addBill:"Zur Anfrage-Stückliste hinzufügen",addFailed:"Übertragung fehlgeschlagen. Bitte Sitzungsspeicher des Browsers prüfen.",
  invalid:"Bitte gültige Abmessungen und eine positive ganze Stangenzahl eingeben.",
  disclaimer:"Theoretischer Näherungswert auf Basis der gewählten Geometrie. Keine Herstellerwägung, kein zertifiziertes Gewicht und kein Nachweis der Produktkonformität.",
  methodTitle:"EN 10210 und EN 10219: Unterschied bei den Ecken",
  methodText:"Für quadratische und rechteckige Hohlprofile verwenden die Berechnungsmodelle unterschiedliche nominelle Eckradien. Dadurch können sich die berechneten kg/m bei gleichen Außenmaßen unterscheiden. Die tatsächliche Lieferung muss mit dem Hersteller abgeglichen werden.",
  readMore:"Zum US-Rohrrechner (Englisch)",rfqEnglish:"Die anschließende Anfrage-Stückliste ist derzeit auf Englisch verfügbar; die Maße und die Methode bleiben erhalten.",noLogin:"Kostenlos, ohne Anmeldung.",
  faqTitle:"Häufige Fragen",
  faq:[
   {q:"Wie wird das Gewicht eines runden Stahlrohrs berechnet?",a:"Für ein Rundrohr gilt A = π × t × (D − t). Die Fläche in mm² wird mit der Stahldichte multipliziert und durch 1.000.000 geteilt, um kg/m zu erhalten."},
   {q:"Wieso unterscheiden sich EN 10210 und EN 10219?",a:"Bei quadratischen und rechteckigen Hohlprofilen werden je nach Herstellverfahren unterschiedliche nominelle Eckradien modelliert. Das beeinflusst die theoretische Querschnittsfläche."},
   {q:"Ist das berechnete Gewicht ein zertifizierter Wert?",a:"Nein. Es handelt sich um eine theoretische Masse; maßgeblich für eine Lieferung sind technische Unterlagen, Toleranzen und Nachweise des Herstellers."},
  ],
 },
 fr:{
  title:"Calculateur de poids de tubes acier – kg/m, CHS, SHS et RHS",
  description:"Calculez gratuitement la masse théorique des tubes acier ronds, carrés et rectangulaires selon EN 10219, EN 10210 ou la géométrie libre, en kg/m, par barre et en tonnes.",
  eyebrow:"Outil technique gratuit · Connaissances acier",
  intro:"Calculez la masse théorique des profilés creux en acier. Choisissez la section, la méthode et les dimensions. Copiez le résultat ou ajoutez-le à une liste pour demande de prix.",
  shape:"Section",standard:"Méthode de calcul",round:"Tube rond (CHS)",square:"Tube carré (SHS)",rectangular:"Tube rectangulaire (RHS)",
  cold:"EN 10219 · formé à froid",hot:"EN 10210 · fini à chaud",geometric:"Calcul géométrique libre",
  diameter:"Diamètre extérieur D (mm)",width:"Largeur extérieure B (mm)",height:"Hauteur extérieure H (mm)",
  wall:"Épaisseur t (mm)",density:"Masse volumique (kg/m³)",length:"Longueur de barre (m)",bars:"Nombre de barres",
  result:"Masse théorique par mètre",perBar:"Masse par barre",totalKg:"Masse totale",totalTonnes:"Tonnage total",
  copy:"Copier le résultat",copied:"Résultat copié.",copyFailed:"Copie impossible.",
  addBill:"Ajouter à la liste de demande de prix",addFailed:"Transfert impossible. Vérifiez le stockage de session du navigateur.",
  invalid:"Saisissez des dimensions valides et un nombre entier positif de barres.",
  disclaimer:"Estimation théorique de masse pour la géométrie sélectionnée : ce n'est ni un poids certifié, ni une mesure du fabricant, ni une preuve de conformité.",
  methodTitle:"EN 10210 et EN 10219 : différence de rayons d'angle",
  methodText:"Pour les sections creuses carrées ou rectangulaires, les modèles utilisent des rayons d'angle nominaux différents selon la fabrication. La masse calculée peut donc varier à dimensions extérieures identiques. Vérifiez les caractéristiques du produit auprès du fabricant.",
  readMore:"Calculateur de tubes américains (en anglais)",rfqEnglish:"La liste de demande de prix suivante est actuellement en anglais. Les dimensions et la méthode de calcul sont conservées.",noLogin:"Gratuit, sans inscription.",
  faqTitle:"Questions fréquentes",
  faq:[
   {q:"Comment calculer le poids d'un tube rond en acier ?",a:"Pour un tube rond, la surface de section vaut A = π × t × (D − t). Multipliez par la masse volumique, puis divisez par 1 000 000 pour obtenir des kg/m."},
   {q:"Pourquoi EN 10210 et EN 10219 donnent-ils des masses différentes ?",a:"Les rayons d'angle nominaux des sections carrées et rectangulaires varient selon le mode de fabrication, modifiant la surface théorique."},
   {q:"Le poids calculé est-il certifié ?",a:"Non. Il s'agit d'une estimation théorique ; la fourniture et les tolérances doivent être confirmées par le fabricant."},
  ],
 },
 es:{
  title:"Calculadora de peso de tubos de acero – kg/m, CHS, SHS y RHS",
  description:"Calcule gratis el peso teórico de tubos de acero redondos, cuadrados y rectangulares según EN 10219, EN 10210 o geometría libre, en kg/m, por barra y toneladas.",
  eyebrow:"Herramienta técnica gratuita · Conocimiento del acero",
  intro:"Calcule la masa teórica de perfiles huecos de acero. Elija la sección, el método y las dimensiones. Copie el resultado o añádalo a una lista para solicitar presupuestos.",
  shape:"Sección",standard:"Método de cálculo",round:"Tubo redondo (CHS)",square:"Tubo cuadrado (SHS)",rectangular:"Tubo rectangular (RHS)",
  cold:"EN 10219 · conformado en frío",hot:"EN 10210 · acabado en caliente",geometric:"Cálculo geométrico libre",
  diameter:"Diámetro exterior D (mm)",width:"Ancho exterior B (mm)",height:"Alto exterior H (mm)",
  wall:"Espesor t (mm)",density:"Densidad (kg/m³)",length:"Longitud de barra (m)",bars:"Número de barras",
  result:"Masa teórica por metro",perBar:"Masa por barra",totalKg:"Masa total",totalTonnes:"Tonelaje total",
  copy:"Copiar resultado",copied:"Resultado copiado.",copyFailed:"No se pudo copiar.",
  addBill:"Añadir a la lista de solicitud de presupuesto",addFailed:"No se pudo transferir. Compruebe el almacenamiento de sesión del navegador.",
  invalid:"Introduzca dimensiones válidas y un número entero positivo de barras.",
  disclaimer:"Estimación teórica para la geometría seleccionada. No equivale a un peso certificado, una medición del fabricante ni una prueba de conformidad.",
  methodTitle:"EN 10210 frente a EN 10219: radios de las esquinas",
  methodText:"En perfiles huecos cuadrados y rectangulares, los modelos emplean distintos radios nominales de las esquinas según el método de fabricación. Esto puede cambiar los kg/m calculados para las mismas dimensiones exteriores. Confirme las características del producto con el fabricante.",
  readMore:"Calculadora de tubos estadounidenses (en inglés)",rfqEnglish:"La siguiente lista de solicitud de presupuesto está disponible actualmente en inglés. Se conservan las medidas y el método de cálculo.",noLogin:"Gratis y sin registro.",
  faqTitle:"Preguntas frecuentes",
  faq:[
   {q:"¿Cómo se calcula el peso de un tubo redondo de acero?",a:"Para un tubo redondo, el área es A = π × t × (D − t). Se multiplica por la densidad del acero y se divide entre 1.000.000 para obtener kg/m."},
   {q:"¿Por qué EN 10210 y EN 10219 pueden dar pesos distintos?",a:"Las esquinas nominales de los perfiles cuadrados y rectangulares se modelan con radios diferentes según su fabricación, lo que modifica el área de sección calculada."},
   {q:"¿Es un peso certificado?",a:"No. Es una estimación teórica; el fabricante debe confirmar las tolerancias, la documentación y el peso real del producto suministrado."},
  ],
 },
};
