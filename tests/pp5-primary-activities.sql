begin;
create temporary table primary_activities_qa(n int,room_id uuid,user_id uuid,student_id uuid,blocked_id uuid);
do $$ declare who uuid;rid uuid;sid uuid;bid uuid;i int;begin
 select id into who from public.profiles where role='teacher' limit 1;
 for i in 1..3 loop
 insert into public.classrooms(class_level,room,academic_year,term,created_by) values(case when i=2 then 'ม.1' else 'ป.1' end,'ACTIVITIES-QA-'||i,9999,1,who) returning id into rid;
 insert into public.classroom_teachers(classroom_id,teacher_id,permission) values(rid,who,case when i=3 then 'viewer' else 'editor' end);
 insert into public.students(classroom_id,student_code,full_name,sort_order,client_uid) values(rid,'QA-STUDENT','QA pupil',1,gen_random_uuid()::text) returning id into sid;
 insert into public.students(classroom_id,student_code,full_name,sort_order,client_uid,record_status) values(rid,'QA-BLOCKED','QA blocked',2,gen_random_uuid()::text,'transferred') returning id into bid;
 insert into primary_activities_qa values(i,rid,who,sid,bid);
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
end $$;
grant select on primary_activities_qa to authenticated;
set local role authenticated;
do $$ declare rid uuid;who uuid;sid uuid;bid uuid;payload jsonb;denied bool;i int;bad jsonb;begin
 select room_id,user_id,student_id,blocked_id into rid,who,sid,bid from primary_activities_qa where n=1;
 payload:=jsonb_build_object('version',1,'scores',jsonb_build_object(sid::text,to_jsonb(array_fill('pass'::text,array[4]))));
 payload:=jsonb_set(payload,array['scores',sid::text,'0'],'"fail"');
 insert into public.pp5_primary_activities(classroom_id,data,updated_by) values(rid,payload,who);
 update public.pp5_primary_activities set data=payload,revision=2 where classroom_id=rid and revision=1;
 if not exists(select 1 from public.pp5_primary_activities where classroom_id=rid and revision=2) then raise exception 'Save/reload failed';end if;
 update public.pp5_primary_activities set data=payload,revision=2 where classroom_id=rid and revision=1;
 if found then raise exception 'Stale update accepted';end if;
 for i in 1..6 loop
 denied:=false;
 begin
 if i=1 then bad:=jsonb_set(payload,array['scores',sid::text,'0'],'4');
 elsif i=2 then bad:=jsonb_set(payload,array['scores',sid::text,'0'],'"invalid"');
 elsif i=3 then bad:=jsonb_set(payload,array['scores',sid::text],'["pass","pass","pass"]');
 elsif i=4 then bad:=jsonb_set(payload,array['scores',bid::text],payload->'scores'->sid::text);
 elsif i=5 then bad:=jsonb_set(payload,array['scores',gen_random_uuid()::text],payload->'scores'->sid::text);
 else bad:=jsonb_set(payload,array['version'],'2');end if;
 update public.pp5_primary_activities set data=bad,revision=3 where classroom_id=rid;
 exception when others then denied:=true;end;
 if not denied then raise exception 'Expected rejection %',i;end if;
 end loop;
 for i in 2..3 loop
 denied:=false;
 begin insert into public.pp5_primary_activities(classroom_id,data,updated_by) select room_id,jsonb_build_object('version',1,'scores','{}'::jsonb),user_id from primary_activities_qa where n=i;
 exception when others then denied:=true;end;
 if not denied then raise exception 'Secondary/viewer write accepted';end if;
 end loop;
end $$;
reset role;rollback;
select 'PASS: primary activities save/reload, revisions, four pass/fail values and version, blocked and foreign pupils, secondary/viewer restrictions; fixtures rolled back' as checks;
