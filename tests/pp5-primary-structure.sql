begin;
create temporary table structure_qa(n int,room_id uuid,teacher_id uuid);
do $$ declare who uuid; rid uuid;i int;begin
 select id into who from public.profiles where role='teacher' limit 1;
 for i in 1..3 loop
 insert into public.classrooms(class_level,room,academic_year,term,created_by) values(case when i=2 then 'ม.1' else 'ป.4' end,'STRUCTURE-QA-'||i,9999,1,who) returning id into rid;
 insert into public.classroom_teachers(classroom_id,teacher_id,permission) values(rid,who,case when i=3 then 'viewer' else 'editor' end);
 insert into structure_qa values(i,rid,who);
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
end $$;
grant select on structure_qa to authenticated;
set local role authenticated;
do $$ declare rid uuid;who uuid;payload jsonb:='{"courses":[{"code":"QA101","name":"QA course","type":"พื้นฐาน","hours":160,"weight":4,"department":"ภาษาไทย","teacher":"QA teacher"}],"activities":[{"code":"QA-A","name":"QA activity","type":"กิจกรรม","hours":40}],"ratio":{"collect":40,"exam":10}}';denied bool; test int;begin
 select room_id,teacher_id into rid,who from structure_qa where n=1;
 insert into public.pp5_primary_structures(classroom_id,data,updated_by) values(rid,payload,who);
 update public.pp5_primary_structures set data=jsonb_set(data,'{ratio,exam}','20'),revision=2,updated_by=who where classroom_id=rid and revision=1;
 if not exists(select 1 from public.pp5_primary_structures where classroom_id=rid and revision=2 and data->'ratio'->>'exam'='20') then raise exception 'Save/reload failed';end if;
 update public.pp5_primary_structures set data=payload,revision=2 where classroom_id=rid and revision=1;
 if found then raise exception 'Stale update accepted';end if;
 for test in 2..3 loop
  denied:=false;
  begin insert into public.pp5_primary_structures(classroom_id,data,updated_by) select room_id,payload,teacher_id from structure_qa where n=test;
  exception when others then denied:=true;end;
  if not denied then raise exception 'Secondary/viewer write accepted';end if;
 end loop;
 denied:=false;
 begin update public.pp5_primary_structures set data=jsonb_set(payload,'{courses,0,hours}','-1'),revision=3 where classroom_id=rid;
 exception when others then denied:=true;end;
 if not denied then raise exception 'Negative hours accepted';end if;
 denied:=false;
 begin update public.pp5_primary_structures set data=jsonb_set(payload,'{ratio,collect}','100'),revision=3 where classroom_id=rid;
 exception when others then denied:=true;end;
 if not denied then raise exception 'Excess total score accepted';end if;
end $$;
reset role;rollback;
select 'PASS: primary save/reload, revision conflict, secondary and viewer restrictions, negative hours and score total rejection; fixtures rolled back' as checks;
