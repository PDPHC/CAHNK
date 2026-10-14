alter table public.pp5_primary_reading disable trigger primary_reading_guard;
update public.pp5_primary_reading r set data=jsonb_set(jsonb_set(r.data,'{scores}',coalesce((select jsonb_object_agg(uid,(select jsonb_agg(case when v='null'::jsonb then v else to_jsonb((v::text)::numeric-1) end order by ord) from jsonb_array_elements(scores) with ordinality a(v,ord))) from jsonb_each(r.data->'scores') e(uid,scores)),'{}'::jsonb)),'{scale}','"0-3"'::jsonb),revision=revision+1,updated_at=now() where data->>'scale' is distinct from '0-3';
create or replace function private.guard_primary_reading() returns trigger language plpgsql security invoker set search_path='' as $$
declare level text; uid text; scores jsonb; item jsonb; person public.students; previous jsonb:='{}';
begin
 select regexp_replace(translate(c.class_level,'๐๑๒๓๔๕๖๗๘๙','0123456789'),'[[:space:]]','','g') into level from public.classrooms c where c.id=new.classroom_id;
 if level is null or level !~ '^(ประถมศึกษาปีที่|ป\.?)[1-6]$' then raise exception 'ใช้ได้เฉพาะห้องประถมศึกษา';end if;
 if tg_op='UPDATE' then
  if new.classroom_id is distinct from old.classroom_id or new.revision<>old.revision+1 then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่';end if;
  previous:=old.data->'scores';
 elsif new.revision<>1 then raise exception 'รุ่นข้อมูลไม่ถูกต้อง';end if;
 if (new.data->>'scale') is distinct from '0-3' then raise exception 'กรุณาโหลดหน้าใหม่เพื่อใช้คะแนน 0–3';end if;
 if jsonb_typeof(new.data) is distinct from 'object' or octet_length(new.data::text)>1048576 or jsonb_typeof(new.data->'scores') is distinct from 'object' or (new.data->>'method') is null or (new.data->>'method') not in ('average','minimum') then raise exception 'ข้อมูลผลการประเมินไม่ถูกต้อง';end if;
 if (select count(*) from jsonb_each(new.data->'scores'))>500 then raise exception 'จำนวนข้อมูลนักเรียนเกินกำหนด';end if;
 for person in select * from public.students where classroom_id=new.classroom_id and record_status in ('transferred','not_present') loop
  if previous->person.id::text is distinct from new.data->'scores'->person.id::text then raise exception 'ไม่อนุญาตให้แก้คะแนนนักเรียนย้ายออกหรือไม่มีตัวตน';end if;
 end loop;
 for uid,scores in select * from jsonb_each(new.data->'scores') loop
  select * into person from public.students where id::text=uid and classroom_id=new.classroom_id;
  if not found then
   if previous->uid=scores then continue;end if;
   raise exception 'นักเรียนไม่ได้อยู่ในห้องนี้';
  end if;
  if jsonb_typeof(scores) is distinct from 'array' then raise exception 'คะแนนต้องเป็นรายการ 18 ข้อ';end if;
  if jsonb_array_length(scores)<>18 then raise exception 'ต้องมีคะแนน 18 ข้อ';end if;
  for item in select value from jsonb_array_elements(scores) loop
   if item='null'::jsonb then continue;end if;
   if jsonb_typeof(item) is distinct from 'number' then raise exception 'คะแนนต้องเป็นตัวเลข';end if;
   if (item::text)::numeric not between 0 and 3 or (item::text)::numeric<>trunc((item::text)::numeric) then raise exception 'คะแนนต้องเป็นจำนวนเต็ม 0–3';end if;
  end loop;
 end loop;
 new.updated_at:=now();return new;
end $$;

alter table public.pp5_primary_reading enable trigger primary_reading_guard;
