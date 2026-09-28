alter table public.school_signatories add column hours_per_credit numeric check(hours_per_credit>0 and hours_per_credit<=200), add column weeks_per_term numeric check(weeks_per_term>0 and weeks_per_term<=52);
alter table public.subject_catalog add column hours_mode text not null default 'manual' check(hours_mode in ('manual','credits')), add column total_hours numeric check(total_hours>=0 and total_hours<=8000), add column level_label text not null default '';
create function private.calculate_subject_hours() returns trigger language plpgsql security invoker set search_path='' as $$
declare h numeric; w numeric;
begin
 if new.hours_mode='credits' then
  select hours_per_credit,weeks_per_term into h,w from public.school_signatories where id=1;
  if h is null or w is null then raise exception 'กรุณาตั้งชั่วโมงต่อหน่วยกิตและสัปดาห์ต่อภาคเรียนในข้อมูลโรงเรียนก่อน';end if;
  new.total_hours:=new.credits*h;new.weekly_hours:=round(new.total_hours/w,4);
 end if;
 return new;
end $$;
create trigger calculate_subject_hours before insert or update on public.subject_catalog for each row execute function private.calculate_subject_hours();
revoke all on function private.calculate_subject_hours() from public,anon,authenticated;

create function public.import_classroom_students(p_room uuid,p_rows jsonb) returns integer language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if not coalesce(private.can_edit_classroom(p_room),false) then raise exception 'ไม่มีสิทธิ์แก้ไขห้องเรียนนี้';end if;
 if jsonb_typeof(p_rows)<>'array' or coalesce(jsonb_array_length(p_rows),0) not between 1 and 200 then raise exception 'ต้องมีรายชื่อ 1–200 คน';end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as x(student_code text,full_name text,sort_order integer) where coalesce(length(btrim(student_code)),0) not between 1 and 40 or coalesce(length(btrim(full_name)),0) not between 1 and 160 or sort_order is null or sort_order not between 1 and 999) then raise exception 'ข้อมูลนักเรียนไม่ครบหรือไม่ถูกต้อง';end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as x(student_code text) group by btrim(student_code) having count(*)>1) or exists(select 1 from jsonb_to_recordset(p_rows) as x(sort_order integer) group by sort_order having count(*)>1) then raise exception 'มีรหัสหรือเลขที่ซ้ำในข้อมูลที่วาง';end if;
 perform 1 from public.classrooms where id=p_room for update;
 if exists(select 1 from jsonb_to_recordset(p_rows) as x(student_code text,sort_order integer) join public.students s on s.classroom_id=p_room and (s.student_code=btrim(x.student_code) or (s.active and s.sort_order=x.sort_order))) then raise exception 'มีรหัสหรือเลขที่ซ้ำกับนักเรียนในห้อง กรุณาแก้ไขก่อนบันทึก';end if;
 insert into public.students(classroom_id,client_uid,student_code,full_name,sort_order,active)
 select p_room,gen_random_uuid(),btrim(student_code),btrim(full_name),sort_order,true from jsonb_to_recordset(p_rows) as x(student_code text,full_name text,sort_order integer);
 get diagnostics n=row_count;return n;
end $$;
revoke all on function public.import_classroom_students(uuid,jsonb) from public,anon;
grant execute on function public.import_classroom_students(uuid,jsonb) to authenticated;

-- Create the subject and all selected classrooms as one transaction under existing RLS.
create or replace function public.create_subject_with_teaching(p_subject jsonb, p_teacher uuid, p_rooms uuid[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_room uuid;
begin
  if not coalesce(private.is_management(),false) then raise exception 'ไม่มีสิทธิ์จัดการรายวิชา'; end if;
  if p_teacher is null or not exists(select 1 from public.profiles where id=p_teacher) then raise exception 'กรุณาเลือกครูผู้สอนจากบัญชีบุคลากร'; end if;
  if coalesce(cardinality(p_rooms),0)=0 then raise exception 'กรุณาเลือกอย่างน้อยหนึ่งห้องเรียน'; end if;
  if exists(select 1 from unnest(p_rooms) r where r is null or not exists(select 1 from public.classrooms c where c.id=r)) then raise exception 'ไม่พบห้องเรียนที่เลือก'; end if;
  insert into public.subject_catalog(code,name,department,credits,weekly_hours,active,hours_mode,total_hours,level_label)
  values(btrim(p_subject->>'code'),btrim(p_subject->>'name'),(p_subject->>'department')::integer,(p_subject->>'credits')::numeric,(p_subject->>'weekly_hours')::numeric,coalesce((p_subject->>'active')::boolean,true),coalesce(p_subject->>'hours_mode','manual'),nullif(p_subject->>'total_hours','')::numeric,coalesce(p_subject->>'level_label','')) returning id into v_id;
  for v_room in select distinct unnest(p_rooms) loop
    insert into public.teaching_assignments(classroom_id,subject_id,teacher_id,active)
    values(v_room,v_id,p_teacher,coalesce((p_subject->>'active')::boolean,true));
  end loop;
  return v_id;
end $$;
revoke all on function public.create_subject_with_teaching(jsonb,uuid,uuid[]) from public,anon;
grant execute on function public.create_subject_with_teaching(jsonb,uuid,uuid[]) to authenticated;

