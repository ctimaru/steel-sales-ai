import type { TubeCalculatorLocale } from "./tube-calculator-locale";

// Presentation only. Dimensions, standards, quantities and mass stay in the
// shared calculator's existing state and authoritative calculation engine.
export const calculatorCinematicCopy: Record<TubeCalculatorLocale, {
  eyebrow: string; description: string; visual: string; results: string; area: string; copy: string; illustration: string;
}> = {
  it: {eyebrow:"Calcolatrice tecnica",description:"Scegli la sezione. Verifica il peso. Componi la distinta.",visual:"Vista tecnica · quote in tempo reale",results:"Risultati",area:"Area sezione",copy:"Copia risultati",illustration:"Immagine illustrativa · quote nello schema"},
  en: {eyebrow:"Technical calculator",description:"Choose the section. Check the weight. Build your bill.",visual:"Technical view · live dimensions",results:"Results",area:"Section area",copy:"Copy results",illustration:"Illustrative image · dimensions in diagram"},
  de: {eyebrow:"Technischer Rechner",description:"Querschnitt wählen. Gewicht prüfen. Stückliste erstellen.",visual:"Technische Ansicht · aktuelle Maße",results:"Ergebnisse",area:"Querschnittsfläche",copy:"Ergebnisse kopieren",illustration:"Beispielbild · Maße in der Zeichnung"},
  fr: {eyebrow:"Calculatrice technique",description:"Choisissez la section. Vérifiez le poids. Composez la liste.",visual:"Vue technique · cotes en temps réel",results:"Résultats",area:"Aire de section",copy:"Copier les résultats",illustration:"Image illustrative · cotes sur le schéma"},
  es: {eyebrow:"Calculadora técnica",description:"Elige la sección. Comprueba el peso. Prepara la lista.",visual:"Vista técnica · cotas en tiempo real",results:"Resultados",area:"Área de sección",copy:"Copiar resultados",illustration:"Imagen ilustrativa · cotas en el esquema"},
};
