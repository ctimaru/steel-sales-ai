-- HOME-REVIEW1 (founder review, 20 Nov 2026): «Capacità disponibile» posts may
-- say what can be worked («Gamma lavorabile»: diameters, thicknesses, lengths).
-- Same function as CPOST2 with one optional text field, `range` (max 80).
-- Every other rule and field is unchanged; existing posts are not touched.

create or replace function private.cpost2_normalize_details(p_post_type text, p_details jsonb)
returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  v_in    jsonb := coalesce(p_details, '{}'::jsonb);
  v_from  date;
  v_to    date;
  v_today date := (now() at time zone 'Europe/Rome')::date;
begin
  if jsonb_typeof(v_in) <> 'object' then
    raise exception 'post details must be an object' using errcode = '22023';
  end if;

  if p_post_type = 'news' then
    return '{}'::jsonb;

  elsif p_post_type = 'capacity' then
    if coalesce(v_in ->> 'process', '') not in
       ('taglio','curvatura','saldatura','laser','foratura','filettatura','zincatura',
        'verniciatura','trattamento_termico','lavorazione_meccanica','altro') then
      raise exception 'invalid capacity process' using errcode = '22023';
    end if;
    v_from := private.cpost2_date(v_in, 'available_from', false);
    v_to   := private.cpost2_date(v_in, 'available_to', false);
    if v_to is not null and v_to < v_today then
      raise exception 'capacity period already ended' using errcode = '22023';
    end if;
    if v_from is not null and v_to is not null and v_to < v_from then
      raise exception 'capacity period ends before it starts' using errcode = '22023';
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
      'process',        v_in ->> 'process',
      'process_detail', private.cpost2_text(v_in, 'process_detail', 120, v_in ->> 'process' = 'altro'),
      'range',          private.cpost2_text(v_in, 'range', 80, false),
      'available_from', v_from,
      'available_to',   v_to,
      'quantity',       private.cpost2_text(v_in, 'quantity', 80, false),
      'location',       private.cpost2_text(v_in, 'location', 120, false)
    ));

  elsif p_post_type = 'stock' then
    if v_in ? 'certificate_31' and jsonb_typeof(v_in -> 'certificate_31') <> 'boolean' then
      raise exception 'invalid post detail: certificate_31' using errcode = '22023';
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
      'product',        private.cpost2_text(v_in, 'product', 120, true),
      'standard',       private.cpost2_text(v_in, 'standard', 60, false),
      'grade',          private.cpost2_text(v_in, 'grade', 60, false),
      'dimensions',     private.cpost2_text(v_in, 'dimensions', 80, false),
      'quantity',       private.cpost2_text(v_in, 'quantity', 80, false),
      'location',       private.cpost2_text(v_in, 'location', 120, false),
      'certificate_31', case when (v_in -> 'certificate_31') = 'true'::jsonb then true end
    ));

  elsif p_post_type = 'event' then
    v_from := private.cpost2_date(v_in, 'date_from', true);
    v_to   := private.cpost2_date(v_in, 'date_to', false);
    if coalesce(v_to, v_from) < v_today then
      raise exception 'event already ended' using errcode = '22023';
    end if;
    if v_to is not null and v_to < v_from then
      raise exception 'event ends before it starts' using errcode = '22023';
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
      'name',      private.cpost2_text(v_in, 'name', 120, true),
      'date_from', v_from,
      'date_to',   v_to,
      'location',  private.cpost2_text(v_in, 'location', 120, true),
      'stand',     private.cpost2_text(v_in, 'stand', 40, false)
    ));
  end if;

  raise exception 'invalid post type' using errcode = '22023';
end;
$$;

revoke all on function private.cpost2_normalize_details(text, jsonb) from public, anon, authenticated;
