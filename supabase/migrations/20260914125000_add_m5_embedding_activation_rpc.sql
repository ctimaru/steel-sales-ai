create or replace function public.activate_embedding_model(p_model_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_model public.knowledge_embedding_models%rowtype;
begin
  select * into target_model
  from public.knowledge_embedding_models
  where model_key = p_model_key
  for update;

  if not found then
    raise exception 'Unknown embedding model: %', p_model_key;
  end if;

  update public.knowledge_embedding_models
  set status = 'candidate', updated_at = now()
  where status = 'active' and id <> target_model.id;

  update public.knowledge_embedding_models
  set status = 'active', updated_at = now()
  where id = target_model.id;

  return jsonb_build_object(
    'model_key', target_model.model_key,
    'model_name', target_model.model_name,
    'dimensions', target_model.dimensions,
    'status', 'active'
  );
end;
$$;

revoke all on function public.activate_embedding_model(text) from public, anon, authenticated;
grant execute on function public.activate_embedding_model(text) to service_role;

comment on function public.activate_embedding_model(text) is
  'Atomically promotes one benchmarked embedding model to active and demotes any previous active model to candidate.';
