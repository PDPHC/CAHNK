begin;
create temporary table attendance_qa(n int,room_id uuid,user_id uuid,student_id uuid,blocked_id uuid,absent_id uuid);
do $$ declare who uuid;rid uuid;sid uuid;bid uuid;aid uuid;i int;begin
 select id into who from public.profiles where role='teacher' limit 1;
 for i in 1..3 loop
 insert into public.classrooms(class_level,room,academic_year,term,created_by) values(case when i=2 then 'ม.1' else 'ป.1' end,'ATTENDANCE-QA-'||i,9999,1,who) returning id into rid;
 insert into public.classroom_teachers(classroom_id,teacher_id,permission) values(rid,who,case when i=3 then 'viewer' else 'editor' end);
 insert into public.students(classroom_id,student_code,full_name,sort_order,client_uid) values(rid,'QA-STUDENT','QA pupil',1,gen_random_uuid()::text) returning id into sid;
 insert into public.students(classroom_id,student_code,full_name,sort_order,client_uid,record_status) values(rid,'QA-BLOCKED','QA transferred',2,gen_random_uuid()::text,'transferred') returning id into bid;
 insert into public.students(classroom_id,student_code,full_name,sort_order,client_uid,record_status) values(rid,'QA-ABSENT','QA not present',3,gen_random_uuid()::text,'not_present') returning id into aid;
 insert into attendance_qa values(i,rid,who,sid,bid,aid);
 end loop;perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
end $$;
grant select on attendance_qa to authenticated;set local role authenticated;
do $$ declare rid uuid;who uuid;sid uuid;bid uuid;aid uuid;payload jsonb;bad jsonb;denied bool;i int;begin
 select room_id,user_id,student_id,blocked_id,absent_id into rid,who,sid,bid,aid from attendance_qa where n=1;
 payload:=jsonb_build_object('version',1,'start','2026-05-18','holidays',jsonb_build_array(jsonb_build_object('date','2026-05-19','name','QA holiday')),'marks',jsonb_build_object(sid::text,jsonb_build_object('2026-05-18','/')));
 insert into public.pp5_primary_attendance(classroom_id,term,data,updated_by) values(rid,1,payload,who);
 update public.pp5_primary_attendance set revision=2,data=payload where classroom_id=rid and revision=1;
 if not exists(select 1 from public.pp5_primary_attendance where classroom_id=rid and revision=2) then raise exception 'Save/reload failed';end if;
 update public.pp5_primary_attendance set revision=2,data=payload where classroom_id=rid and revision=1;if found then raise exception 'Stale accepted';end if;
 for i in 1..7 loop denied:=false;begin
 if i=1 then bad:=jsonb_set(payload,array['marks',sid::text,'2026-05-18'],'"X"');
 elsif i=2 then bad:=jsonb_set(payload,array['marks',sid::text,'2026-05-19'],'"/"');
 elsif i=3 then bad:=jsonb_set(payload,array['marks',sid::text,'2026-05-23'],'"/"');
 elsif i=4 then bad:=jsonb_set(payload,array['marks',sid::text,'2027-01-01'],'"/"');
 elsif i=5 then bad:=jsonb_set(payload,array['marks',bid::text],payload->'marks'->sid::text);
 elsif i=6 then bad:=jsonb_set(payload,array['marks',aid::text],payload->'marks'->sid::text);
 else bad:=jsonb_set(payload,array['marks',gen_random_uuid()::text],payload->'marks'->sid::text);end if;
 update public.pp5_primary_attendance set revision=3,data=bad where classroom_id=rid;
 exception when others then denied:=true;end;if not denied then raise exception 'Expected rejection %',i;end if;end loop;
 for i in 2..3 loop denied:=false;begin insert into public.pp5_primary_attendance(classroom_id,term,data,updated_by) select room_id,1,jsonb_build_object('version',1,'start','2026-05-18','holidays','[]'::jsonb,'marks','{}'::jsonb),user_id from attendance_qa where n=i;
 exception when others then denied:=true;end;if not denied then raise exception 'Secondary/viewer write accepted';end if;end loop;
insert into public.pp5_primary_attendance(classroom_id,term,data,updated_by) values(rid,2,jsonb_build_object('version',1,'start','2026-11-01','holidays',jsonb_build_array(jsonb_build_object('date','2027-01-01','name','New Year')),'marks',jsonb_build_object(sid::text,jsonb_build_object('2026-11-02','ป'))),who);
 if not exists(select 1 from public.pp5_primary_attendance where classroom_id=rid and term=1 and data=payload and revision=2) then raise exception 'Term 1 was changed by term 2';end if;
 if not exists(select 1 from public.pp5_primary_attendance where classroom_id=rid and term=2 and revision=1) then raise exception 'Term 2 missing';end if;
end $$;
reset role;rollback;
select 'PASS: primary attendance save/reload, revisions, symbols, holidays/weekends/outside 100 days, transferred/not-present/foreign pupil, secondary/viewer restrictions; fixtures rolled back' as checks;
