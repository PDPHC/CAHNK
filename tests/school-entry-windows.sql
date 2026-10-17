-- Isolated fixtures: every change is rolled back, including all test news/settings.
begin;
create temporary table window_qa(n int,room_id uuid,teacher uuid,student uuid,admin_id uuid);
do $$ declare who uuid;adm uuid;rid uuid;sid uuid;i int;begin
 select id into who from public.profiles where role='teacher' limit 1;
 select id into adm from public.profiles where role='admin' limit 1;
 if who is null or adm is null then raise exception 'Missing QA role';end if;
 for i in 1..4 loop
  insert into public.classrooms(class_level,room,academic_year,term,created_by) values(case when i=2 then 'มัธยมศึกษาปีที่ ๑' else 'ป.1' end,'ENTRY-WINDOW-QA-'||i,case when i=3 then 2798 else 2799 end,case when i=4 then 2 else 1 end,who) returning id into rid;
  insert into public.classroom_teachers(classroom_id,teacher_id,permission) values(rid,who,'editor');
  insert into public.students(classroom_id,student_code,full_name,sort_order,client_uid) values(rid,'QA-WINDOW','เด็กชายทดสอบ',1,gen_random_uuid()::text) returning id into sid;
  if i<>2 then insert into public.pp5_primary_structures(classroom_id,data,updated_by) values(rid,'{"courses":[{"code":"QA101","name":"QA course","type":"พื้นฐาน","hours":160,"weight":4}],"activities":[],"ratio":{"collect":40,"exam":10}}',who);end if;
  insert into window_qa values(i,rid,who,sid,adm);
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',adm,'role','authenticated')::text,true);
end $$;
grant select on window_qa to authenticated;
set local role authenticated;
do $$ declare adm uuid;begin
 select admin_id into adm from window_qa limit 1;
 insert into public.pp5_entry_windows(education_level,academic_year,term,mode,updated_by) values('primary',2799,1,'closed',adm),('primary',2799,2,'open',adm),('secondary',2799,1,'open',adm),('secondary',2799,2,'closed',adm);
 -- Exact upsert used by Admin, including updating an existing row.
 insert into public.pp5_entry_windows(education_level,academic_year,term,mode,revision,updated_by) values('primary',2799,1,'closed',2,adm)
 on conflict(education_level,academic_year,term) do update set mode=excluded.mode,revision=excluded.revision,updated_by=excluded.updated_by;
 if not exists(select 1 from public.pp5_entry_windows where academic_year=2799 and education_level='primary' and term=1 and revision=2) then raise exception 'Admin upsert failed';end if;
 insert into public.school_announcements(title,body,published,updated_by) values('QA internal','internal',true,adm),('QA draft','draft',false,adm);
 insert into public.school_announcements(title,published,audience,updated_by) values('QA public',true,'public',adm);
 insert into public.school_announcements(title,published,audience,starts_at,ends_at,updated_by) values('QA future',true,'public',now()+interval '1 day',now()+interval '2 days',adm),('QA expired',true,'public',now()-interval '2 days',now()-interval '1 day',adm);
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select teacher from window_qa limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare rid uuid;sid uuid;who uuid;payload jsonb;config jsonb;blank jsonb;denied bool;i int;got jsonb;begin
 select room_id,student,teacher into rid,sid,who from window_qa where n=1;
 if private.pp5_room_entry_open(rid,1) or not private.pp5_room_entry_open(rid,2) then raise exception 'Primary term independence failed';end if;
 if not private.pp5_room_entry_open((select room_id from window_qa where n=2),1) then raise exception 'Primary setting leaked to secondary';end if;
 if not private.pp5_room_entry_open((select room_id from window_qa where n=3),1) then raise exception 'Year separation failed';end if;
 got:=public.pp5_entry_access(rid);if got->>'education_level'<>'primary' or (got->>'exempt')::boolean then raise exception 'Access RPC incorrect';end if;
 -- Teacher cannot write either Admin-only setting table.
 denied:=false;begin insert into public.pp5_entry_windows(education_level,academic_year,term,updated_by) values('primary',2798,1,who);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Teacher edited periods';end if;
 denied:=false;begin insert into public.school_announcements(title,updated_by) values('QA unauthorized',who);exception when insufficient_privilege then denied:=true;end;if not denied then raise exception 'Teacher published news';end if;
 if exists(select 1 from public.school_announcements where title in('QA draft','QA future','QA expired')) then raise exception 'Hidden news leaked to teacher';end if;
 if not exists(select 1 from public.school_announcements where title='QA internal') then raise exception 'Internal news missing';end if;
 -- Closed term 1 blank values remain unchanged while term 2 gets a real score.
 config:=jsonb_build_object('tasks',to_jsonb(array_fill(10,array[16])),'mid',0);
 blank:=jsonb_build_object('tasks',to_jsonb(array_fill(null::int,array[16])),'mid',null,'final',null);
 payload:=jsonb_build_object('maxima',jsonb_build_array(config,config),'scores',jsonb_build_object(sid::text,jsonb_build_object('terms',jsonb_build_array(blank,jsonb_set(blank,'{tasks,0}','5')))));
 insert into public.pp5_primary_course_scores(classroom_id,course_code,data,updated_by) values(rid,'QA101',payload,who);
 update public.pp5_primary_course_scores set data=jsonb_set(payload,array['scores',sid::text,'terms','1','tasks','1'],'6'),revision=2 where classroom_id=rid;
 denied:=false;begin update public.pp5_primary_course_scores set data=jsonb_set(data,array['scores',sid::text,'terms','0','tasks','0'],'7'),revision=3 where classroom_id=rid;exception when others then if sqlerrm not like '%ปิดรับคะแนน%' then raise;end if;denied:=true;end;if not denied then raise exception 'Closed term score accepted';end if;
 denied:=false;begin update public.pp5_primary_course_scores set data=jsonb_set(data,'{maxima,0,mid}','5'),revision=3 where classroom_id=rid;exception when others then if sqlerrm not like '%ปิดรับคะแนน%' then raise;end if;denied:=true;end;if not denied then raise exception 'Closed term maximum accepted';end if;
 -- Shared annual data can change while one term remains open, ratio cannot.
 update public.pp5_primary_structures set data=jsonb_set(data,'{courses,0,name}','"QA changed"'),revision=2 where classroom_id=rid;
 denied:=false;begin update public.pp5_primary_structures set data=jsonb_set(data,'{ratio,exam}','15'),revision=3 where classroom_id=rid;exception when others then if sqlerrm not like '%อัตราส่วน%' then raise;end if;denied:=true;end;if not denied then raise exception 'Ratio changed closed term';end if;
 for i in 1..2 loop
  denied:=false;begin insert into public.pp5_primary_attendance(classroom_id,term,data,updated_by) values(rid,i,'{"version":1,"start":"2026-05-18","holidays":[],"marks":{}}',who);
  exception when others then if i=2 or sqlerrm not like '%ปิดรับข้อมูล%' then raise;end if;denied:=true;end;
  if (i=1)<>denied then raise exception 'Attendance term separation failed';end if;
 end loop;
 -- Secondary uses its own level's term, not the primary policy.
 insert into public.pp5_books(classroom_id,title,template_name,template_base64,updated_by) values((select room_id from window_qa where n=2),'QA','qa.xlsx','',who);
 -- Other classroom modules are outside this feature.
 insert into public.module_data(classroom_id,module_name,data,updated_by) values(rid,'behavior','{}',who);
end $$;
reset role;
-- Close both primary terms and secondary term 1, testing authoritative DB clock schedules.
update public.pp5_entry_windows set mode='scheduled',opens_at=now()+interval '1 day',closes_at=now()+interval '2 days',revision=revision+1 where academic_year=2799 and ((education_level='primary' and term=2) or (education_level='secondary' and term=1));
set local role authenticated;
do $$ declare rid uuid;denied bool;begin
 select room_id into rid from window_qa where n=1;
 if private.pp5_room_entry_open(rid) then raise exception 'Future schedule opened early';end if;
 denied:=false;begin update public.pp5_primary_structures set data=jsonb_set(data,'{courses,0,name}','"QA blocked"'),revision=3 where classroom_id=rid;exception when others then if sqlerrm not like '%ปิดรับข้อมูล%' then raise;end if;denied:=true;end;if not denied then raise exception 'Annual edit accepted when both terms closed';end if;
 denied:=false;begin update public.pp5_books set title='Blocked' where classroom_id=(select room_id from window_qa where n=2);exception when others then if sqlerrm not like '%ปิดรับข้อมูล%' then raise;end if;denied:=true;end;if not denied then raise exception 'Secondary closed edit accepted';end if;
 if not exists(select 1 from public.pp5_primary_course_scores where classroom_id=rid) then raise exception 'Read access lost';end if;
 update public.module_data set data='{"qa":true}' where classroom_id=rid and module_name='behavior';
end $$;
reset role;
update public.pp5_entry_windows set opens_at=now()-interval '2 days',closes_at=now()-interval '1 day',revision=revision+1 where academic_year=2799 and mode='scheduled';
set local role authenticated;
do $$ begin if private.pp5_room_entry_open((select room_id from window_qa where n=1),2) then raise exception 'Expired schedule remained open';end if;end $$;
reset role;
update public.pp5_entry_windows set opens_at=now()-interval '1 day',closes_at=now()+interval '1 day',revision=revision+1 where academic_year=2799 and mode='scheduled';
set local role authenticated;
do $$ begin if not private.pp5_room_entry_open((select room_id from window_qa where n=1),2) then raise exception 'Active schedule not open';end if;end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',(select admin_id from window_qa limit 1),'role','authenticated')::text,true);
set local role authenticated;
do $$ begin if not private.pp5_room_entry_open((select room_id from window_qa where n=1),1) then raise exception 'Admin exemption failed';end if;end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role anon;
do $$ declare feed jsonb;begin
 feed:=public.school_notice_feed();
 if feed->'announcements' @> '[{"title":"QA internal"}]'::jsonb or feed->'announcements' @> '[{"title":"QA draft"}]'::jsonb or feed->'announcements' @> '[{"title":"QA future"}]'::jsonb then raise exception 'Internal or draft news leaked to anon';end if;
 if not feed->'announcements' @> '[{"title":"QA public"}]'::jsonb then raise exception 'Public news missing';end if;
 if has_function_privilege('anon','public.pp5_entry_access(uuid)','execute') then raise exception 'Anonymous access to entry settings';end if;
end $$;
reset role;
rollback;
select 'PASS: Admin-only news and windows, public/internal scheduling, separate levels/years/terms, closed term score+max protection, annual/ratio rules, attendance terms, secondary edits, read access, other modules unaffected, default-open, future/current/expired schedules, Admin exemption, rollback' as result;
