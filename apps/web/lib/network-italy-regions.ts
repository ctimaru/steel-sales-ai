/** NET-AUDIT1.2 — official list of the 20 Italian regions, ISTAT spelling.
 * The Region filter must offer every region the server filter accepts.
 * Server-side, `netlaunch4b_browse_page` matches published facilities AND
 * sourced geo evidence by region name; the previous option list came only from
 * published facilities, so regions such as Piemonte or Veneto were missing even
 * though filtering by them returned real companies. An empty region is reported
 * honestly by the results list; it is never hidden by the option list.
 */
export const ITALY_REGIONS:ReadonlyArray<string>=[
  "Abruzzo","Basilicata","Calabria","Campania","Emilia-Romagna",
  "Friuli-Venezia Giulia","Lazio","Liguria","Lombardia","Marche",
  "Molise","Piemonte","Puglia","Sardegna","Sicilia","Toscana",
  "Trentino-Alto Adige","Umbria","Valle d'Aosta","Veneto",
];

const regionKey=(value:string)=>value.normalize("NFD").replace(/[̀-ͯ]/g,"")
  .toLowerCase().replace(/[^a-z]/g,"");

/** Official spelling for a region value from the URL ("piemonte" → "Piemonte").
 * Returns the trimmed input unchanged when it is not an Italian region. */
export function canonicalItalyRegion(value=""):string{
  const current=value.trim();
  if(!current)return "";
  return ITALY_REGIONS.find(region=>regionKey(region)===regionKey(current))??current;
}

/** Region options for the Italian filter: always the 20 official regions.
 * A still-selected non-canonical value from the URL is kept as an extra option,
 * so the select never silently displays a different region than the filter.
 */
export function italyRegionOptions(selected=""):string[]{
  const current=canonicalItalyRegion(selected);
  return current && !ITALY_REGIONS.includes(current)?[...ITALY_REGIONS,current]:[...ITALY_REGIONS];
}
