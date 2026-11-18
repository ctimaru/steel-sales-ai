import "server-only";

import {createClient} from "@/lib/supabase/server";

export type ProducerStructuredFact={
  id:string;
  companyId:string;
  companyName:string;
  productScope:string;
  kind:"technical_standard"|"steel_grade"|"section_shape"|"dimension_range"|"manufacturing_process";
  value:string;
  sourceUrl:string;
  sourceTitle:string;
  shapeCode:"CHS"|"SHS"|"RHS"|null;
  diameterMin:number|null;diameterMax:number|null;
  widthMin:number|null;widthMax:number|null;
  heightMin:number|null;heightMax:number|null;
  thicknessMin:number|null;thicknessMax:number|null;
  reviewStatus:"pending_producer_confirmation"|"attribute_confirmed_by_producer";
};

export type StructuredCatalogResult={
  totalFacts:number;
  producers:number;
  items:ProducerStructuredFact[];
};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const kinds=new Set(["technical_standard","steel_grade","section_shape","dimension_range","manufacturing_process"]);
function number(x:unknown):x is number{
  return typeof x==="number"&&Number.isFinite(x)&&x>0&&x<=100000;
}
function optionalNumber(x:unknown):x is number|null {
  return x===null||number(x);
}
function sourceUrl(x:unknown):x is string{
  if(typeof x!=="string"||x.length>1200)return false;
  try{
    const u=new URL(x);
    return u.protocol==="https:"&&!u.username&&!u.password&&!u.hash;
  }catch{return false;}
}

/** Never materialize a cross-attribute tuple, verified SKU or availability. */
export function parseProducerStructuredCatalog(input:unknown):StructuredCatalogResult|null{
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const data=input as Record<string,unknown>;
  if(data.contract!=="netproducers-structured-public-v1"||
     data.exact_skus_confirmed!==0||data.source_pdf_copies!==0||
     typeof data.total_facts!=="number"||!Number.isSafeInteger(data.total_facts)||data.total_facts<0||
     typeof data.producers!=="number"||!Number.isSafeInteger(data.producers)||data.producers<0||
     !Array.isArray(data.items)||data.items.length>160||data.count!==data.items.length)return null;
  const items:ProducerStructuredFact[]=[];
  for(const item of data.items){
    if(!item||typeof item!=="object"||Array.isArray(item))return null;
    const p=item as Record<string,unknown>;
    if(typeof p.id!=="string"||!uuid.test(p.id)||
       typeof p.company_id!=="string"||!uuid.test(p.company_id)||
       typeof p.company_name!=="string"||p.company_name.length>220||
       typeof p.product_scope!=="string"||p.product_scope.length>96||
       !kinds.has(p.kind as string)||typeof p.value!=="string"||p.value.length>200||
       !sourceUrl(p.source_url)||typeof p.source_title!=="string"||p.source_title.length>160||
       (p.shape_code!==null&&!["CHS","SHS","RHS"].includes(String(p.shape_code)))||
       !["pending_producer_confirmation","attribute_confirmed_by_producer"].includes(String(p.review_status))
    )return null;
    const fields=[
      p.diameter_min_mm,p.diameter_max_mm,p.width_min_mm,p.width_max_mm,
      p.height_min_mm,p.height_max_mm,p.thickness_min_mm,p.thickness_max_mm,
    ];
    if(!fields.every(optionalNumber))return null;
    const facts:ProducerStructuredFact={
      id:p.id,companyId:p.company_id,companyName:p.company_name,
      productScope:p.product_scope,
      kind:p.kind as ProducerStructuredFact["kind"],value:p.value,
      sourceUrl:p.source_url,sourceTitle:p.source_title,
      shapeCode:p.shape_code as ProducerStructuredFact["shapeCode"],
      diameterMin:p.diameter_min_mm as number|null,
      diameterMax:p.diameter_max_mm as number|null,
      widthMin:p.width_min_mm as number|null,
      widthMax:p.width_max_mm as number|null,
      heightMin:p.height_min_mm as number|null,
      heightMax:p.height_max_mm as number|null,
      thicknessMin:p.thickness_min_mm as number|null,
      thicknessMax:p.thickness_max_mm as number|null,
      reviewStatus:p.review_status as ProducerStructuredFact["reviewStatus"],
    };
    if((facts.diameterMin!==null&&facts.diameterMax!==null&&facts.diameterMin>facts.diameterMax)||
       (facts.thicknessMin!==null&&facts.thicknessMax!==null&&facts.thicknessMin>facts.thicknessMax)||
       (facts.widthMin!==null&&facts.widthMax!==null&&facts.widthMin>facts.widthMax)||
       (facts.heightMin!==null&&facts.heightMax!==null&&facts.heightMin>facts.heightMax))return null;
    items.push(facts);
  }
  return {totalFacts:data.total_facts as number,producers:data.producers as number,items};
}

export async function getProducerStructuredCatalog(search:string):Promise<StructuredCatalogResult|null>{
  try{
    const db=await createClient();
    const {data,error}=await db.rpc("netproducers1_structured_public",{
      p_search:search.slice(0,100),p_limit:160,
    });
    return error?null:parseProducerStructuredCatalog(data);
  }catch{return null;}
}
