import "server-only";
import {createClient} from "@/lib/supabase/server";

export type PdfDimensionRow={
 id:string;companyId:string;companyName:string;
 standard:"EN 10219"|"EN 10210"|"CATALOGUE_UNSPECIFIED";shape:"RHS"|"SHS"|"CHS";
 width:number|null;height:number|null;diameter:number|null;thickness:number|null;
 sourcePage:number;sourceUrl:string;review:"pending_producer_confirmation"|"single_row_confirmed";
};
export type PdfDimensions={total:number;producers:number;rows:PdfDimensionRow[]};
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const valid=(x:unknown)=>typeof x==="number"&&Number.isFinite(x)&&x>0&&x<=1500;
export function parsePdfDimensions(raw:unknown):PdfDimensions|null {
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 if(r.contract!=="netproducers-c3-pdf-public-v1"||
    r.verified_manufacturer_skus!==0||r.mirrored_pdf_copies!==0||
    !Number.isSafeInteger(r.total)||!Number.isSafeInteger(r.producers)||
    !Array.isArray(r.items)||r.items.length>180||r.count!==r.items.length)return null;
 const rows:PdfDimensionRow[]=[];
 for(const obj of r.items){
   if(!obj||typeof obj!=="object"||Array.isArray(obj))return null;
   const x=obj as Record<string,unknown>;
   if(typeof x.id!=="string"||!uuid.test(x.id)||
     typeof x.company_id!=="string"||!uuid.test(x.company_id)||
     typeof x.company_name!=="string"||x.company_name.length>220||
     !["EN 10219","EN 10210","CATALOGUE_UNSPECIFIED"].includes(String(x.standard))||
     !["RHS","SHS","CHS"].includes(String(x.shape))||
     x.review_status!=="pending_producer_confirmation"&&x.review_status!=="single_row_confirmed"||
     !Number.isSafeInteger(x.source_page)||Number(x.source_page)<1||Number(x.source_page)>100||
     typeof x.source_url!=="string"||!x.source_url.startsWith("https://")||
     x.source_url.length>1200||x.thickness_mm!==null||
     x.shape==="CHS"&&(!valid(x.diameter_mm)||x.width_mm!==null||x.height_mm!==null)||
     x.shape!=="CHS"&&(!valid(x.width_mm)||!valid(x.height_mm)||x.diameter_mm!==null)
   )return null;
   rows.push({id:x.id,companyId:x.company_id,companyName:x.company_name,
    standard:x.standard as PdfDimensionRow["standard"],shape:x.shape as PdfDimensionRow["shape"],
    width:x.width_mm as number|null,height:x.height_mm as number|null,
    diameter:x.diameter_mm as number|null,thickness:null,
    sourcePage:x.source_page as number,sourceUrl:x.source_url,
    review:x.review_status as PdfDimensionRow["review"]});
 }
 return {total:r.total as number,producers:r.producers as number,rows};
}
export async function getPdfDimensions(query:string):Promise<PdfDimensions|null>{
 try{
  const db=await createClient();
  const {data,error}=await db.rpc("netproducers_c3_pdf_public",{
   p_search:query.slice(0,80),p_limit:180,
  });
  return error?null:parsePdfDimensions(data);
 }catch{return null;}
}