begin;
create temporary table cover_settings_qa(n int,room_id uuid,user_id uuid);
do $$ declare who uuid;rid uuid;i int;begin
 select id into who from public.profiles where role='teacher' limit 1;
 for i in 1..3 loop
 insert into public.classrooms(class_level,room,academic_year,term,created_by) values(case when i=2 then 'ม.1' else 'ป.1' end,'COVER-SETTINGS-QA-'||i,9999,1,who) returning id into rid;
 insert into public.classroom_teachers(classroom_id,teacher_id,permission) values(rid,who,case when i=3 then 'viewer' else 'editor' end);
 insert into cover_settings_qa values(i,rid,who);
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated')::text,true);
end $$;
grant select on cover_settings_qa to authenticated;
set local role authenticated;
do $$ declare rid uuid;who uuid;payload jsonb;bad jsonb;denied bool;i int;begin
 select room_id,user_id into rid,who from cover_settings_qa where n=1;
 payload:='{"version":1,"transferred":{"male":null,"female":null},"promoted":{"male":0,"female":0}}';
 insert into public.pp5_primary_cover_settings(classroom_id,data,updated_by) values(rid,payload,who);
 payload:=jsonb_set(payload,'{transferred,male}','4');payload:=jsonb_set(payload,'{promoted,female}','12');
 update public.pp5_primary_cover_settings set data=payload,revision=2 where classroom_id=rid and revision=1;
 if not exists(select 1 from public.pp5_primary_cover_settings where classroom_id=rid and data=payload and revision=2) then raise exception 'Save/reload failed';end if;
 update public.pp5_primary_cover_settings set revision=2 where classroom_id=rid and revision=1;if found then raise exception 'Stale write accepted';end if;
 for i in 1..5 loop
 denied:=false;begin
 if i=1 then bad:=jsonb_set(payload,'{promoted,male}','-1');
 elsif i=2 then bad:=jsonb_set(payload,'{promoted,male}','1.5');
 elsif i=3 then bad:=jsonb_set(payload,'{promoted,male}','10000');
 elsif i=4 then bad:=jsonb_set(payload,'{promoted,male}','null');
 else bad:=jsonb_set(payload,'{transferred,male}','"5"');end if;
 update public.pp5_primary_cover_settings set data=bad,revision=3 where classroom_id=rid;
 exception when others then denied:=true;end;
 if not denied then raise exception 'Invalid count accepted %',i;end if;
 end loop;
 for i in 2..3 loop denied:=false;begin
 insert into public.pp5_primary_cover_settings(classroom_id,data,updated_by) select room_id,payload,user_id from cover_settings_qa where n=i;
 exception when others then denied:=true;end;if not denied then raise exception 'Secondary/viewer write accepted';end if;end loop;
end $$;
reset role;rollback;
select 'PASS: cover counts insert/update/reload, null auto-count mode, revision conflicts, integer bounds and primary/editor access; fixtures rolled back' as checks;
