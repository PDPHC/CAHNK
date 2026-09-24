BEGIN;
CREATE TEMP TABLE delete_test_ids AS SELECT gen_random_uuid() actor,gen_random_uuid() target,gen_random_uuid() room,gen_random_uuid() sub,gen_random_uuid() archive;
GRANT SELECT ON delete_test_ids TO authenticated;
INSERT INTO auth.users(id,email) SELECT actor,actor::text||'@example.invalid' FROM delete_test_ids UNION ALL SELECT target,target::text||'@example.invalid' FROM delete_test_ids;
UPDATE public.profiles SET role='admin' WHERE id=(SELECT actor FROM delete_test_ids);
INSERT INTO public.classrooms(id,class_level,room,academic_year,term,created_by) SELECT room,'TEST',actor::text,2569,1,target FROM delete_test_ids;
INSERT INTO public.classroom_teachers(classroom_id,teacher_id) SELECT room,target FROM delete_test_ids;
INSERT INTO public.classroom_submissions(id,classroom_id,report_month,due_date,status,submitted_by) SELECT sub,room,'2026-08-01','2026-09-05','approved',target FROM delete_test_ids;
INSERT INTO public.submission_comments(submission_id,author_id,comment) SELECT sub,target,'preserve test comment' FROM delete_test_ids;
INSERT INTO public.classroom_monthly_archives(id,submission_id,classroom_id,academic_year,term,report_month,due_date,approved_by,approved_name,approved_at,snapshot) SELECT archive,sub,room,2569,1,'2026-08-01','2026-09-05',target,'Preserved signer',now(),'{"test":true}'::jsonb FROM delete_test_ids;
UPDATE public.profiles SET role='teacher' WHERE id=(SELECT actor FROM delete_test_ids);
SELECT set_config('request.jwt.claim.sub',(SELECT actor::text FROM delete_test_ids),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.return_archived_book((SELECT archive FROM delete_test_ids),'test reason'); RAISE EXCEPTION 'Unexpected return allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.profiles SET role='academic' WHERE id=(SELECT actor FROM delete_test_ids);
SELECT set_config('request.jwt.claim.sub',(SELECT actor::text FROM delete_test_ids),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.return_archived_book((SELECT archive FROM delete_test_ids),'test reason'); RAISE EXCEPTION 'Unexpected return allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.profiles SET role='director' WHERE id=(SELECT actor FROM delete_test_ids);
SELECT set_config('request.jwt.claim.sub',(SELECT actor::text FROM delete_test_ids),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.return_archived_book((SELECT archive FROM delete_test_ids),'test reason'); RAISE EXCEPTION 'Unexpected return allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.profiles SET role='admin' WHERE id=(SELECT actor FROM delete_test_ids);
SELECT set_config('request.jwt.claim.sub',(SELECT actor::text FROM delete_test_ids),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.return_archived_book((SELECT archive FROM delete_test_ids),'test reason'); RAISE EXCEPTION 'Unexpected return allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE public.profiles SET role='deputy_director' WHERE id=(SELECT actor FROM delete_test_ids);
SELECT set_config('request.jwt.claim.sub',(SELECT actor::text FROM delete_test_ids),true);
SET LOCAL ROLE authenticated;
SELECT public.return_archived_book((SELECT archive FROM delete_test_ids),'ตรวจการมาเรียนใหม่');
RESET ROLE;
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM public.classroom_submissions WHERE id=(SELECT sub FROM delete_test_ids) AND status='returned_by_academic' AND approved_at IS NULL AND academic_approved_at IS NULL) THEN RAISE EXCEPTION 'Not returned'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.submission_comments WHERE submission_id=(SELECT sub FROM delete_test_ids) AND comment='preserve test comment') THEN RAISE EXCEPTION 'Comment lost'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.workflow_events WHERE classroom_id=(SELECT room FROM delete_test_ids) AND action='reopened' AND snapshot='{"test":true}'::jsonb) THEN RAISE EXCEPTION 'Snapshot lost'; END IF;
IF EXISTS(SELECT 1 FROM public.classroom_monthly_archives WHERE id=(SELECT archive FROM delete_test_ids)) THEN RAISE EXCEPTION 'Archive still active'; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','',true);
UPDATE public.classroom_submissions SET status='submitted_to_academic' WHERE id=(SELECT sub FROM delete_test_ids);
UPDATE public.classroom_submissions SET status='forwarded_to_deputy' WHERE id=(SELECT sub FROM delete_test_ids);
UPDATE public.profiles SET role='deputy_director' WHERE id=(SELECT actor FROM delete_test_ids);
SELECT set_config('request.jwt.claim.sub',(SELECT actor::text FROM delete_test_ids),true);
SET LOCAL ROLE authenticated;
UPDATE public.classroom_submissions SET status='approved' WHERE id=(SELECT sub FROM delete_test_ids);
RESET ROLE;
DO $$ BEGIN
IF (SELECT count(*) FROM public.classroom_monthly_archives WHERE submission_id=(SELECT sub FROM delete_test_ids))<>1 THEN RAISE EXCEPTION 'Reapproval archive failed'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.workflow_events WHERE classroom_id=(SELECT room FROM delete_test_ids) AND action='reopened') THEN RAISE EXCEPTION 'History disappeared'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: return keeps snapshot and comments, clears approvals, reopens teacher editing; fixtures rolled back' result;