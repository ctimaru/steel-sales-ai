import { CALCULATOR_LANGUAGE_ORDER, type CalculatorSiteLocale } from "@/lib/international-calculator-landing";

export type SchoolWorkspaceLocale = CalculatorSiteLocale;
export const schoolWorkspaceLanguageOrder = CALCULATOR_LANGUAGE_ORDER;
export const isSchoolWorkspaceLocale = (input: unknown): input is SchoolWorkspaceLocale =>
  typeof input === "string" && (schoolWorkspaceLanguageOrder as readonly string[]).includes(input);

/** A private workspace URL is always /school/...; locale is presentation, never authorization. */
export function schoolWorkspaceLocale(value: unknown): SchoolWorkspaceLocale {
  return isSchoolWorkspaceLocale(value) ? value : "it";
}
export function schoolWorkspaceHref(path: string, locale: SchoolWorkspaceLocale): string {
  if (!/^\/school(?:\/[a-z0-9-]+)*$/.test(path)) throw new Error("School workspace route only");
  return locale === "it" ? path : path + "?lang=" + locale;
}
export const SCHOOL_PRIVATE_COPY = {
  it: {
    brand:"Scuola",welcome:"La tua officina tecnica privata",intro:"Calcola, consulta e approfondisci. I tuoi documenti aziendali restano separati dalla conoscenza pubblica.",
    kicker:"Workspace aziendale",switchLabel:"Lingua della Scuola privata",publicLabel:"Apri Scuola pubblica",
    calculator:"Calcolo pesi tubi",calcHint:"Calcola kg/m, peso barra e tonnellate con EN 10210 o EN 10219.",calcAction:"Apri calcolatore",
    search:"Ricerca tecnica",searchHint:"Cerca una norma o una designazione di acciaio senza uscire dal workspace.",
    standards:"Norme tecniche",grades:"Gradi di acciaio",searchAction:"Cerca",clear:"Cancella ricerca",
    docs:"Documenti aziendali",docsHint:"Consulta documenti, offerte e ordini solo con i permessi della tua azienda.",docsAction:"Apri documenti privati",
    publicNote:"Per le altre lingue, il calcolatore e gli articoli pubblici si aprono nella versione localizzata.",
    sourceNote:"Le descrizioni tecniche non ancora tradotte restano contrassegnate come fonte italiana.",
    originalItalian:"Fonte editoriale italiana",englishGuides:"Schede in inglese già pubblicate",none:"Nessun risultato pubblicato",returnHome:"Torna alla Scuola",
    read:"Apri riferimento",listed:"Riferimenti pubblicati",latest:"Recenti e preferiti",savedHint:"Salvati su questo dispositivo, non condivisi",
    favorites:"Preferiti",recent:"Recenti",emptyRecent:"Le sezioni visitate compariranno qui.",loading:"Caricamento",
    removeFavorite:"Rimuovi dai preferiti",addFavorite:"Aggiungi ai preferiti",
    sourceDisclosure:"I documenti aziendali non diventano pubblici scegliendo un'altra lingua.",
    privateExplorerOriginal:"L'interfaccia di ricerca documentale sottostante è attualmente disponibile in italiano.",
    allTools:"Risorse della Scuola",referenceNotice:"Verifica sempre l'edizione ufficiale della norma e l'applicabilità del prodotto.",
  },
  en:{
    brand:"School",welcome:"Your private steel technical workspace",intro:"Calculate, search and review technical references. Your company documents stay separate from public knowledge.",
    kicker:"Company workspace",switchLabel:"Private School language",publicLabel:"Open public School",
    calculator:"Steel tube weight calculator",calcHint:"Calculate kg/m, bar mass and tonnes with EN 10210 or EN 10219.",calcAction:"Open calculator",
    search:"Technical search",searchHint:"Search a standard or steel grade within your workspace.",
    standards:"Technical standards",grades:"Steel grades",searchAction:"Search",clear:"Clear search",
    docs:"Company documents",docsHint:"Explore private company documents, offers and orders under your existing permissions.",docsAction:"Open private documents",
    publicNote:"Localized calculators open on the public School; your private documents never follow that link.",
    sourceNote:"Only already-published English technical summaries are displayed as translated. Other source records are explicitly marked Italian.",
    originalItalian:"Original source: Italian",englishGuides:"Published English guides",none:"No published records found",returnHome:"Back to School",
    read:"Read reference",listed:"Published references",latest:"Recent items and favorites",savedHint:"Stored on this device, not shared",
    favorites:"Favorites",recent:"Recent",emptyRecent:"Visited sections will appear here.",loading:"Loading",
    removeFavorite:"Remove from favorites",addFavorite:"Add to favorites",
    sourceDisclosure:"Changing language does not expose company data or change your access rights.",
    privateExplorerOriginal:"The underlying document search interface is currently in Italian; source documents retain their original language.",
    allTools:"School resources",referenceNotice:"Always verify the official standard edition and product applicability.",
  },
  de:{
    brand:"Stahlschule",welcome:"Ihr privater technischer Arbeitsbereich",intro:"Rohrmassen berechnen, Normen und Stahlsorten suchen. Firmendokumente bleiben von öffentlichen Inhalten getrennt.",
    kicker:"Firmen-Workspace",switchLabel:"Sprache der privaten Stahlschule",publicLabel:"Öffentliche Stahlschule öffnen",
    calculator:"Rohrgewichtsrechner",calcHint:"kg/m, Stangenmasse und Tonnen nach EN 10210 oder EN 10219 berechnen.",calcAction:"Rechner öffnen",
    search:"Technische Suche",searchHint:"Normen und Werkstoffbezeichnungen innerhalb Ihres Workspaces suchen.",
    standards:"Technische Normen",grades:"Stahlsorten",searchAction:"Suchen",clear:"Suche löschen",
    docs:"Firmendokumente",docsHint:"Private Dokumente, Angebote und Aufträge gemäß Ihren bestehenden Berechtigungen.",docsAction:"Private Dokumente öffnen",
    publicNote:"Der lokalisierte Rechner öffnet die öffentliche Stahlschule. Private Daten werden nicht übertragen.",
    sourceNote:"Technische Beschreibungen ohne geprüfte deutsche Übersetzung bleiben als italienische Quellen gekennzeichnet.",
    originalItalian:"Originalquelle: Italienisch",englishGuides:"Bereits veröffentlichte englische Leitfäden",none:"Keine veröffentlichten Einträge gefunden",returnHome:"Zur Stahlschule",
    read:"Quelle öffnen",listed:"Veröffentlichte Referenzen",latest:"Zuletzt besucht und Favoriten",savedHint:"Nur auf diesem Gerät gespeichert",
    favorites:"Favoriten",recent:"Zuletzt besucht",emptyRecent:"Besuchte Bereiche werden hier angezeigt.",loading:"Laden",
    removeFavorite:"Aus Favoriten entfernen",addFavorite:"Zu Favoriten hinzufügen",
    sourceDisclosure:"Der Sprachwechsel ändert weder Berechtigungen noch die Sichtbarkeit von Firmendaten.",
    privateExplorerOriginal:"Die zugrunde liegende Dokumentensuche ist derzeit auf Italienisch; Quellen bleiben in ihrer Originalsprache.",
    allTools:"Ressourcen der Stahlschule",referenceNotice:"Amtliche Normausgabe und Produktanwendung immer prüfen.",
  },
  fr:{
    brand:"École de l’acier",welcome:"Votre espace technique privé",intro:"Calculez le poids des tubes et recherchez des normes ou nuances. Les documents professionnels restent privés.",
    kicker:"Espace entreprise",switchLabel:"Langue de l’École privée",publicLabel:"Ouvrir l’École publique",
    calculator:"Calculateur de poids des tubes",calcHint:"Calculez les kg/m, la masse par barre et les tonnes selon EN 10210 ou EN 10219.",calcAction:"Ouvrir le calculateur",
    search:"Recherche technique",searchHint:"Recherchez une norme ou une nuance dans votre espace de travail.",
    standards:"Normes techniques",grades:"Nuances d’acier",searchAction:"Rechercher",clear:"Effacer la recherche",
    docs:"Documents de l’entreprise",docsHint:"Consultez les documents, offres et commandes dans les limites de vos autorisations.",docsAction:"Ouvrir les documents privés",
    publicNote:"Le calculateur localisé s’ouvre dans l’École publique, sans transfert de données privées.",
    sourceNote:"Les descriptions techniques sans traduction française validée sont indiquées comme sources italiennes.",
    originalItalian:"Source originale : italien",englishGuides:"Guides anglais déjà publiés",none:"Aucune référence publiée trouvée",returnHome:"Retour à l’École",
    read:"Ouvrir la référence",listed:"Références publiées",latest:"Récents et favoris",savedHint:"Enregistrés uniquement sur cet appareil",
    favorites:"Favoris",recent:"Récents",emptyRecent:"Les rubriques visitées apparaîtront ici.",loading:"Chargement",
    removeFavorite:"Retirer des favoris",addFavorite:"Ajouter aux favoris",
    sourceDisclosure:"Changer de langue ne modifie ni les autorisations ni la confidentialité de votre entreprise.",
    privateExplorerOriginal:"L’interface de recherche documentaire est actuellement en italien ; les documents restent dans leur langue d’origine.",
    allTools:"Ressources de l’École",referenceNotice:"Vérifiez toujours l’édition officielle et l’application de la norme.",
  },
  es:{
    brand:"Escuela del acero",welcome:"Tu espacio técnico privado",intro:"Calcula el peso de los tubos y busca normas o calidades de acero. Los documentos de empresa permanecen privados.",
    kicker:"Espacio empresarial",switchLabel:"Idioma de la Escuela privada",publicLabel:"Abrir Escuela pública",
    calculator:"Calculadora de peso de tubos",calcHint:"Calcula kg/m, peso por barra y toneladas según EN 10210 o EN 10219.",calcAction:"Abrir calculadora",
    search:"Búsqueda técnica",searchHint:"Busca normas o calidades dentro de tu espacio de trabajo.",
    standards:"Normas técnicas",grades:"Calidades de acero",searchAction:"Buscar",clear:"Limpiar búsqueda",
    docs:"Documentos de empresa",docsHint:"Consulta documentos, ofertas y pedidos bajo los permisos existentes.",docsAction:"Abrir documentos privados",
    publicNote:"La calculadora localizada abre la Escuela pública sin trasladar documentos privados.",
    sourceNote:"Las descripciones sin traducción española validada se muestran como fuentes originales italianas.",
    originalItalian:"Fuente original: italiano",englishGuides:"Guías inglesas ya publicadas",none:"No se encontraron referencias publicadas",returnHome:"Volver a la Escuela",
    read:"Abrir referencia",listed:"Referencias publicadas",latest:"Recientes y favoritos",savedHint:"Guardados solo en este dispositivo",
    favorites:"Favoritos",recent:"Recientes",emptyRecent:"Las secciones visitadas aparecerán aquí.",loading:"Cargando",
    removeFavorite:"Eliminar de favoritos",addFavorite:"Añadir a favoritos",
    sourceDisclosure:"Cambiar el idioma no modifica permisos ni la privacidad de los datos empresariales.",
    privateExplorerOriginal:"La interfaz de búsqueda documental todavía está en italiano; los documentos conservan su idioma original.",
    allTools:"Recursos de la Escuela",referenceNotice:"Comprueba siempre la edición oficial y aplicación de la norma.",
  },
} as const satisfies Record<SchoolWorkspaceLocale, Record<string,string>>;
