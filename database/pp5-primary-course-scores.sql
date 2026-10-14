create table public.pp5_primary_course_scores (
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 course_code text not null check(length(course_code) between 1 and 500),
 data jsonb not null,
 revision integer not null default 1 check(revision>0),
 updated_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now(),
 primary key(classroom_id,course_code)
);
alter table public.pp5_primary_course_scores enable row level security;
grant select,insert,update on public.pp5_primary_course_scores to authenticated;
create policy primary_scores_read on public.pp5_primary_course_scores for select to authenticated using(private.can_view_classroom(classroom_id));
create policy primary_scores_insert on public.pp5_primary_course_scores for insert to authenticated with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_course_scores.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create policy primary_scores_update on public.pp5_primary_course_scores for update to authenticated using(private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_course_scores.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))) with check(updated_by=(select auth.uid()) and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_primary_course_scores.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))));
create function private.guard_primary_course_scores() returns trigger language plpgsql security invoker set search_path='' as $$
declare structure jsonb; level text; uid text; record_data jsonb; person public.students; maxima jsonb; scores jsonb; item jsonb; i int;j int; limit_value numeric; previous jsonb:='{}';
begin
 select regexp_replace(translate(c.class_level,'๐๑๒๓๔๕๖๗๘๙','0123456789'),'[[:space:]]','','g') into level from public.classrooms c where c.id=new.classroom_id;
 if level is null or level !~ '^(ประถมศึกษาปีที่|ป\.?)[1-6]$' then raise exception 'ใช้ได้เฉพาะห้องประถมศึกษา';end if;
 select data into structure from public.pp5_primary_structures where classroom_id=new.classroom_id for share;
 if not exists(select 1 from jsonb_array_elements(coalesce(structure->'courses','[]')) c where c->>'code'=new.course_code) then raise exception 'ไม่พบรายวิชาในโครงสร้างของห้องนี้';end if;
 if tg_op='UPDATE' then
  if (new.classroom_id,new.course_code) is distinct from (old.classroom_id,old.course_code) or new.revision<>old.revision+1 then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่';end if;
  previous:=old.data->'scores';
 elsif new.revision<>1 then raise exception 'รุ่นข้อมูลไม่ถูกต้อง';end if;
 if jsonb_typeof(new.data) is distinct from 'object' or octet_length(new.data::text)>1048576 or jsonb_typeof(new.data->'maxima') is distinct from 'array' or jsonb_typeof(new.data->'scores') is distinct from 'object' then raise exception 'ข้อมูลคะแนนไม่ถูกต้อง';end if;
 if jsonb_array_length(new.data->'maxima')<>2 then raise exception 'ข้อมูลต้องมีสองภาคเรียน';end if;
 for i in 0..1 loop
  maxima:=new.data->'maxima'->i;
  if jsonb_typeof(maxima->'tasks') is distinct from 'array' or jsonb_typeof(maxima->'mid') is distinct from 'number' then raise exception 'คะแนนเต็มไม่ถูกต้อง';end if;
  if jsonb_array_length(maxima->'tasks')<>16 or (maxima->>'mid')::numeric not between 0 and 10000 then raise exception 'คะแนนเต็มไม่ถูกต้อง';end if;
  for item in select value from jsonb_array_elements(maxima->'tasks') loop
   if jsonb_typeof(item) is distinct from 'number' then raise exception 'คะแนนเต็มต้องเป็นตัวเลข';end if;
   if (item::text)::numeric not between 0 and 10000 then raise exception 'คะแนนเต็มไม่ถูกต้อง';end if;
  end loop;
 end loop;
 if (select count(*) from jsonb_each(new.data->'scores'))>500 then raise exception 'จำนวนข้อมูลนักเรียนเกินกำหนด';end if;
 -- Blocked pupils retain their stored scores, including during a bulk clear.
 for person in select * from public.students where classroom_id=new.classroom_id and record_status in ('transferred','not_present') loop
  if previous->person.id::text is distinct from new.data->'scores'->person.id::text then raise exception 'ไม่อนุญาตให้แก้คะแนนนักเรียนย้ายออกหรือไม่มีตัวตน';end if;
 end loop;
 for uid,record_data in select * from jsonb_each(new.data->'scores') loop
  select * into person from public.students where id::text=uid and classroom_id=new.classroom_id;
  if not found then
   if previous->uid=record_data then continue;end if;
   raise exception 'นักเรียนไม่ได้อยู่ในห้องนี้';
  end if;
  if jsonb_typeof(record_data->'terms') is distinct from 'array' then raise exception 'ข้อมูลคะแนนนักเรียนไม่ถูกต้อง';end if;
  if jsonb_array_length(record_data->'terms')<>2 then raise exception 'ต้องมีคะแนนสองภาคเรียน';end if;
  for i in 0..1 loop
   scores:=record_data->'terms'->i;maxima:=new.data->'maxima'->i;
   if jsonb_typeof(scores->'tasks') is distinct from 'array' or not(scores ? 'mid' and scores ? 'final') then raise exception 'ข้อมูลคะแนนไม่ครบ';end if;
   if jsonb_array_length(scores->'tasks')<>16 then raise exception 'ต้องมีคะแนนระหว่างเรียน 16 ช่อง';end if;
   for j in 0..17 loop
    if j<16 then item:=scores->'tasks'->j;limit_value:=(maxima->'tasks'->>j)::numeric;
    elsif j=16 then item:=scores->'mid';limit_value:=(maxima->>'mid')::numeric;
    else item:=scores->'final';limit_value:=(structure->'ratio'->>'exam')::numeric;end if;
    if item='null'::jsonb then continue;end if;
    if jsonb_typeof(item) is distinct from 'number' then raise exception 'คะแนนต้องเป็นตัวเลข';end if;
    if (item::text)::numeric<0 or (item::text)::numeric>limit_value then raise exception 'คะแนนเกินคะแนนเต็ม';end if;
   end loop;
  end loop;
 end loop;
 new.updated_at:=now();return new;
end $$;
revoke all on function private.guard_primary_course_scores() from public,anon,authenticated;
create trigger primary_course_scores_guard before insert or update on public.pp5_primary_course_scores for each row execute function private.guard_primary_course_scores();
