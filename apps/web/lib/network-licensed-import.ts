/** NET-FAST3: bounded CSV/TSV import from an already licensed provider.
 * Pure parser: no network, formulas, personal fields or page content accepted.
 */
export type LicensedCompanyRow={
 name:string;domain:string;source_id:string;role:string;
};
const ROLES=new Set(["unknown","producer","trader_distributor","processor_service_provider","end_user"]);
const HEADER=["name","domain","record_id","role"];
const EXCLUDE=new Set(["facebook.com","linkedin.com","instagram.com","youtube.com","wikidata.org","wikipedia.org","google.com","tiktok.com"]);
function delimiterOf(first:string) {
 const possibilities=["\t",";",","];
 return possibilities.map(d=>({d,score:first.split(d).length})).sort((a,b)=>b.score-a.score)[0].d;
}
function parseDelimited(text:string,delimiter:string):string[][] {
 const rows:string[][]=[];let current:string[]=[];let field="";let quoted=false;
 for(let i=0;i<text.length;i++){
  const char=text[i];
  if(char==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++;continue;}
   if(!quoted&&field.trim()!=="")throw new Error("Virgolette CSV non valide");
   quoted=!quoted;continue;
  }
  if(char===delimiter&&!quoted){current.push(field.trim());field="";continue;}
  if((char==="\n"||char==="\r")&&!quoted){
   if(char==="\r"&&text[i+1]==="\n")i++;
   current.push(field.trim());field="";
   if(current.some(Boolean))rows.push(current);
   current=[];
   continue;
  }
  field+=char;
 }
 if(quoted)throw new Error("CSV con virgolette non chiuse");
 current.push(field.trim());if(current.some(Boolean))rows.push(current);
 return rows;
}
export function parseLicensedCompanies(input:string):LicensedCompanyRow[]{
 if(input.length<1||input.length>450_000)throw new Error("File vuoto o superiore a 450 KB");
 const rows=parseDelimited(input.replace(/^\uFEFF/,""),delimiterOf(input.split(/\r?\n/,1)[0]??""));
 if(!rows.length)throw new Error("Nessuna azienda da importare");
 const head=rows[0].map(s=>s.toLowerCase().replace(/\s+/g,"_"));
 const hasHeader=head.includes("name")&&head.includes("domain");
 const indexes=hasHeader
  ? HEADER.map(h=>head.indexOf(h))
  : [0,1,2,3];
 if(indexes[0]<0||indexes[1]<0)throw new Error("Servono almeno nome e dominio");
 const data=hasHeader?rows.slice(1):rows;
 if(data.length<1||data.length>1000)throw new Error("Ogni lotto richiede 1–1000 aziende");
 const seen=new Set<string>();
 return data.map((fields,index)=>{
  const name=(fields[indexes[0]]??"").trim();
  let domain=(fields[indexes[1]]??"").trim().toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split("/")[0];
  const source_id=(indexes[2]<0?"":(fields[indexes[2]]??"")).trim()||domain;
  const role=(indexes[3]<0?"":(fields[indexes[3]]??"")).trim()||"unknown";
  if(!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,24}$/.test(domain)||
   domain.includes("..")||EXCLUDE.has(domain)||
   name.length<3||name.length>180||/[@<>\x00-\x1f]/.test(name)||
   source_id.length<2||source_id.length>160||/[@<>\x00-\x1f]/.test(source_id)||
   !ROLES.has(role))throw new Error("Riga "+(index+1)+": nome, dominio o ruolo non valido");
  if(seen.has(domain))throw new Error("Dominio ripetuto nel file: "+domain);
  seen.add(domain);
  return {name,domain,source_id,role};
 });
}
