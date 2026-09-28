-- SA7 — Knowledge Operations Delegation Cutover.
--
-- Activates the SA2 Knowledge Editor / Knowledge Publisher capability model over
-- the K2–K8 public Knowledge editorial registry.
--
-- Safety invariant: edits are staged in draft_payload and never mutate the live
-- public copy until an explicitly approved draft is published.

alter table public.steel_knowledge_standard_pages
  add column if not exists draft_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(draft_payload)='object'),
  add column if not exists workflow_status text not null default 'draft'
    check (workflow_status in ('draft','in_review','changes_requested','approved')),
  add column if not exists draft_version integer not null default 1
    check (draft_version > 0),
  add column if not exists draft_updated_by uuid,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists published_by uuid;

alter table public.steel_knowledge_grade_pages
  add column if not exists draft_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(draft_payload)='object'),
  add column if not exists workflow_status text not null default 'draft'
    check (workflow_status in ('draft','in_review','changes_requested','approved')),
  add column if not exists draft_version integer not null default 1
    check (draft_version > 0),
  add column if not exists draft_updated_by uuid,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,
  add column if not exists published_by uuid;

create index if not exists steel_knowledge_standard_pages_workflow_idx
  on public.steel_knowledge_standard_pages(workflow_status,page_status,updated_at desc);

create index if not exists steel_knowledge_grade_pages_workflow_idx
  on public.steel_knowledge_grade_pages(workflow_status,page_status,updated_at desc);

-- Backfill one isolated draft snapshot per existing editorial page. Published
-- K3/K4 pages are treated as historically reviewed/approved; no public copy is
-- changed by this migration.
update public.steel_knowledge_standard_pages p
set
  draft_payload=jsonb_build_object(
    'seo_title',p.seo_title,
    'seo_description',p.seo_description,
    'intro',p.intro,
    'what_it_covers',p.what_it_covers,
    'how_to_read',p.how_to_read,
    'typical_applications',p.typical_applications,
    'editorial_sections',coalesce(p.editorial_sections,'[]'::jsonb),
    'faq',coalesce(p.faq,'[]'::jsonb),
    'source_references',coalesce(p.source_references,'[]'::jsonb),
    'related_slugs',to_jsonb(coalesce(p.related_standard_slugs,'{}'::text[]))
  ),
  workflow_status=case when p.page_status='published' then 'approved' else 'draft' end,
  draft_version=greatest(p.editorial_version,1),
  draft_updated_at=coalesce(p.updated_at,p.created_at),
  reviewed_at=case
    when p.page_status='published' then coalesce(p.published_at,p.updated_at,p.created_at)
    else null
  end
where p.draft_payload='{}'::jsonb;

update public.steel_knowledge_grade_pages p
set
  draft_payload=jsonb_build_object(
    'seo_title',p.seo_title,
    'seo_description',p.seo_description,
    'intro',p.intro,
    'designation_explanation',p.designation_explanation,
    'typical_applications',p.typical_applications,
    'editorial_sections',coalesce(p.editorial_sections,'[]'::jsonb),
    'faq',coalesce(p.faq,'[]'::jsonb),
    'source_references',coalesce(p.source_references,'[]'::jsonb),
    'related_slugs',to_jsonb(coalesce(p.related_grade_slugs,'{}'::text[]))
  ),
  workflow_status=case when p.page_status='published' then 'approved' else 'draft' end,
  draft_version=greatest(p.editorial_version,1),
  draft_updated_at=coalesce(p.updated_at,p.created_at),
  reviewed_at=case
    when p.page_status='published' then coalesce(p.published_at,p.updated_at,p.created_at)
    else null
  end
where p.draft_payload='{}'::jsonb;

create or replace function private.sa7_knowledge_payload_blockers(
  p_content_type text,
  p_payload jsonb
)
returns text[]
language plpgsql
immutable
security definer
set search_path=''
as $function$
declare
  v_type text:=lower(btrim(coalesce(p_content_type,'')));
  v_sections jsonb:=coalesce(p_payload->'editorial_sections','[]'::jsonb);
  v_faq jsonb:=coalesce(p_payload->'faq','[]'::jsonb);
  v_sources jsonb:=coalesce(p_payload->'source_references','[]'::jsonb);
  v_blockers text[]:='{}'::text[];
begin
  if v_type not in ('standard','grade') then
    raise exception 'invalid Knowledge content type' using errcode='22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    return array['invalid_payload']::text[];
  end if;

  if nullif(btrim(coalesce(p_payload->>'seo_title','')),'') is null then
    v_blockers:=array_append(v_blockers,'missing_seo_title');
  end if;
  if nullif(btrim(coalesce(p_payload->>'seo_description','')),'') is null then
    v_blockers:=array_append(v_blockers,'missing_seo_description');
  end if;
  if nullif(btrim(coalesce(p_payload->>'intro','')),'') is null then
    v_blockers:=array_append(v_blockers,'missing_intro');
  end if;

  if v_type='standard'
     and nullif(btrim(coalesce(p_payload->>'what_it_covers','')),'') is null then
    v_blockers:=array_append(v_blockers,'missing_scope_copy');
  end if;

  if v_type='grade'
     and nullif(btrim(coalesce(p_payload->>'designation_explanation','')),'') is null then
    v_blockers:=array_append(v_blockers,'missing_designation_copy');
  end if;

  if jsonb_typeof(v_sections)<>'array'
     or jsonb_array_length(v_sections)<2 then
    v_blockers:=array_append(v_blockers,'insufficient_editorial_sections');
  end if;

  if jsonb_typeof(v_faq)<>'array'
     or jsonb_array_length(v_faq)<2 then
    v_blockers:=array_append(v_blockers,'insufficient_faq');
  end if;

  if jsonb_typeof(v_sources)<>'array'
     or jsonb_array_length(v_sources)<1 then
    v_blockers:=array_append(v_blockers,'missing_sources');
  end if;

  return v_blockers;
end;
$function$;

revoke all on function private.sa7_knowledge_payload_blockers(text,jsonb)
  from public,anon,authenticated;

create or replace function private.sa7_validate_knowledge_payload(
  p_content_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_type text:=lower(btrim(coalesce(p_content_type,'')));
  v_sections jsonb;
  v_faq jsonb;
  v_sources jsonb;
  v_related jsonb;
  v_payload jsonb;
begin
  if v_type not in ('standard','grade') then
    raise exception 'invalid Knowledge content type' using errcode='22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'Knowledge draft payload must be a JSON object' using errcode='22023';
  end if;

  if pg_column_size(p_payload)>262144 then
    raise exception 'Knowledge draft payload exceeds 256 KiB' using errcode='22023';
  end if;

  v_sections:=coalesce(p_payload->'editorial_sections','[]'::jsonb);
  v_faq:=coalesce(p_payload->'faq','[]'::jsonb);
  v_sources:=coalesce(p_payload->'source_references','[]'::jsonb);
  v_related:=coalesce(p_payload->'related_slugs','[]'::jsonb);

  if jsonb_typeof(v_sections)<>'array'
     or jsonb_array_length(v_sections)>24 then
    raise exception 'editorial_sections must be an array with at most 24 items'
      using errcode='22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_sections) item
    where jsonb_typeof(item)<>'object'
       or nullif(btrim(coalesce(item->>'heading','')),'') is null
       or nullif(btrim(coalesce(item->>'body','')),'') is null
       or char_length(item->>'heading')>240
       or char_length(item->>'body')>20000
  ) then
    raise exception 'invalid editorial section' using errcode='22023';
  end if;

  if jsonb_typeof(v_faq)<>'array'
     or jsonb_array_length(v_faq)>24 then
    raise exception 'faq must be an array with at most 24 items'
      using errcode='22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_faq) item
    where jsonb_typeof(item)<>'object'
       or nullif(btrim(coalesce(item->>'question','')),'') is null
       or nullif(btrim(coalesce(item->>'answer','')),'') is null
       or char_length(item->>'question')>500
       or char_length(item->>'answer')>12000
  ) then
    raise exception 'invalid FAQ item' using errcode='22023';
  end if;

  if jsonb_typeof(v_sources)<>'array'
     or jsonb_array_length(v_sources)>30 then
    raise exception 'source_references must be an array with at most 30 items'
      using errcode='22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_sources) item
    where jsonb_typeof(item)<>'object'
       or nullif(btrim(coalesce(item->>'label','')),'') is null
       or nullif(btrim(coalesce(item->>'url','')),'') is null
       or coalesce(item->>'url','') !~* '^https?://'
       or char_length(item->>'label')>500
       or char_length(item->>'url')>2000
       or char_length(coalesce(item->>'publisher',''))>300
       or char_length(coalesce(item->>'status',''))>500
  ) then
    raise exception 'invalid Knowledge source reference' using errcode='22023';
  end if;

  if jsonb_typeof(v_related)<>'array'
     or jsonb_array_length(v_related)>60 then
    raise exception 'related_slugs must be an array with at most 60 items'
      using errcode='22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements_text(v_related) slug
    where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ) then
    raise exception 'invalid related Knowledge slug' using errcode='22023';
  end if;

  if char_length(coalesce(p_payload->>'seo_title',''))>180
     or char_length(coalesce(p_payload->>'seo_description',''))>500
     or char_length(coalesce(p_payload->>'intro',''))>20000
     or char_length(coalesce(p_payload->>'what_it_covers',''))>30000
     or char_length(coalesce(p_payload->>'designation_explanation',''))>30000
     or char_length(coalesce(p_payload->>'how_to_read',''))>30000
     or char_length(coalesce(p_payload->>'typical_applications',''))>30000 then
    raise exception 'Knowledge editorial text exceeds allowed length'
      using errcode='22023';
  end if;

  v_payload:=jsonb_build_object(
    'seo_title',nullif(btrim(coalesce(p_payload->>'seo_title','')),''),
    'seo_description',nullif(btrim(coalesce(p_payload->>'seo_description','')),''),
    'intro',nullif(btrim(coalesce(p_payload->>'intro','')),''),
    'typical_applications',nullif(btrim(coalesce(p_payload->>'typical_applications','')),''),
    'editorial_sections',v_sections,
    'faq',v_faq,
    'source_references',v_sources,
    'related_slugs',v_related
  );

  if v_type='standard' then
    v_payload:=v_payload || jsonb_build_object(
      'what_it_covers',nullif(btrim(coalesce(p_payload->>'what_it_covers','')),''),
      'how_to_read',nullif(btrim(coalesce(p_payload->>'how_to_read','')),'')
    );
  else
    v_payload:=v_payload || jsonb_build_object(
      'designation_explanation',nullif(btrim(coalesce(p_payload->>'designation_explanation','')),'')
    );
  end if;

  return v_payload;
end;
$function$;

revoke all on function private.sa7_validate_knowledge_payload(text,jsonb)
  from public,anon,authenticated;

create or replace function private.sa7_record_knowledge_action(
  p_permission_key text,
  p_action text,
  p_content_type text,
  p_page_id uuid,
  p_before_state jsonb default null,
  p_after_state jsonb default null,
  p_reason text default null
)
returns uuid
language sql
security definer
set search_path=''
as $function$
  select private.sa2_record_platform_event(
    p_permission_key,
    p_action,
    case lower(btrim(p_content_type))
      when 'standard' then 'knowledge_standard_page'
      when 'grade' then 'knowledge_grade_page'
      else 'knowledge_page'
    end,
    p_page_id::text,
    null,
    p_before_state,
    p_after_state,
    p_reason,
    jsonb_build_object(
      'surface','knowledge',
      'content_type',lower(btrim(p_content_type))
    )
  );
$function$;

revoke all on function private.sa7_record_knowledge_action(text,text,text,uuid,jsonb,jsonb,text)
  from public,anon,authenticated;

create or replace function private.sa7_knowledge_queue_impl(
  p_workflow_status text default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_status text:=nullif(lower(btrim(coalesce(p_workflow_status,''))),'');
  v_limit integer:=least(greatest(coalesce(p_limit,200),1),500);
  v_items jsonb;
begin
  perform private.require_platform_permission('knowledge.read_drafts');

  if v_status is not null
     and v_status not in ('draft','in_review','changes_requested','approved') then
    raise exception 'invalid Knowledge workflow status' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.sort_rank,q.updated_at desc,q.label),'[]'::jsonb)
  into v_items
  from (
    select *
    from (
      select
        'standard'::text as content_type,
        p.id as page_id,
        p.slug,
        s.code as label,
        s.title as subtitle,
        p.page_status,
        p.workflow_status,
        p.draft_version,
        p.editorial_version as live_version,
        p.draft_updated_at,
        p.reviewed_at,
        p.review_note,
        p.published_at,
        p.last_reviewed_at,
        cardinality(private.sa7_knowledge_payload_blockers('standard',p.draft_payload))=0 as ready,
        private.sa7_knowledge_payload_blockers('standard',p.draft_payload) as blockers,
        p.updated_at,
        case p.workflow_status
          when 'in_review' then 1
          when 'changes_requested' then 2
          when 'approved' then 3
          else 4
        end as sort_rank
      from public.steel_knowledge_standard_pages p
      join public.steel_standards s on s.id=p.standard_id
      where v_status is null or p.workflow_status=v_status

      union all

      select
        'grade'::text,
        p.id,
        p.slug,
        g.designation,
        coalesce(g.material_number,g.material_family),
        p.page_status,
        p.workflow_status,
        p.draft_version,
        p.editorial_version,
        p.draft_updated_at,
        p.reviewed_at,
        p.review_note,
        p.published_at,
        p.last_reviewed_at,
        cardinality(private.sa7_knowledge_payload_blockers('grade',p.draft_payload))=0,
        private.sa7_knowledge_payload_blockers('grade',p.draft_payload),
        p.updated_at,
        case p.workflow_status
          when 'in_review' then 1
          when 'changes_requested' then 2
          when 'approved' then 3
          else 4
        end
      from public.steel_knowledge_grade_pages p
      join public.steel_material_grades g on g.id=p.material_grade_id
      where v_status is null or p.workflow_status=v_status
    ) u
    order by sort_rank,updated_at desc,label
    limit v_limit
  ) q;

  return jsonb_build_object(
    'items',v_items,
    'total',(
      select count(*) from (
        select workflow_status from public.steel_knowledge_standard_pages
        union all
        select workflow_status from public.steel_knowledge_grade_pages
      ) x
      where v_status is null or x.workflow_status=v_status
    ),
    'draft',(
      select count(*) from (
        select workflow_status from public.steel_knowledge_standard_pages
        union all
        select workflow_status from public.steel_knowledge_grade_pages
      ) x where x.workflow_status='draft'
    ),
    'in_review',(
      select count(*) from (
        select workflow_status from public.steel_knowledge_standard_pages
        union all
        select workflow_status from public.steel_knowledge_grade_pages
      ) x where x.workflow_status='in_review'
    ),
    'changes_requested',(
      select count(*) from (
        select workflow_status from public.steel_knowledge_standard_pages
        union all
        select workflow_status from public.steel_knowledge_grade_pages
      ) x where x.workflow_status='changes_requested'
    ),
    'approved',(
      select count(*) from (
        select workflow_status from public.steel_knowledge_standard_pages
        union all
        select workflow_status from public.steel_knowledge_grade_pages
      ) x where x.workflow_status='approved'
    ),
    'published',(
      (select count(*) from public.steel_knowledge_standard_pages where page_status='published')
      +(select count(*) from public.steel_knowledge_grade_pages where page_status='published')
    )
  );
end;
$function$;

revoke all on function private.sa7_knowledge_queue_impl(text,integer)
  from public,anon,authenticated;

create or replace function public.sa7_knowledge_queue(
  p_workflow_status text default null,
  p_limit integer default 200
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.sa7_knowledge_queue_impl(p_workflow_status,p_limit);
$function$;

revoke all on function public.sa7_knowledge_queue(text,integer)
  from public,anon;
grant execute on function public.sa7_knowledge_queue(text,integer)
  to authenticated,service_role;

create or replace function private.sa7_knowledge_page_impl(
  p_content_type text,
  p_page_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_type text:=lower(btrim(coalesce(p_content_type,'')));
  v_result jsonb;
begin
  perform private.require_platform_permission('knowledge.read_drafts');

  if v_type='standard' then
    select jsonb_build_object(
      'content_type','standard',
      'page_id',p.id,
      'slug',p.slug,
      'label',s.code,
      'subtitle',s.title,
      'page_status',p.page_status,
      'workflow_status',p.workflow_status,
      'draft_version',p.draft_version,
      'live_version',p.editorial_version,
      'draft_payload',p.draft_payload,
      'live_payload',jsonb_build_object(
        'seo_title',p.seo_title,
        'seo_description',p.seo_description,
        'intro',p.intro,
        'what_it_covers',p.what_it_covers,
        'how_to_read',p.how_to_read,
        'typical_applications',p.typical_applications,
        'editorial_sections',p.editorial_sections,
        'faq',p.faq,
        'source_references',p.source_references,
        'related_slugs',to_jsonb(p.related_standard_slugs)
      ),
      'ready',cardinality(private.sa7_knowledge_payload_blockers('standard',p.draft_payload))=0,
      'blockers',to_jsonb(private.sa7_knowledge_payload_blockers('standard',p.draft_payload)),
      'draft_updated_at',p.draft_updated_at,
      'reviewed_at',p.reviewed_at,
      'review_note',p.review_note,
      'published_at',p.published_at,
      'last_reviewed_at',p.last_reviewed_at
    )
    into v_result
    from public.steel_knowledge_standard_pages p
    join public.steel_standards s on s.id=p.standard_id
    where p.id=p_page_id;
  elsif v_type='grade' then
    select jsonb_build_object(
      'content_type','grade',
      'page_id',p.id,
      'slug',p.slug,
      'label',g.designation,
      'subtitle',coalesce(g.material_number,g.material_family),
      'page_status',p.page_status,
      'workflow_status',p.workflow_status,
      'draft_version',p.draft_version,
      'live_version',p.editorial_version,
      'draft_payload',p.draft_payload,
      'live_payload',jsonb_build_object(
        'seo_title',p.seo_title,
        'seo_description',p.seo_description,
        'intro',p.intro,
        'designation_explanation',p.designation_explanation,
        'typical_applications',p.typical_applications,
        'editorial_sections',p.editorial_sections,
        'faq',p.faq,
        'source_references',p.source_references,
        'related_slugs',to_jsonb(p.related_grade_slugs)
      ),
      'ready',cardinality(private.sa7_knowledge_payload_blockers('grade',p.draft_payload))=0,
      'blockers',to_jsonb(private.sa7_knowledge_payload_blockers('grade',p.draft_payload)),
      'draft_updated_at',p.draft_updated_at,
      'reviewed_at',p.reviewed_at,
      'review_note',p.review_note,
      'published_at',p.published_at,
      'last_reviewed_at',p.last_reviewed_at
    )
    into v_result
    from public.steel_knowledge_grade_pages p
    join public.steel_material_grades g on g.id=p.material_grade_id
    where p.id=p_page_id;
  else
    raise exception 'invalid Knowledge content type' using errcode='22023';
  end if;

  if v_result is null then
    raise exception 'Knowledge page not found' using errcode='P0002';
  end if;

  return v_result;
end;
$function$;

revoke all on function private.sa7_knowledge_page_impl(text,uuid)
  from public,anon,authenticated;

create or replace function public.sa7_knowledge_page(
  p_content_type text,
  p_page_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.sa7_knowledge_page_impl(p_content_type,p_page_id);
$function$;

revoke all on function public.sa7_knowledge_page(text,uuid)
  from public,anon;
grant execute on function public.sa7_knowledge_page(text,uuid)
  to authenticated,service_role;

create or replace function private.sa7_knowledge_quality_audit_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_live jsonb;
  v_workflow jsonb;
begin
  perform private.require_platform_permission('knowledge.quality_audit');

  select coalesce(jsonb_agg(to_jsonb(q) order by q.content_type),'[]'::jsonb)
  into v_live
  from public.k8_knowledge_seo_quality_audit() q;

  select jsonb_build_object(
    'total',count(*),
    'ready_drafts',count(*) filter (where ready),
    'blocked_drafts',count(*) filter (where not ready),
    'in_review',count(*) filter (where workflow_status='in_review'),
    'approved',count(*) filter (where workflow_status='approved'),
    'changes_requested',count(*) filter (where workflow_status='changes_requested')
  )
  into v_workflow
  from (
    select
      p.workflow_status,
      cardinality(private.sa7_knowledge_payload_blockers('standard',p.draft_payload))=0 as ready
    from public.steel_knowledge_standard_pages p
    union all
    select
      p.workflow_status,
      cardinality(private.sa7_knowledge_payload_blockers('grade',p.draft_payload))=0
    from public.steel_knowledge_grade_pages p
  ) x;

  return jsonb_build_object('live_quality',v_live,'workflow',v_workflow);
end;
$function$;

revoke all on function private.sa7_knowledge_quality_audit_impl()
  from public,anon,authenticated;

create or replace function public.sa7_knowledge_quality_audit()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $function$
  select private.sa7_knowledge_quality_audit_impl();
$function$;

revoke all on function public.sa7_knowledge_quality_audit()
  from public,anon;
grant execute on function public.sa7_knowledge_quality_audit()
  to authenticated,service_role;

create or replace function private.sa7_save_knowledge_draft_impl(
  p_content_type text,
  p_page_id uuid,
  p_payload jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_type text:=lower(btrim(coalesce(p_content_type,'')));
  v_payload jsonb;
  v_note text:=nullif(btrim(coalesce(p_note,'')),'');
  v_before jsonb;
  v_after jsonb;
begin
  perform private.require_platform_permission('knowledge.edit');

  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'Knowledge edit note exceeds 2000 characters' using errcode='22023';
  end if;

  v_payload:=private.sa7_validate_knowledge_payload(v_type,p_payload);

  if v_type='standard' then
    select jsonb_build_object(
      'workflow_status',workflow_status,
      'draft_version',draft_version,
      'page_status',page_status,
      'draft_payload',draft_payload
    )
    into v_before
    from public.steel_knowledge_standard_pages
    where id=p_page_id
    for update;

    if v_before is null then
      raise exception 'Knowledge standard page not found' using errcode='P0002';
    end if;

    if v_before->>'workflow_status'='in_review' then
      raise exception 'Knowledge draft is frozen while in review' using errcode='22023';
    end if;

    update public.steel_knowledge_standard_pages
    set draft_payload=v_payload,
        workflow_status='draft',
        draft_version=draft_version+1,
        draft_updated_by=v_user_id,
        draft_updated_at=now(),
        reviewed_by=null,
        reviewed_at=null,
        review_note=null,
        updated_at=now()
    where id=p_page_id
    returning jsonb_build_object(
      'workflow_status',workflow_status,
      'draft_version',draft_version,
      'page_status',page_status,
      'ready',cardinality(private.sa7_knowledge_payload_blockers('standard',draft_payload))=0,
      'blockers',to_jsonb(private.sa7_knowledge_payload_blockers('standard',draft_payload))
    ) into v_after;
  elsif v_type='grade' then
    select jsonb_build_object(
      'workflow_status',workflow_status,
      'draft_version',draft_version,
      'page_status',page_status,
      'draft_payload',draft_payload
    )
    into v_before
    from public.steel_knowledge_grade_pages
    where id=p_page_id
    for update;

    if v_before is null then
      raise exception 'Knowledge grade page not found' using errcode='P0002';
    end if;

    if v_before->>'workflow_status'='in_review' then
      raise exception 'Knowledge draft is frozen while in review' using errcode='22023';
    end if;

    update public.steel_knowledge_grade_pages
    set draft_payload=v_payload,
        workflow_status='draft',
        draft_version=draft_version+1,
        draft_updated_by=v_user_id,
        draft_updated_at=now(),
        reviewed_by=null,
        reviewed_at=null,
        review_note=null,
        updated_at=now()
    where id=p_page_id
    returning jsonb_build_object(
      'workflow_status',workflow_status,
      'draft_version',draft_version,
      'page_status',page_status,
      'ready',cardinality(private.sa7_knowledge_payload_blockers('grade',draft_payload))=0,
      'blockers',to_jsonb(private.sa7_knowledge_payload_blockers('grade',draft_payload))
    ) into v_after;
  else
    raise exception 'invalid Knowledge content type' using errcode='22023';
  end if;

  perform private.sa7_record_knowledge_action(
    'knowledge.edit',
    'knowledge_draft_saved',
    v_type,
    p_page_id,
    v_before-'draft_payload',
    v_after,
    v_note
  );

  return v_after || jsonb_build_object('page_id',p_page_id,'content_type',v_type);
end;
$function$;

revoke all on function private.sa7_save_knowledge_draft_impl(text,uuid,jsonb,text)
  from public,anon,authenticated;

create or replace function public.sa7_save_knowledge_draft(
  p_content_type text,
  p_page_id uuid,
  p_payload jsonb,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.sa7_save_knowledge_draft_impl(p_content_type,p_page_id,p_payload,p_note);
$function$;

revoke all on function public.sa7_save_knowledge_draft(text,uuid,jsonb,text)
  from public,anon;
grant execute on function public.sa7_save_knowledge_draft(text,uuid,jsonb,text)
  to authenticated,service_role;

create or replace function private.sa7_submit_knowledge_review_impl(
  p_content_type text,
  p_page_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_type text:=lower(btrim(coalesce(p_content_type,'')));
  v_note text:=nullif(btrim(coalesce(p_note,'')),'');
  v_payload jsonb;
  v_status text;
  v_version integer;
  v_blockers text[];
begin
  perform private.require_platform_permission('knowledge.edit');

  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'Knowledge review submission note exceeds 2000 characters'
      using errcode='22023';
  end if;

  if v_type='standard' then
    select draft_payload,workflow_status,draft_version
    into v_payload,v_status,v_version
    from public.steel_knowledge_standard_pages
    where id=p_page_id
    for update;
  elsif v_type='grade' then
    select draft_payload,workflow_status,draft_version
    into v_payload,v_status,v_version
    from public.steel_knowledge_grade_pages
    where id=p_page_id
    for update;
  else
    raise exception 'invalid Knowledge content type' using errcode='22023';
  end if;

  if v_payload is null then
    raise exception 'Knowledge page not found' using errcode='P0002';
  end if;

  if v_status not in ('draft','changes_requested') then
    raise exception 'Knowledge review submission requires draft or changes_requested state'
      using errcode='22023';
  end if;

  v_blockers:=private.sa7_knowledge_payload_blockers(v_type,v_payload);
  if cardinality(v_blockers)>0 then
    raise exception 'Knowledge draft is not review-ready: %',array_to_string(v_blockers,', ')
      using errcode='23514';
  end if;

  if v_status='in_review' then
    return jsonb_build_object(
      'page_id',p_page_id,'content_type',v_type,
      'workflow_status','in_review','draft_version',v_version,
      'idempotent_replay',true
    );
  end if;

  if v_type='standard' then
    update public.steel_knowledge_standard_pages
    set workflow_status='in_review',
        review_note=v_note,
        reviewed_by=null,
        reviewed_at=null,
        updated_at=now()
    where id=p_page_id;
  else
    update public.steel_knowledge_grade_pages
    set workflow_status='in_review',
        review_note=v_note,
        reviewed_by=null,
        reviewed_at=null,
        updated_at=now()
    where id=p_page_id;
  end if;

  perform private.sa7_record_knowledge_action(
    'knowledge.edit',
    'knowledge_review_submitted',
    v_type,
    p_page_id,
    jsonb_build_object('workflow_status',v_status,'draft_version',v_version),
    jsonb_build_object('workflow_status','in_review','draft_version',v_version),
    v_note
  );

  return jsonb_build_object(
    'page_id',p_page_id,'content_type',v_type,
    'workflow_status','in_review','draft_version',v_version
  );
end;
$function$;

revoke all on function private.sa7_submit_knowledge_review_impl(text,uuid,text)
  from public,anon,authenticated;

create or replace function public.sa7_submit_knowledge_review(
  p_content_type text,
  p_page_id uuid,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.sa7_submit_knowledge_review_impl(p_content_type,p_page_id,p_note);
$function$;

revoke all on function public.sa7_submit_knowledge_review(text,uuid,text)
  from public,anon;
grant execute on function public.sa7_submit_knowledge_review(text,uuid,text)
  to authenticated,service_role;

create or replace function private.sa7_review_knowledge_draft_impl(
  p_content_type text,
  p_page_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_type text:=lower(btrim(coalesce(p_content_type,'')));
  v_decision text:=lower(btrim(coalesce(p_decision,'')));
  v_note text:=nullif(btrim(coalesce(p_note,'')),'');
  v_payload jsonb;
  v_status text;
  v_version integer;
  v_blockers text[];
  v_next_status text;
begin
  perform private.require_platform_permission('knowledge.review');

  if v_decision not in ('approve','changes_requested') then
    raise exception 'invalid Knowledge review decision' using errcode='22023';
  end if;

  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'Knowledge review note exceeds 2000 characters' using errcode='22023';
  end if;

  if v_decision='changes_requested' and v_note is null then
    raise exception 'review note required when requesting changes' using errcode='22023';
  end if;

  if v_type='standard' then
    select draft_payload,workflow_status,draft_version
    into v_payload,v_status,v_version
    from public.steel_knowledge_standard_pages
    where id=p_page_id
    for update;
  elsif v_type='grade' then
    select draft_payload,workflow_status,draft_version
    into v_payload,v_status,v_version
    from public.steel_knowledge_grade_pages
    where id=p_page_id
    for update;
  else
    raise exception 'invalid Knowledge content type' using errcode='22023';
  end if;

  if v_payload is null then
    raise exception 'Knowledge page not found' using errcode='P0002';
  end if;

  if v_status<>'in_review' then
    raise exception 'Knowledge review requires in_review state' using errcode='22023';
  end if;

  if v_decision='approve' then
    v_blockers:=private.sa7_knowledge_payload_blockers(v_type,v_payload);
    if cardinality(v_blockers)>0 then
      raise exception 'Knowledge draft is not publication-ready: %',array_to_string(v_blockers,', ')
        using errcode='23514';
    end if;
    v_next_status:='approved';
  else
    v_next_status:='changes_requested';
  end if;

  if v_type='standard' then
    update public.steel_knowledge_standard_pages
    set workflow_status=v_next_status,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_note=v_note,
        updated_at=now()
    where id=p_page_id;
  else
    update public.steel_knowledge_grade_pages
    set workflow_status=v_next_status,
        reviewed_by=v_user_id,
        reviewed_at=now(),
        review_note=v_note,
        updated_at=now()
    where id=p_page_id;
  end if;

  perform private.sa7_record_knowledge_action(
    'knowledge.review',
    case when v_decision='approve'
      then 'knowledge_draft_approved'
      else 'knowledge_changes_requested'
    end,
    v_type,
    p_page_id,
    jsonb_build_object('workflow_status',v_status,'draft_version',v_version),
    jsonb_build_object('workflow_status',v_next_status,'draft_version',v_version),
    v_note
  );

  return jsonb_build_object(
    'page_id',p_page_id,'content_type',v_type,
    'workflow_status',v_next_status,'draft_version',v_version
  );
end;
$function$;

revoke all on function private.sa7_review_knowledge_draft_impl(text,uuid,text,text)
  from public,anon,authenticated;

create or replace function public.sa7_review_knowledge_draft(
  p_content_type text,
  p_page_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.sa7_review_knowledge_draft_impl(p_content_type,p_page_id,p_decision,p_note);
$function$;

revoke all on function public.sa7_review_knowledge_draft(text,uuid,text,text)
  from public,anon;
grant execute on function public.sa7_review_knowledge_draft(text,uuid,text,text)
  to authenticated,service_role;

create or replace function private.sa7_publish_knowledge_page_impl(
  p_content_type text,
  p_page_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user_id uuid:=(select auth.uid());
  v_type text:=lower(btrim(coalesce(p_content_type,'')));
  v_action text:=lower(btrim(coalesce(p_action,'')));
  v_note text:=nullif(btrim(coalesce(p_note,'')),'');
  v_payload jsonb;
  v_status text;
  v_page_status text;
  v_draft_version integer;
  v_live_version integer;
  v_blockers text[];
  v_after jsonb;
begin
  perform private.require_platform_permission('knowledge.publish');

  if v_action not in ('publish','unpublish') then
    raise exception 'invalid Knowledge publication action' using errcode='22023';
  end if;

  if v_note is not null and char_length(v_note)>2000 then
    raise exception 'Knowledge publication note exceeds 2000 characters' using errcode='22023';
  end if;

  if v_type='standard' then
    select draft_payload,workflow_status,page_status,draft_version,editorial_version
    into v_payload,v_status,v_page_status,v_draft_version,v_live_version
    from public.steel_knowledge_standard_pages
    where id=p_page_id
    for update;
  elsif v_type='grade' then
    select draft_payload,workflow_status,page_status,draft_version,editorial_version
    into v_payload,v_status,v_page_status,v_draft_version,v_live_version
    from public.steel_knowledge_grade_pages
    where id=p_page_id
    for update;
  else
    raise exception 'invalid Knowledge content type' using errcode='22023';
  end if;

  if v_payload is null then
    raise exception 'Knowledge page not found' using errcode='P0002';
  end if;

  if v_action='publish' then
    if v_status<>'approved' then
      raise exception 'approved Knowledge review required before publication'
        using errcode='23514';
    end if;

    v_blockers:=private.sa7_knowledge_payload_blockers(v_type,v_payload);
    if cardinality(v_blockers)>0 then
      raise exception 'Knowledge draft is not publication-ready: %',array_to_string(v_blockers,', ')
        using errcode='23514';
    end if;

    if v_type='standard' then
      update public.steel_knowledge_standard_pages
      set seo_title=v_payload->>'seo_title',
          seo_description=v_payload->>'seo_description',
          intro=v_payload->>'intro',
          what_it_covers=v_payload->>'what_it_covers',
          how_to_read=nullif(v_payload->>'how_to_read',''),
          typical_applications=nullif(v_payload->>'typical_applications',''),
          editorial_sections=v_payload->'editorial_sections',
          faq=v_payload->'faq',
          source_references=v_payload->'source_references',
          related_standard_slugs=coalesce(
            array(select jsonb_array_elements_text(v_payload->'related_slugs')),
            '{}'::text[]
          ),
          editorial_version=v_draft_version,
          page_status='published',
          published_at=now(),
          published_by=v_user_id,
          last_reviewed_at=current_date,
          updated_at=now()
      where id=p_page_id
      returning jsonb_build_object(
        'page_status',page_status,
        'workflow_status',workflow_status,
        'live_version',editorial_version,
        'draft_version',draft_version,
        'published_at',published_at,
        'last_reviewed_at',last_reviewed_at
      ) into v_after;
    else
      update public.steel_knowledge_grade_pages
      set seo_title=v_payload->>'seo_title',
          seo_description=v_payload->>'seo_description',
          intro=v_payload->>'intro',
          designation_explanation=v_payload->>'designation_explanation',
          typical_applications=nullif(v_payload->>'typical_applications',''),
          editorial_sections=v_payload->'editorial_sections',
          faq=v_payload->'faq',
          source_references=v_payload->'source_references',
          related_grade_slugs=coalesce(
            array(select jsonb_array_elements_text(v_payload->'related_slugs')),
            '{}'::text[]
          ),
          editorial_version=v_draft_version,
          page_status='published',
          published_at=now(),
          published_by=v_user_id,
          last_reviewed_at=current_date,
          updated_at=now()
      where id=p_page_id
      returning jsonb_build_object(
        'page_status',page_status,
        'workflow_status',workflow_status,
        'live_version',editorial_version,
        'draft_version',draft_version,
        'published_at',published_at,
        'last_reviewed_at',last_reviewed_at
      ) into v_after;
    end if;
  else
    if v_page_status<>'published' then
      return jsonb_build_object(
        'page_id',p_page_id,'content_type',v_type,
        'page_status',v_page_status,'workflow_status',v_status,
        'idempotent_replay',true
      );
    end if;

    if v_type='standard' then
      update public.steel_knowledge_standard_pages
      set page_status='archived',
          updated_at=now()
      where id=p_page_id
      returning jsonb_build_object(
        'page_status',page_status,
        'workflow_status',workflow_status,
        'live_version',editorial_version,
        'draft_version',draft_version
      ) into v_after;
    else
      update public.steel_knowledge_grade_pages
      set page_status='archived',
          updated_at=now()
      where id=p_page_id
      returning jsonb_build_object(
        'page_status',page_status,
        'workflow_status',workflow_status,
        'live_version',editorial_version,
        'draft_version',draft_version
      ) into v_after;
    end if;
  end if;

  perform private.sa7_record_knowledge_action(
    'knowledge.publish',
    case when v_action='publish'
      then 'knowledge_page_published'
      else 'knowledge_page_unpublished'
    end,
    v_type,
    p_page_id,
    jsonb_build_object(
      'page_status',v_page_status,
      'workflow_status',v_status,
      'live_version',v_live_version,
      'draft_version',v_draft_version
    ),
    v_after,
    v_note
  );

  return v_after || jsonb_build_object('page_id',p_page_id,'content_type',v_type);
end;
$function$;

revoke all on function private.sa7_publish_knowledge_page_impl(text,uuid,text,text)
  from public,anon,authenticated;

create or replace function public.sa7_publish_knowledge_page(
  p_content_type text,
  p_page_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $function$
  select private.sa7_publish_knowledge_page_impl(p_content_type,p_page_id,p_action,p_note);
$function$;

revoke all on function public.sa7_publish_knowledge_page(text,uuid,text,text)
  from public,anon;
grant execute on function public.sa7_publish_knowledge_page(text,uuid,text,text)
  to authenticated,service_role;

comment on column public.steel_knowledge_standard_pages.draft_payload is
  'SA7 isolated editorial draft. Public K2/K3 reads continue to use live columns only until an approved draft is published.';
comment on column public.steel_knowledge_grade_pages.draft_payload is
  'SA7 isolated editorial draft. Public K2/K4 reads continue to use live columns only until an approved draft is published.';
comment on column public.steel_knowledge_standard_pages.workflow_status is
  'SA7 editorial workflow state, separate from public page_status.';
comment on column public.steel_knowledge_grade_pages.workflow_status is
  'SA7 editorial workflow state, separate from public page_status.';
comment on function public.sa7_save_knowledge_draft(text,uuid,jsonb,text) is
  'SA7 Knowledge Editor draft save. Never mutates the currently published live copy.';
comment on function public.sa7_review_knowledge_draft(text,uuid,text,text) is
  'SA7 Knowledge review decision. Approval does not publish.';
comment on function public.sa7_publish_knowledge_page(text,uuid,text,text) is
  'SA7 Knowledge Publisher-only publication transition. Copies an approved isolated draft to the public live fields atomically.';

do $sa7$
begin
  if exists (
    select 1
    from public.steel_knowledge_standard_pages
    where page_status='published'
      and workflow_status<>'approved'
  ) or exists (
    select 1
    from public.steel_knowledge_grade_pages
    where page_status='published'
      and workflow_status<>'approved'
  ) then
    raise exception 'SA7 published Knowledge pages must start from approved workflow state';
  end if;

  if has_table_privilege('authenticated','public.steel_knowledge_standard_pages','SELECT')
     or has_table_privilege('authenticated','public.steel_knowledge_grade_pages','SELECT') then
    raise exception 'SA7 Knowledge editorial tables must remain inaccessible directly to browser roles';
  end if;
end
$sa7$;
