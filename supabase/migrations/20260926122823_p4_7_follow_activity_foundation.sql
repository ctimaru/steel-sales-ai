create table public.network_company_follows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  network_company_id uuid not null references public.network_companies(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  constraint network_company_follows_unique unique (organization_id,user_id,network_company_id)
);

create index network_company_follows_user_org_idx
  on public.network_company_follows (user_id,organization_id,created_at desc);
create index network_company_follows_company_idx
  on public.network_company_follows (network_company_id);

alter table public.network_company_follows enable row level security;
revoke all on table public.network_company_follows from public,anon,authenticated;
grant select,insert,update,delete on table public.network_company_follows to service_role;

create table public.network_activity_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  network_company_id uuid not null references public.network_companies(id) on delete restrict,
  activity_type text not null,
  entity_type text null,
  entity_id uuid null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  source_operation text not null,
  source_reference text not null,
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  constraint network_activity_events_type_check check (activity_type in (
    'company_profile_updated','company_role_updated','product_scope_updated',
    'market_scope_updated','facility_updated','capability_updated',
    'certification_updated','verification_status_updated'
  )),
  constraint network_activity_events_summary_check
    check (char_length(btrim(summary)) between 1 and 500),
  constraint network_activity_events_payload_check
    check (jsonb_typeof(payload)='object' and pg_column_size(payload)<=8192),
  constraint network_activity_events_source_operation_check
    check (char_length(btrim(source_operation)) between 1 and 120),
  constraint network_activity_events_source_reference_check
    check (char_length(btrim(source_reference)) between 1 and 500)
);

create index network_activity_events_company_time_idx
  on public.network_activity_events (network_company_id,occurred_at desc,id desc);
create index network_activity_events_time_idx
  on public.network_activity_events (occurred_at desc,id desc);

alter table public.network_activity_events enable row level security;
revoke all on table public.network_activity_events from public,anon,authenticated;
grant select,insert on table public.network_activity_events to service_role;

create table public.network_activity_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_event_id uuid not null references public.network_activity_events(id) on delete cascade,
  read_at timestamptz not null default clock_timestamp(),
  primary key (user_id,activity_event_id)
);

create index network_activity_reads_event_idx
  on public.network_activity_reads (activity_event_id,user_id);

alter table public.network_activity_reads enable row level security;
revoke all on table public.network_activity_reads from public,anon,authenticated;
grant select,insert,update,delete on table public.network_activity_reads to service_role;

create or replace function private.p4_7_block_activity_mutation()
returns trigger
language plpgsql
security invoker
set search_path=''
as $function$
begin
  raise exception 'network activity events are append-only' using errcode='42501';
end;
$function$;

revoke all on function private.p4_7_block_activity_mutation() from public,anon,authenticated;

create trigger network_activity_events_append_only
before update or delete on public.network_activity_events
for each row execute function private.p4_7_block_activity_mutation();

create or replace function private.p4_7_append_activity(
  p_network_company_id uuid,
  p_activity_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text,
  p_payload jsonb,
  p_source_operation text,
  p_source_reference text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.network_companies c
    where c.id=p_network_company_id and c.publication_status='published'
  ) then
    return null;
  end if;

  insert into public.network_activity_events(
    event_key,network_company_id,activity_type,entity_type,entity_id,
    summary,payload,source_operation,source_reference,occurred_at,created_at
  )
  values(
    gen_random_uuid()::text,
    p_network_company_id,p_activity_type,p_entity_type,p_entity_id,
    p_summary,coalesce(p_payload,'{}'::jsonb),p_source_operation,p_source_reference,
    clock_timestamp(),clock_timestamp()
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function private.p4_7_append_activity(uuid,text,text,uuid,text,jsonb,text,text)
from public,anon,authenticated;
grant execute on function private.p4_7_append_activity(uuid,text,text,uuid,text,jsonb,text,text)
to service_role;

create or replace function private.p4_7_company_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_changed text[] := '{}'::text[];
  v_ref text;
begin
  if tg_op<>'UPDATE' then return new; end if;
  if new.publication_status<>'published' then return new; end if;

  v_ref := 'network_companies:'||new.id::text||':tx:'||txid_current()::text;

  if old.publication_status<>'published' then v_changed:=array_append(v_changed,'publication_status'); end if;
  if old.legal_name is distinct from new.legal_name then v_changed:=array_append(v_changed,'legal_name'); end if;
  if old.trading_name is distinct from new.trading_name then v_changed:=array_append(v_changed,'trading_name'); end if;
  if old.country_code is distinct from new.country_code then v_changed:=array_append(v_changed,'country_code'); end if;
  if old.website_url is distinct from new.website_url then v_changed:=array_append(v_changed,'website_url'); end if;
  if old.description is distinct from new.description then v_changed:=array_append(v_changed,'description'); end if;

  if cardinality(v_changed)>0 then
    perform private.p4_7_append_activity(
      new.id,'company_profile_updated','company',new.id,
      'Profilo aziendale aggiornato',
      jsonb_build_object('changed_fields',to_jsonb(v_changed)),
      'network_companies.update',v_ref||':profile'
    );
  end if;

  if old.verification_status is distinct from new.verification_status then
    perform private.p4_7_append_activity(
      new.id,'verification_status_updated','company',new.id,
      'Stato di verifica aggiornato',
      jsonb_build_object('verification_status',new.verification_status),
      'network_companies.update',v_ref||':verification'
    );
  end if;

  return new;
end;
$function$;

revoke all on function private.p4_7_company_activity_trigger() from public,anon,authenticated;
create trigger network_companies_activity
after update on public.network_companies
for each row execute function private.p4_7_company_activity_trigger();

create or replace function private.p4_7_role_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_row public.network_company_role_assignments%rowtype;
  v_key text;
  v_action text;
begin
  v_row := case when tg_op='DELETE' then old else new end;
  v_action := case when tg_op='INSERT' then 'added' when tg_op='DELETE' then 'removed' else 'updated' end;
  if tg_op='UPDATE'
     and old.role_id is not distinct from new.role_id
     and old.is_primary is not distinct from new.is_primary then return new; end if;
  select canonical_key into v_key from public.network_company_roles where id=v_row.role_id;
  perform private.p4_7_append_activity(
    v_row.company_id,'company_role_updated','company_role_assignment',v_row.id,
    'Ruolo aziendale aggiornato',
    jsonb_build_object('action',v_action,'role_key',v_key,'is_primary',v_row.is_primary),
    'network_company_role_assignments.'||lower(tg_op),
    'network_company_role_assignments:'||v_row.id::text||':tx:'||txid_current()::text||':'||lower(tg_op)
  );
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

revoke all on function private.p4_7_role_activity_trigger() from public,anon,authenticated;
create trigger network_company_role_assignments_activity
after insert or update or delete on public.network_company_role_assignments
for each row execute function private.p4_7_role_activity_trigger();

create or replace function private.p4_7_subtype_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_row public.network_company_subtype_assignments%rowtype;
  v_key text;
  v_action text;
begin
  v_row := case when tg_op='DELETE' then old else new end;
  v_action := case when tg_op='INSERT' then 'added' when tg_op='DELETE' then 'removed' else 'updated' end;
  if tg_op='UPDATE' and old.subtype_id is not distinct from new.subtype_id then return new; end if;
  select canonical_key into v_key from public.network_company_subtypes where id=v_row.subtype_id;
  perform private.p4_7_append_activity(
    v_row.company_id,'company_role_updated','company_subtype_assignment',v_row.id,
    'Classificazione aziendale aggiornata',
    jsonb_build_object('action',v_action,'subtype_key',v_key),
    'network_company_subtype_assignments.'||lower(tg_op),
    'network_company_subtype_assignments:'||v_row.id::text||':tx:'||txid_current()::text||':'||lower(tg_op)
  );
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

revoke all on function private.p4_7_subtype_activity_trigger() from public,anon,authenticated;
create trigger network_company_subtype_assignments_activity
after insert or update or delete on public.network_company_subtype_assignments
for each row execute function private.p4_7_subtype_activity_trigger();

create or replace function private.p4_7_product_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_row public.network_company_products%rowtype;
  v_key text;
  v_action text;
begin
  v_row := case when tg_op='DELETE' then old else new end;
  v_action := case when tg_op='INSERT' then 'added' when tg_op='DELETE' then 'removed' else 'updated' end;
  if tg_op='UPDATE'
     and old.product_family_id is not distinct from new.product_family_id
     and old.relationship_type is not distinct from new.relationship_type
     and old.facility_id is not distinct from new.facility_id then return new; end if;
  select canonical_key into v_key from public.network_product_families where id=v_row.product_family_id;
  perform private.p4_7_append_activity(
    v_row.company_id,'product_scope_updated','company_product',v_row.id,
    'Ambito prodotti aggiornato',
    jsonb_build_object('action',v_action,'product_family_key',v_key,'relationship_type',v_row.relationship_type),
    'network_company_products.'||lower(tg_op),
    'network_company_products:'||v_row.id::text||':tx:'||txid_current()::text||':'||lower(tg_op)
  );
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

revoke all on function private.p4_7_product_activity_trigger() from public,anon,authenticated;
create trigger network_company_products_activity
after insert or update or delete on public.network_company_products
for each row execute function private.p4_7_product_activity_trigger();

create or replace function private.p4_7_market_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_row public.network_company_markets%rowtype;
  v_key text;
  v_action text;
begin
  v_row := case when tg_op='DELETE' then old else new end;
  v_action := case when tg_op='INSERT' then 'added' when tg_op='DELETE' then 'removed' else 'updated' end;
  if tg_op='UPDATE' and old.market_id is not distinct from new.market_id then return new; end if;
  select canonical_key into v_key from public.network_markets where id=v_row.market_id;
  perform private.p4_7_append_activity(
    v_row.company_id,'market_scope_updated','company_market',v_row.id,
    'Mercati serviti aggiornati',
    jsonb_build_object('action',v_action,'market_key',v_key),
    'network_company_markets.'||lower(tg_op),
    'network_company_markets:'||v_row.id::text||':tx:'||txid_current()::text||':'||lower(tg_op)
  );
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

revoke all on function private.p4_7_market_activity_trigger() from public,anon,authenticated;
create trigger network_company_markets_activity
after insert or update or delete on public.network_company_markets
for each row execute function private.p4_7_market_activity_trigger();

create or replace function private.p4_7_facility_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_row public.network_facilities%rowtype;
  v_action text;
  v_changed boolean := true;
begin
  v_row := case when tg_op='DELETE' then old else new end;
  v_action := case when tg_op='INSERT' then 'added' when tg_op='DELETE' then 'removed' else 'updated' end;

  if tg_op='INSERT' and new.publication_status<>'published' then return new; end if;
  if tg_op='UPDATE' and new.publication_status<>'published' then return new; end if;

  if tg_op='UPDATE' then
    v_changed :=
      old.name is distinct from new.name
      or old.facility_type is distinct from new.facility_type
      or old.city is distinct from new.city
      or old.region is distinct from new.region
      or old.country_code is distinct from new.country_code
      or old.website_url is distinct from new.website_url
      or old.publication_status is distinct from new.publication_status
      or old.verification_status is distinct from new.verification_status;
    if not v_changed then return new; end if;
  end if;

  perform private.p4_7_append_activity(
    v_row.company_id,'facility_updated','facility',v_row.id,
    'Sede operativa aggiornata',
    jsonb_build_object('action',v_action,'facility_name',v_row.name),
    'network_facilities.'||lower(tg_op),
    'network_facilities:'||v_row.id::text||':tx:'||txid_current()::text||':'||lower(tg_op)
  );
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

revoke all on function private.p4_7_facility_activity_trigger() from public,anon,authenticated;
create trigger network_facilities_activity
after insert or update or delete on public.network_facilities
for each row execute function private.p4_7_facility_activity_trigger();

create or replace function private.p4_7_capability_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_row public.network_facility_capabilities%rowtype;
  v_company uuid;
  v_facility_published boolean;
  v_key text;
  v_action text;
begin
  v_row := case when tg_op='DELETE' then old else new end;
  v_action := case when tg_op='INSERT' then 'added' when tg_op='DELETE' then 'removed' else 'updated' end;
  if tg_op='UPDATE'
     and old.capability_id is not distinct from new.capability_id
     and old.verification_status is not distinct from new.verification_status then return new; end if;

  select f.company_id,(f.publication_status='published')
  into v_company,v_facility_published
  from public.network_facilities f where f.id=v_row.facility_id;

  if not coalesce(v_facility_published,false) then
    return case when tg_op='DELETE' then old else new end;
  end if;

  select canonical_key into v_key from public.network_capabilities where id=v_row.capability_id;
  perform private.p4_7_append_activity(
    v_company,'capability_updated','facility_capability',v_row.id,
    'Capability operativa aggiornata',
    jsonb_build_object('action',v_action,'capability_key',v_key,'verification_status',v_row.verification_status),
    'network_facility_capabilities.'||lower(tg_op),
    'network_facility_capabilities:'||v_row.id::text||':tx:'||txid_current()::text||':'||lower(tg_op)
  );
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

revoke all on function private.p4_7_capability_activity_trigger() from public,anon,authenticated;
create trigger network_facility_capabilities_activity
after insert or update or delete on public.network_facility_capabilities
for each row execute function private.p4_7_capability_activity_trigger();

create or replace function private.p4_7_certification_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_row public.network_company_certifications%rowtype;
  v_key text;
  v_action text;
begin
  v_row := case when tg_op='DELETE' then old else new end;
  v_action := case when tg_op='INSERT' then 'added' when tg_op='DELETE' then 'removed' else 'updated' end;
  if tg_op='UPDATE'
     and old.certification_type_id is not distinct from new.certification_type_id
     and old.facility_id is not distinct from new.facility_id
     and old.issuer is not distinct from new.issuer
     and old.certificate_identifier is not distinct from new.certificate_identifier
     and old.valid_from is not distinct from new.valid_from
     and old.valid_to is not distinct from new.valid_to
     and old.scope_text is not distinct from new.scope_text
     and old.verification_status is not distinct from new.verification_status
     and old.evidence_reference is not distinct from new.evidence_reference then return new; end if;

  select canonical_key into v_key from public.network_certification_types where id=v_row.certification_type_id;
  perform private.p4_7_append_activity(
    v_row.company_id,'certification_updated','company_certification',v_row.id,
    'Certificazione aggiornata',
    jsonb_build_object('action',v_action,'certification_type_key',v_key,'verification_status',v_row.verification_status),
    'network_company_certifications.'||lower(tg_op),
    'network_company_certifications:'||v_row.id::text||':tx:'||txid_current()::text||':'||lower(tg_op)
  );
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

revoke all on function private.p4_7_certification_activity_trigger() from public,anon,authenticated;
create trigger network_company_certifications_activity
after insert or update or delete on public.network_company_certifications
for each row execute function private.p4_7_certification_activity_trigger();

create or replace function private.p4_7_require_active_membership(p_organization_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
begin
  v_user := (select auth.uid());
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not exists (
    select 1 from public.organization_memberships om
    where om.organization_id=p_organization_id
      and om.user_id=v_user and om.status='active'
  ) then
    raise exception 'active organization membership required' using errcode='42501';
  end if;
  return v_user;
end;
$function$;

revoke all on function private.p4_7_require_active_membership(uuid) from public,anon;
grant execute on function private.p4_7_require_active_membership(uuid) to authenticated,service_role;

create or replace function private.p4_7_follow_company_impl(
  p_organization_id uuid,p_network_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_id uuid;
  v_created_at timestamptz;
  v_created boolean := false;
begin
  v_user := private.p4_7_require_active_membership(p_organization_id);
  if not exists (
    select 1 from public.network_companies c
    where c.id=p_network_company_id and c.publication_status='published'
  ) then
    raise exception 'published Network Company required' using errcode='22023';
  end if;

  insert into public.network_company_follows(
    organization_id,user_id,network_company_id,created_at
  )
  values(p_organization_id,v_user,p_network_company_id,clock_timestamp())
  on conflict (organization_id,user_id,network_company_id) do nothing
  returning id,created_at into v_id,v_created_at;

  if v_id is null then
    select id,created_at into v_id,v_created_at
    from public.network_company_follows
    where organization_id=p_organization_id
      and user_id=v_user and network_company_id=p_network_company_id;
  else
    v_created := true;
  end if;

  return jsonb_build_object(
    'follow_id',v_id,'organization_id',p_organization_id,
    'network_company_id',p_network_company_id,'followed',true,
    'created',v_created,'followed_at',v_created_at
  );
end;
$function$;

revoke all on function private.p4_7_follow_company_impl(uuid,uuid) from public,anon;
grant execute on function private.p4_7_follow_company_impl(uuid,uuid) to authenticated,service_role;

create or replace function public.p4_follow_company(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
as $function$
  select private.p4_7_follow_company_impl(p_organization_id,p_network_company_id);
$function$;
revoke all on function public.p4_follow_company(uuid,uuid) from public,anon;
grant execute on function public.p4_follow_company(uuid,uuid) to authenticated,service_role;

create or replace function private.p4_7_unfollow_company_impl(
  p_organization_id uuid,p_network_company_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_deleted integer;
begin
  v_user := private.p4_7_require_active_membership(p_organization_id);
  delete from public.network_company_follows
  where organization_id=p_organization_id and user_id=v_user and network_company_id=p_network_company_id;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object(
    'organization_id',p_organization_id,'network_company_id',p_network_company_id,
    'followed',false,'removed',(v_deleted>0)
  );
end;
$function$;

revoke all on function private.p4_7_unfollow_company_impl(uuid,uuid) from public,anon;
grant execute on function private.p4_7_unfollow_company_impl(uuid,uuid) to authenticated,service_role;

create or replace function public.p4_unfollow_company(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
as $function$
  select private.p4_7_unfollow_company_impl(p_organization_id,p_network_company_id);
$function$;
revoke all on function public.p4_unfollow_company(uuid,uuid) from public,anon;
grant execute on function public.p4_unfollow_company(uuid,uuid) to authenticated,service_role;

create or replace function private.p4_7_follow_state_impl(
  p_organization_id uuid,p_network_company_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_created_at timestamptz;
begin
  v_user := private.p4_7_require_active_membership(p_organization_id);
  select created_at into v_created_at
  from public.network_company_follows
  where organization_id=p_organization_id and user_id=v_user and network_company_id=p_network_company_id;
  return jsonb_build_object(
    'organization_id',p_organization_id,'network_company_id',p_network_company_id,
    'followed',(v_created_at is not null),'followed_at',v_created_at
  );
end;
$function$;

revoke all on function private.p4_7_follow_state_impl(uuid,uuid) from public,anon;
grant execute on function private.p4_7_follow_state_impl(uuid,uuid) to authenticated,service_role;

create or replace function public.p4_follow_state(p_organization_id uuid,p_network_company_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $function$
  select private.p4_7_follow_state_impl(p_organization_id,p_network_company_id);
$function$;
revoke all on function public.p4_follow_state(uuid,uuid) from public,anon;
grant execute on function public.p4_follow_state(uuid,uuid) to authenticated,service_role;

create or replace function private.p4_7_list_followed_companies_impl(
  p_organization_id uuid,p_limit integer,p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_limit integer := least(greatest(coalesce(p_limit,50),1),100);
  v_offset integer := greatest(coalesce(p_offset,0),0);
  v_items jsonb;
  v_total integer;
begin
  v_user := private.p4_7_require_active_membership(p_organization_id);
  select count(*)::integer into v_total
  from public.network_company_follows f
  join public.network_companies c on c.id=f.network_company_id
  where f.organization_id=p_organization_id and f.user_id=v_user and c.publication_status='published';

  select coalesce(jsonb_agg(jsonb_build_object(
    'network_company_id',x.network_company_id,'followed_at',x.created_at,
    'legal_name',x.legal_name,'trading_name',x.trading_name,'country_code',x.country_code,
    'website_url',x.website_url,'verification_status',x.verification_status,
    'claimed_status',x.claimed_status
  ) order by x.created_at desc,x.network_company_id),'[]'::jsonb)
  into v_items
  from (
    select f.network_company_id,f.created_at,c.legal_name,c.trading_name,c.country_code,
           c.website_url,c.verification_status,c.claimed_status
    from public.network_company_follows f
    join public.network_companies c on c.id=f.network_company_id
    where f.organization_id=p_organization_id and f.user_id=v_user
      and c.publication_status='published'
    order by f.created_at desc,f.network_company_id
    limit v_limit offset v_offset
  ) x;

  return jsonb_build_object('items',v_items,'total',v_total,'limit',v_limit,'offset',v_offset);
end;
$function$;

revoke all on function private.p4_7_list_followed_companies_impl(uuid,integer,integer) from public,anon;
grant execute on function private.p4_7_list_followed_companies_impl(uuid,integer,integer) to authenticated,service_role;

create or replace function public.p4_list_followed_companies(
  p_organization_id uuid,p_limit integer default 50,p_offset integer default 0
)
returns jsonb language sql stable security invoker set search_path=''
as $function$
  select private.p4_7_list_followed_companies_impl(p_organization_id,p_limit,p_offset);
$function$;
revoke all on function public.p4_list_followed_companies(uuid,integer,integer) from public,anon;
grant execute on function public.p4_list_followed_companies(uuid,integer,integer) to authenticated,service_role;

create or replace function private.p4_7_activity_feed_impl(
  p_organization_id uuid,p_unread_only boolean,p_limit integer,p_offset integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_limit integer := least(greatest(coalesce(p_limit,50),1),100);
  v_offset integer := greatest(coalesce(p_offset,0),0);
  v_items jsonb;
  v_total integer;
  v_unread integer;
begin
  v_user := private.p4_7_require_active_membership(p_organization_id);

  with visible as (
    select e.*,c.legal_name,c.trading_name,r.read_at
    from public.network_company_follows f
    join public.network_companies c on c.id=f.network_company_id and c.publication_status='published'
    join public.network_activity_events e
      on e.network_company_id=f.network_company_id and e.occurred_at>=f.created_at
    left join public.network_activity_reads r on r.user_id=v_user and r.activity_event_id=e.id
    where f.organization_id=p_organization_id and f.user_id=v_user
  )
  select
    count(*) filter (where not coalesce(p_unread_only,false) or read_at is null)::integer,
    count(*) filter (where read_at is null)::integer
  into v_total,v_unread
  from visible;

  with visible as (
    select e.*,c.legal_name,c.trading_name,r.read_at
    from public.network_company_follows f
    join public.network_companies c on c.id=f.network_company_id and c.publication_status='published'
    join public.network_activity_events e
      on e.network_company_id=f.network_company_id and e.occurred_at>=f.created_at
    left join public.network_activity_reads r on r.user_id=v_user and r.activity_event_id=e.id
    where f.organization_id=p_organization_id and f.user_id=v_user
      and (not coalesce(p_unread_only,false) or r.read_at is null)
    order by e.occurred_at desc,e.id desc
    limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'activity_event_id',id,'network_company_id',network_company_id,
    'company_name',coalesce(trading_name,legal_name),'legal_name',legal_name,
    'activity_type',activity_type,'entity_type',entity_type,'entity_id',entity_id,
    'summary',summary,'payload',payload,'occurred_at',occurred_at,
    'read_at',read_at,'is_unread',(read_at is null)
  ) order by occurred_at desc,id desc),'[]'::jsonb)
  into v_items
  from visible;

  return jsonb_build_object(
    'items',v_items,'total',v_total,'unread',v_unread,'limit',v_limit,'offset',v_offset
  );
end;
$function$;

revoke all on function private.p4_7_activity_feed_impl(uuid,boolean,integer,integer) from public,anon;
grant execute on function private.p4_7_activity_feed_impl(uuid,boolean,integer,integer) to authenticated,service_role;

create or replace function public.p4_list_activity_feed(
  p_organization_id uuid,p_unread_only boolean default false,
  p_limit integer default 50,p_offset integer default 0
)
returns jsonb language sql stable security invoker set search_path=''
as $function$
  select private.p4_7_activity_feed_impl(p_organization_id,p_unread_only,p_limit,p_offset);
$function$;
revoke all on function public.p4_list_activity_feed(uuid,boolean,integer,integer) from public,anon;
grant execute on function public.p4_list_activity_feed(uuid,boolean,integer,integer) to authenticated,service_role;

create or replace function private.p4_7_mark_activity_read_impl(
  p_organization_id uuid,p_activity_event_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_read_at timestamptz;
begin
  v_user := private.p4_7_require_active_membership(p_organization_id);
  if not exists (
    select 1
    from public.network_company_follows f
    join public.network_companies c on c.id=f.network_company_id and c.publication_status='published'
    join public.network_activity_events e
      on e.network_company_id=f.network_company_id and e.occurred_at>=f.created_at
    where f.organization_id=p_organization_id and f.user_id=v_user and e.id=p_activity_event_id
  ) then
    raise exception 'activity event is not visible to current follower' using errcode='42501';
  end if;

  insert into public.network_activity_reads(user_id,activity_event_id,read_at)
  values(v_user,p_activity_event_id,clock_timestamp())
  on conflict (user_id,activity_event_id)
  do update set read_at=excluded.read_at
  returning read_at into v_read_at;

  return jsonb_build_object('activity_event_id',p_activity_event_id,'read',true,'read_at',v_read_at);
end;
$function$;

revoke all on function private.p4_7_mark_activity_read_impl(uuid,uuid) from public,anon;
grant execute on function private.p4_7_mark_activity_read_impl(uuid,uuid) to authenticated,service_role;

create or replace function public.p4_mark_activity_read(
  p_organization_id uuid,p_activity_event_id uuid
)
returns jsonb language sql volatile security invoker set search_path=''
as $function$
  select private.p4_7_mark_activity_read_impl(p_organization_id,p_activity_event_id);
$function$;
revoke all on function public.p4_mark_activity_read(uuid,uuid) from public,anon;
grant execute on function public.p4_mark_activity_read(uuid,uuid) to authenticated,service_role;

create or replace function private.p4_7_mark_all_activity_read_impl(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid;
  v_count integer;
begin
  v_user := private.p4_7_require_active_membership(p_organization_id);
  with visible as (
    select e.id
    from public.network_company_follows f
    join public.network_companies c on c.id=f.network_company_id and c.publication_status='published'
    join public.network_activity_events e
      on e.network_company_id=f.network_company_id and e.occurred_at>=f.created_at
    where f.organization_id=p_organization_id and f.user_id=v_user
  ),
  inserted as (
    insert into public.network_activity_reads(user_id,activity_event_id,read_at)
    select v_user,id,clock_timestamp() from visible
    on conflict (user_id,activity_event_id) do nothing
    returning 1
  )
  select count(*)::integer into v_count from inserted;
  return jsonb_build_object('marked_read',v_count,'organization_id',p_organization_id);
end;
$function$;

revoke all on function private.p4_7_mark_all_activity_read_impl(uuid) from public,anon;
grant execute on function private.p4_7_mark_all_activity_read_impl(uuid) to authenticated,service_role;

create or replace function public.p4_mark_all_activity_read(p_organization_id uuid)
returns jsonb language sql volatile security invoker set search_path=''
as $function$
  select private.p4_7_mark_all_activity_read_impl(p_organization_id);
$function$;
revoke all on function public.p4_mark_all_activity_read(uuid) from public,anon;
grant execute on function public.p4_mark_all_activity_read(uuid) to authenticated,service_role;

comment on table public.network_company_follows is
  'P4.7 private user-owned follows scoped to active organization context. Follow is not save, connection, inquiry, endorsement or public popularity.';
comment on table public.network_activity_events is
  'P4.7 append-only canonical public-safe Network activity ledger. It contains only effective published Shared Network changes.';
comment on table public.network_activity_reads is
  'P4.7 private user-scoped read state for canonical Network activity events.';
comment on function public.p4_follow_company(uuid,uuid) is
  'P4.7 idempotent private follow for a published Network Company.';
comment on function public.p4_unfollow_company(uuid,uuid) is
  'P4.7 idempotent private unfollow. No target notification or public signal is emitted.';
comment on function public.p4_list_activity_feed(uuid,boolean,integer,integer) is
  'P4.7 in-app activity feed for companies followed by current user after follow time; published visibility remains authoritative.';
