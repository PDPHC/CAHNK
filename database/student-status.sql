alter table public.students add column record_status text not null default 'normal' check(record_status in ('normal','transferred','not_present','special')), add column status_note text not null default '' check(length(status_note)<=500);
create function private.student_module_snapshot(d jsonb,k text,u text) returns jsonb language sql immutable set search_path='' as $$
 select case when k='scholarship' then (select coalesce(jsonb_agg(v order by v->>'uid'),'[]') from jsonb_array_elements(coalesce(d->'rows','[]')) v where v->>'studentUid'=u)
 when k='volunteer' then (select coalesce(jsonb_object_agg(m,v->'data'->u),'{}') from jsonb_each(coalesce(d->'months','{}')) x(m,v) where coalesce(v->'data'->u,'{}')<>'{}')
 else (select coalesce(jsonb_object_agg(m,v->u),'{}') from jsonb_each(coalesce(d,'{}')) x(m,v) where jsonb_typeof(v)='object' and coalesce(v->u,'{}')<>'{}') end;
$$;
create function private.guard_blocked_module_students() returns trigger language plpgsql security invoker set search_path='' as $$
declare s record;before_data jsonb;
begin
 if new.module_name not in ('attendance','savings','behavior','health','literacy','volunteer','scholarship') then return new;end if;
 -- INSERT ON CONFLICT also fires this trigger; inspect the existing row for upserts.
 select data into before_data from public.module_data where classroom_id=new.classroom_id and module_name=new.module_name;
 for s in select coalesce(nullif(client_uid,''),id::text) as u from public.students where classroom_id=new.classroom_id and record_status in ('transferred','not_present') loop
  if private.student_module_snapshot(coalesce(before_data,'{}'),new.module_name,s.u) is distinct from private.student_module_snapshot(new.data,new.module_name,s.u) then raise exception 'ไม่อนุญาตให้แก้ไขข้อมูลนักเรียนที่ย้ายออกหรือไม่มีตัวตน กรุณาโหลดหน้าใหม่';end if;
 end loop;return new;
end $$;
create trigger guard_blocked_module_students before insert or update on public.module_data for each row execute function private.guard_blocked_module_students();
create function private.pp5_student_snapshot(p jsonb,code text) returns jsonb language plpgsql immutable set search_path='' as $$
declare r integer;k text;v jsonb;res jsonb:='{}';sheet text;ref text;n integer;
begin
 for r in 4..63 loop
  if p->>('IN!C'||r)=code then
   for k,v in select * from jsonb_each(p) loop
    sheet:=split_part(k,'!',1);ref:=split_part(k,'!',2);
    if ref !~ '^[A-Z]+[0-9]+$' then continue;end if;n:=substring(ref from '[0-9]+$')::integer;
    if (sheet='IN' and n=r and ref ~ '^[E-K][0-9]+$') or (sheet in ('F','CH') and n=r+3) then
     if v not in ('null'::jsonb,'""'::jsonb) then res:=res||jsonb_build_object(sheet||'!'||regexp_replace(ref,'[0-9]+$',''),v);end if;
    end if;
   end loop;
  end if;
 end loop;return res;
end $$;
create function private.guard_blocked_pp5_students() returns trigger language plpgsql security invoker set search_path='' as $$
declare s record;p jsonb:='{}';begin
 if tg_op='UPDATE' then p:=old.patches;end if;
 for s in select student_code from public.students where classroom_id=new.classroom_id and record_status in ('transferred','not_present') loop
  if private.pp5_student_snapshot(p,s.student_code) is distinct from private.pp5_student_snapshot(new.patches,s.student_code) then raise exception 'ไม่อนุญาตให้แก้ไขคะแนนหรือเวลาเรียนของนักเรียนที่ย้ายออกหรือไม่มีตัวตน';end if;
 end loop;return new;
end $$;
create trigger guard_blocked_pp5_students before insert or update on public.pp5_books for each row execute function private.guard_blocked_pp5_students();
revoke all on function private.guard_blocked_module_students(),private.guard_blocked_pp5_students() from public,anon,authenticated;
revoke all on function private.student_module_snapshot(jsonb,text,text),private.pp5_student_snapshot(jsonb,text) from public,anon;
grant execute on function private.student_module_snapshot(jsonb,text,text),private.pp5_student_snapshot(jsonb,text) to authenticated;

