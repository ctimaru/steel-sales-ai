#!/usr/bin/env node
/**
 * CALC-INT4.2 — local, zero-network Search Console CSV audit.
 * Requires no API keys, subscriptions, uploads or production changes.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { collectEvidence, renderReport } from './calc-int4-2-gsc-core.mjs';

const help = [
  'CALC-INT4.2 — Free local Search Console CSV evidence review',
  '',
  'Usage: npm run seo:gsc -- --manifest private/gsc-evidence/manifest.json',
  '       npm run seo:gsc -- --manifest private/gsc-evidence/manifest.json --output private/gsc-evidence/report.md',
  '       npm run seo:gsc -- --example',
  '',
  'Only Google Search Console CSV exports; no OAuth and no invented traffic.',
  'Keep private/gsc-evidence/ outside Git tracking. See docs/quality/calc-int4-2-gsc-evidence.md.'
].join('\n');

function example() {
  return {
    property: 'sc-domain:smartsteelsales.com',
    exportedAt: '2026-10-16',
    exports: [
      { path: './DEU-de-queries-28d.csv', dimension: 'query', locale: 'de', country: 'DEU',
        startDate: '2026-09-16', endDate: '2026-10-13',
        searchType: 'web', pageFilter: '/de/knowledge/tubes',
        filtersVerified: false, finalData: false },
      { path: './DEU-de-pages-28d.csv', dimension: 'page', locale: 'de', country: 'DEU',
        startDate: '2026-09-16', endDate: '2026-10-13',
        searchType: 'web', pageFilter: '/de/knowledge/tubes',
        filtersVerified: false, finalData: false }
    ]
  };
}
function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) { console.log(help); return; }
  if (argv.includes('--example')) { console.log(JSON.stringify(example(),null,2)); return; }
  const opts={};
  for(let i=0;i<argv.length;i+=2) {
    if (!['--manifest','--output'].includes(argv[i]) || !argv[i+1] ||
        argv[i+1].startsWith('--')) throw new Error('Bad arguments. Use --help.');
    opts[argv[i].slice(2)]=argv[i+1];
  }
  if(!opts.manifest) { console.log(help); process.exitCode=2; return; }
  const file=resolve(opts.manifest);
  const manifest=JSON.parse(readFileSync(file,'utf8'));
  const evidence=collectEvidence(manifest,file);
  const report=renderReport(evidence);
  if (opts.output) {
    const output=resolve(opts.output);
    mkdirSync(dirname(output),{recursive:true});
    writeFileSync(output,report,'utf8');
    console.log('Report salvato localmente: '+output+' | stato='+evidence.status);
  } else console.log(report);
  if(evidence.status==='NO_EVIDENCE')process.exitCode=3;
}
try {main(process.argv.slice(2));} catch(e) {
  console.error('CALC-INT4.2: '+e.message);
  process.exitCode=1;
}
