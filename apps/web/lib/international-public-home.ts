import type { CalculatorLandingLocale } from "@/lib/international-calculator-landing";

/** Purposefully scoped public landing copy: DE/FR/ES homepage entry, not full localized workspace. */
export const INTERNATIONAL_PUBLIC_HOME: Record<CalculatorLandingLocale,{
  title:string;description:string;eyebrow:string;headline:string;accent:string;intro:string;
  freeLabel:string;calculator:string;calculatorDescription:string;
  bill:string;billDescription:string;systemLabel:string;eu:string;us:string;
  stepOne:string;stepTwo:string;stepThree:string;
  workflowsTitle:string;workflowsDescription:string;
  platformTitle:string;platformDescription:string;register:string;registerNotice:string;
  login:string;home:string;contact:string;privacy:string;
  safetyTitle:string;safetyDescription:string;footnote:string;
}> = {
  de:{
    title:"Smart Steel Sales | Stahlrohr-Rechner und Angebots-Stückliste",
    description:"Stahlrohre kostenlos berechnen: EN 10210/10219, NPS/Schedule und ASTM A500. Stückliste für Angebotsanfragen erstellen, ohne Anmeldung.",
    eyebrow:"SMART STEEL INTELLIGENCE · KOSTENLOSE WERKZEUGE",
    headline:"Stahl besser berechnen.",accent:"Angebote klarer anfragen.",
    intro:"Ein Einstieg für das Stahlgeschäft: theoretische Rohrmassen berechnen, Positionen strukturieren und eine Angebotsanfrage als E-Mail vorbereiten. Kostenlos und ohne Anmeldung.",
    freeLabel:"Kostenlos · ohne Konto",
    calculator:"Stahlrohr-Gewichtsrechner öffnen",calculatorDescription:"EN 10210/10219 oder USA NPS/Schedule und HSS ASTM A500. kg/m, kg je Stange und Tonnen.",
    bill:"Anfrage-Stückliste erstellen",billDescription:"Positionen zusammenstellen, Werkstoffgüte ergänzen und eine Anfrage für Lieferanten kopieren.",
    systemLabel:"Zwei technische Systeme",
    eu:"EUROPA · EN 10210 / EN 10219",us:"USA · NPS / SCHEDULE / ASTM",
    stepOne:"01 · Maße und Berechnungsmodell wählen",
    stepTwo:"02 · Menge prüfen und zur Stückliste hinzufügen",
    stepThree:"03 · Güte ergänzen und Anfrage kopieren",
    workflowsTitle:"Vom Gewicht zur strukturierten Anfrage.",
    workflowsDescription:"Beginnen Sie mit einer Berechnung und übernehmen Sie die Position in die kostenlose Anfrage-Stückliste. Kein Medienbruch, kein automatischer Versand.",
    platformTitle:"Mehr als ein Gewichtsrechner",
    platformDescription:"Smart Steel Sales entwickelt geschützte Unternehmensfunktionen für RFQs, Lieferanten und Marktbeziehungen. Der öffentliche Entwurf wird durch eine Registrierung nicht automatisch gespeichert oder übernommen.",
    register:"Unternehmen registrieren (Englisch)",registerNotice:"Registrierung und Unternehmensprüfung derzeit auf Englisch. Weitere private Bereiche und Rechtstexte teilweise auf Italienisch.",
    login:"Anmelden (Englisch)",home:"Startseite",contact:"Kontakt",privacy:"Datenschutz (IT)",
    safetyTitle:"Klarheit bei technischen Daten",
    safetyDescription:"Rechnerergebnisse sind theoretische Näherungen; API-/ASTM-Anforderungen und Katalog-Nennmassen gelten nicht als Zertifizierung. Der Lieferant muss Eignung und Liefermasse bestätigen.",
    footnote:"Öffentliche Werkzeuge versenden keine RFQs und veröffentlichen keine kaufmännischen Daten.",
  },
  fr:{
    title:"Smart Steel Sales | Calculateur tubes acier et demande de prix",
    description:"Calculez gratuitement le poids des tubes acier EN 10210/10219, NPS/Schedule et HSS ASTM A500. Préparez une liste de demande de prix sans inscription.",
    eyebrow:"SMART STEEL INTELLIGENCE · OUTILS GRATUITS",
    headline:"Calculez l'acier plus simplement.",accent:"Demandez vos prix plus clairement.",
    intro:"Un point de départ pour les professionnels de l'acier : estimez la masse des tubes, structurez vos lignes et préparez un courriel de demande de prix. Gratuit, sans inscription.",
    freeLabel:"Gratuit · sans compte",
    calculator:"Ouvrir le calculateur de tubes",calculatorDescription:"EN 10210/10219 ou USA NPS/Schedule et HSS ASTM A500. kg/m, masse par barre et tonnes.",
    bill:"Créer une liste de demande de prix",billDescription:"Rassemblez les lignes, précisez les nuances et copiez une demande destinée aux fournisseurs.",
    systemLabel:"Deux systèmes techniques",
    eu:"EUROPE · EN 10210 / EN 10219",us:"USA · NPS / SCHEDULE / ASTM",
    stepOne:"01 · Choisir les dimensions et la méthode",
    stepTwo:"02 · Vérifier la quantité et ajouter à la liste",
    stepThree:"03 · Préciser la nuance et copier la demande",
    workflowsTitle:"Du calcul à une demande structurée.",
    workflowsDescription:"Commencez par une masse théorique et transférez la ligne vers une liste de demande de prix. Aucun envoi automatique ni changement d'outil.",
    platformTitle:"Bien plus qu'un calculateur de poids",
    platformDescription:"Smart Steel Sales développe des fonctionnalités privées pour les demandes de prix, les fournisseurs et les relations commerciales. L'inscription ne sauvegarde ni ne transfère automatiquement votre brouillon public.",
    register:"Inscrire votre entreprise (anglais)",registerNotice:"Inscription et vérification de l'entreprise actuellement en anglais. Certains espaces privés et textes juridiques restent en italien.",
    login:"Connexion (anglais)",home:"Accueil",contact:"Contact",privacy:"Confidentialité (IT)",
    safetyTitle:"Des données techniques sans ambiguïté",
    safetyDescription:"Les masses calculées sont théoriques. Exigences API/ASTM et masses nominales des catalogues ne constituent pas une certification : les fournisseurs doivent confirmer la conformité et les masses livrées.",
    footnote:"Ces outils publics n'envoient aucune demande et ne publient aucune donnée commerciale.",
  },
  es:{
    title:"Smart Steel Sales | Calculadora de tubos de acero y solicitudes de oferta",
    description:"Calcule gratis el peso de tubos de acero EN 10210/10219, NPS/Schedule y HSS ASTM A500. Prepare una lista para solicitar ofertas sin registrarse.",
    eyebrow:"SMART STEEL INTELLIGENCE · HERRAMIENTAS GRATUITAS",
    headline:"Calcule el acero con claridad.",accent:"Solicite ofertas sin complicaciones.",
    intro:"Un punto de partida para profesionales del acero: calcule masas teóricas de tubos, organice partidas y prepare un correo de solicitud de oferta. Gratis y sin registro.",
    freeLabel:"Gratis · sin cuenta",
    calculator:"Abrir calculadora de tubos",calculatorDescription:"EN 10210/10219 o USA NPS/Schedule y HSS ASTM A500. kg/m, peso por barra y toneladas.",
    bill:"Crear lista para solicitar ofertas",billDescription:"Reúna partidas, confirme la calidad del acero y copie una solicitud para sus proveedores.",
    systemLabel:"Dos sistemas técnicos",
    eu:"EUROPA · EN 10210 / EN 10219",us:"EE. UU. · NPS / SCHEDULE / ASTM",
    stepOne:"01 · Elegir dimensiones y método de cálculo",
    stepTwo:"02 · Revisar cantidad y añadir a la lista",
    stepThree:"03 · Confirmar calidad y copiar la solicitud",
    workflowsTitle:"Del cálculo a una solicitud estructurada.",
    workflowsDescription:"Parta del peso teórico y transfiera la partida a la lista de solicitud de oferta. Sin envío automático ni interrupciones innecesarias.",
    platformTitle:"Más que una calculadora de peso",
    platformDescription:"Smart Steel Sales desarrolla funciones empresariales privadas para solicitudes, proveedores y relaciones comerciales. El registro no guarda ni transfiere automáticamente el borrador público.",
    register:"Registrar empresa (en inglés)",registerNotice:"Registro y revisión empresarial actualmente en inglés. Algunas áreas privadas y documentos legales siguen en italiano.",
    login:"Iniciar sesión (en inglés)",home:"Inicio",contact:"Contacto",privacy:"Privacidad (IT)",
    safetyTitle:"Datos técnicos con contexto",
    safetyDescription:"Las masas calculadas son teóricas. Los requisitos API/ASTM y los pesos nominales de catálogo no certifican un producto: el proveedor debe confirmar la conformidad y la masa de suministro.",
    footnote:"Estas herramientas públicas no envían solicitudes ni publican datos comerciales.",
  },
};
