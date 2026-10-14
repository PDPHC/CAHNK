begin;
create temporary table primary_score_qa(n int,room_id uuid,user_id uuid,student_id uuid,blocked_id uuid);
do $$ declare who uuid;rid uuid;sid uuid;bid uuid;i int;begin
 select id into who from public.profiles where role='teacher' limit 1;
 for i in 1..3 loop
 insert into public.classrooms(class_level,room,academic_year,term,created_by) values(case when i=2 then 'ม.1' else 'ป.4' end,'SCORE-QA-'||i,9999,1,who) returning id into rid;
 insert into public.classroom_teachers(classroom_id,teacher_id,permission) values(rid,who,case when i=3 then 'viewer' else 'editor' end);
 insert into public.students(classroom_id,student_code,full_name,sort_order,client_uid) values(rid,'QA-STUDENT','QA pupil',1,gen_random_uuid()::text) returning id into sid;
 insert into public.students(classroom_id,student_code,full_name,sort_order,client_uid,record_status) values(rid,'QA-BLOCKED','QA blocked',2,gen_random_uuid()::text,'transferred') returning id into bid;
 if i<>2 then insert into public.pp5_primary_structures(classroom_id,data,updated_by) values(rid,'{"courses":[{"code":"QA101","name":"QA course","type":"พื้นฐาน","hours":160,"weight":4}],"activities":[],"ratio":{"collect":40,"exam":10}}',who);end if;
 insert into primary_score_qa values(i,rid,who,sid,bid);
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
end $$;
grant select on primary_score_qa to authenticated;
set local role authenticated;
do $$ declare rid uuid;who uuid;sid uuid;bid uuid;config jsonb;marks jsonb;payload jsonb;denied bool;i int; begin
 select room_id,user_id,student_id,blocked_id into rid,who,sid,bid from primary_score_qa where n=1;
 config:=jsonb_build_object('tasks',to_jsonb(array_fill(10,array[16])),'mid',0);
 marks:=jsonb_build_object('tasks',to_jsonb(array_fill(5,array[16])),'mid',null,'final',5);
 payload:=jsonb_build_object('maxima',jsonb_build_array(config,config),'scores',jsonb_build_object(sid::text,jsonb_build_object('terms',jsonb_build_array(marks,marks))));
 insert into public.pp5_primary_course_scores(classroom_id,course_code,data,updated_by) values(rid,'QA101',payload,who);
 update public.pp5_primary_course_scores set data=payload,revision=2 where classroom_id=rid and course_code='QA101' and revision=1;
 if not exists(select 1 from public.pp5_primary_course_scores where classroom_id=rid and revision=2) then raise exception 'Save/reload failed';end if;
 update public.pp5_primary_course_scores set data=payload,revision=2 where classroom_id=rid and revision=1;
 if found then raise exception 'Stale update accepted';end if;
 for i in 1..4 loop
 denied:=false;
 begin
 if i=1 then update public.pp5_primary_course_scores set data=jsonb_set(payload,array['scores',sid::text,'terms','0','tasks','0'],'11'),revision=3 where classroom_id=rid;
 elsif i=2 then update public.pp5_primary_course_scores set data=jsonb_set(payload,array['scores',bid::text],payload->'scores'->sid::text),revision=3 where classroom_id=rid;
 elsif i=3 then insert into public.pp5_primary_course_scores(classroom_id,course_code,data,updated_by) values(rid,'OTHER',payload,who);
 else update public.pp5_primary_course_scores set data=jsonb_set(payload,array['scores',gen_random_uuid()::text],payload->'scores'->sid::text),revision=3 where classroom_id=rid;end if;
 exception when others then denied:=true;end;
 if not denied then raise exception 'Expected rejection %',i;end if;
 end loop;
 for i in 2..3 loop
 denied:=false;
 begin insert into public.pp5_primary_course_scores(classroom_id,course_code,data,updated_by) select room_id,'QA101',jsonb_build_object('maxima',jsonb_build_array(config,config),'scores','{}'::jsonb),user_id from primary_score_qa where n=i;
 exception when others then denied:=true;end;
 if not denied then raise exception 'Secondary/viewer write accepted';end if;
 end loop;
end $$;
reset role;rollback;
select 'PASS: primary per-course save/reload, revision conflict, score cap, blocked pupil, unknown course, foreign pupil, secondary and viewer write restrictions; fixtures rolled back' as checks;
