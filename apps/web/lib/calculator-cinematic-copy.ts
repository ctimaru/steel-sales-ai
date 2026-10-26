import type { TubeCalculatorLocale } from "./tube-calculator-locale";

// Presentation only. Dimensions, standards, quantities and mass stay in the
// shared calculator's existing state and authoritative calculation engine.
export const calculatorCinematicCopy: Record<TubeCalculatorLocale, {
  eyebrow: string; description: string; visual: string; results: string; area: string; copy: string; illustration: string;
  lengthQuantity: string; outerSize: string; innerDiameter: string; bars: string;
}> = {
  it: {lengthQuantity:"Lunghezza e quantità",outerSize:"Dimensioni esterne B × H",innerDiameter:"Diametro interno (Di)",bars:"barre",eyebrow:"Calcolatrice tecnica",description:"Scegli la sezione. Verifica il peso. Componi la distinta.",visual:"Vista tecnica · quote in tempo reale",results:"Risultati",area:"Area sezione",copy:"Copia risultati",illustration:"Immagine illustrativa · quote nello schema"},
  en: {lengthQuantity:"Length and quantity",outerSize:"External size B × H",innerDiameter:"Internal diameter (Di)",bars:"bars",eyebrow:"Technical calculator",description:"Choose the section. Check the weight. Build your bill.",visual:"Technical view · live dimensions",results:"Results",area:"Section area",copy:"Copy results",illustration:"Illustrative image · dimensions in diagram"},
  de: {lengthQuantity:"Länge und Anzahl",outerSize:"Außenmaße B × H",innerDiameter:"Innendurchmesser (Di)",bars:"Stäbe",eyebrow:"Technischer Rechner",description:"Querschnitt wählen. Gewicht prüfen. Stückliste erstellen.",visual:"Technische Ansicht · aktuelle Maße",results:"Ergebnisse",area:"Querschnittsfläche",copy:"Ergebnisse kopieren",illustration:"Beispielbild · Maße in der Zeichnung"},
  fr: {lengthQuantity:"Longueur et quantité",outerSize:"Dimensions extérieures B × H",innerDiameter:"Diamètre intérieur (Di)",bars:"barres",eyebrow:"Calculatrice technique",description:"Choisissez la section. Vérifiez le poids. Composez la liste.",visual:"Vue technique · cotes en temps réel",results:"Résultats",area:"Aire de section",copy:"Copier les résultats",illustration:"Image illustrative · cotes sur le schéma"},
  es: {lengthQuantity:"Longitud y cantidad",outerSize:"Dimensiones exteriores B × H",innerDiameter:"Diámetro interior (Di)",bars:"barras",eyebrow:"Calculadora técnica",description:"Elige la sección. Comprueba el peso. Prepara la lista.",visual:"Vista técnica · cotas en tiempo real",results:"Resultados",area:"Área de sección",copy:"Copiar resultados",illustration:"Imagen ilustrativa · cotas en el esquema"},
};
