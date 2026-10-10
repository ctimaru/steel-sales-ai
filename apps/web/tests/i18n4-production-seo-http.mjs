import assert from 'node:assert/strict';
const BASE = 'https://www.smartsteelsales.com';
let ok=0, warn=0;
const pairs = [
 ['/en','/'],['/en/knowledge','/knowledge'],
 ['/en/knowledge/tubes','/knowledge/tubes'],
 ['/en/knowledge/standards','/knowledge/norme'],
 ['/en/knowledge/grades','/knowledge/gradi'],
 ['/en/distinta','/distinta'],
];
function pass(s){console.log('I18N4 PASS',s);ok++}
function warning(s){console.warn('I18N4 FOLLOWUP',s);warn++}
function tags(s,tag){return [...s.matchAll(new RegExp('<'+tag+'\\b[^>]*>','gi'))].map(x=>x[0]);}
function attribute(t,k){const m=t.match(new RegExp('\\b'+k+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')','i'));return m?.[1]??m?.[2]??null;}
function sameUrl(a,b){return new URL(a).href===new URL(b).href;}
function link(html,rel){return tags(html,'link').filter(t=>attribute(t,'rel')===rel);}
function canonical(html){const c=link(html,'canonical');assert.equal(c.length,1,'expected one canonical');return attribute(c[0],'href');}
function alternates(html){const m=new Map();for(const t of link(html,'alternate')){const k=attribute(t,'hreflang');if(k){assert.ok(!m.has(k),'duplicate hreflang '+k);m.set(k,attribute(t,'href'));}}return m;}
async function read(path){const u=new URL(path,BASE);assert.equal(u.origin,BASE,'external destination');const r=await fetch(u,{method:'GET',redirect:'manual',cache:'no-store',headers:{'user-agent':'SmartSteelSales-I18N4-ReadOnlySEOAcceptance/1.0','accept':'text/html,application/xml,text/xml,text/plain'},signal:AbortSignal.timeout(30000)});const html=await r.text();assert.equal(r.status,200,path+' HTTP '+r.status);assert.ok(html.length<12000000,'abnormal payload');return {html,r};}
function checkHtml(html,path,it=null){assert.ok(sameUrl(canonical(html),BASE+path),'canonical mismatch '+path);const meta=tags(html,'meta').filter(x=>attribute(x,'name')==='robots').map(x=>attribute(x,'content')).join(' ');assert.doesNotMatch(meta,/noindex/i,path+' noindex');assert.match(html,/<main\b[^>]*\blang="en"/i,path+' main lang');assert.match(html,/<h1\b/i,path+' no H1');if(it){const a=alternates(html);assert.ok(sameUrl(a.get('en'),BASE+path),path+' en hreflang');assert.ok(sameUrl(a.get('it'),BASE+it),path+' it hreflang');}const root=tags(html,'html')[0]||'';if(attribute(root,'lang')!=='en')warning(path+' <html lang> is not en (screen-reader locale gap)');pass(path+' canonical, content, indexability'+(it?', hreflang':''));}
const {html:robots}=await read('/robots.txt');assert.match(robots,/Sitemap:\s*https:\/\/www\.smartsteelsales\.com\/sitemap\.xml/i);for(const [p] of pairs){for(const line of robots.split(/\r?\n/)){const rule=line.match(/^Disallow:\s*(\/\S*)/i)?.[1];if(rule)assert.ok(!p.startsWith(rule),p+' blocked by robots '+rule);}}pass('robots: EN crawlable');
const {html:xml,r:sr}=await read('/sitemap.xml');assert.match(sr.headers.get('content-type')||'',/xml/);assert.match(xml,/<urlset/i);const locs=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert.equal(new Set(locs).size,locs.length,'duplicate sitemap loc');for(const [p] of pairs)assert.ok(locs.includes(BASE+p),'missing sitemap '+p);assert.ok(locs.includes(BASE+'/en/network'));for(const p of ['/dashboard','/platform','/login','/register','/marketplace'])assert.ok(!locs.some(x=>new URL(x).pathname===p||new URL(x).pathname.startsWith(p+'/')),'private sitemap URL '+p);pass('sitemap unique, EN URLs included, private excluded');
for(const [p,it] of pairs){const {html}=await read(p);checkHtml(html,p,it);const {html:other}=await read(it);assert.ok(sameUrl(canonical(other),BASE+it),'Italian canonical '+it);const a=alternates(other);assert.ok(sameUrl(a.get('it'),BASE+it),'Italian self-alternate '+it);assert.ok(sameUrl(a.get('en'),BASE+p),'English reciprocal '+p);pass(it+' reciprocal alternates');}
const net=await read('/en/network');checkHtml(net.html,'/en/network');
for(const name of ['standards','grades']){const prefix=BASE+'/en/knowledge/'+name+'/';const entries=locs.filter(x=>x.startsWith(prefix));assert.ok(entries.length>0,'No published EN '+name+' detail URLs in sitemap');for(const url of [entries[0],entries[entries.length-1]].filter((x,i,arr)=>arr.indexOf(x)===i)){const p=new URL(url).pathname;const slug=p.split('/').at(-1);const it='/knowledge/'+(name==='standards'?'norme':'gradi')+'/'+slug;const {html}=await read(p);checkHtml(html,p,it);assert.match(html,/application\/ld\+json/i);}pass(name+': '+entries.length+' published guide URL(s)');}
for(const path of ['/en/knowledge/standards?q=EN%2010219','/en/knowledge/grades?q=S355']){const {html}=await read(path);const meta=tags(html,'meta').filter(t=>attribute(t,'name')==='robots').map(t=>attribute(t,'content')).join(' ');assert.match(meta,/noindex/i,path+' search results should noindex');assert.ok(sameUrl(canonical(html),BASE+path.split('?')[0]),'Parameterized canonical '+path);pass(path+' noindex query');}
console.log('I18N4 PRODUCTION ACCEPTANCE',ok,'PASS;',warn,'KNOWN LOCALE WARNINGS; write operations: 0');