import "server-only";
import postgres from "postgres";
const writerRole="mkt9_intake_writer";
type ReserveInput={id:string;emailDigest:string;codeDigest:string;challengeDigest:string;payload:{kind:"partner"|"investor";locale:"it"|"en";name:string;email:string;organization:string|null;notice_version:string}};
// Production accepts only a dedicated, TLS-verified connection; no service-role fallback.
export function communityWriterConfig() {
  const raw=process.env.MKT9_COMMUNITY_DATABASE_URL?.trim();
  if(!raw) return null;
  try {
    const u=new URL(raw);
    const local=process.env.NODE_ENV==="test"&&["127.0.0.1","localhost"].includes(u.hostname)&&u.port==="54322";
    if(!["postgres:","postgresql:"].includes(u.protocol)||!u.password||u.search||u.hash||u.pathname!=="/postgres") return null;
    const user=decodeURIComponent(u.username);
    if(user!==writerRole&&!user.startsWith(writerRole+"."))return null;
    if(!local&&!(/^[a-z0-9.-]+\.pooler\.supabase\.com$/i.test(u.hostname)||/^db\.[a-z0-9]+\.supabase\.co$/i.test(u.hostname)))return null;
    return {raw,local};
  } catch {return null;}
}
export function communityWriterConfigured(){return communityWriterConfig()!==null;}
let connection:ReturnType<typeof postgres>|undefined;
function writer(){
  const cfg=communityWriterConfig();if(!cfg)throw Error("Community writer unavailable");
  if(!connection)connection=postgres(cfg.raw,{max:1,prepare:false,connect_timeout:5,idle_timeout:10,max_lifetime:60,ssl:cfg.local?false:{rejectUnauthorized:true},onnotice:()=>{}});
  return connection;
}
export async function reserveCommunityEmail(input:ReserveInput):Promise<boolean>{
  return writer().begin(async sql=>{
    const [role]=await sql`select current_user as name`;
    if(role?.name!==writerRole)throw Error("Unexpected community writer role");
    const [result]=await sql`select public.mkt9_reserve_email(${input.id}::uuid,${input.emailDigest},${input.codeDigest},${input.challengeDigest},${sql.json(input.payload)}) as ok`;
    return result?.ok===true;
  });
}
export async function confirmCommunityCode(id:string,digest:string):Promise<boolean>{
  return writer().begin(async sql=>{
    const [role]=await sql`select current_user as name`;
    if(role?.name!==writerRole)throw Error("Unexpected community writer role");
    const [result]=await sql`select public.mkt9_confirm_email(${id}::uuid,${digest}) as ok`;
    return result?.ok===true;
  });
}
