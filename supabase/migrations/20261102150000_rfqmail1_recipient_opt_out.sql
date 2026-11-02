-- RFQ-MAIL1 — recipient opt-out for RFQ invitations.
-- With NET-CONTACT1, RFQs reach companies that never registered (public
-- company mailboxes). Every invitation and reminder now carries a personal
-- opt-out link and RFC 8058 one-click List-Unsubscribe headers. Opting out
-- suppresses the address platform-wide for future RFQs (same suppression
-- list as hard bounces and complaints, which already block launch, add and
-- reminders). The current invitation stays answerable.

alter table public.buyer_rfq_email_suppressions
  drop constraint if exists buyer_rfq_email_suppressions_reason_check;
alter table public.buyer_rfq_email_suppressions
  add constraint buyer_rfq_email_suppressions_reason_check
  check (reason in ('hard_bounce','complaint','opt_out'));

create or replace function rfqh_secure.rfqmail1_opt_out_impl(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_dispatch public.buyer_rfq_dispatches%rowtype;
  v_email text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'RFQ invite is not available' using errcode='42501';
  end if;
  select * into v_dispatch from public.buyer_rfq_dispatches d where d.token_hash=p_token_hash;
  if not found then raise exception 'RFQ invite is not available' using errcode='42501'; end if;
  select s.supplier_email_normalized into v_email from public.buyer_rfq_suppliers s where s.id=v_dispatch.supplier_id;
  if v_email is null then raise exception 'RFQ invite is not available' using errcode='42501'; end if;
  -- Keep a stronger existing reason (hard bounce / complaint); idempotent.
  insert into public.buyer_rfq_email_suppressions(email_normalized,reason,provider,first_event_id)
  values(v_email,'opt_out','recipient',null)
  on conflict (email_normalized) do nothing;
  perform private.rfqh3_log_event(v_dispatch.rfq_id,v_dispatch.supplier_id,v_dispatch.owner_user_id,
    v_dispatch.organization_id,'recipient_opted_out','{}'::jsonb,null);
  return jsonb_build_object('contract','rfqmail1-opt-out-v1','status','opted_out');
end;
$function$;
revoke all on function rfqh_secure.rfqmail1_opt_out_impl(text) from public;
grant execute on function rfqh_secure.rfqmail1_opt_out_impl(text) to anon,authenticated;

create or replace function public.rfqmail1_opt_out(p_token_hash text)
returns jsonb language sql volatile security invoker set search_path='' as $$
  select rfqh_secure.rfqmail1_opt_out_impl(p_token_hash);
$$;
revoke all on function public.rfqmail1_opt_out(text) from public,anon,authenticated;
grant execute on function public.rfqmail1_opt_out(text) to anon,authenticated;

-- NET-CONTACT1 reachability: an opted-out or bounced company email is no
-- longer offered as an RFQ channel in the Network list.
create or replace function private.netcontact1_rfq_reachability_impl(p_organization_id uuid,p_company_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_readiness jsonb;
begin
  perform private.pa1_3_require_network_access(p_organization_id);
  if p_company_ids is null or cardinality(p_company_ids)<1 or cardinality(p_company_ids)>24 then
    raise exception 'Select 1 to 24 companies' using errcode='22023';
  end if;
  v_readiness:=public.netconnect2e_readiness(p_organization_id,p_company_ids);
  return jsonb_build_object('contract','netcontact1-reach-v1','items',coalesce((
    select jsonb_agg(jsonb_build_object('company_id',r->>'company_id','channel',
      case when r->>'status' in ('available','connected') then 'platform'
        when exists(select 1 from private.rfqh2_best_network_contact((r->>'company_id')::uuid) b
          where not exists(select 1 from public.buyer_rfq_email_suppressions x
            where x.email_normalized=b.email)) then 'email'
        else 'none' end))
    from jsonb_array_elements(v_readiness->'items') r),'[]'::jsonb));
end;
$function$;
