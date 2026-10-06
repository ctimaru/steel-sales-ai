-- RFQH3 capability-schema hardening.
-- Keep anon completely out of private while retaining non-exposed capability wrappers.

create schema if not exists rfqh_secure;
revoke all on schema rfqh_secure from public;
grant usage on schema rfqh_secure to anon,authenticated;

create or replace function rfqh_secure.rfqh3_open_invite_impl(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_supplier public.buyer_rfq_suppliers%rowtype;
  v_rfq public.buyer_rfq_campaigns%rowtype;
  v_org_name text;
  v_distinta public.buyer_distintas%rowtype;
  v_lines jsonb;
  v_first_open boolean:=false;
begin
  select * into v_dispatch from public.buyer_rfq_dispatches d
  where d.token_hash=p_token_hash and d.status not in ('cancelled','failed','bounced','complained')
  for update;
  if not found then return jsonb_build_object('valid',false); end if;

  select * into v_supplier from public.buyer_rfq_suppliers s where s.id=v_dispatch.supplier_id;
  select * into v_rfq from public.buyer_rfq_campaigns r where r.id=v_dispatch.rfq_id;
  if v_rfq.status in ('cancelled','closed') then return jsonb_build_object('valid',false); end if;
  select o.name into v_org_name from public.organizations o where o.id=v_rfq.organization_id;
  select * into v_distinta from public.buyer_distintas d where d.id=v_rfq.source_distinta_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'position',l.line_position,'description',l.description,'standard',l.standard_code,
    'grade',l.grade_code,'finish',l.finish_code,'quantity_mode',l.quantity_mode,
    'quantity',l.quantity,'bar_length_m',l.bar_length_m,'weight_kg_m',l.weight_kg_m,
    'line_meters',l.line_meters,'line_tonnes',l.line_tonnes,'note',l.note
  ) order by l.line_position),'[]'::jsonb)
  into v_lines from public.buyer_distinta_lines l where l.distinta_id=v_rfq.source_distinta_id;

  if v_dispatch.opened_at is null then
    v_first_open:=true;
    update public.buyer_rfq_dispatches
    set status='opened',opened_at=now(),updated_at=now()
    where id=v_dispatch.id;

    update public.buyer_rfq_suppliers
    set status=case when status in ('sent','delivered') then 'opened' else status end,
        opened_at=coalesce(opened_at,now()),updated_at=now()
    where id=v_supplier.id;

    perform private.rfqh3_log_event(
      v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,v_dispatch.organization_id,
      'invite_opened',jsonb_build_object('dispatch_id',v_dispatch.id),null
    );
  end if;

  return jsonb_build_object(
    'valid',true,'first_open',v_first_open,'title',v_rfq.title,
    'buyer_organization_name',v_org_name,'supplier_name',v_supplier.supplier_name,
    'due_at',v_rfq.due_at,'expired',(v_rfq.due_at is not null and v_rfq.due_at<now()),
    'buyer_message',v_rfq.buyer_message,'delivery_country_code',v_rfq.delivery_country_code,
    'delivery_region',v_rfq.delivery_region,'incoterm',v_rfq.incoterm,
    'payment_terms',v_rfq.payment_terms,'line_count',v_distinta.line_count,
    'total_meters',v_distinta.total_meters,'total_tonnes',v_distinta.total_tonnes,'lines',v_lines
  );
end;
$$;

revoke all on function rfqh_secure.rfqh3_open_invite_impl(text) from public,anon,authenticated;
grant execute on function rfqh_secure.rfqh3_open_invite_impl(text) to anon,authenticated;

create or replace function rfqh_secure.rfqh3_ingest_resend_event_impl(
  p_db_secret text,p_event_id text,p_event_type text,p_provider_message_id text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_expected_hash text;
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_email text;
  v_event_type text:=lower(btrim(coalesce(p_event_type,'')));
  v_inserted_event_id uuid;
begin
  select c.webhook_db_secret_sha256 into v_expected_hash
  from private.rfqh3_config c where c.singleton=true;

  if v_expected_hash is null
     or encode(extensions.digest(coalesce(p_db_secret,''),'sha256'),'hex')<>v_expected_hash
  then raise exception 'Invalid webhook database secret' using errcode='42501'; end if;

  if nullif(btrim(coalesce(p_event_id,'')),'') is null then
    raise exception 'Webhook event ID required';
  end if;

  insert into public.buyer_rfq_webhook_events(
    provider_event_id,provider_message_id,event_type,payload
  ) values (
    p_event_id,nullif(btrim(coalesce(p_provider_message_id,'')),''),v_event_type,
    coalesce(p_payload,'{}'::jsonb)
  )
  on conflict (provider_event_id) do nothing
  returning id into v_inserted_event_id;

  if v_inserted_event_id is null then
    return jsonb_build_object('ok',true,'duplicate',true);
  end if;

  select d.* into v_dispatch
  from public.buyer_rfq_dispatches d
  where d.provider_message_id=p_provider_message_id
  limit 1;

  if not found then
    return jsonb_build_object('ok',true,'matched',false);
  end if;

  select s.supplier_email_normalized into v_email
  from public.buyer_rfq_suppliers s
  where s.id=v_dispatch.supplier_id;

  if v_event_type='email.delivered' then
    update public.buyer_rfq_dispatches
    set status=case when status='opened' then status else 'delivered' end,
        delivered_at=coalesce(delivered_at,now()),updated_at=now()
    where id=v_dispatch.id;

    update public.buyer_rfq_suppliers
    set status=case when status='opened' then status else 'delivered' end,
        delivered_at=coalesce(delivered_at,now()),updated_at=now()
    where id=v_dispatch.supplier_id;

  elsif v_event_type='email.delivery_delayed' then
    update public.buyer_rfq_dispatches
    set status=case when status='opened' then status else 'delivery_delayed' end,
        updated_at=now()
    where id=v_dispatch.id;

  elsif v_event_type='email.bounced' then
    update public.buyer_rfq_dispatches
    set status='bounced',bounced_at=coalesce(bounced_at,now()),updated_at=now()
    where id=v_dispatch.id;

    update public.buyer_rfq_suppliers
    set status='bounced',updated_at=now()
    where id=v_dispatch.supplier_id;

    if v_email is not null then
      insert into public.buyer_rfq_email_suppressions(
        email_normalized,reason,provider,first_event_id
      ) values (v_email,'hard_bounce','resend',p_event_id)
      on conflict (email_normalized) do update
      set reason='hard_bounce',updated_at=now();
    end if;

  elsif v_event_type='email.complained' then
    update public.buyer_rfq_dispatches
    set status='complained',complained_at=coalesce(complained_at,now()),updated_at=now()
    where id=v_dispatch.id;

    update public.buyer_rfq_suppliers
    set status='complained',updated_at=now()
    where id=v_dispatch.supplier_id;

    if v_email is not null then
      insert into public.buyer_rfq_email_suppressions(
        email_normalized,reason,provider,first_event_id
      ) values (v_email,'complaint','resend',p_event_id)
      on conflict (email_normalized) do update
      set reason='complaint',updated_at=now();
    end if;
  end if;

  update public.buyer_rfq_webhook_events
  set matched_dispatch_id=v_dispatch.id,processed=true,processed_at=now()
  where id=v_inserted_event_id;

  perform private.rfqh3_log_event(
    v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,v_dispatch.organization_id,
    replace(v_event_type,'.','_'),
    jsonb_build_object(
      'dispatch_id',v_dispatch.id,
      'provider_message_id',p_provider_message_id,
      'provider_event_id',p_event_id
    ),
    null
  );

  return jsonb_build_object(
    'ok',true,'matched',true,'dispatch_id',v_dispatch.id,'event_type',v_event_type
  );
end;
$$;

revoke all on function rfqh_secure.rfqh3_ingest_resend_event_impl(text,text,text,text,jsonb)
from public,anon,authenticated;
grant execute on function rfqh_secure.rfqh3_ingest_resend_event_impl(text,text,text,text,jsonb)
to anon;

create or replace function public.rfqh3_open_invite(p_token_hash text)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select rfqh_secure.rfqh3_open_invite_impl(p_token_hash);
$$;

create or replace function public.rfqh3_ingest_resend_event(
  p_db_secret text,p_event_id text,p_event_type text,p_provider_message_id text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select rfqh_secure.rfqh3_ingest_resend_event_impl(
    p_db_secret,p_event_id,p_event_type,p_provider_message_id,p_payload
  );
$$;

revoke execute on function private.rfqh3_open_invite_impl(text) from anon;
revoke execute on function private.rfqh3_ingest_resend_event_impl(text,text,text,text,jsonb) from anon;
revoke usage on schema private from anon;

notify pgrst,'reload schema';
