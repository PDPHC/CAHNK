-- Admin news and server-enforced PP5/PP6 entry periods. Existing classroom RLS stays in force.
create or replace function private.school_controls_admin() returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create or replace function private.pp5_window_exempt() returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is null or exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','director','deputy_director','academic'));
$$;
revoke all on function private.school_controls_admin(),private.pp5_window_exempt() from public,anon;
grant execute on function private.school_controls_admin(),private.pp5_window_exempt() to authenticated;

create table public.school_announcements (
 id uuid primary key default gen_random_uuid(), title text not null check(length(btrim(title)) between 1 and 160),
 body text not null default '' check(length(body)<=3000), tone text not null default 'info' check(tone in ('info','important','urgent')),
 published boolean not null default false, audience text not null default 'authenticated' check(audience in ('authenticated','public')),
 starts_at timestamptz, ends_at timestamptz, revision integer not null default 1,
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
 check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create table public.pp5_entry_windows (
 education_level text not null check(education_level in ('primary','secondary')), academic_year integer not null check(academic_year between 2500 and 2800),
 term integer not null check(term in (1,2)), mode text not null default 'open' check(mode in ('open','closed','scheduled')),
 opens_at timestamptz, closes_at timestamptz, revision integer not null default 1,
 updated_by uuid references auth.users(id), updated_at timestamptz not null default now(),
 primary key(education_level,academic_year,term),
 check(mode<>'scheduled' or (opens_at is not null and closes_at is not null and closes_at>opens_at))
);
alter table public.school_announcements enable row level security;
alter table public.pp5_entry_windows enable row level security;
revoke all on public.school_announcements,public.pp5_entry_windows from anon,authenticated;
grant select on public.school_announcements to authenticated;
grant select(id,title,body,tone,published,audience,starts_at,ends_at,updated_at) on public.school_announcements to anon;
grant insert,update on public.school_announcements to authenticated;
grant select,insert,update on public.pp5_entry_windows to authenticated;
create policy notices_public on public.school_announcements for select to anon using(
 published and audience='public' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now()));
create policy notices_signed_in on public.school_announcements for select to authenticated using(
 private.school_controls_admin() or (published and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())));
create policy notices_insert on public.school_announcements for insert to authenticated with check(private.school_controls_admin() and updated_by=auth.uid());
create policy notices_update on public.school_announcements for update to authenticated using(private.school_controls_admin()) with check(private.school_controls_admin() and updated_by=auth.uid());
create policy periods_read on public.pp5_entry_windows for select to authenticated using(true);
create policy periods_insert on public.pp5_entry_windows for insert to authenticated with check(private.school_controls_admin() and updated_by=auth.uid());
create policy periods_update on public.pp5_entry_windows for update to authenticated using(private.school_controls_admin()) with check(private.school_controls_admin() and updated_by=auth.uid());

create or replace function private.school_control_revision() returns trigger
language plpgsql security invoker set search_path='' as $$ begin
 if tg_op='UPDATE' and new.revision<>old.revision+1 then raise exception 'การตั้งค่าถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุด';end if;
 if new.revision<1 then raise exception 'รุ่นข้อมูลไม่ถูกต้อง';end if;
 new.updated_at:=now();return new;
end $$;
create trigger school_notice_revision before insert or update on public.school_announcements for each row execute function private.school_control_revision();
create trigger school_period_revision before insert or update on public.pp5_entry_windows for each row execute function private.school_control_revision();

create or replace function public.school_notice_feed() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('server_now',now(),'announcements',coalesce(jsonb_agg(jsonb_build_object(
 'id',id,'title',title,'body',body,'tone',tone,'starts_at',starts_at,'ends_at',ends_at) order by updated_at desc),'[]'::jsonb))
 from public.school_announcements where published and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
$$;
revoke all on function public.school_notice_feed() from public;
grant execute on function public.school_notice_feed() to anon,authenticated;

create or replace function private.pp5_education_level(value text) returns text
language sql immutable security invoker set search_path='' as $$
 select case when v ~ '^(ประถมศึกษาปีที่|ป\.?)[1-6]$' then 'primary' when v ~ '^(มัธยมศึกษาปีที่|ม\.?)[1-6]$' then 'secondary' end
 from (select regexp_replace(translate(value,'๐๑๒๓๔๕๖๗๘๙','0123456789'),'[[:space:]]','','g') v) q;
$$;
create or replace function private.pp5_window_open(p_level text,p_year integer,p_term integer) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((select case mode when 'open' then true when 'closed' then false else now()>=opens_at and now()<closes_at end
 from public.pp5_entry_windows where education_level=p_level and academic_year=p_year and term=p_term),true);
$$;
create or replace function private.pp5_room_entry_open(p_room uuid,p_term integer default null) returns boolean
language sql stable security invoker set search_path='' as $$
 select private.pp5_window_exempt() or coalesce((select case when p_term is null then
 private.pp5_window_open(private.pp5_education_level(class_level),academic_year,1) or private.pp5_window_open(private.pp5_education_level(class_level),academic_year,2)
 else private.pp5_window_open(private.pp5_education_level(class_level),academic_year,p_term) end from public.classrooms where id=p_room),false);
$$;

-- Canonical projection ignores empty pupil records added while editing the other term.
create or replace function private.pp5_score_term(payload jsonb,t integer) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('maxima',coalesce(payload->'maxima'->t,jsonb_build_object('tasks',to_jsonb(array_fill(10,array[16])),'mid',0)),
 'scores',coalesce((select jsonb_object_agg(key,value->'terms'->t) from jsonb_each(coalesce(payload->'scores','{}'))
 where value->'terms'->t is not null and value->'terms'->t<>jsonb_build_object('tasks',to_jsonb(array_fill(null::integer,array[16])),'mid',null,'final',null)),'{}'::jsonb));
$$;
create or replace function private.pp5_guard_entry_window() returns trigger
language plpgsql security invoker set search_path='' as $$
declare r uuid; t integer; previous jsonb; nextdata jsonb; level_term integer;
begin
 if private.pp5_window_exempt() then if tg_op='DELETE' then return old;else return new;end if;end if;
 r:=case when tg_op='DELETE' then old.classroom_id else new.classroom_id end;
 if tg_op='UPDATE' and old.classroom_id is distinct from new.classroom_id then
  raise exception 'ไม่สามารถเปลี่ยนห้องของข้อมูล ปพ.5';
 end if;
 if tg_table_name='pp5_books' then
  select term into level_term from public.classrooms where id=r;
  if not private.pp5_room_entry_open(r,level_term) then raise exception 'ปิดรับข้อมูล ปพ.5 / ปพ.6 ภาคเรียนที่ % ตามกำหนดของ Admin — ยังดูและพิมพ์ได้',level_term;end if;
 elsif tg_table_name='pp5_primary_attendance' then
  t:=case when tg_op='DELETE' then old.term else new.term end;
  if tg_op='UPDATE' and old.term is distinct from new.term then raise exception 'ไม่สามารถเปลี่ยนภาคเรียนของข้อมูล';end if;
  if not private.pp5_room_entry_open(r,t) then raise exception 'ปิดรับข้อมูล ปพ.5 / ปพ.6 ภาคเรียนที่ % ตามกำหนดของ Admin — ยังดูและพิมพ์ได้',t;end if;
 else
  if tg_op<>'INSERT' then previous:=old.data;end if;
  if tg_op<>'DELETE' then nextdata:=new.data;end if;
  if tg_op='UPDATE' and previous is not distinct from nextdata then return new;end if;
  if tg_table_name='pp5_primary_course_scores' then
   for t in 0..1 loop
    if private.pp5_score_term(previous,t) is distinct from private.pp5_score_term(nextdata,t) and not private.pp5_room_entry_open(r,t+1) then
     raise exception 'ปิดรับคะแนนภาคเรียนที่ % ตามกำหนดของ Admin — ข้อมูลที่กรอกยังอยู่ในหน้านี้',t+1;
    end if;
   end loop;
  else
   if not private.pp5_room_entry_open(r) then raise exception 'ปิดรับข้อมูล ปพ.5 / ปพ.6 ทั้งสองภาคเรียน — ยังดูและพิมพ์ได้';end if;
   if tg_table_name='pp5_primary_structures' and coalesce(previous->'ratio','{"collect":40,"exam":10}'::jsonb) is distinct from nextdata->'ratio'
    and (not private.pp5_room_entry_open(r,1) or not private.pp5_room_entry_open(r,2)) then
    raise exception 'อัตราส่วนคะแนนใช้ทั้งปี ต้องเปิดรับข้อมูลทั้งสองภาคเรียนจึงแก้ไขได้';
   end if;
  end if;
 end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
do $$ declare tab text;begin
 foreach tab in array array['pp5_books','pp5_primary_structures','pp5_primary_course_scores','pp5_primary_attendance','pp5_primary_traits','pp5_primary_reading','pp5_primary_activities','pp5_primary_cover_settings'] loop
  execute format('create trigger aa_pp5_entry_window before insert or update or delete on public.%I for each row execute function private.pp5_guard_entry_window()',tab);
 end loop;
end $$;
create or replace function public.pp5_entry_access(p_room uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare r public.classrooms; lev text; periods jsonb;
begin
 if not coalesce(private.can_view_classroom(p_room),false) then raise exception 'ไม่มีสิทธิ์เข้าถึงห้องเรียน';end if;
 select * into r from public.classrooms where id=p_room;lev:=private.pp5_education_level(r.class_level);
 if lev is null then raise exception 'ไม่พบระดับชั้นประถมหรือมัธยม';end if;
 select jsonb_agg(jsonb_build_object('term',s.t,'mode',coalesce(w.mode,'open'),'opens_at',w.opens_at,'closes_at',w.closes_at) order by s.t) into periods
 from generate_series(1,2) s(t) left join public.pp5_entry_windows w on w.education_level=lev and w.academic_year=r.academic_year and w.term=s.t;
 return jsonb_build_object('room',r.id,'education_level',lev,'academic_year',r.academic_year,'server_now',now(),'exempt',private.pp5_window_exempt(),'terms',periods);
end $$;
create or replace function private.primary_structure_can_edit(p_room uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and private.pp5_room_entry_open(p_room) and (private.is_management() or exists(
 select 1 from public.classroom_teachers ct where ct.classroom_id=p_room and ct.teacher_id=auth.uid() and ct.permission in ('owner','editor')));
$$;
revoke all on function private.pp5_education_level(text),private.pp5_window_open(text,integer,integer),private.pp5_room_entry_open(uuid,integer),private.pp5_score_term(jsonb,integer),private.pp5_guard_entry_window(),private.school_control_revision(),public.pp5_entry_access(uuid) from public,anon;
grant execute on function private.pp5_education_level(text),private.pp5_window_open(text,integer,integer),private.pp5_room_entry_open(uuid,integer),private.pp5_score_term(jsonb,integer),public.pp5_entry_access(uuid) to authenticated;
