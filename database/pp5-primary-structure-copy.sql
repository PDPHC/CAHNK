-- Read and write through existing RLS; copy only saved curriculum structures.
create or replace function private.primary_structure_grade(value text) returns integer
language sql immutable security invoker set search_path='' as $$
 select case when level ~ '^(ประถมศึกษาปีที่|ป\.?)[1-6]$' then right(level,1)::integer end
 from (select regexp_replace(translate(value,'๐๑๒๓๔๕๖๗๘๙','0123456789'),'[[:space:]]','','g') as level) q;
$$;
create or replace function private.primary_structure_can_edit(p_room uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and (private.is_management() or exists(
  select 1 from public.classroom_teachers ct where ct.classroom_id=p_room and ct.teacher_id=auth.uid() and ct.permission in ('owner','editor')));
$$;
revoke all on function private.primary_structure_grade(text),private.primary_structure_can_edit(uuid) from public,anon;
grant execute on function private.primary_structure_grade(text),private.primary_structure_can_edit(uuid) to authenticated;

create or replace function public.pp5_primary_structure_copy_targets(p_source uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare source_room public.classrooms; result jsonb;
begin
 if not private.primary_structure_can_edit(p_source) then raise exception 'ไม่มีสิทธิ์แก้ไขโครงสร้างต้นทาง';end if;
 select * into source_room from public.classrooms where id=p_source;
 if not found or private.primary_structure_grade(source_room.class_level) is null then raise exception 'ใช้ได้เฉพาะระดับประถมศึกษา';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'class_level',c.class_level,'room',c.room,
  'academic_year',c.academic_year,'term',c.term,'revision',coalesce(s.revision,0)) order by c.room,c.id),'[]'::jsonb) into result
 from public.classrooms c left join public.pp5_primary_structures s on s.classroom_id=c.id
 where c.id<>p_source and private.primary_structure_grade(c.class_level)=private.primary_structure_grade(source_room.class_level)
 and c.academic_year=source_room.academic_year and c.term=source_room.term and private.primary_structure_can_edit(c.id);
 return result;
end $$;

create or replace function public.pp5_copy_primary_structure(p_source uuid,p_source_revision integer,p_targets jsonb,p_overwrite boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare source_room public.classrooms; target_room public.classrooms; source_data public.pp5_primary_structures;
 item jsonb; target_id uuid; expected integer; actual integer; written integer; result jsonb:='[]';
begin
 if auth.uid() is null or not private.primary_structure_can_edit(p_source) then raise exception 'ไม่มีสิทธิ์แก้ไขโครงสร้างต้นทาง';end if;
 if jsonb_typeof(p_targets) is distinct from 'array' then raise exception 'กรุณาเลือกห้องปลายทาง';end if;
 if jsonb_array_length(p_targets) not between 1 and 100 then raise exception 'เลือกห้องปลายทาง 1–100 ห้อง';end if;
 if (select count(distinct e->>'classroom_id') from jsonb_array_elements(p_targets) e)<>jsonb_array_length(p_targets) then raise exception 'ห้องปลายทางซ้ำหรือไม่ถูกต้อง';end if;
 select * into source_room from public.classrooms where id=p_source;
 if not found or private.primary_structure_grade(source_room.class_level) is null then raise exception 'ใช้ได้เฉพาะระดับประถมศึกษา';end if;
 -- Deterministic row locking prevents two concurrent copies from taking locks in opposite order.
 perform s.classroom_id from public.pp5_primary_structures s where s.classroom_id=p_source or s.classroom_id in
  (select (e->>'classroom_id')::uuid from jsonb_array_elements(p_targets) e) order by s.classroom_id for update;
 select * into source_data from public.pp5_primary_structures where classroom_id=p_source;
 if not found or source_data.revision is distinct from p_source_revision then raise exception 'โครงสร้างต้นทางเปลี่ยนแล้ว กรุณาบันทึกหรือโหลดข้อมูลใหม่';end if;
 for item in select e from jsonb_array_elements(p_targets) e order by e->>'classroom_id' loop
  target_id:=(item->>'classroom_id')::uuid;
  if jsonb_typeof(item->'revision') is distinct from 'number' or (item->>'revision')::numeric<0 then raise exception 'รุ่นข้อมูลปลายทางไม่ถูกต้อง';end if;
  expected:=(item->>'revision')::integer;
  if target_id=p_source then raise exception 'ไม่สามารถคัดลอกทับห้องต้นทาง';end if;
  if not private.primary_structure_can_edit(target_id) then raise exception 'ไม่มีสิทธิ์แก้ไขห้องปลายทาง';end if;
  select * into target_room from public.classrooms where id=target_id;
  if not found or private.primary_structure_grade(target_room.class_level) is distinct from private.primary_structure_grade(source_room.class_level) then raise exception 'นำไปใช้ได้เฉพาะระดับชั้นเดียวกัน';end if;
  if target_room.academic_year<>source_room.academic_year or target_room.term<>source_room.term then raise exception 'ต้องเป็นปีการศึกษาและภาคเรียนเดียวกัน';end if;
  select revision into actual from public.pp5_primary_structures where classroom_id=target_id;
  actual:=coalesce(actual,0);
  if actual<>expected then raise exception 'โครงสร้างห้องปลายทางเปลี่ยนแล้ว กรุณาเลือกห้องใหม่';end if;
  if actual>0 and p_overwrite is not true then raise exception 'โปรดยืนยันการแทนที่โครงสร้างเดิมของห้องปลายทาง';end if;
  insert into public.pp5_primary_structures(classroom_id,data,revision,updated_by)
   values(target_id,source_data.data,1,auth.uid())
   on conflict(classroom_id) do update set data=excluded.data,revision=pp5_primary_structures.revision+1,updated_by=excluded.updated_by
    where pp5_primary_structures.revision=expected
   returning revision into written;
  if not found then raise exception 'โครงสร้างห้องปลายทางเปลี่ยนแล้ว กรุณาเลือกห้องใหม่';end if;
  result:=result||jsonb_build_array(jsonb_build_object('classroom_id',target_id,'revision',written));
 end loop;
 return result;
end $$;
revoke all on function public.pp5_primary_structure_copy_targets(uuid),public.pp5_copy_primary_structure(uuid,integer,jsonb,boolean) from public,anon;
grant execute on function public.pp5_primary_structure_copy_targets(uuid),public.pp5_copy_primary_structure(uuid,integer,jsonb,boolean) to authenticated;
