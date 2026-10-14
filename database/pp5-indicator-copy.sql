-- Copy only curriculum configuration; caller permissions and submitted-book locks remain in force.
create or replace function private.pp5_copy_level_key(value text) returns text
language sql immutable security invoker set search_path='' as $$
 select regexp_replace(translate(replace(replace(btrim(value),'มัธยมศึกษาปีที่','ม.'),'ประถมศึกษาปีที่','ป.'),'๐๑๒๓๔๕๖๗๘๙','0123456789'),'[[:space:]]','','g');
$$;
create or replace function private.pp5_indicator_copy_key(value text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select value in ('__pp5_indicator_count','__pp5_deleted_indicators','D!N24') or value ~ '^IN![E-J]3$' or value ~ '^D!C(28|29|30)$'
 or case when value ~ '^D![COPQRT][0-9]+$' then
  substring(value from '[0-9]+$')::integer between 8 and 22 or substring(value from '[0-9]+$')::integer between 54 and 153 or value ~ '^D![OPQRT]24$'
 else false end;
$$;
revoke all on function private.pp5_copy_level_key(text),private.pp5_indicator_copy_key(text) from public,anon;
grant execute on function private.pp5_copy_level_key(text),private.pp5_indicator_copy_key(text) to authenticated;

create or replace function public.pp5_indicator_copy_targets(p_source uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare source_room public.classrooms; result jsonb;
begin
 if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
 select c.* into source_room from public.pp5_books b join public.classrooms c on c.id=b.classroom_id where b.id=p_source;
 if not found then raise exception 'ไม่มีสิทธิ์เข้าถึงเล่มต้นทาง'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'title',b.title,'revision',b.revision,'class_level',c.class_level,'room',c.room) order by c.room,b.title),'[]'::jsonb) into result
 from public.pp5_books b join public.classrooms c on c.id=b.classroom_id
 where c.id<>source_room.id and private.pp5_copy_level_key(c.class_level)=private.pp5_copy_level_key(source_room.class_level)
 and c.academic_year=source_room.academic_year and c.term=source_room.term
 and (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=c.id and ct.teacher_id=auth.uid() and ct.permission in ('owner','editor')))
 and public.pp5_workflow_state(b.id)->>'status' in ('draft','returned');
 return result;
end;
$$;

create or replace function public.pp5_copy_indicators(p_source uuid,p_source_revision integer,p_target uuid,p_target_revision integer,p_values jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare source_book public.pp5_books; target_book public.pp5_books; source_room public.classrooms; target_room public.classrooms; key text; value jsonb; retained jsonb; updated_revision integer;
begin
 if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
 if p_source=p_target then raise exception 'ต้องเลือกเล่มในอีกห้อง'; end if;
 perform b.id from public.pp5_books b where b.id in (p_source,p_target) order by b.id for update;
 select * into source_book from public.pp5_books where id=p_source;
 if not found then raise exception 'ไม่มีสิทธิ์เข้าถึงเล่มต้นทาง'; end if;
 select * into target_book from public.pp5_books where id=p_target;
 if not found then raise exception 'ไม่มีสิทธิ์เข้าถึงเล่มปลายทาง'; end if;
 select * into source_room from public.classrooms where id=source_book.classroom_id for share;
 select * into target_room from public.classrooms where id=target_book.classroom_id for share;
 if source_room.id=target_room.id then raise exception 'ต้องเลือกเล่มในอีกห้อง'; end if;
 if private.pp5_copy_level_key(source_room.class_level) is distinct from private.pp5_copy_level_key(target_room.class_level) then raise exception 'คัดลอกได้เฉพาะระดับชั้นเดียวกัน'; end if;
 if (source_room.academic_year,source_room.term) is distinct from (target_room.academic_year,target_room.term) then raise exception 'ต้องเป็นปีการศึกษาและภาคเรียนเดียวกัน'; end if;
 if not (private.is_management() or exists(select 1 from public.classroom_teachers ct where ct.classroom_id=target_room.id and ct.teacher_id=auth.uid() and ct.permission in ('owner','editor'))) then raise exception 'ไม่มีสิทธิ์แก้ไขห้องปลายทาง'; end if;
 if p_source_revision is distinct from source_book.revision or p_target_revision is distinct from target_book.revision then raise exception 'ข้อมูลเล่มเปลี่ยนแล้ว กรุณาปิดหน้าต่างและเลือกปลายทางใหม่'; end if;
 if public.pp5_workflow_state(source_book.id)->>'status' not in ('draft','returned') or public.pp5_workflow_state(target_book.id)->>'status' not in ('draft','returned') then raise exception 'เล่มอยู่ระหว่างตรวจหรือเก็บเข้าคลังแล้ว'; end if;
 if p_values is null or jsonb_typeof(p_values)<>'object' or octet_length(p_values::text)>262144 then raise exception 'ข้อมูลตัวชี้วัดไม่ถูกต้อง'; end if;
 for key,value in select * from jsonb_each(p_values) loop
  if not private.pp5_indicator_copy_key(key) then raise exception 'ไม่อนุญาตให้คัดลอกช่อง %',key; end if;
  if key='__pp5_indicator_count' then
   if jsonb_typeof(value)<>'number' or value::text !~ '^[0-9]+$' or (value::text)::integer not between 0 and 100 then raise exception 'จำนวนตัวชี้วัดไม่ถูกต้อง'; end if;
  elsif key='__pp5_deleted_indicators' then
   if jsonb_typeof(value)<>'array' then raise exception 'รายการตัวชี้วัดไม่ถูกต้อง'; end if;
   if exists(select 1 from jsonb_array_elements(value) as items(item) where jsonb_typeof(item)<>'number' or item::text !~ '^(8|9|1[0-9]|2[0-2])$') then raise exception 'รายการตัวชี้วัดไม่ถูกต้อง'; end if;
  elsif key ~ '^D!C' then
   if jsonb_typeof(value)<>'string' then raise exception 'ข้อความตัวชี้วัดไม่ถูกต้อง'; end if;
  elsif value<>'""'::jsonb and (jsonb_typeof(value)<>'number' or (value::text)::numeric<0) then raise exception 'คะแนนและชั่วโมงต้องเป็นตัวเลขตั้งแต่ศูนย์';
  end if;
 end loop;
 if not (p_values ? '__pp5_indicator_count' and p_values ? '__pp5_deleted_indicators') then raise exception 'ข้อมูลตัวชี้วัดไม่ครบ'; end if;
 select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into retained from jsonb_each(target_book.patches) e where not private.pp5_indicator_copy_key(e.key);
 update public.pp5_books set patches=retained||p_values,updated_by=auth.uid() where id=p_target returning revision into updated_revision;
 if not found then raise exception 'ไม่มีสิทธิ์แก้ไขห้องปลายทาง'; end if;
 return jsonb_build_object('id',p_target,'revision',updated_revision);
end;
$$;
revoke all on function public.pp5_indicator_copy_targets(uuid),public.pp5_copy_indicators(uuid,integer,uuid,integer,jsonb) from public,anon;
grant execute on function public.pp5_indicator_copy_targets(uuid),public.pp5_copy_indicators(uuid,integer,uuid,integer,jsonb) to authenticated;
