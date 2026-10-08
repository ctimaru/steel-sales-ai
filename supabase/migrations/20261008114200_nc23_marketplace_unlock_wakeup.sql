-- Marketplace matches may exist before the qualifying unlock.
-- Wake their queued references only once entitlement is actually created.
create or replace function private.nc23_wake_unlocked_matches()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
 insert into public.notification_source_bridge_queue
   (event_type,source_event_id,source_revision,organization_id)
 select 'workspace.marketplace.opportunity_matched',
   n.id::text,1,n.recipient_organization_id
 from public.marketplace_notifications n
 where n.request_id=new.request_id
   and n.recipient_organization_id=new.supplier_organization_id
   and n.notification_kind='opportunity_match'
 on conflict on constraint nc23_queue_dedupe do update
 set status=case when notification_source_bridge_queue.status='projected'
                 then 'projected' else 'pending' end,
     attempts=case when notification_source_bridge_queue.status='projected'
                   then notification_source_bridge_queue.attempts else 0 end,
     next_attempt_at=now(),updated_at=now();
 return new;
exception when others then
 raise log 'NC23 entitlement wake failed state=%',sqlstate;
 return new;
end;
$fn$;
revoke all on function private.nc23_wake_unlocked_matches() from public,anon,authenticated;
create trigger nc23_marketplace_unlock_capture after insert on public.marketplace_unlocks
 for each row execute function private.nc23_wake_unlocked_matches();
