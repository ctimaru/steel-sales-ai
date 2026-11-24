import { NextResponse } from "next/server";
import { isPlatformSuperadmin } from "@/lib/platform-admin";
import { queryPublicCompany } from "@/lib/public-company-lookup";
import { foundingCompanyLookupResult } from "@/lib/founding-company-lookup-contract";
export const dynamic="force-dynamic";
const reply=(status:number,data:unknown)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:Request){
 try{
  if(!await isPlatformSuperadmin())return reply(403,{status:"error",items:[]});
  const data=await request.formData();
  const result=await queryPublicCompany(data.get("company_query"),data.get("company_website"));
  return reply(200,foundingCompanyLookupResult(result));
 }catch{return reply(503,{status:"error",items:[]});}
}
