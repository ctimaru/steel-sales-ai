-- TRUST-AUDIT1C.2F: authenticated RLS knowledge acceptance on a clean staging DB.
-- Test fixtures are synthetic; the entire transaction is rolled back.
BEGIN;
INSERT INTO public.knowledge_sources(id,access_scope,source_key,source_type,source_class,name)
VALUES('44444444-4444-4444-8444-000000000001','global','trust-c2f-synthetic-source','website','official','TRUST C2F synthetic fixture');
INSERT INTO public.knowledge_documents(id,source_id,document_type,content_checksum,status)
VALUES
('44444444-4444-4444-8444-000000000002','44444444-4444-4444-8444-000000000001','webpage',repeat('c',64),'ready'),
('44444444-4444-4444-8444-000000000003','44444444-4444-4444-8444-000000000001','webpage',repeat('d',64),'superseded');
INSERT INTO public.knowledge_chunks(source_id,document_id,chunk_index,content,content_checksum)
VALUES
('44444444-4444-4444-8444-000000000001','44444444-4444-4444-8444-000000000002',0,'synthetic ready chunk',repeat('e',64)),
('44444444-4444-4444-8444-000000000001','44444444-4444-4444-8444-000000000003',0,'synthetic quarantined chunk',repeat('f',64));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-000000000004',true);
DO $trust$
BEGIN
  IF (SELECT count(*) FROM public.knowledge_documents WHERE id='44444444-4444-4444-8444-000000000002')<>1 THEN
    RAISE EXCEPTION 'TRUST-C2F: ready document must remain visible';
  END IF;
  IF (SELECT count(*) FROM public.knowledge_documents WHERE id='44444444-4444-4444-8444-000000000003')<>0 THEN
    RAISE EXCEPTION 'TRUST-C2F: quarantined document must be hidden';
  END IF;
  IF (SELECT count(*) FROM public.knowledge_chunks WHERE document_id='44444444-4444-4444-8444-000000000002')<>1 THEN
    RAISE EXCEPTION 'TRUST-C2F: ready chunk must remain visible';
  END IF;
  IF (SELECT count(*) FROM public.knowledge_chunks WHERE document_id='44444444-4444-4444-8444-000000000003')<>0 THEN
    RAISE EXCEPTION 'TRUST-C2F: quarantined chunk must be hidden';
  END IF;
END $trust$;
SELECT
 (SELECT count(*) FROM public.knowledge_documents WHERE id='44444444-4444-4444-8444-000000000002') AS visible_ready_docs,
 (SELECT count(*) FROM public.knowledge_documents WHERE id='44444444-4444-4444-8444-000000000003') AS visible_quarantined_docs,
 (SELECT count(*) FROM public.knowledge_chunks WHERE document_id='44444444-4444-4444-8444-000000000002') AS visible_ready_chunks,
 (SELECT count(*) FROM public.knowledge_chunks WHERE document_id='44444444-4444-4444-8444-000000000003') AS visible_quarantined_chunks;
ROLLBACK;
