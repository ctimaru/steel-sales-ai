-- PA1.2 — Public company lookup by name / VAT.
--
-- Public acquisition may answer "is my company already in SSS?" but must not
-- expose the paid Network directory or enriched Network data.

create schema if not exists public_lookup_private;

revoke all on schema public_lookup_private from public;
grant usage on schema public_lookup_private to anon,authenticated,service_role;

create or replace function public_lookup_private.pa1_2_company_lookup_impl(
  p_query text
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_raw text := btrim(coalesce(p_query,''));
  v_identifier text;
  v_name_key text;
  v_digit_count integer;
  v_is_identifier boolean := false;
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_mode text := 'name';
begin
  if char_length(v_raw)<3 or char_length(v_raw)>120 then
    return jsonb_build_object(
      'ok',false,
      'code','invalid_query',
      'mode',null,
      'items','[]'::jsonb
    );
  end if;

  v_identifier:=private.hp4_normalize_identifier(v_raw);
  v_name_key:=private.hp4_company_name_key(v_raw);
  v_digit_count:=char_length(
    regexp_replace(coalesce(v_identifier,''),'[^0-9]','','g')
  );

  v_is_identifier:=
    v_identifier is not null
    and char_length(v_identifier) between 8 and 18
    and v_digit_count>=8;

  if v_is_identifier then
    v_mode:='vat';

    select
      coalesce(jsonb_agg(to_jsonb(q) order by q.legal_name),'[]'::jsonb),
      count(*)
    into v_items,v_count
    from (
      select
        c.legal_name,
        c.trading_name,
        c.country_code,
        case
          when private.hp4_normalize_identifier(c.vat_id) is null then null
          else '••••'||right(private.hp4_normalize_identifier(c.vat_id),4)
        end as vat_hint,
        case
          when c.claimed_status='claimed'
               or exists(
                 select 1
                 from public.network_company_claims cl
                 where cl.network_company_id=c.id
                   and cl.status='approved'
               )
            then 'claimed'
          when c.claimed_status='pending'
               or exists(
                 select 1
                 from public.network_company_claims cl
                 where cl.network_company_id=c.id
                   and cl.status in ('requested','under_review')
               )
            then 'claim_in_progress'
          else 'claimable'
        end as claim_state
      from public.network_companies c
      where c.publication_status='published'
        and c.archived_at is null
        and c.vat_id is not null
        and (
          private.hp4_normalize_identifier(c.vat_id)=v_identifier
          or upper(c.country_code)
             ||private.hp4_normalize_identifier(c.vat_id)=v_identifier
          or (
            char_length(v_identifier)>2
            and left(v_identifier,2)=upper(c.country_code)
            and private.hp4_normalize_identifier(c.vat_id)=substr(v_identifier,3)
          )
        )
      order by c.legal_name,c.id
      limit 1
    ) q;
  else
    v_mode:='name';

    if v_name_key is null or char_length(v_name_key)<3 then
      return jsonb_build_object(
        'ok',false,
        'code','invalid_query',
        'mode','name',
        'items','[]'::jsonb
      );
    end if;

    select
      coalesce(
        jsonb_agg(
          to_jsonb(q)-'sort_exact'-'sort_prefix'-'sort_len'
          order by q.sort_exact desc,q.sort_prefix desc,q.sort_len,q.legal_name
        ),
        '[]'::jsonb
      ),
      count(*)
    into v_items,v_count
    from (
      select
        c.legal_name,
        c.trading_name,
        c.country_code,
        case
          when private.hp4_normalize_identifier(c.vat_id) is null then null
          else '••••'||right(private.hp4_normalize_identifier(c.vat_id),4)
        end as vat_hint,
        case
          when c.claimed_status='claimed'
               or exists(
                 select 1
                 from public.network_company_claims cl
                 where cl.network_company_id=c.id
                   and cl.status='approved'
               )
            then 'claimed'
          when c.claimed_status='pending'
               or exists(
                 select 1
                 from public.network_company_claims cl
                 where cl.network_company_id=c.id
                   and cl.status in ('requested','under_review')
               )
            then 'claim_in_progress'
          else 'claimable'
        end as claim_state,
        (private.hp4_company_name_key(c.legal_name)=v_name_key) as sort_exact,
        (
          private.hp4_company_name_key(c.legal_name) like v_name_key||'%'
          or private.hp4_company_name_key(c.trading_name) like v_name_key||'%'
        ) as sort_prefix,
        char_length(c.legal_name) as sort_len
      from public.network_companies c
      where c.publication_status='published'
        and c.archived_at is null
        and (
          private.hp4_company_name_key(c.legal_name) like '%'||v_name_key||'%'
          or private.hp4_company_name_key(c.trading_name) like '%'||v_name_key||'%'
        )
      order by sort_exact desc,sort_prefix desc,sort_len,c.legal_name,c.id
      limit 5
    ) q;
  end if;

  return jsonb_build_object(
    'ok',true,
    'code',case when v_count=0 then 'not_found' else 'ok' end,
    'mode',v_mode,
    'items',v_items
  );
end;
$function$;

revoke all on function public_lookup_private.pa1_2_company_lookup_impl(text)
from public;
grant execute on function public_lookup_private.pa1_2_company_lookup_impl(text)
to anon,authenticated,service_role;

create or replace function public.pa1_2_company_lookup(
  p_query text
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select public_lookup_private.pa1_2_company_lookup_impl(p_query);
$function$;

revoke all on function public.pa1_2_company_lookup(text)
from public;
grant execute on function public.pa1_2_company_lookup(text)
to anon,authenticated,service_role;

comment on function public.pa1_2_company_lookup(text) is
  'PA1.2 public identity lookup. Returns only minimal company identity and claim state; no paid Network attributes, filters, contacts or profile data.';
