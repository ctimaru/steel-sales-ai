import type {RfqAiTextDraftResult} from "@/lib/rfq-ai-free-text";
import type {RfqAiIssue} from "@/lib/rfq-ai-intake-contract";

/** COMPACT6E: completion coaching only. No field is ever inferred,
 * normalized, approved or saved from this advice.
 */
export const NETWORK_RFQ_MAX_TEXT=4000;

const QUESTIONS:Partial<Record<RfqAiIssue["code"],string>>={
  missing_dimensions:"Indica forma (tondo, quadro o rettangolare), dimensioni esterne e spessore in mm.",
  ambiguous_geometry:"Chiarisci quale geometria è corretta: non mischiare diametro e lati.",
  invalid_geometry:"Correggi geometria e spessore: devono descrivere una sezione realizzabile.",
  missing_standard:"Quale norma? Verifica EN 10210 o EN 10219.",
  unsupported_standard:"La norma non è disponibile nel configuratore: verifica prima di proseguire.",
  missing_grade:"Quale qualità d'acciaio? Scrivi il grado esplicitamente.",
  missing_quantity:"Quante barre, metri o tonnellate servono?",
  invalid_quantity:"Correggi la quantità e l'unità; le barre richiedono un numero intero.",
  unsupported_quantity_unit:"Specifica l'unità: barre/pezzi, metri oppure tonnellate.",
  missing_bar_length:"Quanto misura ogni singola barra, in metri?",
  invalid_bar_length:"Correggi la lunghezza di ciascuna barra (metri, maggiore di zero).",
  invalid_source:"Il testo originale di questo articolo non è verificabile.",
  untrusted_document_intent:"Conferma che si tratta di una richiesta di acquisto, non un'offerta ricevuta.",
  untrusted_item_role:"Verifica se l'articolo è richiesto o offerto.",
  parser_validation:"Rivedi i campi indicati: non tutti i dati sono validati.",
  invalid_target:"Correggi l'eventuale prezzo obiettivo o lascialo vuoto.",
};
export type NetworkRfqQuestion={candidateId:string;label:string;questions:string[]};

/** Questions are derived from existing authoritative RFQAI3 issue codes. */
export function networkRfqQuestions(
 result:RfqAiTextDraftResult,
):NetworkRfqQuestion[]{
 return result.candidates.slice(0,30).map((candidate,index)=>{
   const codes=new Set(candidate.issues.map(issue=>issue.code));
   const questions=[...codes].flatMap(code=>QUESTIONS[code]?[QUESTIONS[code]!]:[]);
   const label=candidate.sourceExcerpt
     ?candidate.sourceExcerpt.slice(0,85)
     :"Articolo "+(index+1)+" · provenienza da verificare";
   return {candidateId:candidate.candidateId,label,questions:questions.slice(0,6)};
 }).filter(row=>row.questions.length>0);
}

/** Browser dictation is untrusted user input. Append, never replace or
 * silently split lines by conjunctions ("e" might be inside a grade).
 * A new line makes another spoken item legible in the RFQAI3 source review.
 */
export function appendNetworkRfqDictation(current:string,spoken:string):string|null{
 if(typeof spoken!=="string")return null;
 const cleaned=spoken.replace(/[\u0000-\u001f]+/g," ").replace(/\s+/g," ").trim();
 if(!cleaned)return null;
 const next=(current.trim()?current.trimEnd()+"\n":"")+cleaned;
 return next.length<=NETWORK_RFQ_MAX_TEXT?next:null;
}
export function networkRfqTextValid(text:string):boolean{
 return typeof text==="string"&&text.trim().length>=12&&
   text.length<=NETWORK_RFQ_MAX_TEXT&&!text.includes("\u0000");
}
