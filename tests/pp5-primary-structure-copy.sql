begin;
create temporary table structure_copy_qa(n int,room_id uuid,user_id uuid);
do $$ declare who uuid;rid uuid;i int;payload jsonb;begin
 select id into who from public.profiles where role='teacher' limit 1;
 if who is null then raise exception 'No teacher fixture available';end if;
 for i in 1..8 loop
  insert into public.classrooms(class_level,room,academic_year,term,created_by) values(case when i=2 then 'ประถมศึกษาปีที่ ๑' when i=3 then 'ป.2' else 'ป.1' end,'STRUCTURE-COPY-QA-'||i,case when i=5 then 9998 else 9999 end,case when i=6 then 2 else 1 end,who) returning id into rid;
  insert into public.classroom_teachers(classroom_id,teacher_id,permission) values(rid,who,case when i=4 then 'viewer' else 'editor' end);
  insert into structure_copy_qa values(i,rid,who);
 end loop;
 payload:='{"courses":[{"code":"T11101","name":"QA course","type":"พื้นฐาน","hours":160,"weight":4,"department":"ภาษาไทย","teacher":"QA"}],"activities":[{"code":"A1","name":"QA activity","type":"กิจกรรม","hours":40}],"ratio":{"collect":40,"exam":10}}';
 insert into public.pp5_primary_structures(classroom_id,data,updated_by) select room_id,payload,user_id from structure_copy_qa where n in(1,7);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
end $$;
grant select on structure_copy_qa to authenticated;
set local role authenticated;
do $$ declare src uuid;dst uuid;existing uuid;who uuid;targets jsonb;listed jsonb;payload jsonb;denied bool;i int;begin
 select room_id,user_id into src,who from structure_copy_qa where n=1;
 select room_id into dst from structure_copy_qa where n=2;
 select room_id into existing from structure_copy_qa where n=7;
 listed:=public.pp5_primary_structure_copy_targets(src);
 if jsonb_array_length(listed)<>3 then raise exception 'Target list incorrect %',listed;end if;
 if not exists(select 1 from jsonb_array_elements(listed) e where e->>'id'=dst::text) then raise exception 'Thai numeral grade was excluded';end if;
 targets:=jsonb_build_array(jsonb_build_object('classroom_id',dst,'revision',0),jsonb_build_object('classroom_id',existing,'revision',1));
 denied:=false;begin perform public.pp5_copy_primary_structure(src,1,targets,false);exception when others then denied:=true;end;
 if not denied then raise exception 'Overwrite accepted without acknowledgement';end if;
 if exists(select 1 from public.pp5_primary_structures where classroom_id=dst) then raise exception 'Partial copy was not rolled back';end if;
 perform public.pp5_copy_primary_structure(src,1,targets,true);
 select data into payload from public.pp5_primary_structures where classroom_id=src;
 if (select count(*) from public.pp5_primary_structures where classroom_id in(dst,existing) and data=payload)<>2 then raise exception 'Bulk copy data differs';end if;
 if not exists(select 1 from public.pp5_primary_structures where classroom_id=existing and revision=2) then raise exception 'Revision did not increment';end if;
 if not exists(select 1 from public.pp5_primary_structures where classroom_id=src and revision=1) then raise exception 'Source changed';end if;
 for i in 1..8 loop
  denied:=false;
  begin
   if i in (3,4,5,6) then
    select room_id into dst from structure_copy_qa where n=i;
    perform public.pp5_copy_primary_structure(src,1,jsonb_build_array(jsonb_build_object('classroom_id',dst,'revision',0)),true);
   elsif i=1 then perform public.pp5_copy_primary_structure(src,2,targets,true);
   elsif i=2 then select room_id into dst from structure_copy_qa where n=2;perform public.pp5_copy_primary_structure(src,1,jsonb_build_array(jsonb_build_object('classroom_id',dst,'revision',0)),true);
   elsif i=7 then perform public.pp5_copy_primary_structure(src,1,jsonb_build_array(jsonb_build_object('classroom_id',src,'revision',1)),true);
   else select room_id into dst from structure_copy_qa where n=4;perform public.pp5_primary_structure_copy_targets(dst);
   end if;
  exception when others then denied:=true;end;
  if not denied then raise exception 'Invalid operation accepted: %',i;end if;
 end loop;
 -- Every selected target is rolled back when any target fails validation.
 select room_id into dst from structure_copy_qa where n=8;
 select room_id into existing from structure_copy_qa where n=3;
 denied:=false;begin perform public.pp5_copy_primary_structure(src,1,jsonb_build_array(jsonb_build_object('classroom_id',dst,'revision',0),jsonb_build_object('classroom_id',existing,'revision',0)),false);exception when others then denied:=true;end;
 if not denied or exists(select 1 from public.pp5_primary_structures where classroom_id=dst) then raise exception 'Mixed-grade batch was partially copied';end if;
 if has_function_privilege('anon','public.pp5_copy_primary_structure(uuid,integer,jsonb,boolean)','execute') then raise exception 'Anonymous execution allowed';end if;
end $$;
rollback;
select 'PASS: same-grade bulk copy, Thai grade aliases, new and existing targets, overwrite acknowledgement, optimistic revisions, viewer/year/term/cross-grade/self restrictions, atomic rollback, no anonymous access' as result;
