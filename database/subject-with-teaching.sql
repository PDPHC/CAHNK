-- Create the subject and all selected classrooms as one transaction under existing RLS.
create function public.create_subject_with_teaching(p_subject jsonb, p_teacher uuid, p_rooms uuid[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_room uuid;
begin
  if not coalesce(private.is_management(),false) then raise exception 'ไม่มีสิทธิ์จัดการรายวิชา'; end if;
  if p_teacher is null or not exists(select 1 from public.profiles where id=p_teacher) then raise exception 'กรุณาเลือกครูผู้สอนจากบัญชีบุคลากร'; end if;
  if coalesce(cardinality(p_rooms),0)=0 then raise exception 'กรุณาเลือกอย่างน้อยหนึ่งห้องเรียน'; end if;
  if exists(select 1 from unnest(p_rooms) r where r is null or not exists(select 1 from public.classrooms c where c.id=r)) then raise exception 'ไม่พบห้องเรียนที่เลือก'; end if;
  insert into public.subject_catalog(code,name,department,credits,weekly_hours,active)
  values(btrim(p_subject->>'code'),btrim(p_subject->>'name'),(p_subject->>'department')::integer,(p_subject->>'credits')::numeric,(p_subject->>'weekly_hours')::numeric,coalesce((p_subject->>'active')::boolean,true)) returning id into v_id;
  for v_room in select distinct unnest(p_rooms) loop
    insert into public.teaching_assignments(classroom_id,subject_id,teacher_id,active)
    values(v_room,v_id,p_teacher,coalesce((p_subject->>'active')::boolean,true));
  end loop;
  return v_id;
end $$;
revoke all on function public.create_subject_with_teaching(jsonb,uuid,uuid[]) from public,anon;
grant execute on function public.create_subject_with_teaching(jsonb,uuid,uuid[]) to authenticated;

