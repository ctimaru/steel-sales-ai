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
  /* EMBED4 — hierarchy is measured within the actual modal, not the page. */
  [data-calculator-embed] [data-cockpit-workspace] {
    align-items:start;
  }
  [data-calculator-embed] [data-cockpit-workspace] > * {
    min-width:0;
  }
  [data-calculator-embed] [data-cockpit-preview] figure > svg {
    display:block;
    max-width:100%;
    height:auto;
    margin-inline:auto;
  }
  [data-calculator-embed] [data-cockpit-kpis] > div > p:last-child {
    font-variant-numeric:tabular-nums;
  }
  [data-calculator-embed] [data-cockpit-results] [aria-live="polite"] {
    overflow-wrap:normal;
  }
  [data-calculator-embed] [data-cockpit-add] {
    min-height:46px;
  }
  @media(min-width:1000px) {
    [data-calculator-embed] [data-cockpit-workspace] {
      grid-template-columns:minmax(250px,1.03fr) minmax(280px,1.07fr) minmax(250px,.94fr);
    }
    [data-calculator-embed] [data-cockpit-workspace] > [data-cockpit-fields],
    [data-calculator-embed] [data-cockpit-workspace] > [data-cockpit-results] {
      align-self:stretch;
    }
    [data-calculator-embed] [data-cockpit-workspace] [data-cockpit-preview] figure > svg {
      max-height:192px;
    }
    [data-calculator-embed] [data-cockpit-kpis] > div {
      min-height:39px;
    }
  }
  @media(min-width:700px) and (max-width:999px) {
    [data-calculator-embed] [data-cockpit-workspace] {
      grid-template-columns:repeat(2,minmax(0,1fr));
    }
    [data-calculator-embed] [data-cockpit-kpis] > div { min-height:42px; }
  }
  /* Embed-only: never truncate the steel shape labels at 390px or 1440px. */
  [data-calculator-embed] [data-calc-shape-buttons] button {
    min-width:0;
    gap:3px;
    padding-inline:3px;
  }
  [data-calculator-embed] [data-calc-shape-buttons] button span {
    min-width:0;
    overflow:visible;
    text-overflow:clip;
    white-space:nowrap;
  }
  @media(max-width:1199px) {
    [data-calculator-embed] [data-calc-shape-buttons] button svg {
      display:none;
    }
    [data-calculator-embed] [data-calc-shape-buttons] button span {
      font-size:clamp(9px,2.6vw,12px);
      letter-spacing:-.02em;
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
