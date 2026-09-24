BEGIN;
CREATE TEMP TABLE validation_test_ids(t uuid,c uuid);
INSERT INTO validation_test_ids VALUES(gen_random_uuid(),gen_random_uuid());
INSERT INTO auth.users(id,email) SELECT t,t||'@example.invalid' FROM validation_test_ids;
UPDATE public.profiles SET role='teacher' WHERE id=(SELECT t FROM validation_test_ids);
INSERT INTO public.classrooms(id,class_level,room,academic_year,term,open_date,close_date,holidays)
SELECT c,'TEST',c::text,2569,1,'2026-08-03','2026-08-04','[{"date":"2026-08-04","name":"test holiday"}]' FROM validation_test_ids;
INSERT INTO public.classroom_teachers(classroom_id,teacher_id) SELECT c,t FROM validation_test_ids;
INSERT INTO public.students(classroom_id,client_uid,full_name) SELECT c,'fixture-student','นักเรียนทดสอบ' FROM validation_test_ids;
GRANT SELECT ON validation_test_ids TO authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT t::text FROM validation_test_ids),true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE e jsonb; BEGIN
 e:=public.validate_monthly_submission((SELECT c FROM validation_test_ids),'2026-08-01');
 IF jsonb_array_length(e)<>6 THEN RAISE EXCEPTION 'Expected six missing modules: %',e; END IF;
 BEGIN
  INSERT INTO public.classroom_submissions(classroom_id,report_month,due_date,status,submitted_by)
  SELECT c,'2026-08-01','2026-09-05','submitted_to_academic',t FROM validation_test_ids;
  RAISE EXCEPTION 'Incomplete submit accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Incomplete submit accepted' THEN RAISE; END IF; END;
END $$;
INSERT INTO public.module_data(classroom_id,module_name,data,updated_by)
SELECT c,x.name,x.data,t FROM validation_test_ids CROSS JOIN (VALUES
 ('attendance','{"2026-08":{"fixture-student":{"3":"/"}}}'::jsonb),
 ('behavior','{"2026-08":{"fixture-student":{"rating":"ดี"}}}'::jsonb),
 ('health','{"2026-08":{"fixture-student":{"age":"13","weight":"45","height":"150","hair":"3","hygiene":"2","clothes":"3","mouth":"3"}}}'::jsonb),
 ('homeroom','{"rows":[{"date":"2026-08-03","hmMath":true}]}'::jsonb),
 ('report_checks','{"2026-08":{"savings_none":true,"scholarship_none":true}}'::jsonb)
) x(name,data);
DO $$ DECLARE e jsonb;k text;saved jsonb; BEGIN
 e:=public.validate_monthly_submission((SELECT c FROM validation_test_ids),'2026-08-01');
 IF e<>'[]'::jsonb THEN RAISE EXCEPTION 'Complete with exceptions should pass: %',e; END IF;
 FOREACH k IN ARRAY ARRAY['attendance','behavior','health','homeroom'] LOOP
  SELECT data INTO saved FROM public.module_data WHERE classroom_id=(SELECT c FROM validation_test_ids) AND module_name=k;
  UPDATE public.module_data SET data='{}' WHERE classroom_id=(SELECT c FROM validation_test_ids) AND module_name=k;
  e:=public.validate_monthly_submission((SELECT c FROM validation_test_ids),'2026-08-01');
  IF NOT e @> jsonb_build_array(jsonb_build_object('module',k)) THEN RAISE EXCEPTION 'Missing required module accepted: %',k; END IF;
  UPDATE public.module_data SET data=saved WHERE classroom_id=(SELECT c FROM validation_test_ids) AND module_name=k;
 END LOOP;
END $$;
INSERT INTO public.classroom_submissions(classroom_id,report_month,due_date,status,submitted_by) SELECT c,'2026-08-01','2026-09-05','submitted_to_academic',t FROM validation_test_ids;
INSERT INTO public.module_data(classroom_id,module_name,data,updated_by) SELECT c,'savings','{"2026-08":{"fixture-student":{"3":"10"}}}',t FROM validation_test_ids;
DO $$ DECLARE e jsonb; BEGIN
 e:=public.validate_monthly_submission((SELECT c FROM validation_test_ids),'2026-08-01');
 IF NOT e @> '[{"module":"savings"}]'::jsonb THEN RAISE EXCEPTION 'Conflicting savings declaration accepted'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: four mandatory forms, explicit savings/scholarship exceptions, optional volunteer, holiday exclusion, direct incomplete insert rejected, valid insert accepted, conflicting declaration rejected; all fixtures rolled back' AS result;

