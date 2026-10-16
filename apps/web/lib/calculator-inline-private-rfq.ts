/**
 * CALC-INT4.4D — immutable, validated private RFQ payload.
 * 4.4A remains public/price-free; 4.4C keeps rates in React memory.
 * Only a deliberate authenticated click may call saveBuyerDistinta with this
 * payload. No supplier dispatch or marketplace publication lives here.
 */
import { calculateBuyerDistintaLine, type BuyerDistintaDraftLine } from "@/lib/buyer-distinta";
import { inlineDistintaBuyerLines, type InlineDistintaState } from "@/lib/calculator-inline-distinta";
import { buyerTargetPreview, type BuyerTargetState } from "@/lib/calculator-inline-buyer-target";

export type InlinePrivateRfqSnapshot = { title: string; lines: BuyerDistintaDraftLine[] };
export type InlinePrivateRfqBuild =
  | { ok: true; snapshot: InlinePrivateRfqSnapshot; withTargets: number }
  | { ok: false; error: string };

export function prepareInlinePrivateRfq(
  state: InlineDistintaState, targets: BuyerTargetState, includePrivateTargets: boolean,
): InlinePrivateRfqBuild {
  const canonical = inlineDistintaBuyerLines(state);
  if (!canonical?.length) return {ok:false,error:"Aggiungi almeno un articolo valido alla distinta."};
  if (canonical.some(line=>!calculateBuyerDistintaLine(line).complete)) {
    return {ok:false,error:"Completa quantità, lunghezza e peso delle righe."};
  }
  let withTargets=0;
  const lines=canonical.map(line=>{
    const privateValue=includePrivateTargets ? buyerTargetPreview(line,targets) : null;
    if(privateValue) {
      withTargets++;
      return {...line,targetEurT:String(privateValue.eurT)};
    }
    return {...line,targetEurT:""};
  });
  return {ok:true,withTargets,snapshot:{title:"Richiesta di offerta dal calcolatore",lines}};
}

/** Never put sensitive data in URLs or other browser storage. */
export function privateRfqSnapshotSignature(snapshot: InlinePrivateRfqSnapshot) {
  return JSON.stringify(snapshot);
}
