-- STAGING-READY1: intentionally read-only first-deploy guard.
-- The workflow validates the exact database target before executing this file.
-- A remote DB with any application tables or users must never be migrated
-- with the bootstrap workflow, to prevent accidental data loss or takeover.
DO $staging_ready1_pristine$
BEGIN
  IF (SELECT count(*) FROM auth.users) > 0 THEN
    RAISE EXCEPTION 'Unsafe staging state: existing auth users found';
  END IF;
  IF (SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE') > 0 THEN
    RAISE EXCEPTION 'Unsafe staging state: existing public tables found';
  END IF;
END;
$staging_ready1_pristine$;
