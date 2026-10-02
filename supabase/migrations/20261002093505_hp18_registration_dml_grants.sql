-- HP18 — Production Journey Acceptance
-- The registration UI writes draft applications through the authenticated
-- PostgREST role. RLS already constrains INSERT/UPDATE to the authenticated
-- applicant and editable states; restore only the DML grants needed by that UI.

grant insert, update
on table public.company_registration_applications
to authenticated;
