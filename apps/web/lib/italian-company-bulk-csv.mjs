/**
 * CRAWL-IT6.6b — no third-party CSV dependency, no external requests.
 * Deliberately accepts corporate-only fields. CSV may be quoted and semicolon-separated.
 */
const HEADERS = {
  company_name: ["company_name","denominazione","denominazione_impresa","ragione_sociale","azienda","impresa","legal_name","company"],
  domain: ["domain","website","sito_web","sito","website_url","web"],
  vat_id: ["vat_id","partita_iva","partitaiva","piva","p_iva"],
  province: ["province","provincia","sigla_provincia","provincia_sigla","prov"],
  municipality: ["municipality","comune","citta","localita","city"],
  ateco_code: ["ateco_code","codice_ateco","ateco","attivita_ateco"],
  ateco_version: ["ateco_version","versione_ateco"],
  role: ["role","segment","ruolo","categoria","tipologia"],
  source_record_id: ["source_record_id","id_fonte","id_record","numero_rea"],
  evidence_url: ["evidence_url","url_evidenza","fonte_url"]
};
const SENSITIVE = /(^|_)(email|e_mail|mail|pec|telefono|phone|cellulare|mobile|contatto|contact|nome_persona|cognome|indirizzo_privato|birth|nascita|codice_fiscale_persona)(_|$)/;
function normHeader(value) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
}
function parseRecords(text) {
  if (typeof text !== "string" || !text.trim()) throw Error("CSV vuoto.");
  const raw = text.replace(/^\uFEFF/,"");
  const topLine = raw.slice(0,raw.indexOf("\n")<0?Math.min(raw.length,2000):raw.indexOf("\n"));
  const delimiter = [";",",","\t"].map(c=>({c,n:topLine.split(c).length})).sort((a,b)=>b.n-a.n)[0].c;
  let rows=[], row=[], value="",quoted=false, afterQuote=false;
  for(let i=0;i<raw.length;i++) {
    const c=raw[i];
    if(quoted) {
      if(c==='"' && raw[i+1]==='"'){value+='"';i++;}
      else if(c==='"'){quoted=false;afterQuote=true;}
      else value+=c;
    } else if(c==='"' && value===""){quoted=true;afterQuote=false;}
    else if(c===delimiter){row.push(value.trim());value="";afterQuote=false;}
    else if(c==="\n" || c==="\r") {
      if(c==="\r" && raw[i+1]==="\n")i++;
      row.push(value.trim());value="";afterQuote=false;
      if(row.some(x=>x!=="")) rows.push(row);
      row=[];
      if(rows.length>2001) throw Error("Massimo 2.000 righe aziendali per file.");
    } else if (afterQuote && !/\s/.test(c)) {throw Error("CSV con virgolette non valide.");}
    else if (afterQuote) {continue;}
    else value+=c;
  }
  if(quoted)throw Error("CSV con campo tra virgolette non chiuso.");
  row.push(value.trim());
  if(row.some(x=>x!==""))rows.push(row);
  if(rows.length<2)throw Error("CSV senza righe aziendali.");
  if(rows.length>2001)throw Error("Massimo 2.000 righe aziendali per file.");
  return rows;
}
export function parseItalianCompanyCsv(text,options={}) {
  const {defaultRole="",atecoVersion=""}=options;
  const records=parseRecords(text);
  const headers=records[0].map(normHeader);
  if(headers.some(h=>SENSITIVE.test(h)))throw Error("Il CSV contiene colonne personali o di contatto: rimuovile prima dell'importazione.");
  if(new Set(headers).size!==headers.length)throw Error("Intestazioni CSV duplicate.");
  const index=Object.fromEntries(Object.entries(HEADERS).map(([field,aliases])=>[field,headers.findIndex(h=>aliases.includes(h))]));
  if(index.company_name<0)throw Error("Manca la colonna denominazione/company_name.");
  if(!["trader_distributor","end_user"].includes(defaultRole))throw Error("Seleziona Commercianti o Utilizzatori.");
  const seen=new Set(), rows=[];
  let duplicatesInFile=0;
  for(let i=1;i<records.length;i++){
    const line=records[i];
    if(line.length!==headers.length)throw Error("Numero di colonne non valido alla riga "+(i+1)+".");
    const field=k=>index[k]<0?"":(line[index[k]]||"").trim();
    const company=field("company_name");
    if(!company || company.length<3 || company.length>180 || /[<>@\x00-\x1f]/.test(company))
      throw Error("Denominazione azienda non valida alla riga "+(i+1)+".");
    const rawWeb=field("domain");
    let domain="";
    if(rawWeb){
      try {
        const url=new URL(rawWeb.startsWith("https://")?rawWeb:"https://"+rawWeb);
        if(url.protocol!=="https:" || url.username || url.password || url.port || url.search || url.hash)
          throw Error("unsafe");
        domain=url.hostname.toLowerCase().replace(/^www\./,"").replace(/\.$/,"");
        if(!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$/.test(domain) || domain.includes(".."))throw Error("unsafe");
      } catch {throw Error("Sito web non valido alla riga "+(i+1)+".");}
    }
    const vat=field("vat_id").toUpperCase().replace(/\s/g,"");
    const province=field("province").toUpperCase();
    const municipality=field("municipality");
    const ateco=field("ateco_code");
    const version=field("ateco_version")||atecoVersion;
    const role=field("role")||defaultRole;
    if(!["trader_distributor","end_user"].includes(role))throw Error("Segmento non valido alla riga "+(i+1)+".");
    if(vat && !/^(IT)?[0-9]{11}$/.test(vat))throw Error("P.IVA aziendale non valida alla riga "+(i+1)+".");
    if(province && !/^[A-Z]{2}$/.test(province))throw Error("Provincia: usare sigla di 2 lettere, riga "+(i+1)+".");
    if(ateco && (!/^\d{2}(\.\d{1,2}){0,2}$/.test(ateco) || !["2022","2025"].includes(version)))
      throw Error("ATECO richiede un codice valido e la versione 2022/2025, riga "+(i+1)+".");
    if(!domain && !vat && !province)
      throw Error("Servono almeno dominio, P.IVA aziendale o provincia alla riga "+(i+1)+".");
    const key=vat?"vat:"+vat.replace(/^IT/,""):domain?"domain:"+domain:"name_province:"+company.toLowerCase().replace(/\s+/g," ")+":"+province;
    if(seen.has(key)){duplicatesInFile++;continue;}
    seen.add(key);
    rows.push({
      company_name:company,role,domain,vat_id:vat,province,municipality,
      ateco_code:ateco,ateco_version:ateco?version:"",
      source_record_id:field("source_record_id")||"csv-line-"+(i+1),
      evidence_url:field("evidence_url")
    });
  }
  if(!rows.length)throw Error("Il file non contiene aziende nuove dopo deduplicazione interna.");
  return {rows,duplicatesInFile,originalRows:records.length-1};
}
