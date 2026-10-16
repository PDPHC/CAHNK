create table public.pp5_primary_cover_settings (
 classroom_id uuid primary key references public.classrooms(id) on delete cascade,
 data jsonb not null,
 revision integer not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.pp5_primary_cover_settings enable row level security;
revoke all on public.pp5_primary_cover_settings from anon,authenticated;
grant select,insert,update on public.pp5_primary_cover_settings to authenticated;
create policy primary_cover_settings_read on public.pp5_primary_cover_settings for select to authenticated using(private.can_view_classroom(classroom_id));
create policy primary_cover_settings_insert on public.pp5_primary_cover_settings for insert to authenticated with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_cover_settings.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create policy primary_cover_settings_update on public.pp5_primary_cover_settings for update to authenticated using(private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_cover_settings.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))) with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_cover_settings.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create function private.guard_primary_cover_settings() returns trigger language plpgsql security invoker set search_path='' as $$
declare level text;group_name text;field_name text;item jsonb;
begin
 select regexp_replace(translate(c.class_level,'๐๑๒๓๔๕๖๗๘๙','0123456789'),'[[:space:]]','','g') into level from public.classrooms c where c.id=new.classroom_id;
 if level is null or level !~ '^(ประถมศึกษาปีที่|ป\.?)[1-6]$' then raise exception 'ใช้ได้เฉพาะห้องประถมศึกษา';end if;
 if tg_op='UPDATE' then
  if new.classroom_id is distinct from old.classroom_id or new.revision<>old.revision+1 then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่';end if;
 elsif new.revision<>1 then raise exception 'รุ่นข้อมูลไม่ถูกต้อง';end if;
 if jsonb_typeof(new.data) is distinct from 'object' or octet_length(new.data::text)>8192 or new.data->'version' is distinct from '1'::jsonb then raise exception 'ข้อมูลหน้าปกไม่ถูกต้อง';end if;
 foreach group_name in array array['transferred','promoted'] loop
  if jsonb_typeof(new.data->group_name) is distinct from 'object' then raise exception 'ข้อมูลจำนวนไม่ถูกต้อง';end if;
  foreach field_name in array array['male','female'] loop
   item:=new.data->group_name->field_name;
   if group_name='transferred' and item='null'::jsonb then continue;end if;
   if jsonb_typeof(item) is distinct from 'number' then raise exception 'จำนวนต้องเป็นตัวเลข';end if;
   if (item::text)::numeric not between 0 and 9999 or (item::text)::numeric<>trunc((item::text)::numeric) then raise exception 'จำนวนต้องเป็นจำนวนเต็ม 0–9999';end if;
  end loop;
 end loop;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.guard_primary_cover_settings() from public,anon,authenticated;
create trigger primary_cover_settings_guard before insert or update on public.pp5_primary_cover_settings for each row execute function private.guard_primary_cover_settings();
