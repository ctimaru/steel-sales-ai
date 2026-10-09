-- DEMOTEST2 regression: repair the HP13/RFQH13 RLS policy cycle.
--
-- Before: buyer_rfq_campaigns INSERT policy queried buyer_distintas.
-- Its shared SELECT policy in turn queried buyer_rfq_campaigns, producing
-- ERROR: infinite recursion detected in policy for relation "buyer_rfq_campaigns".
--
-- Preserve the original owner + draft + source organization contract, and
-- enforce active membership.  The internal definer check bypasses the
-- source-table SELECT policy recursion and NEVER accepts a different JWT actor.

create or replace function private.rfqh13_source_distinta_owned_for_campaign(
  p_distinta_id uuid,
  p_organization_id uuid,
  p_actor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select coalesce(
    (select auth.uid()) is not null
    and p_actor_id=(select auth.uid())
    and exists (
      select 1
      from public.buyer_distintas d
      join public.organization_memberships m
        on m.organization_id=d.organization_id
       and m.user_id=p_actor_id
       and m.status='active'
      where d.id=p_distinta_id
        and d.owner_user_id=p_actor_id
        and d.organization_id=p_organization_id
    ),
    false
  );
$$;

revoke all on function private.rfqh13_source_distinta_owned_for_campaign(uuid,uuid,uuid)
from public,anon,authenticated;
grant execute on function private.rfqh13_source_distinta_owned_for_campaign(uuid,uuid,uuid)
to authenticated, service_role;

comment on function private.rfqh13_source_distinta_owned_for_campaign(uuid,uuid,uuid)
is 'DEMOTEST2: JWT actor + active tenant + owner-only source check for RFQ creation, avoiding recursive RLS on buyer_distintas.';

drop policy if exists buyer_rfq_campaigns_owner_insert on public.buyer_rfq_campaigns;
create policy buyer_rfq_campaigns_owner_insert
on public.buyer_rfq_campaigns
for insert to authenticated
with check (
  owner_user_id=(select auth.uid())
  and status='draft'
  and private.rfqh13_source_distinta_owned_for_campaign(
    source_distinta_id,
    organization_id,
    (select auth.uid())
  )
);
