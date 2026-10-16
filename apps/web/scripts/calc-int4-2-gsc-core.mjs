/**
 * CALC-INT4.2. Read-only evidence processing; no OAuth, no external calls.
 * Google Search Console "Queries" and "Pages" exports are DIFFERENT
 * dimensions. Do not join them or sum them as if they were joint data.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const LOCALES = ['de', 'fr', 'es'];
const COUNTRIES = ['DEU', 'FRA', 'ESP', 'ALL'];
const DIMENSIONS = ['query', 'page', 'query-page'];
const MARKET = {
  de: { label: 'DE · Hohlprofile, DIN EN 10210/10219', topic: '/de/knowledge/tubes/din-en-10219-2-toleranzen-masse-hohlprofile',
    terms: ['10210','10219','hohlprofil','quadrat','toleranz','masse','gewicht','stahlbau'] },
  fr: { label: 'FR · NF EN, certificat 3.1', topic: '/fr/knowledge/tubes/certificat-matiere-en-10204-31-profils-creux',
    terms: ['10204','10219','10210','certificat','contrôle','matière','profil creux','poids','devis'] },
  es: { label: 'ES · UNE-EN, peso y pedido', topic: '/es/knowledge/tubes/une-en-10210-10219-ediciones-peso-pedido',
    terms: ['10210','10219','une','perfiles','perfil hueco','peso','tubo','pedido'] }
};
const BRAND = /\bsmart\s*steel\s*sales\b|\bsmartsteelsales\b/i;
const REQUIRED = ['clicks', 'impressions', 'ctr', 'position'];
const ALIASES = {
  query: ['query','queries','topqueries','searchqueries','suchanfragen','suchanfrage',
    'requete','requetes','consultas','consulta','queryprincipali','querypiufrequenti','principalesrequetes'],
  page: ['page','pages','url','urls','seiten','seite','pagina','pagine','paginas'],
  clicks: ['clicks','click','clics','clic','klicks','klick','clics'],
  impressions: ['impressions','impression','impressionen','impressioni','impresiones'],
  ctr: ['ctr','clickthroughrate','tauxdeclics','porcentajedeclics'],
  position: ['position','avgposition','averageposition','posizione','positionmoyenne','posicion','posicionmedia','durchschnittlicheposition']
};
function norm(text) {
  return String(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]/g,'');
}
function cleanQuery(text) {
  return String(text).normalize('NFKC').replace(/\s+/g,' ').trim();
}
function localUrl(value) {
  const parsed = new URL(value);
  if (!['smartsteelsales.com','www.smartsteelsales.com'].includes(parsed.hostname) ||
      parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Page URL not an HTTPS Smart Steel Sales canonical URL');
  }
  return parsed.pathname.replace(/\/+$/,'') || '/';
}
function parseCsv(text) {
  const source = text.replace(/^\uFEFF/,'');
  const first = source.split(/\r?\n/,1)[0] || '';
  // Delimiters inside quoted cells must not be counted.
  let quoted = false, comma = 0, semi = 0;
  for (let i=0; i<first.length; i++) {
    if (first[i] === '"') { if (quoted && first[i+1] === '"') i++; else quoted=!quoted; }
    else if (!quoted && first[i] === ',') comma++;
    else if (!quoted && first[i] === ';') semi++;
  }
  const delimiter = semi > comma ? ';' : ',';
  const rows = []; let cells = [], cell = ''; quoted = false;
  for (let i=0;i<source.length;i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i+1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && ch === delimiter) {
      cells.push(cell); cell = '';
    } else if (!quoted && (ch === '\r' || ch === '\n')) {
      if (ch === '\r' && source[i+1] === '\n') i++;
      cells.push(cell); cell = '';
      if (cells.some(v=>v.trim())) rows.push(cells);
      cells = [];
    } else cell += ch;
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  cells.push(cell);
  if (cells.some(v=>v.trim())) rows.push(cells);
  return rows;
}
function number(raw, metric) {
  let s = String(raw).trim().replace(/[\u00A0\u202F\s]/g, '');
  if (!s || s === '-' || s === '~' || s.startsWith('<') || s.startsWith('>')) {
    throw new Error('Non-exact or missing ' + metric + ' value');
  }
  const pct = s.endsWith('%');
  if (pct) s=s.slice(0,-1);
  const decimals = metric === 'ctr' || metric === 'position';
  if (pct && metric !== 'ctr') throw new Error('Unexpected % on ' + metric);
  if (!/^[-+]?\d[\d.,]*$/.test(s)) throw new Error('Invalid number ' + metric + ': ' + raw);
  // GSC locale-specific CSV: "1.234" is 1234 for counts, "7,3" is 7.3 for position.
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g,'').replace(',', '.') : s.replace(/,/g,'');
  } else if (decimals) {
    s = s.replace(',','.');
  } else {
    s = s.replace(/[,.]/g,'');
  }
  const v = Number(s);
  if (!Number.isFinite(v) || v < 0) throw new Error('Invalid positive ' + metric + ': ' + raw);
  if (!decimals && !Number.isSafeInteger(v)) throw new Error('Count is not an integer: ' + raw);
  if (metric === 'ctr') {
    const fraction = pct ? v / 100 : v;
    if (fraction > 1) throw new Error('CTR must be a fraction or include %: ' + raw);
    return fraction;
  }
  if (metric === 'position' && v > 1000) throw new Error('Invalid average position: ' + raw);
  return v;
}
function headerIndices(row, dimension) {
  const result = {};
  for (const metric of [...REQUIRED,...(dimension === 'query-page' ? ['query','page'] : [dimension])]) {
    const idx = row.findIndex(v=>ALIASES[metric]?.includes(norm(v)));
    if (idx < 0) throw new Error('CSV header missing ' + metric + ' for ' + dimension);
    result[metric]=idx;
  }
  return result;
}
function isoValid(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(+d) && d.toISOString().slice(0,10) === value;
}
function periodDays(start,end) {
  return Math.round((new Date(end+'T00:00:00Z')-new Date(start+'T00:00:00Z'))/86400000)+1;
}
function validateEntry(e, manifest) {
  if (!e || typeof e !== 'object') throw new Error('Invalid export record');
  if (!DIMENSIONS.includes(e.dimension)) throw new Error('Expected dimension: query, page or query-page');
  if (!LOCALES.includes(e.locale) || !COUNTRIES.includes(e.country)) throw new Error('Invalid locale/country');
  if (typeof e.path !== 'string' || !e.path.toLowerCase().endsWith('.csv')) throw new Error('CSV path required');
  if (typeof e.pageFilter !== 'string' || e.pageFilter !== '/'+e.locale+'/knowledge/tubes') {
    throw new Error('Explicit locale pageFilter must equal /'+e.locale+'/knowledge/tubes');
  }
  if (!isoValid(e.startDate) || !isoValid(e.endDate) || ![7,28].includes(periodDays(e.startDate,e.endDate))) {
    throw new Error('Require a valid inclusive 7- or 28-day date window');
  }
  if (e.endDate > manifest.exportedAt) throw new Error('Export period must not end after exportedAt');
  if (e.searchType !== 'web') throw new Error('Search type must be web');
  if (typeof e.filtersVerified !== 'boolean' || typeof e.finalData !== 'boolean') {
    throw new Error('filtersVerified and finalData must be explicitly true or false');
  }
}
function readRows(e, manifest, manifestFile) {
  validateEntry(e,manifest);
  const file = resolve(dirname(manifestFile),e.path);
  const rows = parseCsv(readFileSync(file,'utf8'));
  if (!rows.length) throw new Error('Empty CSV file: ' + e.path);
  const ix = headerIndices(rows[0],e.dimension);
  const result=[],seen=new Set();
  for(let i=1;i<rows.length;i++) {
    const record=rows[i];
    const row={ locale:e.locale,country:e.country,dimension:e.dimension,
      startDate:e.startDate,endDate:e.endDate,windowDays:periodDays(e.startDate,e.endDate),
      pageFilter:e.pageFilter, filtersVerified:e.filtersVerified,finalData:e.finalData,
      clicks:number(record[ix.clicks]??'', 'clicks'),
      impressions:number(record[ix.impressions]??'', 'impressions'),
      ctr:number(record[ix.ctr]??'', 'ctr'),
      position:number(record[ix.position]??'', 'position') };
    if (row.clicks > row.impressions) throw new Error('Clicks exceed impressions');
    if (e.dimension!=='page') row.query=cleanQuery(record[ix.query]??'');
    if (e.dimension!=='query') row.page=localUrl(record[ix.page]??'');
    if (row.query === '' || (row.page && !row.page.startsWith(e.pageFilter))) {
      throw new Error('Empty query or page outside declared locale scope');
    }
    const key=[row.query??'',row.page??''].join('\u0000');
    if (seen.has(key)) throw new Error('Duplicate CSV row for the same dimension key; cannot double-count');
    seen.add(key);
    result.push(row);
  }
  return result;
}
function groupKey(e) {
  return [e.locale,e.country,e.dimension,e.startDate,e.endDate,e.pageFilter].join('|');
}
function classifyQuery(row) {
  if (BRAND.test(row.query)) return {priority:'EXCLUDE_BRAND',action:'Non priorizzare query di brand'};
  if (!row.finalData || !row.filtersVerified) return {priority:'VERIFY_EXPORT',action:'Validare filtri e giorni completi'};
  if (row.windowDays!==28) return {priority:'OBSERVE_7D',action:'Attendere finestra comparabile di 28 giorni'};
  if (row.impressions<30) return {priority:'LOW_SIGNAL',action:'Osservare senza creare pagine'};
  if (row.position>=4 && row.position<=20 && row.ctr<0.03) {
    return {priority:'P1_CTR',action:'Rivedere snippet e intent della pagina, dopo verifica query→URL'};
  }
  if (row.position>20 && row.position<=50 && row.impressions>=30) {
    return {priority:'P2_INTENT',action:'Verificare intento e pertinenza dei contenuti esistenti'};
  }
  return {priority:'MONITOR',action:'Monitorare; nessuna espansione automatica'};
}
function classifyPage(row) {
  if (!row.finalData || !row.filtersVerified) return {priority:'VERIFY_EXPORT',action:'Validare filtri e giorni completi'};
  if (row.windowDays!==28) return {priority:'OBSERVE_7D',action:'Osservare; serve baseline di 28 giorni'};
  if (row.impressions>=30 && row.position>=4 && row.position<=20 && row.ctr<0.03) {
    return {priority:'P1_PAGE_CTR',action:'Audit titolo, descrizione e contenuto della landing'};
  }
  return {priority:'MONITOR',action:'Osservare la performance della landing'};
}
function overlapWarnings(rows) {
  const byScope=new Map();
  for(const r of rows.filter(r=>r.dimension==='query-page'&&r.finalData&&r.filtersVerified&&r.windowDays===28&&r.impressions>=10)) {
    const key=[r.locale,r.country,r.startDate,r.endDate,norm(r.query)].join('|');
    if(!byScope.has(key))byScope.set(key,[]);
    byScope.get(key).push(r);
  }
  const warnings=[];
  for(const group of byScope.values()) {
    const urls=new Set(group.map(r=>r.page));
    if(urls.size>=2) {
      warnings.push({locale:group[0].locale,country:group[0].country,query:group[0].query,
        pages:[...urls],impressions:group.reduce((sum,r)=>sum+r.impressions,0),
        verdict:'URL_OVERLAP_REVIEW_NOT_PROVEN_CANNIBALIZATION'});
    }
  }
  return warnings.sort((a,b)=>b.impressions-a.impressions);
}
export function collectEvidence(manifest, manifestFile, {read=readRows}={}) {
  if (!manifest || typeof manifest!=='object' || typeof manifest.property!=='string' ||
      !/^(sc-domain:smartsteelsales\.com|https:\/\/www\.smartsteelsales\.com\/)$/.test(manifest.property) ||
      !isoValid(manifest.exportedAt) || !Array.isArray(manifest.exports)) {
    throw new Error('Manifest requires verified property identifier, exportedAt and exports[]');
  }
  const rows=[],scopes=[],seen=new Set();
  for(const e of manifest.exports) {
    validateEntry(e,manifest);
    const key=groupKey(e);
    if(seen.has(key))throw new Error('Duplicate scoped export; would double-count data');
    seen.add(key);
    const values=read(e,manifest,manifestFile);
    scopes.push({locale:e.locale,country:e.country,dimension:e.dimension,startDate:e.startDate,
      endDate:e.endDate,windowDays:periodDays(e.startDate,e.endDate),rows:values.length,
      finalData:e.finalData,filtersVerified:e.filtersVerified});
    rows.push(...values);
  }
  const queries=rows.filter(x=>x.dimension==='query'||x.dimension==='query-page')
    .map(x=>({...x,...classifyQuery(x),
      topicRelated:MARKET[x.locale].terms.some(word=>norm(x.query).includes(norm(word))),
      topicPath:MARKET[x.locale].topic}))
    .sort((a,b)=> {
      const order=['P1_CTR','P2_INTENT','VERIFY_EXPORT','OBSERVE_7D','LOW_SIGNAL','MONITOR','EXCLUDE_BRAND'];
      return order.indexOf(a.priority)-order.indexOf(b.priority)||b.impressions-a.impressions;
    });
  const pages=rows.filter(x=>x.dimension==='page').map(x=>({...x,...classifyPage(x)}))
    .sort((a,b)=>b.impressions-a.impressions);
  const pairRows=rows.filter(x=>x.dimension==='query-page');
  const overlaps=overlapWarnings(pairRows);
  return {property:manifest.property,exportedAt:manifest.exportedAt,
    status: !scopes.length ? 'NO_EVIDENCE' :
      !scopes.some(s=>s.finalData&&s.filtersVerified&&s.windowDays===28&&s.rows>0) ? 'PENDING_28D_VALIDATION' :
      'OBSERVED_SAMPLE',
    scopes,queries,pages,overlaps,limitations:[
      'GSC exports may be truncated to 1,000 rows and anonymize some searches; not total traffic.',
      'Query and Page exports are separate dimensions; never infer their query→page relationship.',
      'Country is the Google searcher location, while locale comes from the URL filter.',
      'Priority thresholds are transparent editorial triage heuristics, not SEO predictions.',
      'Observed 28d search data does not prove Google indexing for an individual URL.'
    ]};
}
function cell(v) {return String(v??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ').slice(0,180);}
function table(header, lines) {
  return ['| '+header.map(cell).join(' | ')+' |','| '+header.map(()=>'---').join(' | ')+' |',
    ...lines.map(row=>'| '+row.map(cell).join(' | ')+' |')].join('\n');
}
export function renderReport(r) {
  const lines=[
    '# CALC-INT4.2 — GSC Evidence & Content Prioritization',
    '',
    '- Fonte: esportazioni locali Google Search Console dichiarate nel manifest; **nessun dato inventato**.',
    '- Proprietà: '+r.property+' · Estratto: '+r.exportedAt,
    '- Stato: **'+r.status+'**. '+(r.status==='NO_EVIDENCE' ? 'Nessun CSV reale ricevuto. Nessuna classifica SEO.' :
      'Il campione NON rappresenta necessariamente la totalità delle query.'),
    '',
    '## Perimetro degli export',
    ''
  ];
  if(r.scopes.length)lines.push(table(['Lingua pagina','Paese ricerca','Dimensione','Periodo','Righe','Finale/filtri'],
    r.scopes.map(s=>[s.locale.toUpperCase(),s.country,s.dimension,s.startDate+' → '+s.endDate,s.rows,
      s.finalData&&s.filtersVerified?'Confermati':'NON CONFERMATI'])));
  else lines.push('Nessuna osservazione; richiedere CSV query/pagine reali con paese, periodo e prefisso URL.');
  lines.push('','## Query osservate (priorità, massimo 25)','');
  if(r.queries.length)lines.push(table(['Lingua','Paese','Query','Impression','Click','CTR','Pos.','Classe','Cluster pertinente','Passo'],
    r.queries.slice(0,25).map(x=>[x.locale,x.country,x.query,x.impressions,x.clicks,
      (x.ctr*100).toFixed(1)+'%',x.position.toFixed(1),x.priority,x.topicRelated?'Da verificare':'Non assegnato',x.action])));
  else lines.push('Nessuna query osservata. Le query ipotizzate in CALC-INT4.1 NON sono considerate osservazioni.');
  lines.push('','## Pagine osservate (massimo 15)','');
  if(r.pages.length)lines.push(table(['Lingua','Paese','Pagina','Impression','Click','CTR','Pos.','Classe'],
    r.pages.slice(0,15).map(x=>[x.locale,x.country,x.page,x.impressions,x.clicks,
      (x.ctr*100).toFixed(1)+'%',x.position.toFixed(1),x.priority])));
  else lines.push('Nessuna esportazione della dimensione Pagine: attribuzione query→landing non disponibile.');
  lines.push('','## Query su più URL (solo export congiunto query-page)','');
  if(r.overlaps.length)lines.push(table(['Lingua','Paese','Query','URL distinti','Impression campionate','Verifica'],
    r.overlaps.slice(0,10).map(x=>[x.locale,x.country,x.query,x.pages.join(' · '),
      x.impressions,'Sovrapposizione, NON cannibalizzazione provata'])));
  else lines.push('Nessuna sovrapposizione rilevata oppure dimensione query-page assente. Non è una prova di assenza di cannibalizzazione.');
  lines.push('','## Criteri di prudenza','');
  for (const warning of r.limitations)lines.push('- '+warning);
  lines.push('','**Decisione editoriale:** ottimizzare prima le pagine esistenti con segnali attendibili; nuove URL solo dopo verifica intento, originalità tecnica, copertura esistente e domanda ripetuta.');
  return lines.join('\n')+'\n';
}
export const GSC_MARKETS=MARKET;
