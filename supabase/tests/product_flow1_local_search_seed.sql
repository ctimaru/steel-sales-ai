-- Disposable LOCAL GoTrue/Postgres only. Apply after DEMOTEST2.3 seed.
-- The workflow pins psql to 127.0.0.1:54322; never use a linked/hosted project.
\set ON_ERROR_STOP on
begin;

-- Deliberately exercise the absence of an active model, not a mocked provider.
update public.knowledge_embedding_models set status='candidate' where status='active';

insert into public.commercial_datasets
 (id,owner_id,organization_id,source_run_id,source_filename,status)
values
 ('00000000-0000-0000-0000-000000093401',:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000023301','00000000-0000-0000-0000-000000093411','flow1-buyer-synthetic.eml','ready'),
 ('00000000-0000-0000-0000-000000093402',:'producer_user_id'::uuid,'00000000-0000-0000-0000-000000023302','00000000-0000-0000-0000-000000093412','flow1-producer-synthetic.eml','ready');
insert into public.commercial_threads
 (id,owner_id,organization_id,dataset_id,source_conversation_id,subject,last_activity_at)
values
 ('00000000-0000-0000-0000-000000093421',:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000023301','00000000-0000-0000-0000-000000093401','00000000-0000-0000-0000-000000093431','FLOW1 LOCAL STEEL BUYER',now()),
 ('00000000-0000-0000-0000-000000093422',:'producer_user_id'::uuid,'00000000-0000-0000-0000-000000023302','00000000-0000-0000-0000-000000093402','00000000-0000-0000-0000-000000093432','FLOW1 LOCAL STEEL PRODUCER',now());
insert into public.commercial_observations
 (owner_id,organization_id,dataset_id,thread_id,source_conversation_id,item_role,
  product_type,grade,standard,outer_diameter_mm,thickness_mm,
  source_filename,source_text,search_text)
values
 (:'buyer_user_id'::uuid,'00000000-0000-0000-0000-000000023301','00000000-0000-0000-0000-000000093401','00000000-0000-0000-0000-000000093421','00000000-0000-0000-0000-000000093431','requested',
  'round_tube','S355J2H','EN 10219',60.3,3.2,'flow1-buyer-synthetic.eml','FLOW1 LOCAL STEEL BUYER verified round 60.3 x 3.2 EN 10219','FLOW1 LOCAL STEEL BUYER'),
 (:'producer_user_id'::uuid,'00000000-0000-0000-0000-000000023302','00000000-0000-0000-0000-000000093402','00000000-0000-0000-0000-000000093422','00000000-0000-0000-0000-000000093432','requested',
  'round_tube','S355J2H','EN 10219',60.3,3.2,'flow1-producer-synthetic.eml','FLOW1 LOCAL STEEL PRODUCER verified round 60.3 x 3.2 EN 10219','FLOW1 LOCAL STEEL PRODUCER');

do $$ begin
 if exists(select 1 from public.knowledge_embedding_models where status='active') then
   raise exception 'FLOW1 requires no active embedding model';
 end if;
 if (select count(*) from public.commercial_datasets where source_filename like 'flow1-%-synthetic.eml') <> 2 then
   raise exception 'FLOW1 requires two isolated synthetic datasets';
 end if;
end $$;
commit;
select 'FLOW1 local structured search seeded: two tenants, zero active embedding models' as result;
