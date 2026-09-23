-- PA2.30.10 operational bridge — service-role-only transfer chunk writer.
-- Temporary upload bridge writes archive chunks through this RPC; no anon/authenticated access.

create or replace function public.p1_store_offer_source_recovery_transfer_chunk(
  p_transfer_id text,
  p_part_no integer,
  p_payload_base64 text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_transfer_id text := nullif(btrim(coalesce(p_transfer_id,'')),'');
  payload text := nullif(coalesce(p_payload_base64,''),'');
begin
  if v_transfer_id is null then
    return jsonb_build_object('status','blocked','reason','transfer_id_required');
  end if;
  if p_part_no is null or p_part_no<0 then
    return jsonb_build_object('status','blocked','reason','invalid_part_no');
  end if;
  if payload is null or length(payload)>200000 then
    return jsonb_build_object('status','blocked','reason','invalid_payload_chunk');
  end if;
  if payload !~ '^[A-Za-z0-9+/=]+$' then
    return jsonb_build_object('status','blocked','reason','payload_not_base64');
  end if;

  insert into private.commercial_offer_recovery_transfer_chunks(
    transfer_id,part_no,payload_base64
) values (v_transfer_id,p_part_no,payload)
  on conflict (transfer_id,part_no)
  do update set payload_base64=excluded.payload_base64,created_at=now();

  return jsonb_build_object(
    'status','stored',
    'transfer_id',v_transfer_id,
    'part_no',p_part_no,
    'payload_length',length(payload),
    'control_phase','PA2.30.10'
  );
end;
$$;

revoke all on function public.p1_store_offer_source_recovery_transfer_chunk(text,integer,text)
from public,anon,authenticated;
grant execute on function public.p1_store_offer_source_recovery_transfer_chunk(text,integer,text)
to service_role;
