export type ItalianCompanyRow = {
 company_name:string;role:"trader_distributor"|"end_user";domain:string;vat_id:string;
 province:string;municipality:string;ateco_code:string;ateco_version:string;
 source_record_id:string;evidence_url:string;
};
export function parseItalianCompanyCsv(text:string,options?:{
 defaultRole?:"trader_distributor"|"end_user"|"";atecoVersion?:"2022"|"2025"|"";
}):{rows:ItalianCompanyRow[]; duplicatesInFile:number; originalRows:number};
