alter table public.buyer_rfq_suppliers
  drop constraint if exists buyer_rfq_suppliers_status_check;

alter table public.buyer_rfq_suppliers
  add constraint buyer_rfq_suppliers_status_check
  check(status in(
    'draft','queued','sent','delivered','opened','responded','declined',
    'bounced','complained','failed','cancelled','awarded','not_awarded'
  ));

create table if not exists public.buyer_rfq_awards(
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null unique references public.buyer_rfq_campaigns(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'confirmed' check(status='confirmed'),
  award_mode text not null check(award_mode in('full','split')),
  reason text not null check(char_length(btrim(reason)) between 3 and 2000),
  currency_code text not null default 'EUR' check(currency_code='EUR'),
  line_count integer not null check(line_count>0),
  supplier_count integer not null check(supplier_count>0),
  total_tonnes numeric(18,6) not null check(total_tonnes>=0),
  total_eur numeric(18,2) not null check(total_eur>=0),
  target_total_eur numeric(18,2) not null check(target_total_eur>=0),
  savings_eur numeric(18,2) not null,
  savings_pct numeric(12,6),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists buyer_rfq_awards_owner_idx
  on public.buyer_rfq_awards(owner_user_id,confirmed_at desc);
create index if not exists buyer_rfq_awards_org_idx
  on public.buyer_rfq_awards(organization_id,confirmed_at desc);

create table if not exists public.buyer_rfq_award_allocations(
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.buyer_rfq_awards(id) on delete restrict,
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete restrict,
  rfq_line_id uuid not null references public.buyer_distinta_lines(id) on delete restrict,
  supplier_id uuid not null references public.buyer_rfq_suppliers(id) on delete restrict,
  quote_id uuid not null references public.buyer_rfq_quotes(id) on delete restrict,
  quote_line_id uuid not null references public.buyer_rfq_quote_lines(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  line_position integer not null check(line_position>0),
  description text not null,
  awarded_tonnes numeric(18,6) not null check(awarded_tonnes>0),
  awarded_meters numeric(18,6) not null check(awarded_meters>=0),
  unit_eur_t numeric(18,6) not null check(unit_eur_t>0),
  unit_eur_m numeric(18,6) not null check(unit_eur_m>0),
  line_total_eur numeric(18,2) not null check(line_total_eur>=0),
  target_eur_t numeric(18,6) not null check(target_eur_t>=0),
  target_total_eur numeric(18,2) not null check(target_total_eur>=0),
  savings_eur numeric(18,2) not null,
  lead_time_days integer check(lead_time_days is null or lead_time_days between 0 and 3650),
  delivery_date date,
  created_at timestamptz not null default now(),
  unique(award_id,rfq_line_id,supplier_id)
);

create index if not exists buyer_rfq_award_allocations_award_idx
  on public.buyer_rfq_award_allocations(award_id,line_position);
create index if not exists buyer_rfq_award_allocations_rfq_idx
  on public.buyer_rfq_award_allocations(rfq_id,line_position);
create index if not exists buyer_rfq_award_allocations_supplier_idx
  on public.buyer_rfq_award_allocations(supplier_id,award_id);
create index if not exists buyer_rfq_award_allocations_quote_idx
  on public.buyer_rfq_award_allocations(quote_id);
create index if not exists buyer_rfq_award_allocations_quote_line_idx
  on public.buyer_rfq_award_allocations(quote_line_id);
create index if not exists buyer_rfq_award_allocations_owner_idx
  on public.buyer_rfq_award_allocations(owner_user_id,award_id);
create index if not exists buyer_rfq_award_allocations_org_idx
  on public.buyer_rfq_award_allocations(organization_id,award_id);

create table if not exists public.buyer_purchase_order_drafts(
  id uuid primary key default gen_random_uuid(),
  award_id uuid not null references public.buyer_rfq_awards(id) on delete restrict,
  rfq_id uuid not null references public.buyer_rfq_campaigns(id) on delete restrict,
  supplier_id uuid not null references public.buyer_rfq_suppliers(id) on delete restrict,
  quote_id uuid not null references public.buyer_rfq_quotes(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  status text not null default 'draft' check(status in('draft','issued','cancelled')),
  po_draft_ref text not null check(char_length(po_draft_ref) between 5 and 80),
  supplier_name_snapshot text,
  supplier_email_snapshot text,
  supplier_company_id uuid references public.companies(id) on delete set null,
  supplier_network_company_id uuid references public.network_companies(id) on delete set null,
  supplier_organization_id uuid references public.organizations(id) on delete set null,
  currency_code text not null default 'EUR' check(currency_code='EUR'),
  quote_revision_no integer not null check(quote_revision_no>=1),
  incoterm text,
  payment_terms text,
  validity_until date,
  lead_time_days integer check(lead_time_days is null or lead_time_days between 0 and 3650),
  delivery_date date,
  total_tonnes numeric(18,6) not null check(total_tonnes>=0),
  total_eur numeric(18,2) not null check(total_eur>=0),
  commercial_order_id uuid references public.orders(id) on delete set null,
  notes text check(notes is null or char_length(notes)<=4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  issued_at timestamptz,
  unique(award_id,supplier_id),
  unique(organization_id,po_draft_ref)
);

create index if not exists buyer_purchase_order_drafts_rfq_idx
  on public.buyer_purchase_order_drafts(rfq_id,created_at desc);
create index if not exists buyer_purchase_order_drafts_supplier_idx
  on public.buyer_purchase_order_drafts(supplier_id,created_at desc);
create index if not exists buyer_purchase_order_drafts_quote_idx
  on public.buyer_purchase_order_drafts(quote_id);
create index if not exists buyer_purchase_order_drafts_owner_idx
  on public.buyer_purchase_order_drafts(owner_user_id,created_at desc);
create index if not exists buyer_purchase_order_drafts_org_idx
  on public.buyer_purchase_order_drafts(organization_id,created_at desc);
create index if not exists buyer_purchase_order_drafts_commercial_order_idx
  on public.buyer_purchase_order_drafts(commercial_order_id)
  where commercial_order_id is not null;

create table if not exists public.buyer_purchase_order_lines(
  id uuid primary key default gen_random_uuid(),
  po_draft_id uuid not null references public.buyer_purchase_order_drafts(id) on delete cascade,
  award_allocation_id uuid not null unique references public.buyer_rfq_award_allocations(id) on delete restrict,
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
  created_at timestamptz not null default now()
);

create index if not exists buyer_purchase_order_lines_po_idx
  on public.buyer_purchase_order_lines(po_draft_id,line_position);
create index if not exists buyer_purchase_order_lines_rfq_line_idx
  on public.buyer_purchase_order_lines(rfq_line_id);
create index if not exists buyer_purchase_order_lines_owner_idx
  on public.buyer_purchase_order_lines(owner_user_id,po_draft_id);
create index if not exists buyer_purchase_order_lines_org_idx
  on public.buyer_purchase_order_lines(organization_id,po_draft_id);

alter table public.buyer_rfq_awards enable row level security;
alter table public.buyer_rfq_award_allocations enable row level security;
alter table public.buyer_purchase_order_drafts enable row level security;
alter table public.buyer_purchase_order_lines enable row level security;

revoke all on public.buyer_rfq_awards from anon,authenticated;
revoke all on public.buyer_rfq_award_allocations from anon,authenticated;
revoke all on public.buyer_purchase_order_drafts from anon,authenticated;
revoke all on public.buyer_purchase_order_lines from anon,authenticated;

grant select on public.buyer_rfq_awards to authenticated;
grant select on public.buyer_rfq_award_allocations to authenticated;
grant select on public.buyer_purchase_order_drafts to authenticated;
grant select on public.buyer_purchase_order_lines to authenticated;

create policy buyer_rfq_awards_owner_select
on public.buyer_rfq_awards
for select to authenticated
using(owner_user_id=(select auth.uid()));

create policy buyer_rfq_award_allocations_owner_select
on public.buyer_rfq_award_allocations
for select to authenticated
using(owner_user_id=(select auth.uid()));

create policy buyer_purchase_order_drafts_owner_select
on public.buyer_purchase_order_drafts
for select to authenticated
using(owner_user_id=(select auth.uid()));

create policy buyer_purchase_order_lines_owner_select
on public.buyer_purchase_order_lines
for select to authenticated
using(owner_user_id=(select auth.uid()));

create or replace function private.rfqh7_confirm_award_impl(
  p_rfq_id uuid,
  p_reason text,
  p_allocations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_campaign public.buyer_rfq_campaigns%rowtype;
  v_award public.buyer_rfq_awards%rowtype;
  v_alloc jsonb;
  v_line public.buyer_distinta_lines%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
  v_quote public.buyer_rfq_quotes%rowtype;
  v_quote_line public.buyer_rfq_quote_lines%rowtype;
  v_awarded_tonnes numeric;
  v_offered_tonnes numeric;
  v_awarded_meters numeric;
  v_existing_line_award numeric;
  v_line_total numeric;
  v_target_total numeric;
  v_total_eur numeric;
  v_total_tonnes numeric;
  v_target_eur numeric;
  v_supplier_count integer;
  v_line_count integer;
  v_mode text;
  v_po_id uuid;
  v_po_seq integer:=0;
  v_po record;
  v_po_json jsonb:='[]'::jsonb;
  v_reason text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  v_reason:=btrim(coalesce(p_reason,''));
  if char_length(v_reason)<3 or char_length(v_reason)>2000 then
    raise exception 'Award reason must be between 3 and 2000 characters';
  end if;

  if jsonb_typeof(coalesce(p_allocations,'[]'::jsonb))<>'array'
    or jsonb_array_length(coalesce(p_allocations,'[]'::jsonb))=0 then
    raise exception 'At least one award allocation is required';
  end if;

  if jsonb_array_length(p_allocations)>500 then
    raise exception 'Too many award allocations';
  end if;

  select * into v_campaign
  from public.buyer_rfq_campaigns r
  where r.id=p_rfq_id
    and r.owner_user_id=v_user_id
  for update;

  if not found then
    raise exception 'RFQ not found or not accessible' using errcode='42501';
  end if;

  if v_campaign.status not in('launched','collecting') then
    raise exception 'RFQ is not eligible for award';
  end if;

  if exists(select 1 from public.buyer_rfq_awards a where a.rfq_id=p_rfq_id) then
    raise exception 'RFQ award is already confirmed';
  end if;

  select count(*)::int,coalesce(sum(l.line_tonnes),0)::numeric,coalesce(sum(l.target_total_eur),0)::numeric
  into v_line_count,v_total_tonnes,v_target_eur
  from public.buyer_distinta_lines l
  where l.distinta_id=v_campaign.source_distinta_id;

  if v_line_count<=0 then
    raise exception 'RFQ has no source lines';
  end if;

  insert into public.buyer_rfq_awards(
    rfq_id,owner_user_id,organization_id,award_mode,reason,line_count,
    supplier_count,total_tonnes,total_eur,target_total_eur,savings_eur,savings_pct
  ) values(
    p_rfq_id,v_user_id,v_campaign.organization_id,'split',v_reason,v_line_count,
    1,v_total_tonnes,0,v_target_eur,0,null
  )
  returning * into v_award;

  for v_alloc in select value from jsonb_array_elements(p_allocations)
  loop
    if nullif(v_alloc->>'line_id','') is null
      or nullif(v_alloc->>'supplier_id','') is null
      or nullif(v_alloc->>'awarded_tonnes','') is null then
      raise exception 'Award allocation requires line, supplier and awarded tonnes';
    end if;

    v_awarded_tonnes:=(v_alloc->>'awarded_tonnes')::numeric;
    if v_awarded_tonnes<=0 then
      raise exception 'Awarded tonnes must be positive';
    end if;

    select * into v_line
    from public.buyer_distinta_lines l
    where l.id=(v_alloc->>'line_id')::uuid
      and l.distinta_id=v_campaign.source_distinta_id;

    if not found then
      raise exception 'Award line does not belong to this RFQ';
    end if;

    select * into v_supplier
    from public.buyer_rfq_suppliers s
    where s.id=(v_alloc->>'supplier_id')::uuid
      and s.rfq_id=p_rfq_id
      and s.owner_user_id=v_user_id;

    if not found then
      raise exception 'Award supplier does not belong to this RFQ';
    end if;

    if v_supplier.status in('declined','bounced','complained','failed','cancelled','not_awarded') then
      raise exception 'Supplier is not eligible for award';
    end if;

    select * into v_quote
    from public.buyer_rfq_quotes q
    where q.rfq_id=p_rfq_id
      and q.supplier_id=v_supplier.id
    order by q.revision_no desc
    limit 1;

    if not found or v_quote.status<>'submitted' then
      raise exception 'Supplier latest quote must be submitted before award';
    end if;

    select * into v_quote_line
    from public.buyer_rfq_quote_lines ql
    where ql.quote_id=v_quote.id
      and ql.rfq_line_id=v_line.id;

    if not found or v_quote_line.response_status<>'quoted'
      or v_quote_line.normalized_eur_t is null
      or v_quote_line.normalized_eur_m is null then
      raise exception 'Selected supplier did not submit a comparable quote for this line';
    end if;

    v_offered_tonnes:=case
      when v_quote_line.offered_quantity is null then v_line.line_tonnes
      when v_quote_line.offered_quantity_mode='tonnes' then v_quote_line.offered_quantity
      when v_quote_line.offered_quantity_mode='meters' then v_quote_line.offered_quantity*v_line.weight_kg_m/1000
      when v_quote_line.offered_quantity_mode='bars'
        and v_line.bar_length_m is not null
        then v_quote_line.offered_quantity*v_line.bar_length_m*v_line.weight_kg_m/1000
      else v_line.line_tonnes
    end;

    if v_offered_tonnes is null or v_offered_tonnes<=0 then
      raise exception 'Selected supplier has no allocatable quantity for this line';
    end if;

    if v_awarded_tonnes>v_offered_tonnes+0.000001 then
      raise exception 'Award exceeds supplier offered quantity on line %',v_line.line_position;
    end if;

    select coalesce(sum(a.awarded_tonnes),0)
    into v_existing_line_award
    from public.buyer_rfq_award_allocations a
    where a.award_id=v_award.id
      and a.rfq_line_id=v_line.id;

    if v_existing_line_award+v_awarded_tonnes>v_line.line_tonnes+0.000001 then
      raise exception 'Award exceeds requested quantity on line %',v_line.line_position;
    end if;

    if exists(
      select 1
      from public.buyer_rfq_award_allocations a
      where a.award_id=v_award.id
        and a.rfq_line_id=v_line.id
        and a.supplier_id=v_supplier.id
    ) then
      raise exception 'Duplicate supplier allocation on line %',v_line.line_position;
    end if;

    v_awarded_meters:=case
      when v_line.weight_kg_m>0 then v_awarded_tonnes*1000/v_line.weight_kg_m
      else 0 end;
    v_line_total:=round(v_quote_line.normalized_eur_t*v_awarded_tonnes,2);
    v_target_total:=round(v_line.target_eur_t*v_awarded_tonnes,2);

    insert into public.buyer_rfq_award_allocations(
      award_id,rfq_id,rfq_line_id,supplier_id,quote_id,quote_line_id,
      owner_user_id,organization_id,line_position,description,
      awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur,
      target_eur_t,target_total_eur,savings_eur,lead_time_days,delivery_date
    ) values(
      v_award.id,p_rfq_id,v_line.id,v_supplier.id,v_quote.id,v_quote_line.id,
      v_user_id,v_campaign.organization_id,v_line.line_position,v_line.description,
      v_awarded_tonnes,v_awarded_meters,v_quote_line.normalized_eur_t,
      v_quote_line.normalized_eur_m,v_line_total,v_line.target_eur_t,
      v_target_total,round(v_target_total-v_line_total,2),
      coalesce(v_quote_line.lead_time_days,v_quote.lead_time_days),
      coalesce(v_quote_line.delivery_date,v_quote.delivery_date)
    );
  end loop;

  if exists(
    select 1
    from public.buyer_distinta_lines l
    left join (
      select a.rfq_line_id,sum(a.awarded_tonnes) as awarded_tonnes
      from public.buyer_rfq_award_allocations a
      where a.award_id=v_award.id
      group by a.rfq_line_id
    ) x on x.rfq_line_id=l.id
    where l.distinta_id=v_campaign.source_distinta_id
      and abs(coalesce(x.awarded_tonnes,0)-l.line_tonnes)>0.000001
  ) then
    raise exception 'Award must cover 100%% of every RFQ line';
  end if;

  select
    count(distinct a.supplier_id)::int,
    coalesce(sum(a.line_total_eur),0)::numeric,
    coalesce(sum(a.awarded_tonnes),0)::numeric
  into v_supplier_count,v_total_eur,v_total_tonnes
  from public.buyer_rfq_award_allocations a
  where a.award_id=v_award.id;

  v_mode:=case when v_supplier_count=1 then 'full' else 'split' end;

  update public.buyer_rfq_awards
  set award_mode=v_mode,
      supplier_count=v_supplier_count,
      total_tonnes=v_total_tonnes,
      total_eur=round(v_total_eur,2),
      savings_eur=round(v_target_eur-v_total_eur,2),
      savings_pct=case when v_target_eur>0 then ((v_target_eur-v_total_eur)/v_target_eur)*100 else null end
  where id=v_award.id
  returning * into v_award;

  for v_po in
    select
      a.supplier_id,
      min(a.quote_id::text)::uuid as quote_id,
      sum(a.awarded_tonnes)::numeric as total_tonnes,
      sum(a.line_total_eur)::numeric as total_eur
    from public.buyer_rfq_award_allocations a
    where a.award_id=v_award.id
    group by a.supplier_id
    order by a.supplier_id
  loop
    v_po_seq:=v_po_seq+1;

    select * into v_supplier
    from public.buyer_rfq_suppliers s where s.id=v_po.supplier_id;

    select * into v_quote
    from public.buyer_rfq_quotes q where q.id=v_po.quote_id;

    insert into public.buyer_purchase_order_drafts(
      award_id,rfq_id,supplier_id,quote_id,owner_user_id,organization_id,
      po_draft_ref,supplier_name_snapshot,supplier_email_snapshot,
      supplier_company_id,supplier_network_company_id,supplier_organization_id,
      quote_revision_no,incoterm,payment_terms,validity_until,lead_time_days,
      delivery_date,total_tonnes,total_eur,notes
    ) values(
      v_award.id,p_rfq_id,v_supplier.id,v_quote.id,v_user_id,v_campaign.organization_id,
      'PO-'||upper(substr(replace(v_award.id::text,'-',''),1,8))||'-'||lpad(v_po_seq::text,2,'0'),
      v_supplier.supplier_name,v_supplier.supplier_email_normalized,
      v_supplier.supplier_company_id,v_supplier.supplier_network_company_id,
      v_supplier.supplier_organization_id,v_quote.revision_no,v_quote.incoterm,
      v_quote.payment_terms,v_quote.validity_until,v_quote.lead_time_days,
      v_quote.delivery_date,round(v_po.total_tonnes,6),round(v_po.total_eur,2),
      'Generato da RFQ award '||v_award.id::text||'. Bozza: nessun ordine è stato inviato automaticamente.'
    )
    returning id into v_po_id;

    insert into public.buyer_purchase_order_lines(
      po_draft_id,award_allocation_id,rfq_line_id,owner_user_id,organization_id,
      line_position,description,standard_code,grade_code,finish_code,
      awarded_tonnes,awarded_meters,unit_eur_t,unit_eur_m,line_total_eur,
      lead_time_days,delivery_date
    )
    select
      v_po_id,a.id,a.rfq_line_id,v_user_id,v_campaign.organization_id,
      a.line_position,a.description,l.standard_code,l.grade_code,l.finish_code,
      a.awarded_tonnes,a.awarded_meters,a.unit_eur_t,a.unit_eur_m,a.line_total_eur,
      a.lead_time_days,a.delivery_date
    from public.buyer_rfq_award_allocations a
    join public.buyer_distinta_lines l on l.id=a.rfq_line_id
    where a.award_id=v_award.id
      and a.supplier_id=v_supplier.id
    order by a.line_position;

    v_po_json:=v_po_json||jsonb_build_array(jsonb_build_object(
      'po_draft_id',v_po_id,
      'supplier_id',v_supplier.id,
      'supplier_name',v_supplier.supplier_name,
      'po_draft_ref','PO-'||upper(substr(replace(v_award.id::text,'-',''),1,8))||'-'||lpad(v_po_seq::text,2,'0'),
      'total_tonnes',round(v_po.total_tonnes,6),
      'total_eur',round(v_po.total_eur,2)
    ));

    perform private.rfqh3_log_event(
      p_rfq_id,v_supplier.id,v_user_id,v_campaign.organization_id,
      'purchase_order_draft_created',
      jsonb_build_object(
        'award_id',v_award.id,
        'po_draft_id',v_po_id,
        'total_tonnes',round(v_po.total_tonnes,6),
        'total_eur',round(v_po.total_eur,2)
      ),
      v_user_id
    );
  end loop;

  update public.buyer_rfq_campaigns
  set status='awarded',awarded_at=now(),updated_at=now()
  where id=p_rfq_id;

  update public.buyer_rfq_suppliers s
  set status='awarded',awarded_at=now(),updated_at=now()
  where s.rfq_id=p_rfq_id
    and exists(
      select 1 from public.buyer_rfq_award_allocations a
      where a.award_id=v_award.id and a.supplier_id=s.id
    );

  update public.buyer_rfq_suppliers s
  set status='not_awarded',updated_at=now()
  where s.rfq_id=p_rfq_id
    and s.status not in('awarded','declined','bounced','complained','failed','cancelled')
    and not exists(
      select 1 from public.buyer_rfq_award_allocations a
      where a.award_id=v_award.id and a.supplier_id=s.id
    );

  update public.buyer_rfq_negotiation_threads
  set status='closed',active_request_type=null,request_due_at=null,
      active_request_at=null,updated_at=now()
  where rfq_id=p_rfq_id
    and status<>'closed';

  perform private.rfqh3_log_event(
    p_rfq_id,null,v_user_id,v_campaign.organization_id,
    'rfq_award_confirmed',
    jsonb_build_object(
      'award_id',v_award.id,
      'award_mode',v_award.award_mode,
      'supplier_count',v_award.supplier_count,
      'line_count',v_award.line_count,
      'total_tonnes',v_award.total_tonnes,
      'total_eur',v_award.total_eur,
      'target_total_eur',v_award.target_total_eur,
      'savings_eur',v_award.savings_eur,
      'savings_pct',v_award.savings_pct,
      'reason',v_award.reason
    ),
    v_user_id
  );

  return jsonb_build_object(
    'award_id',v_award.id,
    'award_mode',v_award.award_mode,
    'supplier_count',v_award.supplier_count,
    'line_count',v_award.line_count,
    'total_tonnes',v_award.total_tonnes,
    'total_eur',v_award.total_eur,
    'target_total_eur',v_award.target_total_eur,
    'savings_eur',v_award.savings_eur,
    'savings_pct',v_award.savings_pct,
    'po_drafts',v_po_json
  );
end;
$$;

revoke all on function private.rfqh7_confirm_award_impl(uuid,text,jsonb)
from public,anon,authenticated;
grant execute on function private.rfqh7_confirm_award_impl(uuid,text,jsonb)
to authenticated;

create or replace function public.rfqh7_confirm_award(
  p_rfq_id uuid,
  p_reason text,
  p_allocations jsonb
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh7_confirm_award_impl(p_rfq_id,p_reason,p_allocations)
$$;

revoke all on function public.rfqh7_confirm_award(uuid,text,jsonb)
from public,anon,authenticated;
grant execute on function public.rfqh7_confirm_award(uuid,text,jsonb)
to authenticated;

create or replace function private.rfqh7_link_commercial_order_impl(
  p_po_draft_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid();
  v_po public.buyer_purchase_order_drafts%rowtype;
  v_order public.orders%rowtype;
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

  select * into v_order
  from public.orders o
  where o.id=p_order_id
    and o.organization_id=v_po.organization_id;

  if not found then
    raise exception 'Commercial order not found in the same organization';
  end if;

  if not public.is_organization_member(v_po.organization_id,false) then
    raise exception 'Organization access required' using errcode='42501';
  end if;

  update public.buyer_purchase_order_drafts
  set commercial_order_id=p_order_id,updated_at=now()
  where id=v_po.id;

  perform private.rfqh3_log_event(
    v_po.rfq_id,v_po.supplier_id,v_user_id,v_po.organization_id,
    'purchase_order_commercial_order_linked',
    jsonb_build_object(
      'po_draft_id',v_po.id,
      'commercial_order_id',p_order_id
    ),
    v_user_id
  );

  return jsonb_build_object(
    'po_draft_id',v_po.id,
    'commercial_order_id',p_order_id
  );
end;
$$;

revoke all on function private.rfqh7_link_commercial_order_impl(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.rfqh7_link_commercial_order_impl(uuid,uuid)
to authenticated;

create or replace function public.rfqh7_link_commercial_order(
  p_po_draft_id uuid,
  p_order_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.rfqh7_link_commercial_order_impl(p_po_draft_id,p_order_id)
$$;

revoke all on function public.rfqh7_link_commercial_order(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.rfqh7_link_commercial_order(uuid,uuid)
to authenticated;

notify pgrst,'reload schema';