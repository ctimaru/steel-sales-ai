/**
 * Pure, executable validation for optional SCHOOL-UNIFY6B responses.
 * An LLM can only select existing published K2 references, never issue a verified commercial decision.
 */
import {isSchoolEvidenceLocale,type SchoolEvidenceLocale,type SchoolTechnicalEvidence}
  from "@/lib/school-knowledge-evidence";

export type SchoolGroundedAIResult={
  status:"grounded"|"disabled"|"no_evidence"|"quota"|"unavailable";
  answer:string;
  sources:Array<{id:string;title:string;url:string}>;
  reviewRequired:true;
};
const idPattern=/^(?:en\s*[- ]?\s*\d{4,5}(?:\s*[- ]?\d)?|s\d{3}[a-z0-9]{1,8}|p\d{3}[a-z0-9]{1,8}|16mo3)$/i;
type AIRequest={locale:string;codes:string[]};

export const SCHOOL_GROUNDED_FORMAT={
  type:"json_schema",
  json_schema:{name:"school_grounded_answer",strict:true,schema:{
    type:"object",additionalProperties:false,
    properties:{answer:{type:"string"},sourceIds:{type:"array",items:{type:"string"}},uncertain:{type:"boolean"}},
    required:["answer","sourceIds","uncertain"],
  }},
} as const;

/** Never accept a user prompt, arbitrary PII, or hidden metadata as model input. */
export function sanitizeGroundedRequest(input:unknown):{locale:SchoolEvidenceLocale;codes:string[]}|null{
  if(!input||typeof input!=="object"||Array.isArray(input))return null;
  const obj=input as Partial<AIRequest>;
  if(typeof obj.locale!=="string"||!isSchoolEvidenceLocale(obj.locale)||
    !Array.isArray(obj.codes)||obj.codes.length<1||obj.codes.length>2)return null;
  const codes=obj.codes.filter((code):code is string=>typeof code==="string"&&
    code.length>=3&&code.length<=24&&idPattern.test(code.trim()))
    .map(code=>code.trim()).map(code=>code.toUpperCase().replace(/\s|-/g,""));
  if(codes.length!==obj.codes.length||new Set(codes).size!==codes.length)return null;
  return {locale:obj.locale,codes};
}
export function validateSchoolGroundedOutput(value:unknown,evidence:SchoolTechnicalEvidence[]):{
  answer:string;sourceIds:string[];
}|null{
  if(!value||typeof value!=="object"||Array.isArray(value))return null;
  const x=value as {answer?:unknown;sourceIds?:unknown;uncertain?:unknown};
  if(Object.keys(x).some(k=>!["answer","sourceIds","uncertain"].includes(k))||
    typeof x.answer!=="string"||x.answer.trim().length<25||x.answer.length>1000||
    x.uncertain!==false||!Array.isArray(x.sourceIds)||x.sourceIds.length<1||
    x.sourceIds.length>4||!x.sourceIds.every(s=>typeof s==="string"))return null;
  const existing=new Set(evidence.map(item=>item.id));
  if(x.sourceIds.some(id=>!existing.has(id)))return null;
  if(/(?:€\s*\d|\d\s*€|in\s+stock|immediately\s+available|garanti(?:ert|to|e)|certificat(?:o|ed|ion)|gleichwertig|[ée]quivalent|equivalent|sustituible)/i.test(x.answer))
    return null;
  return {answer:x.answer.trim(),sourceIds:[...new Set(x.sourceIds)]};
}
