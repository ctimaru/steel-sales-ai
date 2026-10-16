import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectEvidence, renderReport, GSC_MARKETS } from '../scripts/calc-int4-2-gsc-core.mjs';

const date28={startDate:'2026-09-16',endDate:'2026-10-13'};
const date7={startDate:'2026-10-07',endDate:'2026-10-13'};
function setup(dimension='query', locale='de', window=date28) {
  const dir=mkdtempSync(join(tmpdir(),'calc-int4-2-'));
  const manifestFile=join(dir,'manifest.json');
  const entry={path:'data.csv',dimension,locale,country:locale==='de'?'DEU':locale==='fr'?'FRA':'ESP',
    ...window,searchType:'web',pageFilter:'/'+locale+'/knowledge/tubes',
    filtersVerified:true,finalData:true};
  const manifest={property:'sc-domain:smartsteelsales.com',exportedAt:'2026-10-16',exports:[entry]};
  return {dir,entry,manifest,manifestFile,
    write(text){writeFileSync(join(dir,'data.csv'),text);return this;},
    run(){return collectEvidence(manifest,manifestFile);}
  };
}

test('CALC-INT4.2: without real exports the report is explicitly NO_EVIDENCE',()=>{
  const manifest={property:'sc-domain:smartsteelsales.com',exportedAt:'2026-10-16',exports:[]};
  const result=collectEvidence(manifest,'/does/not/matter/manifest.json');
  assert.equal(result.status,'NO_EVIDENCE');
  assert.deepEqual(result.queries,[]);
  assert.deepEqual(result.pages,[]);
  assert.match(renderReport(result), /Nessuna classifica SEO/);
  assert.doesNotMatch(renderReport(result), /\| P1_CTR \|/);
});

test('CALC-INT4.2: rank and CTR rules use only confirmed 28-day observed queries',()=>{
  const x=setup().write('Top queries,Clicks,Impressions,CTR,Position\n' +
    '"DIN EN 10219-2 Toleranzen",1,100,1%,8.2\n' +
    '"smart steel sales",8,10,80%,1\n' +
    '"rohr ungewohnlich",0,4,0%,32\n');
  const r=x.run();
  assert.equal(r.status,'OBSERVED_SAMPLE');
  assert.equal(r.queries[0].query,'DIN EN 10219-2 Toleranzen');
  assert.equal(r.queries[0].priority,'P1_CTR');
  assert.equal(r.queries[0].topicRelated,true);
  assert.equal(r.queries.find(q=>q.query==='smart steel sales').priority,'EXCLUDE_BRAND');
  assert.equal(r.queries.find(q=>q.impressions===4).priority,'LOW_SIGNAL');
  assert.match(renderReport(r),/100/);
});

test('CALC-INT4.2: real localized semicolon CSV with decimal comma and thousands',()=>{
  const x=setup('query','fr').write('\uFEFFRequêtes;Clics;Impressions;CTR;Position\r\n' +
    '"certificat matière 3.1";6;1.200;0,5%;12,5\r\n');
  const r=x.run();
  assert.equal(r.queries[0].impressions,1200);
  assert.equal(r.queries[0].clicks,6);
  assert.equal(r.queries[0].ctr,0.005);
  assert.equal(r.queries[0].position,12.5);
  assert.equal(r.queries[0].topicRelated,true);
});

test('CALC-INT4.2: valid Italian / German / Spanish header names',()=>{
  const x=setup('query','es').write('Consultas,Clics,Impresiones,CTR,Posición\n' +
    '"peso tubo 10210",0,100,0%,25\n');
  const r=x.run();
  assert.equal(r.queries[0].priority,'P2_INTENT');
});

test('CALC-INT4.2: individual Pages export cannot be silently attributed to Queries export',()=>{
  const x=setup('page').write('Pages,Clicks,Impressions,CTR,Position\n' +
    'https://www.smartsteelsales.com/de/knowledge/tubes,2,200,1%,11\n');
  const r=x.run();
  assert.equal(r.pages.length,1);
  assert.equal(r.queries.length,0);
  assert.equal(r.overlaps.length,0);
  assert.match(renderReport(r),/Nessuna query osservata/);
});

test('CALC-INT4.2: country differs from page language and is retained as filter metadata',()=>{
  const x=setup().write('Query,Clicks,Impressions,CTR,Position\n' +
    'DIN EN 10219 Gewicht,2,100,2%,9\n');
  x.entry.country='FRA';
  assert.equal(x.run().queries[0].country,'FRA');
});

test('CALC-INT4.2: detect URL overlaps ONLY in joint query/page rows',()=>{
  const x=setup('query-page').write('Query,Page,Clicks,Impressions,CTR,Position\n' +
    '"10219 Hohlprofile",https://www.smartsteelsales.com/de/knowledge/tubes,1,35,2.857%,12\n' +
    '"10219 Hohlprofile",https://www.smartsteelsales.com/de/knowledge/tubes/din-en-10219-2-toleranzen-masse-hohlprofile,1,23,4.348%,17\n');
  const r=x.run();
  assert.equal(r.overlaps.length,1);
  assert.equal(r.overlaps[0].impressions,58);
  assert.equal(r.overlaps[0].pages.length,2);
  assert.equal(r.overlaps[0].verdict,'URL_OVERLAP_REVIEW_NOT_PROVEN_CANNIBALIZATION');
  assert.match(renderReport(r),/NON cannibalizzazione provata/);
});

test('CALC-INT4.2: reject URL from external domain or wrong locale prefix',()=>{
  const x=setup('page').write('Page,Clicks,Impressions,CTR,Position\n' +
    'https://competitor.example/de/knowledge/tubes,0,100,0%,10\n');
  assert.throws(()=>x.run(),/Page URL not an HTTPS Smart Steel Sales/);
  x.write('Page,Clicks,Impressions,CTR,Position\n' +
    'https://www.smartsteelsales.com/it/knowledge/tubes,0,100,0%,10\n');
  assert.throws(()=>x.run(),/outside declared locale scope/);
});

test('CALC-INT4.2: rejects duplicate scoped exports, preventing double-counting',()=>{
  const x=setup().write('Query,Clicks,Impressions,CTR,Position\n10219 hohl,0,60,0%,20\n');
  x.manifest.exports.push({...x.entry,path:'another-file.csv'});
  assert.throws(()=>x.run(),/Duplicate scoped export/);
});

test('CALC-INT4.2: non-final source cannot trigger a ranking action',()=>{
  const x=setup().write('Query,Clicks,Impressions,CTR,Position\n10219 hohl,0,100,0%,7\n');
  x.entry.finalData=false;
  const r=x.run();
  assert.equal(r.status,'PENDING_28D_VALIDATION');
  assert.equal(r.queries[0].priority,'VERIFY_EXPORT');
});

test('CALC-INT4.2: 7-day data is observed but not ranked like 28-day opportunity',()=>{
  const x=setup('query','de',date7).write('Query,Clicks,Impressions,CTR,Position\n10219 hohl,0,100,0%,7\n');
  const r=x.run();
  assert.equal(r.queries[0].priority,'OBSERVE_7D');
  assert.equal(r.status,'PENDING_28D_VALIDATION');
});

test('CALC-INT4.2: reject malformed or ambiguous metrics and missing headers',()=>{
  const x=setup().write('Query,Clicks,Impressions,CTR,Position\n10219,0,50,-,7\n');
  assert.throws(()=>x.run(),/Non-exact or missing ctr/);
  x.write('Query,Clicks,CTR,Position\n10219,0,0%,7\n');
  assert.throws(()=>x.run(),/CSV header missing impressions/);
  x.write('Query,Clicks,Impressions,CTR,Position\n10219,55,50,100%,7\n');
  assert.throws(()=>x.run(),/Clicks exceed impressions/);
});

test('CALC-INT4.2: query-page rows must not imply a site-wide traffic total',()=>{
  const x=setup('query-page').write('Query,Page,Clicks,Impressions,CTR,Position\n' +
    '10210,https://www.smartsteelsales.com/de/knowledge/tubes,0,35,0%,15\n');
  const r=x.run();
  assert.equal(r.pages.length,0);
  assert.equal(r.queries[0].impressions,35);
  assert.match(r.limitations.join(' '), /never infer their query→page relationship/);
});

test('CALC-INT4.2: source topic URLs match actual published editorial slugs',()=>{
  const source=readFileSync(new URL('../lib/calculator-topic-clusters.ts',import.meta.url),'utf8');
  assert.deepEqual(Object.keys(GSC_MARKETS),['de','fr','es']);
  for (const market of Object.values(GSC_MARKETS)) {
    assert.ok(source.includes(market.topic.split('/').at(-1)),market.topic);
    assert.ok(market.terms.length>=5);
  }
});
