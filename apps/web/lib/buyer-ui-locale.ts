/** CALC-NEXT1F — Workspace buyer UI labels only. No translation of technical standards, article descriptions, grades or supplier messages. */
export type BuyerUiLocale="it"|"en"|"de"|"fr"|"es";
export const buyerUiLocales=["it","en","de","fr","es"] as const;
export function safeBuyerUiLocale(input: unknown):BuyerUiLocale {
  return typeof input==="string" && buyerUiLocales.some(x=>x===input) ? input as BuyerUiLocale : "it";
}
export const buyerUiCopy={
  "La tua distinta": {
    "it": "La tua distinta",
    "en": "Your bill of materials",
    "de": "Ihre Stückliste",
    "fr": "Votre nomenclature",
    "es": "Tu lista de materiales"
  },
  "Commerciale · Carrello privato": {
    "it": "Commerciale · Carrello privato",
    "en": "Commercial · Private cart",
    "de": "Vertrieb · Privater Warenkorb",
    "fr": "Commercial · Panier privé",
    "es": "Comercial · Carrito privado"
  },
  "Carrello della distinta privata": {
    "it": "Carrello della distinta privata",
    "en": "Private bill cart",
    "de": "Privater Stücklisten-Warenkorb",
    "fr": "Panier de nomenclature privé",
    "es": "Carrito de lista privado"
  },
  "Chiudi": {
    "it": "Chiudi",
    "en": "Close",
    "de": "Schließen",
    "fr": "Fermer",
    "es": "Cerrar"
  },
  "Modifica": {
    "it": "Modifica",
    "en": "Edit",
    "de": "Bearbeiten",
    "fr": "Modifier",
    "es": "Editar"
  },
  "Righe pronte": {
    "it": "Righe pronte",
    "en": "Ready lines",
    "de": "Fertige Positionen",
    "fr": "Lignes prêtes",
    "es": "Líneas listas"
  },
  "Metri": {
    "it": "Metri",
    "en": "Metres",
    "de": "Meter",
    "fr": "Mètres",
    "es": "Metros"
  },
  "Tonnellate": {
    "it": "Tonnellate",
    "en": "Tonnes",
    "de": "Tonnen",
    "fr": "Tonnes",
    "es": "Toneladas"
  },
  "Totali parziali": {
    "it": "Totali parziali",
    "en": "Partial totals",
    "de": "Zwischensummen",
    "fr": "Totaux partiels",
    "es": "Totales parciales"
  },
  "Completa le righe": {
    "it": "Completa le righe",
    "en": "Complete lines",
    "de": "Positionen vervollständigen",
    "fr": "Compléter les lignes",
    "es": "Completar líneas"
  },
  "Crea RFQ privata →": {
    "it": "Crea RFQ privata →",
    "en": "Create private RFQ →",
    "de": "Private Anfrage erstellen →",
    "fr": "Créer une RFQ privée →",
    "es": "Crear RFQ privada →"
  },
  "Creazione RFQ…": {
    "it": "Creazione RFQ…",
    "en": "Creating RFQ…",
    "de": "Anfrage wird erstellt…",
    "fr": "Création de RFQ…",
    "es": "Creando RFQ…"
  },
  "Copia distinta": {
    "it": "Copia distinta",
    "en": "Copy bill",
    "de": "Stückliste kopieren",
    "fr": "Copier la liste",
    "es": "Copiar lista"
  },
  "Copiata ✓": {
    "it": "Copiata ✓",
    "en": "Copied ✓",
    "de": "Kopiert ✓",
    "fr": "Copiée ✓",
    "es": "Copiada ✓"
  },
  "Riprova copia": {
    "it": "Riprova copia",
    "en": "Retry copy",
    "de": "Kopieren wiederholen",
    "fr": "Réessayer la copie",
    "es": "Reintentar copia"
  },
  "Calcola qui, gestisci nel carrello": {
    "it": "Calcola qui, gestisci nel carrello",
    "en": "Calculate here, manage in cart",
    "de": "Hier berechnen, im Warenkorb verwalten",
    "fr": "Calculer ici, gérer dans le panier",
    "es": "Calcula aquí, gestiona en el carrito"
  },
  "Apri carrello": {
    "it": "Apri carrello",
    "en": "Open cart",
    "de": "Warenkorb öffnen",
    "fr": "Ouvrir le panier",
    "es": "Abrir carrito"
  },
  "righe": {
    "it": "righe",
    "en": "lines",
    "de": "Positionen",
    "fr": "lignes",
    "es": "líneas"
  },
  "righe pronte": {
    "it": "righe pronte",
    "en": "ready lines",
    "de": "fertige Positionen",
    "fr": "lignes prêtes",
    "es": "líneas listas"
  },
  "Articoli in distinta": {
    "it": "Articoli in distinta",
    "en": "Bill items",
    "de": "Stücklistenpositionen",
    "fr": "Articles de la liste",
    "es": "Artículos de la lista"
  },
  "Titolo distinta": {
    "it": "Titolo distinta",
    "en": "Bill title",
    "de": "Titel der Stückliste",
    "fr": "Titre de la liste",
    "es": "Título de la lista"
  },
  "1 · Calcola e aggiungi": {
    "it": "1 · Calcola e aggiungi",
    "en": "1 · Calculate and add",
    "de": "1 · Berechnen und hinzufügen",
    "fr": "1 · Calculer et ajouter",
    "es": "1 · Calcula y añade"
  },
  "Grado acciaio · facoltativo ora": {
    "it": "Grado acciaio · facoltativo ora",
    "en": "Steel grade · optional for now",
    "de": "Stahlsorte · derzeit optional",
    "fr": "Nuance d'acier · facultative",
    "es": "Grado de acero · opcional"
  },
  "Il peso teorico si aggiorna mentre scrivi; nessuna RFQ viene inviata automaticamente.": {
    "it": "Il peso teorico si aggiorna mentre scrivi; nessuna RFQ viene inviata automaticamente.",
    "en": "Theoretical mass updates while typing; no RFQ is automatically sent.",
    "de": "Theoretische Masse wird laufend aktualisiert; keine Anfrage wird automatisch gesendet.",
    "fr": "La masse théorique se met à jour; aucune RFQ n'est envoyée automatiquement.",
    "es": "El peso teórico se actualiza; no se envía ninguna RFQ automáticamente."
  },
  "Altri metodi · testo AI, configuratore assistito e ricerca catalogo": {
    "it": "Altri metodi · testo AI, configuratore assistito e ricerca catalogo",
    "en": "Other methods · AI text, guided builder and catalog search",
    "de": "Weitere Methoden · KI-Text, Assistent und Katalogsuche",
    "fr": "Autres méthodes · texte IA, assistant et catalogue",
    "es": "Otros métodos · texto IA, asistente y catálogo"
  },
  "Anteprima in tempo reale": {
    "it": "Anteprima in tempo reale",
    "en": "Live preview",
    "de": "Live-Vorschau",
    "fr": "Aperçu en direct",
    "es": "Vista previa en directo"
  },
  "In configurazione": {
    "it": "In configurazione",
    "en": "Being configured",
    "de": "In Konfiguration",
    "fr": "En configuration",
    "es": "En configuración"
  },
  "Articolo da compilare": {
    "it": "Articolo da compilare",
    "en": "Incomplete item",
    "de": "Position ausfüllen",
    "fr": "Article à remplir",
    "es": "Artículo por completar"
  },
  "Norma da scegliere": {
    "it": "Norma da scegliere",
    "en": "Select standard",
    "de": "Norm auswählen",
    "fr": "Choisir une norme",
    "es": "Elegir norma"
  },
  "Quantità mancante": {
    "it": "Quantità mancante",
    "en": "Quantity missing",
    "de": "Menge fehlt",
    "fr": "Quantité manquante",
    "es": "Falta cantidad"
  },
  "Articolo *": {
    "it": "Articolo *",
    "en": "Item *",
    "de": "Artikel *",
    "fr": "Article *",
    "es": "Artículo *"
  },
  "Norma": {
    "it": "Norma",
    "en": "Standard",
    "de": "Norm",
    "fr": "Norme",
    "es": "Norma"
  },
  "Grado": {
    "it": "Grado",
    "en": "Grade",
    "de": "Stahlsorte",
    "fr": "Nuance",
    "es": "Grado"
  },
  "Scegli": {
    "it": "Scegli",
    "en": "Choose",
    "de": "Wählen",
    "fr": "Choisir",
    "es": "Elegir"
  },
  "Quantità *": {
    "it": "Quantità *",
    "en": "Quantity *",
    "de": "Menge *",
    "fr": "Quantité *",
    "es": "Cantidad *"
  },
  "Unità": {
    "it": "Unità",
    "en": "Unit",
    "de": "Einheit",
    "fr": "Unité",
    "es": "Unidad"
  },
  "Barre / pezzi": {
    "it": "Barre / pezzi",
    "en": "Bars / pieces",
    "de": "Stangen / Stück",
    "fr": "Barres / pièces",
    "es": "Barras / piezas"
  },
  "Barra (m) *": {
    "it": "Barra (m) *",
    "en": "Bar length (m) *",
    "de": "Stangenlänge (m) *",
    "fr": "Longueur barre (m) *",
    "es": "Longitud barra (m) *"
  },
  "Peso kg/m *": {
    "it": "Peso kg/m *",
    "en": "Mass kg/m *",
    "de": "Masse kg/m *",
    "fr": "Masse kg/m *",
    "es": "Peso kg/m *"
  },
  "Dettagli e opzioni": {
    "it": "Dettagli e opzioni",
    "en": "Details and options",
    "de": "Details und Optionen",
    "fr": "Détails et options",
    "es": "Detalles y opciones"
  },
  "Correggi target": {
    "it": "Correggi target",
    "en": "Correct target",
    "de": "Zielpreis korrigieren",
    "fr": "Corriger l'objectif",
    "es": "Corregir objetivo"
  },
  "Duplica articolo": {
    "it": "Duplica articolo",
    "en": "Duplicate item",
    "de": "Artikel duplizieren",
    "fr": "Dupliquer l'article",
    "es": "Duplicar artículo"
  },
  "Rimuovi articolo": {
    "it": "Rimuovi articolo",
    "en": "Remove item",
    "de": "Artikel entfernen",
    "fr": "Supprimer l'article",
    "es": "Eliminar artículo"
  },
  "Rimuovi": {
    "it": "Rimuovi",
    "en": "Remove",
    "de": "Entfernen",
    "fr": "Supprimer",
    "es": "Eliminar"
  },
  "Aggiungi riga libera": {
    "it": "Aggiungi riga libera",
    "en": "+ Add manual line",
    "de": "+ Freie Position hinzufügen",
    "fr": "+ Ajouter une ligne libre",
    "es": "+ Añadir línea libre"
  },
  "Documentazione richiesta · intera distinta": {
    "it": "Documentazione richiesta · intera distinta",
    "en": "Required documents · whole bill",
    "de": "Erforderliche Dokumente · gesamte Stückliste",
    "fr": "Documents requis · liste entière",
    "es": "Documentación requerida · lista completa"
  },
  "Condizioni impostate": {
    "it": "Condizioni impostate",
    "en": "Requirements set",
    "de": "Anforderungen festgelegt",
    "fr": "Conditions définies",
    "es": "Condiciones definidas"
  },
  "Facoltativa": {
    "it": "Facoltativa",
    "en": "Optional",
    "de": "Optional",
    "fr": "Facultatif",
    "es": "Opcional"
  },
  "Non specificato": {
    "it": "Non specificato",
    "en": "Not specified",
    "de": "Nicht angegeben",
    "fr": "Non précisé",
    "es": "No especificado"
  },
  "Salvataggio e creazione…": {
    "it": "Salvataggio e creazione…",
    "en": "Saving and creating…",
    "de": "Speichern und Erstellen…",
    "fr": "Enregistrement et création…",
    "es": "Guardando y creando…"
  },
  "Salva distinta": {
    "it": "Salva distinta",
    "en": "Save bill",
    "de": "Stückliste speichern",
    "fr": "Enregistrer la liste",
    "es": "Guardar lista"
  },
  "Salvataggio…": {
    "it": "Salvataggio…",
    "en": "Saving…",
    "de": "Speichern…",
    "fr": "Enregistrement…",
    "es": "Guardando…"
  },
  "Salvata ✓": {
    "it": "Salvata ✓",
    "en": "Saved ✓",
    "de": "Gespeichert ✓",
    "fr": "Enregistrée ✓",
    "es": "Guardada ✓"
  },
  "Altre opzioni · salva solo la distinta o invia direttamente via email": {
    "it": "Altre opzioni · salva solo la distinta o invia direttamente via email",
    "en": "Other options · save bill or send email directly",
    "de": "Weitere Optionen · speichern oder per E-Mail senden",
    "fr": "Autres options · enregistrer ou envoyer par email",
    "es": "Otras opciones · guardar o enviar por correo"
  },
  "Spazio privato": {
    "it": "Spazio privato",
    "en": "Private workspace",
    "de": "Privater Arbeitsbereich",
    "fr": "Espace privé",
    "es": "Espacio privado"
  },
  "Salva soltanto la distinta.": {
    "it": "Salva soltanto la distinta.",
    "en": "Save only the bill.",
    "de": "Nur die Stückliste speichern.",
    "fr": "Enregistrer uniquement la liste.",
    "es": "Guardar solo la lista."
  },
  "Invio fornitori": {
    "it": "Invio fornitori",
    "en": "Supplier delivery",
    "de": "Lieferantenversand",
    "fr": "Envoi aux fournisseurs",
    "es": "Envío a proveedores"
  },
  "Invia direttamente a più fornitori.": {
    "it": "Invia direttamente a più fornitori.",
    "en": "Send directly to several suppliers.",
    "de": "Direkt an mehrere Lieferanten senden.",
    "fr": "Envoyer directement à plusieurs fournisseurs.",
    "es": "Enviar directamente a varios proveedores."
  },
  "Email fornitori": {
    "it": "Email fornitori",
    "en": "Supplier emails",
    "de": "Lieferanten-E-Mails",
    "fr": "Emails fournisseurs",
    "es": "Correos de proveedores"
  },
  "Oggetto": {
    "it": "Oggetto",
    "en": "Subject",
    "de": "Betreff",
    "fr": "Objet",
    "es": "Asunto"
  },
  "Messaggio": {
    "it": "Messaggio",
    "en": "Message",
    "de": "Nachricht",
    "fr": "Message",
    "es": "Mensaje"
  },
  "Invia ai fornitori": {
    "it": "Invia ai fornitori",
    "en": "Send to suppliers",
    "de": "An Lieferanten senden",
    "fr": "Envoyer aux fournisseurs",
    "es": "Enviar a proveedores"
  },
  "Invio…": {
    "it": "Invio…",
    "en": "Sending…",
    "de": "Senden…",
    "fr": "Envoi…",
    "es": "Enviando…"
  },
  "Bozza trovata in questa scheda": {
    "it": "Bozza trovata in questa scheda",
    "en": "Draft found in this tab",
    "de": "Entwurf in diesem Tab gefunden",
    "fr": "Brouillon trouvé dans cet onglet",
    "es": "Borrador encontrado en esta pestaña"
  },
  "Riprendi la distinta": {
    "it": "Riprendi la distinta",
    "en": "Resume bill",
    "de": "Stückliste fortsetzen",
    "fr": "Reprendre la liste",
    "es": "Reanudar lista"
  },
  "Scarta e crea nuova": {
    "it": "Scarta e crea nuova",
    "en": "Discard and start new",
    "de": "Verwerfen und neu beginnen",
    "fr": "Ignorer et recommencer",
    "es": "Descartar y crear nueva"
  },
  "RFQ Hub · Distinta privata": {
    "it": "RFQ Hub · Distinta privata",
    "en": "RFQ Hub · Private bill",
    "de": "RFQ Hub · Private Stückliste",
    "fr": "RFQ Hub · Liste privée",
    "es": "RFQ Hub · Lista privada"
  },
  "Creazione articoli": {
    "it": "Creazione articoli",
    "en": "Create items",
    "de": "Artikel erstellen",
    "fr": "Créer des articles",
    "es": "Crear artículos"
  },
  "Articoli salvati": {
    "it": "Articoli salvati",
    "en": "Saved items",
    "de": "Gespeicherte Artikel",
    "fr": "Articles enregistrés",
    "es": "Artículos guardados"
  },
  "Scarta passaggio": {
    "it": "Scarta passaggio",
    "en": "Discard handoff",
    "de": "Übergabe verwerfen",
    "fr": "Ignorer le transfert",
    "es": "Descartar transferencia"
  },
  "Certificato di controllo EN 10204": {
    "it": "Certificato di controllo EN 10204",
    "en": "Inspection certificate EN 10204",
    "de": "Prüfbescheinigung EN 10204",
    "fr": "Certificat de contrôle EN 10204",
    "es": "Certificado de inspección EN 10204"
  },
  "Marcatura CE + DoP, se applicabili": {
    "it": "Marcatura CE + DoP, se applicabili",
    "en": "CE marking + DoP, if applicable",
    "de": "CE-Kennzeichnung + DoP, falls zutreffend",
    "fr": "Marquage CE + DoP, si applicable",
    "es": "Marcado CE + DoP, si procede"
  },
  "Produttore certificato UNI EN ISO 9001": {
    "it": "Produttore certificato UNI EN ISO 9001",
    "en": "UNI EN ISO 9001 certified manufacturer",
    "de": "Hersteller zertifiziert nach UNI EN ISO 9001",
    "fr": "Fabricant certifié UNI EN ISO 9001",
    "es": "Fabricante certificado UNI EN ISO 9001"
  },
  "Nuova distinta": {
    "it": "Nuova distinta",
    "en": "New bill",
    "de": "Neue Stückliste",
    "fr": "Nouvelle liste",
    "es": "Nueva lista"
  },
  "Le mie RFQ": {
    "it": "Le mie RFQ",
    "en": "My RFQs",
    "de": "Meine Anfragen",
    "fr": "Mes RFQ",
    "es": "Mis RFQ"
  },
  "Workspace aziendale · acquisti": {
    "it": "Workspace aziendale · acquisti",
    "en": "Company workspace · purchasing",
    "de": "Unternehmensbereich · Einkauf",
    "fr": "Espace entreprise · achats",
    "es": "Espacio empresarial · compras"
  },
  "Scegli la lingua": {
    "it": "Scegli la lingua",
    "en": "Choose language",
    "de": "Sprache wählen",
    "fr": "Choisir la langue",
    "es": "Elegir idioma"
  },
  "RFQ privata · nessun invio automatico": {
    "it": "RFQ privata · nessun invio automatico",
    "en": "Private RFQ · no automatic dispatch",
    "de": "Private Anfrage · kein automatischer Versand",
    "fr": "RFQ privée · aucun envoi automatique",
    "es": "RFQ privada · sin envío automático"
  }
} as const;
export function buyerUiText(key:keyof typeof buyerUiCopy,locale:BuyerUiLocale):string {
  return buyerUiCopy[key][locale];
}
