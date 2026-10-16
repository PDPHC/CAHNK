create table public.pp5_primary_traits (
 classroom_id uuid primary key references public.classrooms(id) on delete cascade,
 data jsonb not null,
 revision integer not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.pp5_primary_traits enable row level security;
revoke all on public.pp5_primary_traits from anon,authenticated;
grant select,insert,update on public.pp5_primary_traits to authenticated;
create policy primary_traits_read on public.pp5_primary_traits for select to authenticated using(private.can_view_classroom(classroom_id));
create policy primary_traits_insert on public.pp5_primary_traits for insert to authenticated with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_traits.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create policy primary_traits_update on public.pp5_primary_traits for update to authenticated using(private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_traits.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))) with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_traits.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create function private.guard_primary_traits() returns trigger language plpgsql security invoker set search_path='' as $$
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
  if jsonb_typeof(scores) is distinct from 'array' then raise exception 'คะแนนต้องเป็นรายการ 8 ข้อ';end if;
  if jsonb_array_length(scores)<>8 then raise exception 'ต้องมีคะแนน 8 ข้อ';end if;
  for item in select value from jsonb_array_elements(scores) loop
   if item='null'::jsonb then continue;end if;
   if jsonb_typeof(item) is distinct from 'number' then raise exception 'คะแนนต้องเป็นตัวเลข';end if;
   if (item::text)::numeric not between 0 and 3 or (item::text)::numeric<>trunc((item::text)::numeric) then raise exception 'คะแนนต้องเป็นจำนวนเต็ม 0–3';end if;
  end loop;
 end loop;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.guard_primary_traits() from public,anon,authenticated;
create trigger primary_traits_guard before insert or update on public.pp5_primary_traits for each row execute function private.guard_primary_traits();
