-- NC2.3: durable private reference queue; no email/push or payload copies.
create table public.notification_source_bridge_queue (
 id bigint generated always as identity primary key,
 event_type text not null check (length(event_type) between 1 and 100),
 source_event_id text not null check (length(source_event_id) between 1 and 128),
 source_revision integer not null check (source_revision>=1),
 organization_id uuid,
 status text not null default 'pending' check(status in ('pending','retry','projected','dead')),
 attempts integer not null default 0 check(attempts>=0),
 next_attempt_at timestamptz not null default now(),
 last_sqlstate text check(last_sqlstate is null or last_sqlstate ~ '^[A-Z0-9]{5}$'),
 event_id uuid,
 projected_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint nc23_queue_dedupe unique nulls not distinct
   (event_type,source_event_id,source_revision,organization_id),
 constraint nc23_scope check(
  (event_type like 'workspace.%' and organization_id is not null)
  or (event_type like 'platform.%' and organization_id is null))
);
create index nc23_queue_ready on public.notification_source_bridge_queue(next_attempt_at,id)
 where status in ('pending','retry');
create index nc23_queue_dead on public.notification_source_bridge_queue(updated_at desc,id desc)
 where status='dead';
alter table public.notification_source_bridge_queue enable row level security;
revoke all on public.notification_source_bridge_queue from public,anon,authenticated;
grant all on public.notification_source_bridge_queue to service_role;

create or replace function public.nc23_process_source_bridge_batch(p_limit integer default 50)
returns jsonb language plpgsql security invoker set search_path=''
as $fn$
declare
 r public.notification_source_bridge_queue%rowtype;
 answer jsonb; v_state text; n integer;
 total integer:=0; done_count integer:=0; retry_count integer:=0; dead_count integer:=0;
begin
 if current_user<>'service_role' then
   raise exception using errcode='42501',message='service-only source bridge';
 end if;
 if p_limit is null or p_limit not between 1 and 100 then
   raise exception using errcode='22023',message='invalid batch size';
 end if;
 for r in
   select * from public.notification_source_bridge_queue q
   where q.status in ('pending','retry') and q.next_attempt_at<=now()
   order by q.next_attempt_at,q.id for update skip locked limit p_limit
 loop
   total:=total+1;
   begin
     select public.nc22_route_notification(
       r.event_type,r.source_event_id,r.source_revision,r.organization_id
     ) into answer;
     update public.notification_source_bridge_queue q
     set status='projected',event_id=(answer->>'event_id')::uuid,
       projected_at=now(),last_sqlstate=null,updated_at=now()
     where q.id=r.id;
     done_count:=done_count+1;
   exception when others then
     v_state:=sqlstate; n:=r.attempts+1;
     if n>=12 or v_state in ('0A000','22023') then
       update public.notification_source_bridge_queue q
       set status='dead',attempts=n,last_sqlstate=v_state,updated_at=now()
       where q.id=r.id;
       dead_count:=dead_count+1;
     else
       update public.notification_source_bridge_queue q
       set status='retry',attempts=n,last_sqlstate=v_state,
         next_attempt_at=now()+make_interval(mins=>least(240,power(2,least(n,8))::integer)),
         updated_at=now() where q.id=r.id;
       retry_count:=retry_count+1;
     end if;
   end;
 end loop;
 return jsonb_build_object('processed',total,'projected',done_count,
   'retry',retry_count,'dead',dead_count,'email_dispatched',false);
end;
$fn$;
revoke all on function public.nc23_process_source_bridge_batch(integer)
 from public,anon,authenticated;
grant execute on function public.nc23_process_source_bridge_batch(integer) to service_role;
