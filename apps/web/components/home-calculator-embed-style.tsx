/** HOME-CALC-EMBED2: isolated layout refinements for the modal-only calculator.
 * Shared formulas, RFQ handoff and full School pages are intentionally untouched.
 */
export function HomeCalculatorEmbedStyle() {
  return <style>{`
  body:has([data-calculator-embed]) > footer { display:none!important; }
  [data-calculator-embed] { width:100%; min-width:0; overflow-x:clip; }
  [data-calculator-embed] [data-calc-region-switch] > div:first-child {
    margin-bottom:6px; padding:6px 10px; border-radius:10px;
  }
  [data-calculator-embed] [data-calc-region-switch] > div:first-child p { line-height:1.3; }
  [data-calculator-embed] [data-cockpit-header] { padding:9px 12px; }
  [data-calculator-embed] [data-cockpit-header] :is(h1,h2) { font-size:clamp(17px,2vw,20px); }
  [data-calculator-embed] [data-cockpit-toolbar] { padding:9px 11px; gap:8px; }
  [data-calculator-embed] [data-cockpit-workspace] { padding:9px; gap:9px; align-items:stretch; }
  [data-calculator-embed] [data-cockpit-fields],
  [data-calculator-embed] [data-cockpit-results] { min-width:0; padding:10px; border-radius:10px; }
  [data-calculator-embed] [data-cockpit-results] > div:first-child { padding:9px; }
  [data-calculator-embed] [data-cockpit-kpis] { gap:5px; }
  [data-calculator-embed] [data-cockpit-kpis] > div { min-height:39px; padding:7px 9px; }
  [data-calculator-embed] [data-cockpit-add] { margin-top:8px; }
  [data-calculator-embed] [data-cockpit-preview] { min-width:0; }
  @media(min-width:1000px) {
    [data-calculator-embed] [data-cockpit-workspace] {
      grid-template-columns:minmax(235px,1fr) minmax(270px,1.06fr) minmax(245px,.91fr);
    }
    [data-calculator-embed] [data-cockpit-workspace] > * { min-width:0; }
    [data-calculator-embed] [data-cockpit-workspace] [data-cockpit-preview] svg {
      max-height:210px; width:100%;
    }
  }
  @media(max-width:699px) {
    [data-calculator-embed] [data-cockpit-workspace] { padding:6px; gap:6px; }
    [data-calculator-embed] [data-cockpit-fields] { padding:9px; }
    [data-calculator-embed] [data-cockpit-toolbar] { padding:8px; }
    [data-calculator-embed] [data-cockpit-header] { padding:9px; }
  }
  `}</style>;
}
