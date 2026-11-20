-- PROD-EMAIL1.B — audited system review for generic company mailboxes.
-- Disposable transaction: no persistent fixture changes.
begin;

create or replace function pg_temp.pe1b_ok(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PROD-EMAIL1.B assertion failed: %',message;
  end if;
end $$;

-- The system publisher is service-only and remains SECURITY INVOKER.
select pg_temp.pe1b_ok(
  not has_function_privilege('anon',
    'private.netcontact1_auto_review_company_channels(integer,text,boolean)','EXECUTE'),
  'anon cannot auto-review'
);
select pg_temp.pe1b_ok(
  not has_function_privilege('authenticated',
    'private.netcontact1_auto_review_company_channels(integer,text,boolean)','EXECUTE'),
  'authenticated cannot auto-review'
);
select pg_temp.pe1b_ok(
  has_function_privilege('service_role',
    'private.netcontact1_auto_review_company_channels(integer,text,boolean)','EXECUTE'),
  'service_role may auto-review'
);
select pg_temp.pe1b_ok(
  not (select p.prosecdef from pg_proc p
       where p.oid='private.netcontact1_auto_review_company_channels(integer,text,boolean)'::regprocedure),
  'auto-review is SECURITY INVOKER'
);

-- Human LR4 reviews explicitly remain platform reviews.
select pg_temp.pe1b_ok(
  position('privacy_review_actor_type=''platform''' in
    pg_get_functiondef('private.lr4_review_contact_privacy_impl(uuid,text,text,timestamptz,text,boolean)'::regprocedure))>0,
  'human LR4 marks platform actor'
);

-- Isolate one seeded published IT company for the system-flow acceptance.
update public.network_contacts
set publication_status='archived',archived_at=now()
where company_id='51100000-0000-5000-8000-000000000005'::uuid
  and archived_at is null;

-- Remove unrelated pending NET-CONTACT1 candidates so the bounded publisher
-- deterministically selects only the disposable fixture below.
update public.network_contacts nc
set publication_status='archived',archived_at=now()
from public.network_data_assertions a
where a.id=nc.source_assertion_id
  and a.field_path='netcontact1_public_company_channel'
  and nc.publication_status='pending_review'
  and nc.archived_at is null;

set local role service_role;

do $t$
declare
  morandi constant uuid:='51100000-0000-5000-8000-000000000005';
  staged jsonb;
  dry jsonb;
  applied jsonb;
begin
  staged:=public.netcontact1_stage_company_channel(
    morandi,
    'vendite@morandispa.it',
    null,
    'https://www.morandispa.it/contatti'
  );
  perform pg_temp.pe1b_ok(staged->>'status'='staged','generic first-party email staged');

  dry:=private.netcontact1_auto_review_company_channels(25,'IT',false);
  perform pg_temp.pe1b_ok((dry->>'eligible_total')::int=1,'dry-run finds one strict candidate');
  perform pg_temp.pe1b_ok((dry->>'published')::int=0,'dry-run writes nothing');

  applied:=private.netcontact1_auto_review_company_channels(25,'IT',true);
  perform pg_temp.pe1b_ok((applied->>'published')::int=1,'system review publishes one candidate');
end
$t$;

reset role;

select pg_temp.pe1b_ok(exists(
  select 1
  from public.network_contacts nc
  where nc.company_id='51100000-0000-5000-8000-000000000005'::uuid
    and nc.email='vendite@morandispa.it'
    and nc.publication_status='published'
    and nc.privacy_classification='company_channel'
    and nc.privacy_legal_basis='not_applicable_company_data'
    and nc.lia_status='not_required'
    and nc.art14_status='not_required'
    and nc.privacy_review_actor_type='system'
    and nc.privacy_reviewed_by is null
    and nc.privacy_reviewed_at is not null
    and nc.privacy_review_expires_at>now()+interval '11 months'
),'system-reviewed contact is LR4 company-channel ready');

select pg_temp.pe1b_ok(exists(
  select 1
  from public.network_data_governance_events e
  join public.network_contacts nc on nc.id=e.subject_id
  where nc.email='vendite@morandispa.it'
    and e.subject_type='network_contact'
    and e.action='contact_privacy_reviewed'
    and e.actor_type='system'
    and e.actor_user_id is null
),'system review is auditable without impersonating a user');

select pg_temp.pe1b_ok(
  (select b.email
   from private.rfqh2_best_network_contact('51100000-0000-5000-8000-000000000005'::uuid) b)
  ='vendite@morandispa.it',
  'system-reviewed company email becomes RFQ-usable'
);

-- Replay is idempotent: nothing remains eligible after publication.
set local role service_role;
select pg_temp.pe1b_ok(
  (private.netcontact1_auto_review_company_channels(25,'IT',false)->>'eligible_total')::int=0,
  'replay has zero eligible candidates'
);
reset role;

rollback;
