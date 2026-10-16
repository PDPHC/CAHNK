create table public.pp5_primary_attendance (
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 term int not null check(term in (1,2)),
 data jsonb not null,
 revision int not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(classroom_id,term)
);
alter table public.pp5_primary_attendance enable row level security;
revoke all on public.pp5_primary_attendance from anon,authenticated;
grant select,insert,update on public.pp5_primary_attendance to authenticated;
create policy primary_attendance_read on public.pp5_primary_attendance for select to authenticated using(private.can_view_classroom(classroom_id));
create policy primary_attendance_insert on public.pp5_primary_attendance for insert to authenticated with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_attendance.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create policy primary_attendance_update on public.pp5_primary_attendance for update to authenticated using(private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_attendance.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))) with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_attendance.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create function private.guard_primary_attendance() returns trigger language plpgsql security invoker set search_path='' as $$
declare level text; uid text; marks jsonb; entry record; h jsonb; person public.students; previous jsonb:='{}'; first_day date; allowed text[];
begin
 select regexp_replace(translate(c.class_level,'๐๑๒๓๔๕๖๗๘๙','0123456789'),'[[:space:]]','','g') into level from public.classrooms c where c.id=new.classroom_id;
 if level is null or level !~ '^(ประถมศึกษาปีที่|ป\.?)[1-6]$' then raise exception 'ใช้ได้เฉพาะห้องประถมศึกษา';end if;
 if tg_op='UPDATE' then
  if (new.classroom_id,new.term) is distinct from (old.classroom_id,old.term) or new.revision<>old.revision+1 then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่';end if;previous:=old.data->'marks';
 elsif new.revision<>1 then raise exception 'รุ่นข้อมูลไม่ถูกต้อง';end if;
 if jsonb_typeof(new.data) is distinct from 'object' or octet_length(new.data::text)>3145728 or new.data->'version' is distinct from '1'::jsonb or jsonb_typeof(new.data->'holidays') is distinct from 'array' or jsonb_typeof(new.data->'marks') is distinct from 'object' then raise exception 'ข้อมูลเวลาเรียนไม่ถูกต้อง';end if;
 if (new.data->>'start') is null or (new.data->>'start') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'วันเริ่มต้นไม่ถูกต้อง';end if;
 first_day:=(new.data->>'start')::date;
 if first_day<'2020-01-01'::date or first_day>'2100-12-31'::date then raise exception 'วันเริ่มต้นไม่ถูกต้อง';end if;
 if jsonb_array_length(new.data->'holidays')>400 then raise exception 'จำนวนวันหยุดเกินกำหนด';end if;
 for h in select value from jsonb_array_elements(new.data->'holidays') loop
  if jsonb_typeof(h) is distinct from 'object' or coalesce(h->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or jsonb_typeof(h->'name') is distinct from 'string' or length(btrim(h->>'name')) not between 1 and 500 then raise exception 'วันหยุดไม่ถูกต้อง';end if;
  perform (h->>'date')::date;
 end loop;
 select array_agg(to_char(d,'YYYY-MM-DD') order by d) into allowed from (select first_day+i as d from generate_series(0,399) i where extract(isodow from first_day+i)<6 and not exists(select 1 from jsonb_array_elements(new.data->'holidays') holiday_day(value) where holiday_day.value->>'date'=to_char(first_day+i,'YYYY-MM-DD')) order by i limit 100) x;
 if coalesce(array_length(allowed,1),0)<>100 then raise exception 'ปฏิทินไม่ครบ 100 วันเรียน';end if;
 if (select count(*) from jsonb_each(new.data->'marks'))>500 then raise exception 'จำนวนนักเรียนเกินกำหนด';end if;
 for person in select * from public.students where classroom_id=new.classroom_id and record_status in ('transferred','not_present') loop
  if previous->person.id::text is distinct from new.data->'marks'->person.id::text then raise exception 'ไม่อนุญาตให้แก้ข้อมูลนักเรียนย้ายออกหรือไม่มีตัวตน';end if;
 end loop;
 for uid,marks in select * from jsonb_each(new.data->'marks') loop
  select * into person from public.students where id::text=uid and classroom_id=new.classroom_id;
  if not found then if previous->uid=marks then continue;end if;raise exception 'นักเรียนไม่ได้อยู่ในห้องนี้';end if;
  if jsonb_typeof(marks) is distinct from 'object' then raise exception 'ข้อมูลเช็กชื่อไม่ถูกต้อง';end if;
  for entry in select * from jsonb_each(marks) loop
   if not(entry.key=any(allowed)) or jsonb_typeof(entry.value) is distinct from 'string' or entry.value#>>'{}' not in ('/','ป','ล','ข') then raise exception 'บันทึกได้เฉพาะวันเรียน และสถานะ มา ป่วย ลา ขาด';end if;
  end loop;
 end loop;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.guard_primary_attendance() from public,anon,authenticated;
create trigger primary_attendance_guard before insert or update on public.pp5_primary_attendance for each row execute function private.guard_primary_attendance();
