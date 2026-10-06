alter table public.buyer_purchase_order_drafts
  drop constraint if exists buyer_purchase_order_drafts_status_check;

alter table public.buyer_purchase_order_drafts
  add constraint buyer_purchase_order_drafts_status_check
  check(status in(
    'draft','issued','supplier_confirmed','supplier_rejected',
    'change_requested','cancelled'
  ));

create table if not exists public.buyer_purchase_order_versions(
  id uuid primary key default gen_random_uuid(),
  po_draft_id uuid not null references public.buyer_purchase_order_drafts(id) on delete restrict,
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete restrict,
  supplier_id uuid not null references public.buyer_rfq_suppliers(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  version_no integer not null check(version_no>=1),
  status text not null default 'issued'
    check(status in('issued','supplier_confirmed','supplier_rejected','change_requested','superseded','cancelled')),
  token_hash text not null unique check(char_length(token_hash)=64),
  idempotency_key text not null unique,
  po_number text not null check(char_length(po_number) between 5 and 100),
  buyer_organization_name_snapshot text not null,
  supplier_name_snapshot text,
  supplier_email_snapshot text,
  currency_code text not null default 'EUR' check(currency_code='EUR'),
  incoterm text,
  payment_terms text,
  delivery_date date,
  lead_time_days integer check(lead_time_days is null or lead_time_days between 0 and 3650),
  total_tonnes numeric(18,6) not null check(total_tonnes>=0),
  total_eur numeric(18,2) not null check(total_eur>=0),
  buyer_message text check(buyer_message is null or char_length(buyer_message)<=4000),
  notes text check(notes is null or char_length(notes)<=4000),
  confirmation_due_at timestamptz,
  snapshot jsonb not null,
  snapshot_sha256 text not null check(char_length(snapshot_sha256)=64),
  delivery_status text not null default 'pending'
    check(delivery_status in('pending','sent','failed','skipped')),
  provider text,
  provider_message_id text unique,
  delivery_error text,
  issued_at timestamptz not null default now(),
  supplier_responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(po_draft_id,version_no)
);

create index if not exists buyer_purchase_order_versions_po_idx
  on public.buyer_purchase_order_versions(po_draft_id,version_no desc);
create index if not exists buyer_purchase_order_versions_rfq_idx
  on public.buyer_purchase_order_versions(rfq_id,issued_at desc);
create index if not exists buyer_purchase_order_versions_supplier_idx
  on public.buyer_purchase_order_versions(supplier_id,issued_at desc);
create index if not exists buyer_purchase_order_versions_owner_idx
  on public.buyer_purchase_order_versions(owner_user_id,issued_at desc);
create index if not exists buyer_purchase_order_versions_org_idx
  on public.buyer_purchase_order_versions(organization_id,issued_at desc);

create table if not exists public.buyer_purchase_order_version_lines(
  id uuid primary key default gen_random_uuid(),
  po_version_id uuid not null references public.buyer_purchase_order_versions(id) on delete cascade,
  source_po_line_id uuid not null references public.buyer_purchase_order_lines(id) on delete restrict,
  rfq_line_id uuid not null references public.buyer_distinta_lines(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  line_position integer not null check(line_position>0),
  description text not null,
  standard_code text,
  grade_code text,
  finish_code text,
  awarded_tonnes numeric(18,6) not null check(awarded_tonnes>0),
  awarded_meters numeric(18,6) not null check(awarded_meters>=0),
  unit_eur_t numeric(18,6) not null check(unit_eur_t>0),
  unit_eur_m numeric(18,6) not null check(unit_eur_m>0),
  line_total_eur numeric(18,2) not null check(line_total_eur>=0),
  lead_time_days integer check(lead_time_days is null or lead_time_days between 0 and 3650),
  delivery_date date,
  created_at timestamptz not null default now(),
  unique(po_version_id,source_po_line_id)
);

create index if not exists buyer_purchase_order_version_lines_version_idx
  on public.buyer_purchase_order_version_lines(po_version_id,line_position);
create index if not exists buyer_purchase_order_version_lines_source_idx
  on public.buyer_purchase_order_version_lines(source_po_line_id);
create index if not exists buyer_purchase_order_version_lines_rfq_idx
  on public.buyer_purchase_order_version_lines(rfq_line_id);
create index if not exists buyer_purchase_order_version_lines_owner_idx
  on public.buyer_purchase_order_version_lines(owner_user_id,po_version_id);
create index if not exists buyer_purchase_order_version_lines_org_idx
  on public.buyer_purchase_order_version_lines(organization_id,po_version_id);

create table if not exists public.buyer_purchase_order_supplier_responses(
  id uuid primary key default gen_random_uuid(),
  po_version_id uuid not null unique references public.buyer_purchase_order_versions(id) on delete restrict,
  po_draft_id uuid not null references public.buyer_purchase_order_drafts(id) on delete restrict,
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete restrict,
  supplier_id uuid not null references public.buyer_rfq_suppliers(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  decision text not null check(decision in('confirmed','rejected','change_requested')),
  message text check(message is null or char_length(message)<=4000),
  confirmed_delivery_date date,
  supplier_reference text check(supplier_reference is null or char_length(supplier_reference)<=200),
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists buyer_purchase_order_supplier_responses_po_idx
  on public.buyer_purchase_order_supplier_responses(po_draft_id,responded_at desc);
create index if not exists buyer_purchase_order_supplier_responses_rfq_idx
  on public.buyer_purchase_order_supplier_responses(rfq_id,responded_at desc);
create index if not exists buyer_purchase_order_supplier_responses_supplier_idx
  on public.buyer_purchase_order_supplier_responses(supplier_id,responded_at desc);
create index if not exists buyer_purchase_order_supplier_responses_owner_idx
  on public.buyer_purchase_order_supplier_responses(owner_user_id,responded_at desc);
create index if not exists buyer_purchase_order_supplier_responses_org_idx
  on public.buyer_purchase_order_supplier_responses(organization_id,responded_at desc);

alter table public.buyer_purchase_order_versions enable row level security;
alter table public.buyer_purchase_order_version_lines enable row level security;
alter table public.buyer_purchase_order_supplier_responses enable row level security;

revoke all on public.buyer_purchase_order_versions from anon,authenticated;
revoke all on public.buyer_purchase_order_version_lines from anon,authenticated;
revoke all on public.buyer_purchase_order_supplier_responses from anon,authenticated;

grant select on public.buyer_purchase_order_versions to authenticated;
grant select on public.buyer_purchase_order_version_lines to authenticated;
grant select on public.buyer_purchase_order_supplier_responses to authenticated;

create policy buyer_purchase_order_versions_owner_select
on public.buyer_purchase_order_versions
for select to authenticated
using(owner_user_id=(select auth.uid()));

create policy buyer_purchase_order_version_lines_owner_select
on public.buyer_purchase_order_version_lines
for select to authenticated
using(owner_user_id=(select auth.uid()));

create policy buyer_purchase_order_supplier_responses_owner_select
on public.buyer_purchase_order_supplier_responses
for select to authenticated
using(owner_user_id=(select auth.uid()));

create or replace function private.rfqh9_update_po_terms_impl(
  p_po_draft_id uuid,
  p_incoterm text,
  p_payment_terms text,
  p_delivery_date date,
  p_lead_time_days integer,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_po public.buyer_purchase_order_drafts%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select * into v_po
  from public.buyer_purchase_order_drafts p
  where p.id=p_po_draft_id
    and p.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'PO draft not found or not accessible' using errcode='42501';
  end if;

  if v_po.status not in('draft','change_requested','supplier_rejected') then
    raise exception 'PO terms cannot be changed in current status';
  end if;

  if p_lead_time_days is not null and (p_lead_time_days<0 or p_lead_time_days>3650) then
    raise exception 'Lead time is not valid';
  end if;

  if p_notes is not null and char_length(p_notes)>4000 then
    raise exception 'PO notes exceed maximum length';
  end if;

  update public.buyer_purchase_order_drafts
  set incoterm=nullif(btrim(coalesce(p_incoterm,'')),''),
      payment_terms=nullif(btrim(coalesce(p_payment_terms,'')),''),
      delivery_date=p_delivery_date,
      lead_time_days=p_lead_time_days,
      notes=nullif(btrim(coalesce(p_notes,'')),''),
      status='draft',
      updated_at=now()
  where id=v_po.id;

  perform private.rfqh3_log_event(
    v_po.rfq_id,v_po.supplier_id,v_user_id,v_po.organization_id,
    'purchase_order_terms_updated',
    jsonb_build_object('po_draft_id',v_po.id),
    v_user_id
  );

  return jsonb_build_object('po_draft_id',v_po.id,'status','draft');
end;
$$;

revoke all on function private.rfqh9_update_po_terms_impl(uuid,text,text,date,integer,text)
from public,anon,authenticated;
grant execute on function private.rfqh9_update_po_terms_impl(uuid,text,text,date,integer,text)
to authenticated;

create or replace function public.rfqh9_update_po_terms(
  p_po_draft_id uuid,
  p_incoterm text default null,
  p_payment_terms text default null,
  p_delivery_date date default null,
  p_lead_time_days integer default null,
  p_notes text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh9_update_po_terms_impl(
    p_po_draft_id,p_incoterm,p_payment_terms,p_delivery_date,p_lead_time_days,p_notes
  )
$$;

revoke all on function public.rfqh9_update_po_terms(uuid,text,text,date,integer,text)
from public,anon,authenticated;
grant execute on function public.rfqh9_update_po_terms(uuid,text,text,date,integer,text)
to authenticated;

create or replace function private.rfqh9_prepare_issue_impl(
  p_po_draft_id uuid,
  p_token_hash text,
  p_idempotency_key text,
  p_buyer_message text,
  p_confirmation_due_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_po public.buyer_purchase_order_drafts%rowtype;
  v_org public.organizations%rowtype;
  v_version_no integer;
  v_version_id uuid;
  v_snapshot jsonb;
  v_snapshot_hash text;
  v_po_number text;
  v_line_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid PO token hash';
  end if;

  if nullif(btrim(coalesce(p_idempotency_key,'')),'') is null then
    raise exception 'PO issue idempotency key required';
  end if;

  if p_confirmation_due_at is not null and p_confirmation_due_at<=now() then
    raise exception 'PO confirmation deadline must be in the future';
  end if;

  if p_buyer_message is not null and char_length(p_buyer_message)>4000 then
    raise exception 'Buyer message exceeds maximum length';
  end if;

  select * into v_po
  from public.buyer_purchase_order_drafts p
  where p.id=p_po_draft_id
    and p.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'PO draft not found or not accessible' using errcode='42501';
  end if;

  if v_po.status not in('draft','change_requested','supplier_rejected') then
    raise exception 'PO cannot be issued in current status';
  end if;

  select * into v_org from public.organizations o where o.id=v_po.organization_id;

  select count(*)::int into v_line_count
  from public.buyer_purchase_order_lines l
  where l.po_draft_id=v_po.id;

  if v_line_count<1 then
    raise exception 'PO has no lines';
  end if;

  select coalesce(max(v.version_no),0)+1
  into v_version_no
  from public.buyer_purchase_order_versions v
  where v.po_draft_id=v_po.id;

  v_po_number:=v_po.po_draft_ref||'/V'||v_version_no::text;

  select jsonb_build_object(
    'po_draft_id',v_po.id,
    'rfq_id',v_po.rfq_id,
    'award_id',v_po.award_id,
    'po_number',v_po_number,
    'version_no',v_version_no,
    'buyer_organization_name',v_org.name,
    'buyer_organization_country',v_org.country_code,
    'supplier_name',v_po.supplier_name_snapshot,
    'supplier_email',v_po.supplier_email_snapshot,
    'currency_code',v_po.currency_code,
    'incoterm',v_po.incoterm,
    'payment_terms',v_po.payment_terms,
    'delivery_date',v_po.delivery_date,
    'lead_time_days',v_po.lead_time_days,
    'total_tonnes',v_po.total_tonnes,
    'total_eur',v_po.total_eur,
    'notes',v_po.notes,
    'lines',coalesce((
      select jsonb_agg(jsonb_build_object(
        'source_po_line_id',l.id,
        'rfq_line_id',l.rfq_line_id,
        'line_position',l.line_position,
        'description',l.description,
        'standard_code',l.standard_code,
        'grade_code',l.grade_code,
        'finish_code',l.finish_code,
        'awarded_tonnes',l.awarded_tonnes,
        'awarded_meters',l.awarded_meters,
        'unit_eur_t',l.unit_eur_t,
        'unit_eur_m',l.unit_eur_m,
        'line_total_eur',l.line_total_eur,
        'lead_time_days',l.lead_time_days,
        'delivery_date',l.delivery_date
      ) order by l.line_position)
      from public.buyer_purchase_order_lines l
      where l.po_draft_id=v_po.id
    ),'[]'::jsonb)
  ) into v_snapshot;

  v_snapshot_hash:=encode(extensions.digest(v_snapshot::text,'sha256'),'hex');

  update public.buyer_purchase_order_versions
  set status='superseded',updated_at=now()
  where po_draft_id=v_po.id
    and status in('issued','supplier_rejected','change_requested');

  insert into public.buyer_purchase_order_versions(
    po_draft_id,rfq_id,supplier_id,owner_user_id,organization_id,
    version_no,status,token_hash,idempotency_key,po_number,
    buyer_organization_name_snapshot,supplier_name_snapshot,supplier_email_snapshot,
    currency_code,incoterm,payment_terms,delivery_date,lead_time_days,
    total_tonnes,total_eur,buyer_message,notes,confirmation_due_at,
    snapshot,snapshot_sha256
  ) values(
    v_po.id,v_po.rfq_id,v_po.supplier_id,v_user_id,v_po.organization_id,
    v_version_no,'issued',p_token_hash,p_idempotency_key,v_po_number,
    v_org.name,v_po.supplier_name_snapshot,v_po.supplier_email_snapshot,
    v_po.currency_code,v_po.incoterm,v_po.payment_terms,v_po.delivery_date,v_po.lead_time_days,
    v_po.total_tonnes,v_po.total_eur,nullif(btrim(coalesce(p_buyer_message,'')),''),
    v_po.notes,p_confirmation_due_at,v_snapshot,v_snapshot_hash
  )
  returning id into v_version_id;

  insert into public.buyer_purchase_order_version_lines(
    po_version_id,source_po_line_id,rfq_line_id,owner_user_id,organization_id,
    line_position,description,standard_code,grade_code,finish_code,
    awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur,
    lead_time_days,delivery_date
  )
  select
    v_version_id,l.id,l.rfq_line_id,v_user_id,v_po.organization_id,
    l.line_position,l.description,l.standard_code,l.grade_code,l.finish_code,
    l.awarded_tonnes,l.awarded_meters,l.unit_eur_t,l.unit_eur_m,l.line_total_eur,
    l.lead_time_days,l.delivery_date
  from public.buyer_purchase_order_lines l
  where l.po_draft_id=v_po.id
  order by l.line_position;

  update public.buyer_purchase_order_drafts
  set status='issued',issued_at=now(),updated_at=now()
  where id=v_po.id;

  perform private.rfqh3_log_event(
    v_po.rfq_id,v_po.supplier_id,v_user_id,v_po.organization_id,
    'purchase_order_issued',
    jsonb_build_object(
      'po_draft_id',v_po.id,
      'po_version_id',v_version_id,
      'version_no',v_version_no,
      'po_number',v_po_number,
      'snapshot_sha256',v_snapshot_hash,
      'confirmation_due_at',p_confirmation_due_at
    ),
    v_user_id
  );

  return jsonb_build_object(
    'po_draft_id',v_po.id,
    'po_version_id',v_version_id,
    'version_no',v_version_no,
    'po_number',v_po_number,
    'snapshot_sha256',v_snapshot_hash,
    'supplier_name',v_po.supplier_name_snapshot,
    'supplier_email',v_po.supplier_email_snapshot,
    'buyer_organization_name',v_org.name,
    'confirmation_due_at',p_confirmation_due_at
  );
end;
$$;

revoke all on function private.rfqh9_prepare_issue_impl(uuid,text,text,text,timestamptz)
from public,anon,authenticated;
grant execute on function private.rfqh9_prepare_issue_impl(uuid,text,text,text,timestamptz)
to authenticated;

create or replace function public.rfqh9_prepare_issue(
  p_po_draft_id uuid,
  p_token_hash text,
  p_idempotency_key text,
  p_buyer_message text default null,
  p_confirmation_due_at timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh9_prepare_issue_impl(
    p_po_draft_id,p_token_hash,p_idempotency_key,p_buyer_message,p_confirmation_due_at
  )
$$;

revoke all on function public.rfqh9_prepare_issue(uuid,text,text,text,timestamptz)
from public,anon,authenticated;
grant execute on function public.rfqh9_prepare_issue(uuid,text,text,text,timestamptz)
to authenticated;

create or replace function private.rfqh9_mark_issue_delivery_impl(
  p_po_version_id uuid,
  p_status text,
  p_provider text,
  p_provider_message_id text,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_version public.buyer_purchase_order_versions%rowtype;
  v_status text:=lower(btrim(coalesce(p_status,'')));
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if v_status not in('sent','failed','skipped') then
    raise exception 'Invalid PO delivery status';
  end if;

  select * into v_version
  from public.buyer_purchase_order_versions v
  where v.id=p_po_version_id
    and v.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'PO version not found or not accessible' using errcode='42501';
  end if;

  update public.buyer_purchase_order_versions
  set delivery_status=v_status,
      provider=nullif(btrim(coalesce(p_provider,'')),''),
      provider_message_id=case when v_status='sent' then nullif(btrim(coalesce(p_provider_message_id,'')),'') else provider_message_id end,
      delivery_error=case when v_status='failed' then left(coalesce(p_error,'PO delivery failed'),1000) else null end,
      updated_at=now()
  where id=v_version.id;

  perform private.rfqh3_log_event(
    v_version.rfq_id,v_version.supplier_id,v_user_id,v_version.organization_id,
    case when v_status='sent' then 'purchase_order_delivery_sent'
         when v_status='failed' then 'purchase_order_delivery_failed'
         else 'purchase_order_delivery_skipped' end,
    jsonb_build_object(
      'po_version_id',v_version.id,
      'provider',p_provider,
      'provider_message_id',p_provider_message_id,
      'error',p_error
    ),
    v_user_id
  );

  return jsonb_build_object('po_version_id',v_version.id,'delivery_status',v_status);
end;
$$;

revoke all on function private.rfqh9_mark_issue_delivery_impl(uuid,text,text,text,text)
from public,anon,authenticated;
grant execute on function private.rfqh9_mark_issue_delivery_impl(uuid,text,text,text,text)
to authenticated;

create or replace function public.rfqh9_mark_issue_delivery(
  p_po_version_id uuid,
  p_status text,
  p_provider text default null,
  p_provider_message_id text default null,
  p_error text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh9_mark_issue_delivery_impl(
    p_po_version_id,p_status,p_provider,p_provider_message_id,p_error
  )
$$;

revoke all on function public.rfqh9_mark_issue_delivery(uuid,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.rfqh9_mark_issue_delivery(uuid,text,text,text,text)
to authenticated;

create or replace function rfqh_secure.rfqh9_supplier_portal_impl(
  p_token_hash text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_version public.buyer_purchase_order_versions%rowtype;
  v_response public.buyer_purchase_order_supplier_responses%rowtype;
begin
  select * into v_version
  from public.buyer_purchase_order_versions v
  where v.token_hash=p_token_hash
  limit 1;

  if not found then
    return jsonb_build_object('valid',false);
  end if;

  select * into v_response
  from public.buyer_purchase_order_supplier_responses r
  where r.po_version_id=v_version.id;

  return jsonb_build_object(
    'valid',true,
    'po_version_id',v_version.id,
    'po_draft_id',v_version.po_draft_id,
    'rfq_id',v_version.rfq_id,
    'version_no',v_version.version_no,
    'status',v_version.status,
    'po_number',v_version.po_number,
    'buyer_organization_name',v_version.buyer_organization_name_snapshot,
    'supplier_name',v_version.supplier_name_snapshot,
    'currency_code',v_version.currency_code,
    'incoterm',v_version.incoterm,
    'payment_terms',v_version.payment_terms,
    'delivery_date',v_version.delivery_date,
    'lead_time_days',v_version.lead_time_days,
    'total_tonnes',v_version.total_tonnes,
    'total_eur',v_version.total_eur,
    'buyer_message',v_version.buyer_message,
    'notes',v_version.notes,
    'confirmation_due_at',v_version.confirmation_due_at,
    'issued_at',v_version.issued_at,
    'snapshot_sha256',v_version.snapshot_sha256,
    'can_respond',(v_version.status='issued' and (v_version.confirmation_due_at is null or v_version.confirmation_due_at>now())),
    'response',case when v_response.id is null then null else jsonb_build_object(
      'decision',v_response.decision,
      'message',v_response.message,
      'confirmed_delivery_date',v_response.confirmed_delivery_date,
      'supplier_reference',v_response.supplier_reference,
      'responded_at',v_response.responded_at
    ) end,
    'lines',coalesce((
      select jsonb_agg(jsonb_build_object(
        'line_position',l.line_position,
        'description',l.description,
        'standard_code',l.standard_code,
        'grade_code',l.grade_code,
        'finish_code',l.finish_code,
        'awarded_tonnes',l.awarded_tonnes,
        'awarded_meters',l.awarded_meters,
        'unit_eur_t',l.unit_eur_t,
        'unit_eur_m',l.unit_eur_m,
        'line_total_eur',l.line_total_eur,
        'lead_time_days',l.lead_time_days,
        'delivery_date',l.delivery_date
      ) order by l.line_position)
      from public.buyer_purchase_order_version_lines l
      where l.po_version_id=v_version.id
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function rfqh_secure.rfqh9_supplier_portal_impl(text) from public;
grant execute on function rfqh_secure.rfqh9_supplier_portal_impl(text) to anon,authenticated;

create or replace function public.rfqh9_supplier_portal(
  p_token_hash text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select rfqh_secure.rfqh9_supplier_portal_impl(p_token_hash)
$$;

revoke all on function public.rfqh9_supplier_portal(text) from public,anon,authenticated;
grant execute on function public.rfqh9_supplier_portal(text) to anon,authenticated;

create or replace function rfqh_secure.rfqh9_supplier_decide_impl(
  p_token_hash text,
  p_decision text,
  p_message text,
  p_confirmed_delivery_date date,
  p_supplier_reference text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_version public.buyer_purchase_order_versions%rowtype;
  v_existing public.buyer_purchase_order_supplier_responses%rowtype;
  v_decision text:=lower(btrim(coalesce(p_decision,'')));
  v_message text:=nullif(btrim(coalesce(p_message,'')),'');
  v_reference text:=nullif(btrim(coalesce(p_supplier_reference,'')),'');
begin
  if v_decision not in('confirmed','rejected','change_requested') then
    raise exception 'Invalid supplier PO decision';
  end if;

  if v_message is not null and char_length(v_message)>4000 then
    raise exception 'Supplier message exceeds maximum length';
  end if;

  if v_reference is not null and char_length(v_reference)>200 then
    raise exception 'Supplier reference exceeds maximum length';
  end if;

  if v_decision in('rejected','change_requested') and v_message is null then
    raise exception 'Supplier message is required for rejection or change request';
  end if;

  select * into v_version
  from public.buyer_purchase_order_versions v
  where v.token_hash=p_token_hash
  for update;

  if not found then
    raise exception 'PO link is invalid' using errcode='42501';
  end if;

  if v_version.status<>'issued' then
    select * into v_existing
    from public.buyer_purchase_order_supplier_responses r
    where r.po_version_id=v_version.id;

    if found then
      return jsonb_build_object(
        'po_version_id',v_version.id,
        'decision',v_existing.decision,
        'already_responded',true
      );
    end if;

    raise exception 'PO version is not open for supplier response';
  end if;

  if v_version.confirmation_due_at is not null and v_version.confirmation_due_at<=now() then
    raise exception 'PO confirmation deadline has passed';
  end if;

  insert into public.buyer_purchase_order_supplier_responses(
    po_version_id,po_draft_id,rfq_id,supplier_id,owner_user_id,organization_id,
    decision,message,confirmed_delivery_date,supplier_reference
  ) values(
    v_version.id,v_version.po_draft_id,v_version.rfq_id,v_version.supplier_id,
    v_version.owner_user_id,v_version.organization_id,
    v_decision,v_message,p_confirmed_delivery_date,v_reference
  )
  returning * into v_existing;

  update public.buyer_purchase_order_versions
  set status=case
        when v_decision='confirmed' then 'supplier_confirmed'
        when v_decision='rejected' then 'supplier_rejected'
        else 'change_requested'
      end,
      supplier_responded_at=now(),
      updated_at=now()
  where id=v_version.id;

  update public.buyer_purchase_order_drafts
  set status=case
        when v_decision='confirmed' then 'supplier_confirmed'
        when v_decision='rejected' then 'supplier_rejected'
        else 'change_requested'
      end,
      delivery_date=case
        when v_decision='confirmed' and p_confirmed_delivery_date is not null
          then p_confirmed_delivery_date
        else delivery_date
      end,
      updated_at=now()
  where id=v_version.po_draft_id;

  perform private.rfqh3_log_event(
    v_version.rfq_id,v_version.supplier_id,v_version.owner_user_id,v_version.organization_id,
    case when v_decision='confirmed' then 'purchase_order_supplier_confirmed'
         when v_decision='rejected' then 'purchase_order_supplier_rejected'
         else 'purchase_order_supplier_change_requested' end,
    jsonb_build_object(
      'po_draft_id',v_version.po_draft_id,
      'po_version_id',v_version.id,
      'version_no',v_version.version_no,
      'decision',v_decision,
      'message',v_message,
      'confirmed_delivery_date',p_confirmed_delivery_date,
      'supplier_reference',v_reference
    ),
    null
  );

  return jsonb_build_object(
    'po_version_id',v_version.id,
    'decision',v_decision,
    'already_responded',false
  );
end;
$$;

revoke all on function rfqh_secure.rfqh9_supplier_decide_impl(text,text,text,date,text) from public;
grant execute on function rfqh_secure.rfqh9_supplier_decide_impl(text,text,text,date,text) to anon,authenticated;

create or replace function public.rfqh9_supplier_decide(
  p_token_hash text,
  p_decision text,
  p_message text default null,
  p_confirmed_delivery_date date default null,
  p_supplier_reference text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select rfqh_secure.rfqh9_supplier_decide_impl(
    p_token_hash,p_decision,p_message,p_confirmed_delivery_date,p_supplier_reference
  )
$$;

revoke all on function public.rfqh9_supplier_decide(text,text,text,date,text) from public,anon,authenticated;
grant execute on function public.rfqh9_supplier_decide(text,text,text,date,text) to anon,authenticated;

create or replace function private.rfqh9_po_state_impl(
  p_rfq_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if not exists(
    select 1 from public.buyer_rfq_campaigns r
    where r.id=p_rfq_id and r.owner_user_id=v_user_id
  ) then
    raise exception 'RFQ not found or not accessible' using errcode='42501';
  end if;

  select jsonb_build_object(
    'contract','RFQH9-po-state-v1',
    'rfq_id',p_rfq_id,
    'purchase_orders',
    coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,
      'supplier_id',p.supplier_id,
      'status',p.status,
      'po_draft_ref',p.po_draft_ref,
      'supplier_name',p.supplier_name_snapshot,
      'supplier_email',p.supplier_email_snapshot,
      'incoterm',p.incoterm,
      'payment_terms',p.payment_terms,
      'delivery_date',p.delivery_date,
      'lead_time_days',p.lead_time_days,
      'total_tonnes',p.total_tonnes,
      'total_eur',p.total_eur,
      'notes',p.notes,
      'issued_at',p.issued_at,
      'versions',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',v.id,
          'version_no',v.version_no,
          'status',v.status,
          'po_number',v.po_number,
          'delivery_status',v.delivery_status,
          'provider_message_id',v.provider_message_id,
          'confirmation_due_at',v.confirmation_due_at,
          'issued_at',v.issued_at,
          'snapshot_sha256',v.snapshot_sha256,
          'response',(
            select jsonb_build_object(
              'decision',sr.decision,
              'message',sr.message,
              'confirmed_delivery_date',sr.confirmed_delivery_date,
              'supplier_reference',sr.supplier_reference,
              'responded_at',sr.responded_at
            )
            from public.buyer_purchase_order_supplier_responses sr
            where sr.po_version_id=v.id
          )
        ) order by v.version_no desc)
        from public.buyer_purchase_order_versions v
        where v.po_draft_id=p.id
      ),'[]'::jsonb),
      'lines',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',l.id,
          'line_position',l.line_position,
          'description',l.description,
          'standard_code',l.standard_code,
          'grade_code',l.grade_code,
          'finish_code',l.finish_code,
          'awarded_tonnes',l.awarded_tonnes,
          'awarded_meters',l.awarded_meters,
          'unit_eur_t',l.unit_eur_t,
          'unit_eur_m',l.unit_eur_m,
          'line_total_eur',l.line_total_eur,
          'lead_time_days',l.lead_time_days,
          'delivery_date',l.delivery_date
        ) order by l.line_position)
        from public.buyer_purchase_order_lines l
        where l.po_draft_id=p.id
      ),'[]'::jsonb)
    ) order by p.po_draft_ref),'[]'::jsonb)
  )
  into v_result
  from public.buyer_purchase_order_drafts p
  where p.rfq_id=p_rfq_id
    and p.owner_user_id=v_user_id;

  return coalesce(v_result,jsonb_build_object(
    'contract','RFQH9-po-state-v1',
    'rfq_id',p_rfq_id,
    'purchase_orders','[]'::jsonb
  ));
end;
$$;

revoke all on function private.rfqh9_po_state_impl(uuid) from public,anon,authenticated;
grant execute on function private.rfqh9_po_state_impl(uuid) to authenticated;

create or replace function public.rfqh9_po_state(
  p_rfq_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
  select private.rfqh9_po_state_impl(p_rfq_id)
$$;

revoke all on function public.rfqh9_po_state(uuid) from public,anon,authenticated;
grant execute on function public.rfqh9_po_state(uuid) to authenticated;

notify pgrst,'reload schema';