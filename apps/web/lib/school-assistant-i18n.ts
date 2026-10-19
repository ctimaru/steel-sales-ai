import type { SchoolWorkspaceLocale } from "@/lib/school-workspace-i18n";

type AssistantCopy = {
  title:string; eyebrow:string; intro:string; mode:string; privacy:string; placeholder:string;
  ask:string; clear:string; loading:string; sources:string; noEvidence:string; error:string;
  empty:string; start:string; results:string; facts:string; clarification:string; preview:string;
  verify:string; openCalc:string; bill:string; note:string; standard:string; grade:string; shape:string;
  dimensions:string; quantity:string; length:string; unverified:string; found:string; askMore:string;
  missing:Record<"standard"|"grade"|"family"|"dimensions"|"thickness"|"quantity"|"length",string>;
  example1:string; example2:string;
  aiLabel:string;aiPrivacy:string;aiAction:string;aiWorking:string;aiReview:string;aiError:string;
  voiceStart:string;voiceStop:string;voiceUnsupported:string;voiceError:string;voiceCaution:string;
};
export const SCHOOL_ASSISTANT_COPY:Record<SchoolWorkspaceLocale,AssistantCopy> = {
  it:{
    title:"Assistente tecnico",eyebrow:"Smart Steel School · Intelligence-ready",
    intro:"Descrivi il tubo o chiedi di una norma. L'assistente estrae i dati espliciti e recupera schede pubblicate con fonti; non inventa dimensioni o certificazioni.",
    mode:"Ricerca conversazionale guidata · non AI generativa",privacy:"Il testo completo resta nel browser. Al catalogo pubblico vengono inviati solo i codici tecnici riconosciuti.",
    placeholder:"Es. Cerco 40 tubi tondi da 3 metri EN 10219 S235",ask:"Invia",clear:"Nuova conversazione",loading:"Consulto le fonti…",
    sources:"Fonti pubblicate",noEvidence:"Non ho trovato una scheda verificabile per questi codici. Specifica una norma EN o un grado completo; non deduco equivalenze.",
    error:"La consultazione delle fonti non è disponibile. Nessuna conclusione tecnica viene proposta senza verifica.",
    empty:"Parti con una domanda tecnica o descrivi la tua esigenza.",start:"Prova un esempio",results:"Riscontro dalle fonti",facts:"Dati riconosciuti",
    clarification:"Per preparare una distinta servono ancora",preview:"Anteprima richiesta",verify:"Controlla i dati prima di qualsiasi uso commerciale.",
    openCalc:"Verifica nel calcolatore",bill:"Apri Distinta (compilazione manuale)",note:"La distinta non è ancora compilata automaticamente. Nessuna RFQ, ordine o connessione viene inviata.",
    standard:"Norma",grade:"Acciaio",shape:"Sagoma",dimensions:"Dimensioni",quantity:"Barre",length:"Lunghezza",unverified:"designazione incompleta",found:"Dati raccolti",askMore:"Rispondi indicando le informazioni mancanti; puoi usare messaggi successivi.",
    missing:{standard:"norma di prodotto completa",grade:"designazione completa del grado",family:"sagoma CHS / SHS / RHS",
      dimensions:"dimensioni esterne in mm",thickness:"spessore in mm",quantity:"numero di barre",length:"lunghezza per barra in m"},
    aiLabel:"Sintesi AI con fonti",aiPrivacy:"Solo codici tecnici e schede pubbliche K2 raggiungono il modello dopo il tuo clic. Nessun testo privato viene inviato.",aiAction:"Genera sintesi verificabile",aiWorking:"Consultazione AI…",aiReview:"Controlla l’edizione ufficiale e conferma prima di usare queste informazioni in una RFQ.",aiError:"Sintesi non disponibile. Restano consultabili le schede pubblicate.",voiceStart:"🎙️ Dettatura",voiceStop:"Interrompi",voiceUnsupported:"Dettatura non disponibile su questo browser sicuro.",voiceError:"Microfono negato o trascrizione non riuscita.",voiceCaution:"Il browser può usare un servizio vocale esterno. Trascrizione modificabile prima dell’invio.",
    example1:"Cerco 40 tubi a 3 metri EN 10219 S235",example2:"Differenza EN 10210 e EN 10219"
  },
  en:{
    title:"Technical assistant",eyebrow:"Smart Steel School · Intelligence-ready",
    intro:"Describe a tube or ask about a standard. The assistant extracts explicit details and retrieves cited public references, without inventing dimensions or certification.",
    mode:"Guided conversational lookup · not generative AI",privacy:"Your full message stays in the browser. Only extracted technical codes are sent to the public catalog.",
    placeholder:"e.g. Need 40 round tubes, 3 metres, EN 10219 S235",ask:"Send",clear:"New conversation",loading:"Checking sources…",
    sources:"Published sources",noEvidence:"No verifiable article was found for those codes. Enter an EN standard or full grade; no equivalences are inferred.",
    error:"Sources are temporarily unavailable. No unverified technical answer will be given.",
    empty:"Ask a technical question or describe your requirement.",start:"Try an example",results:"Evidence from sources",facts:"Recognized details",
    clarification:"Still needed for an RFQ bill",preview:"Enquiry preview",verify:"Verify all details before any commercial use.",
    openCalc:"Verify in calculator",bill:"Open RFQ bill (manual entry)",note:"The RFQ bill is not populated automatically yet. No RFQ or purchase order is sent.",
    standard:"Standard",grade:"Grade",shape:"Shape",dimensions:"Dimensions",quantity:"Bars",length:"Bar length",unverified:"incomplete designation",found:"Details captured",askMore:"Reply with missing details; follow-up messages build on previous facts.",
    missing:{standard:"complete product standard",grade:"full steel grade",family:"CHS / SHS / RHS section",
      dimensions:"external dimensions in mm",thickness:"wall thickness in mm",quantity:"bar quantity",length:"bar length in m"},
    aiLabel:"Source-cited AI synthesis",aiPrivacy:"Only technical codes and published K2 cards are sent to the model, after your click. Private text is never forwarded.",aiAction:"Generate grounded summary",aiWorking:"Checking AI…",aiReview:"Verify the official standard edition and approve before using in any RFQ.",aiError:"AI synthesis unavailable. Published cards remain accessible.",voiceStart:"🎙️ Dictate",voiceStop:"Stop",voiceUnsupported:"Dictation unavailable in this secure browser.",voiceError:"Microphone denied or transcription unsuccessful.",voiceCaution:"Your browser may use an external speech service. Review and edit the transcript before sending.",
    example1:"Need 40 round tubes of 3 metres EN 10219 S235",example2:"EN 10210 versus EN 10219"
  },
  de:{
    title:"Technischer Assistent",eyebrow:"Smart Steel School · Intelligence-ready",
    intro:"Beschreiben Sie ein Rohr oder fragen Sie nach einer Norm. Der Assistent erfasst nur ausdrücklich genannte Daten und zeigt veröffentlichte Quellen.",
    mode:"Geführte dialogische Suche · keine generative KI",privacy:"Die gesamte Nachricht bleibt im Browser. Nur erkannte technische Codes gehen an den öffentlichen Katalog.",
    placeholder:"z. B. Suche 40 runde Rohre, 3 Meter, EN 10219 S235",ask:"Senden",clear:"Neuer Dialog",loading:"Quellen werden geprüft…",
    sources:"Veröffentlichte Quellen",noEvidence:"Kein verifizierbarer Eintrag zu diesen Codes. Bitte Norm oder vollständige Stahlgüte nennen; keine Gleichwertigkeit wird abgeleitet.",
    error:"Die Quellen sind derzeit nicht erreichbar. Keine ungeprüfte technische Antwort.",
    empty:"Stellen Sie eine technische Frage oder beschreiben Sie Ihren Bedarf.",start:"Beispiel nutzen",results:"Ergebnis aus Quellen",facts:"Erkannte Angaben",
    clarification:"Für die Stückliste fehlen",preview:"Anfragevorschau",verify:"Alle Angaben vor geschäftlicher Nutzung prüfen.",
    openCalc:"Im Rechner prüfen",bill:"Stückliste öffnen (manuell)",note:"Die Stückliste wird noch nicht automatisch befüllt. Keine Anfrage oder Bestellung wird versandt.",
    standard:"Norm",grade:"Güte",shape:"Form",dimensions:"Abmessungen",quantity:"Stangen",length:"Stangenlänge",unverified:"unvollständige Bezeichnung",found:"Erfasste Angaben",askMore:"Ergänzen Sie die fehlenden Angaben in einer neuen Nachricht.",
    missing:{standard:"vollständige Produktnorm",grade:"vollständige Stahlgüte",family:"Profil CHS / SHS / RHS",
      dimensions:"Außenmaße in mm",thickness:"Wanddicke in mm",quantity:"Stückzahl",length:"Länge je Stange in m"},
    aiLabel:"KI-Zusammenfassung mit Quellen",aiPrivacy:"Erst nach Klick werden technische Codes und veröffentlichte K2-Daten übertragen, keine privaten Nachrichten.",aiAction:"Belegte Zusammenfassung",aiWorking:"KI wird geprüft…",aiReview:"Amtliche Normausgabe prüfen und vor einer Anfrage bestätigen.",aiError:"KI-Zusammenfassung nicht verfügbar. Quellen bleiben lesbar.",voiceStart:"🎙️ Diktieren",voiceStop:"Stopp",voiceUnsupported:"Diktat in diesem sicheren Browser nicht verfügbar.",voiceError:"Mikrofon abgelehnt oder Transkription fehlgeschlagen.",voiceCaution:"Der Browser kann einen externen Spracherkennungsdienst verwenden. Text vor dem Senden prüfen.",
    example1:"Suche 40 runde Rohre 3 Meter EN 10219 S235",example2:"EN 10210 im Vergleich zu EN 10219"
  },
  fr:{
    title:"Assistant technique",eyebrow:"Smart Steel School · Intelligence-ready",
    intro:"Décrivez un tube ou interrogez une norme. L'assistant extrait seulement les données indiquées et recherche des sources publiques citées.",
    mode:"Recherche guidée par dialogue · pas d'IA générative",privacy:"Votre message complet reste dans le navigateur. Seuls les codes techniques détectés sont envoyés au catalogue public.",
    placeholder:"Ex. Cherche 40 tubes ronds de 3 mètres EN 10219 S235",ask:"Envoyer",clear:"Nouvelle conversation",loading:"Consultation des sources…",
    sources:"Sources publiées",noEvidence:"Aucune fiche vérifiable trouvée pour ces codes. Précisez la norme ou la nuance complète; aucune équivalence n'est présumée.",
    error:"Les sources sont indisponibles. Aucune réponse technique non vérifiée.",
    empty:"Posez une question technique ou décrivez votre besoin.",start:"Exemple",results:"Résultats sourcés",facts:"Informations reconnues",
    clarification:"Pour préparer la liste il manque",preview:"Aperçu de demande",verify:"Vérifiez les données avant tout usage commercial.",
    openCalc:"Vérifier au calculateur",bill:"Ouvrir la liste (saisie manuelle)",note:"La liste n'est pas préremplie automatiquement. Aucune demande ni commande n'est envoyée.",
    standard:"Norme",grade:"Nuance",shape:"Section",dimensions:"Dimensions",quantity:"Barres",length:"Longueur",unverified:"désignation incomplète",found:"Informations recueillies",askMore:"Complétez les éléments manquants dans un message suivant.",
    missing:{standard:"norme de produit complète",grade:"nuance d'acier complète",family:"forme CHS / SHS / RHS",
      dimensions:"dimensions externes en mm",thickness:"épaisseur en mm",quantity:"nombre de barres",length:"longueur par barre en m"},
    aiLabel:"Synthèse IA avec sources",aiPrivacy:"Seuls les codes techniques et les fiches K2 publiées sont transmis après votre clic; aucun texte privé.",aiAction:"Générer une synthèse sourcée",aiWorking:"Vérification IA…",aiReview:"Vérifiez la norme officielle avant tout usage dans une demande de prix.",aiError:"Synthèse indisponible. Les références restent consultables.",voiceStart:"🎙️ Dicter",voiceStop:"Arrêter",voiceUnsupported:"Dictée indisponible dans ce navigateur sécurisé.",voiceError:"Microphone refusé ou transcription échouée.",voiceCaution:"Le navigateur peut utiliser un service vocal externe. Relisez la transcription avant l’envoi.",
    example1:"Cherche 40 tubes ronds de 3 mètres EN 10219 S235",example2:"Différence entre EN 10210 et EN 10219"
  },
  es:{
    title:"Asistente técnico",eyebrow:"Smart Steel School · Intelligence-ready",
    intro:"Describe un tubo o pregunta por una norma. El asistente extrae solo datos explícitos y recupera referencias públicas citadas.",
    mode:"Búsqueda conversacional guiada · no es IA generativa",privacy:"El mensaje completo permanece en tu navegador. Solo los códigos técnicos se consultan en el catálogo público.",
    placeholder:"Ej. Busco 40 tubos redondos de 3 metros EN 10219 S235",ask:"Enviar",clear:"Nueva conversación",loading:"Consultando fuentes…",
    sources:"Fuentes publicadas",noEvidence:"No se encontró una ficha verificable para esos códigos. Indica norma o calidad completa; no se presumen equivalencias.",
    error:"Las fuentes no están disponibles. No se proporcionan respuestas técnicas sin verificar.",
    empty:"Haz una pregunta técnica o describe lo que buscas.",start:"Probar ejemplo",results:"Respuesta con fuentes",facts:"Datos detectados",
    clarification:"Para preparar la lista faltan",preview:"Vista previa de solicitud",verify:"Verifica los datos antes de utilizarlos comercialmente.",
    openCalc:"Verificar en calculadora",bill:"Abrir lista (entrada manual)",note:"La lista no se rellena automáticamente. No se envía ninguna solicitud ni pedido.",
    standard:"Norma",grade:"Calidad",shape:"Forma",dimensions:"Dimensiones",quantity:"Barras",length:"Longitud",unverified:"designación incompleta",found:"Datos recogidos",askMore:"Completa la información en un mensaje posterior.",
    missing:{standard:"norma de producto completa",grade:"calidad de acero completa",family:"forma CHS / SHS / RHS",
      dimensions:"dimensiones externas en mm",thickness:"espesor en mm",quantity:"cantidad de barras",length:"longitud por barra en m"},
    aiLabel:"Síntesis IA con fuentes",aiPrivacy:"Solo códigos técnicos y fichas K2 publicadas se envían al modelo después de pulsar. Nunca el texto privado.",aiAction:"Generar síntesis verificada",aiWorking:"Consultando IA…",aiReview:"Comprueba la norma oficial antes de usarla en una solicitud.",aiError:"Síntesis no disponible. Las fichas siguen accesibles.",voiceStart:"🎙️ Dictar",voiceStop:"Detener",voiceUnsupported:"Dictado no disponible en este navegador seguro.",voiceError:"Micrófono denegado o transcripción fallida.",voiceCaution:"El navegador puede usar un servicio de voz externo. Revisa y edita el texto antes de enviarlo.",
    example1:"Busco 40 tubos redondos de 3 metros EN 10219 S235",example2:"Diferencia EN 10210 y EN 10219"
  },
};
