-- PA2.10 — identity confirmation queue + atomic product workflow.
-- Provides a human confirmation surface without domain inference.

create or replace function public.p1_identity_confirmation_queue(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
with access_check as (
  select public.is_organization_member(p_organization_id,false) as allowed
),
unresolved_contacts as (
  select
    c.id,
    c.full_name,
    c.email_normalized,
    c.created_at,
    count(distinct m.id)::int as message_count,
    count(distinct r.id)::int as rfq_count
  from public.contacts c
  left join public.messages m
    on m.organization_id=c.organization_id
   and (
     m.sender_contact_id=c.id
     or (
       m.sender_contact_id is null
       and lower(btrim(coalesce(m.sender_email,'')))=c.email_normalized
     )
   )
  left join public.rfqs r
    on r.organization_id=c.organization_id
   and r.contact_id=c.id
  where c.organization_id=p_organization_id
    and c.company_id is null
    and c.email_normalized is not null
    and c.email_normalized<>''
    and (select allowed from access_check)
  group by c.id,c.full_name,c.email_normalized,c.created_at
  having count(distinct m.id)>0 or count(distinct r.id)>0
  order by c.created_at desc
  limit greatest(1,least(coalesce(p_limit,100),500))
),
verified_companies as (
  select
    c.id,
    c.name,
    c.company_type,
    c.country,
    c.vat_number_normalized,
    min(v.created_at) as verified_at,
    jsonb_agg(
      distinct jsonb_build_object(
        'identity_type',v.identity_type,
        'identity_value',v.identity_value,
        'verification_basis',v.verification_basis
      )
    ) as identities
  from public.companies c
  join public.commercial_company_identity_verifications v
    on v.organization_id=c.organization_id
   and v.company_id=c.id
  where c.organization_id=p_organization_id
    and (select allowed from access_check)
  group by c.id,c.name,c.company_type,c.country,c.vat_number_normalized
  order by c.name
)
select jsonb_build_object(
  'summary',jsonb_build_object(
    'unresolved_contacts',(select count(*) from unresolved_contacts),
    'verified_companies',(select count(*) from verified_companies)
  ),
  'contacts',coalesce((
    select jsonb_agg(jsonb_build_object(
      'contact_id',id,
      'full_name',full_name,
      'email',email_normalized,
      'message_count',message_count,
      'rfq_count',rfq_count
    ))
    from unresolved_contacts
  ),'[]'::jsonb),
  'verified_companies',coalesce((
    select jsonb_agg(jsonb_build_object(
      'company_id',id,
      'name',name,
      'company_type',company_type,
      'country',country,
      'vat_number',vat_number_normalized,
      'verified_at',verified_at,
      'identities',identities
    ))
    from verified_companies
  ),'[]'::jsonb),
  'policy',jsonb_build_object(
    'requires_explicit_user_confirmation',true,
    'requires_verified_company',true,
    'domain_inference',false
  )
);
$$;

revoke execute on function public.p1_identity_confirmation_queue(uuid,integer)
from public,anon;
grant execute on function public.p1_identity_confirmation_queue(uuid,integer)
to authenticated,service_role;

create or replace function private.confirm_contact_company_mapping_impl(
  p_contact_id uuid,
  p_company_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $confirm_identity$
declare
  actor_id uuid := (select auth.uid());
  target_contact public.contacts%rowtype;
  mapping_result jsonb;
  message_row record;
  resolution_result jsonb;
  resolved_messages integer := 0;
  linked_rfqs integer := 0;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_contact
  from public.contacts
  where id=p_contact_id
  for update;

  if not found then
    raise exception 'Contact not found';
  end if;

  if not public.is_organization_member(target_contact.organization_id,true) then
    raise exception 'Active organization write membership required';
  end if;

  mapping_result := private.link_contact_to_verified_company_impl(
    p_contact_id,
    p_company_id,
    'human_confirmed',
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object(
      'phase','PA2.10',
      'confirmed_by',actor_id
    )
  );

  for message_row in
    select m.id
    from public.messages m
    where m.organization_id=target_contact.organization_id
      and (
        m.sender_contact_id=target_contact.id
        or (
          lower(btrim(coalesce(m.sender_email,'')))=target_contact.email_normalized
          and m.sender_contact_id is null
        )
      )
    order by m.sent_at nulls last,m.id
  loop
    resolution_result := private.resolve_message_business_identity_impl(message_row.id);
    if resolution_result->>'status'='resolved' then
      resolved_messages := resolved_messages+1;
      linked_rfqs := linked_rfqs+coalesce((resolution_result->>'rfq_linked_count')::int,0);
    end if;
  end loop;

  return jsonb_build_object(
    'status','confirmed',
    'contact_id',p_contact_id,
    'company_id',p_company_id,
    'mapping_status',mapping_result->>'status',
    'mapping_id',mapping_result->>'mapping_id',
    'resolved_messages',resolved_messages,
    'linked_rfqs',linked_rfqs
  );
end;
$confirm_identity$;

revoke execute on function private.confirm_contact_company_mapping_impl(uuid,uuid,jsonb)
from public,anon;
grant execute on function private.confirm_contact_company_mapping_impl(uuid,uuid,jsonb)
to authenticated,service_role;

create or replace function public.confirm_contact_company_mapping(
  p_contact_id uuid,
  p_company_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.confirm_contact_company_mapping_impl(
    p_contact_id,p_company_id,p_metadata
  );
$$;

revoke execute on function public.confirm_contact_company_mapping(uuid,uuid,jsonb)
from public,anon;
grant execute on function public.confirm_contact_company_mapping(uuid,uuid,jsonb)
to authenticated,service_role;

comment on function public.confirm_contact_company_mapping(uuid,uuid,jsonb) is
  'PA2.10 human-confirmed Contact→verified Company mapping, followed by deterministic Message/RFQ propagation.';
