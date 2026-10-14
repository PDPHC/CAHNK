-- Integration checks use synthetic records and roll back every change.
begin;
create temporary table copy_qa(n integer primary key,room_id uuid,book_id uuid,user_id uuid);
do $$
declare who uuid; room_id uuid; book_id uuid; i integer;
begin
 select id into who from public.profiles where role='teacher' limit 1;
 if who is null then raise exception 'A teacher account is required for permission tests'; end if;
 for i in 1..7 loop
  insert into public.classrooms(class_level,room,academic_year,term,created_by)
  values(case i when 3 then 'มัธยมศึกษาปีที่ 2' when 4 then 'ประถมศึกษาปีที่ 1' else 'มัธยมศึกษาปีที่ 1' end,'COPY-QA-'||i,9999,case when i=5 then 2 else 1 end,who) returning id into room_id;
  insert into public.classroom_teachers(classroom_id,teacher_id,permission) values(room_id,who,case when i=7 then 'viewer' else 'editor' end);
  insert into public.pp5_books(classroom_id,title,template_name,template_base64,updated_by,patches)
  values(room_id,'Indicator copy QA','QA','AA==',who,'{"D!C8":"old","D!C54":"stale extra","IN!C4":"QA-STUDENT","IN!E4":15,"CH!G7":"/"}') returning id into book_id;
  insert into copy_qa values(i,room_id,book_id,who);
  if i=6 then insert into public.pp5_submissions(book_id,status,submitted_by,route,snapshot) values(book_id,'department',who,'{}','{}'); end if;
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
end $$;
grant select on copy_qa to authenticated;
set local role authenticated;
do $$
declare source_id uuid; target_id uuid; source_revision integer; targets jsonb; result jsonb; payload jsonb:='{"__pp5_indicator_count":0,"__pp5_deleted_indicators":[],"D!C8":"QA copied indicator","D!O8":3,"D!T8":2}'; denied boolean; test record;
begin
 select book_id into source_id from copy_qa where n=1;
 select revision into source_revision from public.pp5_books where id=source_id;
 targets:=public.pp5_indicator_copy_targets(source_id);
 if jsonb_array_length(targets)<>1 or targets->0->>'id'<>(select book_id::text from copy_qa where n=2) then raise exception 'Target filtering failed'; end if;
 select book_id into target_id from copy_qa where n=2;
 perform public.pp5_copy_indicators(source_id,source_revision,target_id,1,payload);
 select patches into result from public.pp5_books where id=target_id;
 if result->>'D!C8'<>'QA copied indicator' or result->>'D!O8'<>'3' or result->>'D!T8'<>'2' or result ? 'D!C54' then raise exception 'Indicator replacement failed'; end if;
 if result->>'IN!C4'<>'QA-STUDENT' or result->>'IN!E4'<>'15' or result->>'CH!G7'<>'/' then raise exception 'Student data was changed'; end if;
 for test in select * from (values (3,'ระดับชั้นเดียวกัน'),(4,'ระดับชั้นเดียวกัน'),(5,'ปีการศึกษา'),(6,'ระหว่างตรวจ'),(7,'ไม่มีสิทธิ์'),(2,'ข้อมูลเล่มเปลี่ยน')) as cases(n,message) loop
  select book_id into target_id from copy_qa where n=test.n;denied:=false;
  begin perform public.pp5_copy_indicators(source_id,source_revision,target_id,1,payload);
  exception when others then if position(test.message in sqlerrm)=0 then raise;end if;denied:=true;end;
  if not denied then raise exception 'Expected rejection for case %',test.n;end if;
 end loop;
 select book_id into target_id from copy_qa where n=2;denied:=false;
 begin perform public.pp5_copy_indicators(source_id,source_revision,target_id,2,payload||'{"IN!E4":99}');
 exception when others then if position('ไม่อนุญาตให้คัดลอกช่อง' in sqlerrm)=0 then raise;end if;denied:=true;end;
 if not denied then raise exception 'Student score payload was accepted';end if;
 if private.pp5_copy_level_key('ม.๑')<>private.pp5_copy_level_key('มัธยมศึกษาปีที่ 1') or private.pp5_copy_level_key('ป.1')=private.pp5_copy_level_key('ม.1') then raise exception 'Level normalization failed';end if;
end $$;
reset role;
rollback;
select 'PASS: target filtering, same-grade copy, preserved student data, cross-grade and primary/secondary rejection, term restriction, submitted-book lock, reader permissions, revision conflict, payload allowlist, Thai level normalization; all fixture changes rolled back' as checks;
