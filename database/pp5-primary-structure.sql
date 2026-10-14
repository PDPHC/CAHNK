create table public.pp5_primary_structures (
 classroom_id uuid primary key references public.classrooms(id) on delete cascade,
 data jsonb not null,
 revision integer not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.pp5_primary_structures enable row level security;
grant select,insert,update on public.pp5_primary_structures to authenticated;
create policy primary_structure_read on public.pp5_primary_structures for select to authenticated using(private.can_view_classroom(classroom_id));
create policy primary_structure_insert on public.pp5_primary_structures for insert to authenticated with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_structures.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create policy primary_structure_update on public.pp5_primary_structures for update to authenticated using(private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_structures.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))) with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_structures.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create function private.guard_primary_structure() returns trigger language plpgsql security invoker set search_path='' as $$
declare item jsonb; group_name text; field text; level text;
begin
 select regexp_replace(translate(c.class_level,'๐๑๒๓๔๕๖๗๘๙','0123456789'),'[[:space:]]','','g') into level from public.classrooms c where c.id=new.classroom_id;
 if level is null or level !~ '^(ประถมศึกษาปีที่|ป\.?)[1-6]$' then raise exception 'ใช้ได้เฉพาะห้องประถมศึกษา';end if;
 if tg_op='UPDATE' then
  if new.classroom_id<>old.classroom_id or new.revision<>old.revision+1 then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่';end if;
 elsif new.revision<>1 then raise exception 'รุ่นข้อมูลไม่ถูกต้อง';end if;
 if jsonb_typeof(new.data) is distinct from 'object' or octet_length(new.data::text)>262144 then raise exception 'ข้อมูลโครงสร้างไม่ถูกต้อง';end if;
 foreach group_name in array array['courses','activities'] loop
  if jsonb_typeof(new.data->group_name) is distinct from 'array' then raise exception 'ตารางไม่ถูกต้อง';end if;
  if jsonb_array_length(new.data->group_name)>100 then raise exception 'รองรับไม่เกิน 100 แถวต่อตาราง';end if;
  for item in select value from jsonb_array_elements(new.data->group_name) loop
   if jsonb_typeof(item) is distinct from 'object' or length(btrim(coalesce(item->>'code','')))=0 or length(btrim(coalesce(item->>'name','')))=0 then raise exception 'กรุณากรอกรหัสและชื่อให้ครบ';end if;
   foreach field in array array['code','name','type','department','teacher'] loop
    if item ? field and (jsonb_typeof(item->field)<>'string' or length(item->>field)>500) then raise exception 'ข้อความไม่ถูกต้อง';end if;
   end loop;
   foreach field in array case when group_name='courses' then array['hours','weight'] else array['hours'] end loop
    if jsonb_typeof(item->field) is distinct from 'number' then raise exception 'ชั่วโมงและน้ำหนักต้องเป็นตัวเลข';end if;
    if (item->>field)::numeric<0 or (item->>field)::numeric>10000 then raise exception 'ชั่วโมงและน้ำหนักไม่ถูกต้อง';end if;
   end loop;
  end loop;
 end loop;
 foreach field in array array['collect','exam'] loop
  if jsonb_typeof(new.data->'ratio'->field) is distinct from 'number' then raise exception 'อัตราส่วนคะแนนไม่ถูกต้อง';end if;
  if (new.data->'ratio'->>field)::numeric not between 0 and 100 then raise exception 'คะแนนต้องอยู่ระหว่าง 0–100';end if;
 end loop;
 if (new.data->'ratio'->>'collect')::numeric+(new.data->'ratio'->>'exam')::numeric>100 then raise exception 'คะแนนรวมต้องไม่เกิน 100';end if;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.guard_primary_structure() from public,anon,authenticated;
create trigger primary_structure_guard before insert or update on public.pp5_primary_structures for each row execute function private.guard_primary_structure();
