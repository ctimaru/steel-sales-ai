-- NET-LAUNCH5E: keep private browse implementation non-executable by authenticated.
-- Its definer checks auth.uid(), active organization membership, and Free/Pro entitlement.
CREATE OR REPLACE FUNCTION public.netlaunch4b_browse_page(
 p_organization_id uuid,p_access text,p_source text,
 p_query text DEFAULT NULL,p_role text DEFAULT NULL,p_region text DEFAULT NULL,
 p_persona text DEFAULT NULL,p_page integer DEFAULT 1,p_limit integer DEFAULT 18
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 SELECT private.netlaunch4b_browse_page_impl(
  p_organization_id,p_access,p_source,p_query,p_role,p_region,p_persona,p_page,p_limit
 )
$function$;
REVOKE ALL ON FUNCTION public.netlaunch4b_browse_page(uuid,text,text,text,text,text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.netlaunch4b_browse_page(uuid,text,text,text,text,text,text,integer,integer) TO authenticated;
