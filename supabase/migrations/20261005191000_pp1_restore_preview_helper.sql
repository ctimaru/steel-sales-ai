-- PP1 — restore anonymous-safe internal preview permission bridge.
-- PL1.6 defines this helper in source; PP1 makes the production dependency explicit.

begin;

create or replace function public.pl1_can_preview_internal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then false
    else private.has_platform_permission('knowledge.read_drafts')
  end;
$$;

revoke all on function public.pl1_can_preview_internal()
from public;

grant execute on function public.pl1_can_preview_internal()
to anon, authenticated;

create or replace function public.pl1_price_list_public_notices(
  p_version_id uuid,
  p_include_internal boolean default false
)
returns table(
  notice_code text,
  title text,
  body text,
  severity text,
  calculation_order integer
)
language sql
stable
security invoker
set search_path=''
as $$
  with allowed as (
    select v.id
    from public.price_list_versions v
    where v.id=p_version_id
      and (
        public.pl1_version_visible_to(v.id,'public')
        or (
          p_include_internal
          and public.pl1_can_preview_internal()
          and v.status in ('draft','review','verified')
        )
      )
  )
  select
    case
      when r.rule_type='logistics_discount' then 'logistics_discount_manual'
      when r.rule_type='other'
        and r.rule_payload->>'kind'='melted_and_poured_certificate_extra'
        then 'certificate_extra_manual'
      else 'source_rule_manual'
    end as notice_code,
    case
      when r.rule_type='logistics_discount'
        then 'Sconto logistico non automatizzato'
      when r.rule_type='other'
        and r.rule_payload->>'kind'='melted_and_poured_certificate_extra'
        then 'Extra certificazione su accordo'
      else 'Condizione della fonte non automatizzata'
    end as title,
    coalesce(r.source_text,'Condizione presente nella fonte originale.')
      || ' Questa condizione non viene applicata automaticamente dal calcolo Smart Steel Sales.' as body,
    'warning'::text as severity,
    r.calculation_order
  from allowed a
  join public.price_rules r on r.price_list_version_id=a.id
  where r.status='review_required'
  order by r.calculation_order,r.id;
$$;

revoke all on function public.pl1_price_list_public_notices(uuid,boolean)
from public;

grant execute on function public.pl1_price_list_public_notices(uuid,boolean)
to anon,authenticated;

commit;
