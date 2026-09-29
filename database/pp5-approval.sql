-- PP5 approvals are separate from monthly classroom submissions.
begin;
create table public.pp5_reviewers (
 stage text not null check(stage in ('department','assessment','deputy','director')),
 scope text not null,
 user_id uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key(stage,scope),
 check((stage='department' and scope in ('0','1','2','3','4','5','6','7')) or
       (stage='assessment' and scope in ('kindergarten','primary_lower','primary_upper','secondary_lower')) or
       (stage in ('deputy','director') and scope='all'))
);
create table public.pp5_submissions (
 book_id uuid primary key references public.pp5_books(id),
 status text not null check(status in ('department','assessment','deputy','director','returned','archived')),
 revision integer not null default 1,
 round integer not null default 1,
 submitted_by uuid not null references public.profiles(id),
 submitted_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 archived_at timestamptz,
 route jsonb not null,
 snapshot jsonb not null,
 signatures jsonb not null default '{}',
 return_reason text not null default ''
);
create table public.pp5_review_events (
 id bigint generated always as identity primary key,
 book_id uuid not null references public.pp5_submissions(book_id),
 round integer not null,
 actor_id uuid references public.profiles(id),
 actor_name text not null,
 action text not null,
 stage text not null,
 note text not null default '',
 signature jsonb,
 snapshot jsonb,
 created_at timestamptz not null default now()
);
create index pp5_submissions_status on public.pp5_submissions(status,updated_at);
create index pp5_events_book on public.pp5_review_events(book_id,id);
create function private.pp5_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create function private.pp5_participant(route jsonb,teacher uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (private.pp5_admin() or teacher=auth.uid() or exists(select 1 from jsonb_each_text(route) where value=auth.uid()::text));
$$;
alter table public.pp5_reviewers enable row level security;
alter table public.pp5_submissions enable row level security;
alter table public.pp5_review_events enable row level security;
revoke all on public.pp5_reviewers,public.pp5_submissions,public.pp5_review_events from anon,authenticated;
grant select on public.pp5_reviewers,public.pp5_submissions,public.pp5_review_events to authenticated;
create policy pp5_reviewer_read on public.pp5_reviewers for select to authenticated using(private.pp5_admin() or user_id=auth.uid());
create policy pp5_submission_read on public.pp5_submissions for select to authenticated using(private.pp5_participant(route,submitted_by));
create policy pp5_event_read on public.pp5_review_events for select to authenticated using(exists(select 1 from public.pp5_submissions s where s.book_id=pp5_review_events.book_id and private.pp5_participant(s.route,s.submitted_by)));
-- Only the assigned teacher or an existing classroom reader sees a workflow state.
create function public.pp5_workflow_state(p_book uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare b public.pp5_books; s public.pp5_submissions;
begin
 select * into b from public.pp5_books where id=p_book;
 if not found or not private.can_view_classroom(b.classroom_id) then raise exception 'ไม่มีสิทธิ์เข้าถึงเล่ม'; end if;
 select * into s from public.pp5_submissions where book_id=p_book;
 if not found then return jsonb_build_object('status','draft');end if;
 return jsonb_build_object('status',s.status,'revision',s.revision,'return_reason',s.return_reason,'round',s.round);
end $$;
create function private.pp5_lock_submitted() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.pp5_submissions where book_id=old.id and status<>'returned') then
  raise exception 'เล่มอยู่ระหว่างตรวจหรือเก็บเข้าคลังแล้ว ไม่อนุญาตให้แก้ไข';
 end if;if TG_OP='DELETE' then return old;end if;return new;
end $$;
create trigger pp5_lock_submitted before update or delete on public.pp5_books for each row execute function private.pp5_lock_submitted();
create function public.pp5_reviewer_settings() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.pp5_admin() then raise exception 'เฉพาะ Admin';end if;
 return jsonb_build_object('people',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name,'role',role) order by display_name),'[]') from public.profiles),
 'reviewers',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.pp5_reviewers r));
end $$;
create function public.pp5_save_reviewers(p_rows jsonb) returns void language plpgsql security definer set search_path='' as $$
declare r jsonb; v_role text;
begin
 if not private.pp5_admin() then raise exception 'เฉพาะ Admin';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<>14 then raise exception 'ต้องกำหนดผู้ตรวจครบ 14 ตำแหน่ง';end if;
 if (select count(distinct ((v->>'stage')||':'||(v->>'scope'))) from jsonb_array_elements(p_rows) v)<>14 then raise exception 'ตำแหน่งซ้ำ';end if;
 for r in select * from jsonb_array_elements(p_rows) loop
  select role into v_role from public.profiles where id=(r->>'user_id')::uuid;
  if not found then raise exception 'ไม่พบบัญชีผู้ตรวจ';end if;
  if r->>'stage'='director' and v_role<>'director' then raise exception 'ผอ. ต้องเป็นบัญชีสิทธิ์ ผอ.';end if;
  if r->>'stage'='deputy' and v_role<>'deputy_director' then raise exception 'รองวิชาการต้องเป็นบัญชีสิทธิ์ รอง ผอ.';end if;
  insert into public.pp5_reviewers(stage,scope,user_id) values(r->>'stage',r->>'scope',(r->>'user_id')::uuid)
  on conflict(stage,scope) do update set user_id=excluded.user_id,updated_at=now();
 end loop;
end $$;
create function private.pp5_assessment_scope(level text) returns text language plpgsql immutable set search_path='' as $$
declare s text:=regexp_replace(translate(level,'๐๑๒๓๔๕๖๗๘๙','0123456789'),'\s','','g');n integer;
begin
 if s ~ 'อนุบาล|^อ\.' then return 'kindergarten';end if;
 n:=substring(s from '(?:ปีที่|ป\.|ม\.)([1-6])')::integer;
 if s ~ 'ประถม|^ป\.' then
  if s like '%ตอนต้น%' or n between 1 and 3 then return 'primary_lower';end if;
  if s like '%ตอนปลาย%' or n between 4 and 6 then return 'primary_upper';end if;
 elsif s ~ 'มัธยม|^ม\.' and (s like '%ตอนต้น%' or n between 1 and 3) then return 'secondary_lower';end if;
 return null;
end $$;
create function private.pp5_sign() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare image text;name text;
begin
 select signature_data into image from public.user_signatures where user_id=auth.uid();
 if image is null or image !~ '^data:image/(png|jpeg|webp);base64,' then raise exception 'กรุณาบันทึกลายเซ็นของฉันก่อนส่งหรืออนุมัติ';end if;
 select display_name into name from public.profiles where id=auth.uid();
 if length(btrim(coalesce(name,'')))=0 then raise exception 'กรุณากำหนดชื่อผู้ใช้ก่อนลงนาม';end if;
 return jsonb_build_object('user_id',auth.uid(),'name',name,'image',image,'at',now());
end $$;
create function public.pp5_submit(p_book uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare b public.pp5_books;a public.teaching_assignments;c public.classrooms;s public.pp5_submissions;department integer;v_scope text;route jsonb;sig jsonb;snap jsonb;
begin
 if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ';end if;
 select * into b from public.pp5_books where id=p_book for update;
 if not found or b.revision is distinct from p_revision then raise exception 'เล่มมีการเปลี่ยนแปลง กรุณาเปิดใหม่';end if;
 select * into a from public.teaching_assignments where id=b.assignment_id and active;
 if not found or a.teacher_id is distinct from auth.uid() then raise exception 'เฉพาะครูผู้สอนที่กำหนดให้รายวิชานี้';end if;
 select * into s from public.pp5_submissions where book_id=p_book for update;
 if found and s.status<>'returned' then raise exception 'ส่งเล่มนี้แล้ว';end if;
 select * into c from public.classrooms where id=b.classroom_id;
 select sc.department into department from public.subject_catalog sc where id=a.subject_id and active;
 v_scope:=private.pp5_assessment_scope(c.class_level);
 if v_scope is null or department is null then raise exception 'ไม่พบกลุ่มสาระหรือช่วงชั้นที่รองรับ';end if;
 select jsonb_object_agg(r.stage,r.user_id) into route from public.pp5_reviewers r where
 (r.stage='department' and r.scope=department::text) or (r.stage='assessment' and r.scope=v_scope) or r.stage in ('deputy','director');
 if route is null or not(route ?& array['department','assessment','deputy','director']) then raise exception 'Admin ยังไม่ได้กำหนดบัญชีผู้ตรวจครบตามเส้นทาง';end if;
 sig:=private.pp5_sign();
 snap:=jsonb_build_object('title',b.title,'classroom_id',b.classroom_id,'class_label',c.class_level||'/'||c.room,'academic_year',c.academic_year,'term',c.term,'department',department,'assessment_scope',v_scope,'book_revision',b.revision,'template_base64',b.template_base64,'patches',b.patches,'holidays',case when c.use_thai_holidays=false then '[]'::jsonb else coalesce(c.holidays,'[]'::jsonb) end);
 insert into public.pp5_submissions(book_id,status,submitted_by,route,snapshot,signatures) values(p_book,'department',auth.uid(),route,snap,jsonb_build_object('teacher',sig))
 on conflict(book_id) do update set status='department',revision=pp5_submissions.revision+1,round=pp5_submissions.round+1,submitted_by=excluded.submitted_by,submitted_at=now(),updated_at=now(),archived_at=null,route=excluded.route,snapshot=excluded.snapshot,signatures=excluded.signatures,return_reason='' returning * into s;
 insert into public.pp5_review_events(book_id,round,actor_id,actor_name,action,stage,signature,snapshot) values(p_book,s.round,auth.uid(),sig->>'name','submit','teacher',sig,snap);
 return jsonb_build_object('status',s.status,'revision',s.revision);
end $$;
create function public.pp5_review_action(p_book uuid,p_revision integer,p_action text,p_note text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.pp5_submissions;sig jsonb;next_stage text;actor text;
begin
 if auth.uid() is null then raise exception 'กรุณาเข้าสู่ระบบ';end if;
 perform 1 from public.pp5_books where id=p_book for update;
 select * into s from public.pp5_submissions where book_id=p_book for update;
 if not found or s.revision is distinct from p_revision then raise exception 'สถานะเปลี่ยนแล้ว กรุณาโหลดใหม่';end if;
 if s.status not in ('department','assessment','deputy','director') or s.route->>s.status is distinct from auth.uid()::text then raise exception 'ไม่ใช่ผู้ตรวจที่รับผิดชอบในขั้นตอนนี้';end if;
 if p_action is null or p_action not in ('approve','return') then raise exception 'คำสั่งไม่ถูกต้อง';end if;
 if length(coalesce(p_note,''))>2000 then raise exception 'หมายเหตุยาวเกิน 2,000 ตัวอักษร';end if;
 if p_action='return' then
  if length(btrim(coalesce(p_note,'')))=0 then raise exception 'กรุณาระบุเหตุผลส่งคืน';end if;
  next_stage:='returned';
 else
  sig:=private.pp5_sign();next_stage:=case s.status when 'department' then 'assessment' when 'assessment' then 'deputy' when 'deputy' then 'director' else 'archived' end;
 end if;
 select display_name into actor from public.profiles where id=auth.uid();
 update public.pp5_submissions set status=next_stage,revision=revision+1,updated_at=now(),return_reason=case when p_action='return' then btrim(p_note) else '' end,
 signatures=case when sig is not null then signatures||jsonb_build_object(s.status,sig) else signatures end,
 archived_at=case when next_stage='archived' then now() else null end where book_id=p_book;
 insert into public.pp5_review_events(book_id,round,actor_id,actor_name,action,stage,note,signature) values(p_book,s.round,auth.uid(),actor,p_action,s.status,coalesce(p_note,''),sig);
 return jsonb_build_object('status',next_stage,'revision',s.revision+1);
end $$;
create function public.pp5_review_list() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('book_id',book_id,'status',status,'revision',revision,'round',round,'submitted_by',submitted_by,'updated_at',updated_at,'archived_at',archived_at,'route',route,'title',snapshot->>'title','class_label',snapshot->>'class_label','academic_year',snapshot->>'academic_year','term',snapshot->>'term','teacher',signatures->'teacher'->>'name') order by updated_at desc),'[]'::jsonb)
 from public.pp5_submissions where private.pp5_participant(route,submitted_by);
$$;
revoke all on function public.pp5_review_list() from public,anon;
grant execute on function public.pp5_review_list() to authenticated;
-- Teachers store only their own signature; reviewers never fetch another user's signature directly.
drop policy user_signatures_insert_own on public.user_signatures;
drop policy user_signatures_update_own on public.user_signatures;
create policy user_signatures_insert_own on public.user_signatures for insert to authenticated with check(user_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid()));
create policy user_signatures_update_own on public.user_signatures for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke all on function private.pp5_admin(),private.pp5_participant(jsonb,uuid),private.pp5_lock_submitted(),private.pp5_assessment_scope(text),private.pp5_sign() from public,anon,authenticated;
grant execute on function private.pp5_admin(),private.pp5_participant(jsonb,uuid) to authenticated;
revoke all on function public.pp5_workflow_state(uuid),public.pp5_reviewer_settings(),public.pp5_save_reviewers(jsonb),public.pp5_submit(uuid,integer),public.pp5_review_action(uuid,integer,text,text) from public,anon;
grant execute on function public.pp5_workflow_state(uuid),public.pp5_reviewer_settings(),public.pp5_save_reviewers(jsonb),public.pp5_submit(uuid,integer),public.pp5_review_action(uuid,integer,text,text) to authenticated;
-- Privileged implementations stay in the non-exposed private schema.
-- Public RPC wrappers run as the caller; private functions enforce all identity/state checks.
alter function public.pp5_workflow_state(uuid) set schema private;
create function public.pp5_workflow_state(p_book uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private.pp5_workflow_state(p_book); $$;
revoke all on function public.pp5_workflow_state(uuid) from public,anon;
grant execute on function public.pp5_workflow_state(uuid) to authenticated;
alter function public.pp5_reviewer_settings() set schema private;
create function public.pp5_reviewer_settings() returns jsonb language sql stable security invoker set search_path='' as $$ select private.pp5_reviewer_settings(); $$;
revoke all on function public.pp5_reviewer_settings() from public,anon;
grant execute on function public.pp5_reviewer_settings() to authenticated;
alter function public.pp5_save_reviewers(jsonb) set schema private;
create function public.pp5_save_reviewers(p_rows jsonb) returns void language sql volatile security invoker set search_path='' as $$ select private.pp5_save_reviewers(p_rows); $$;
revoke all on function public.pp5_save_reviewers(jsonb) from public,anon;
grant execute on function public.pp5_save_reviewers(jsonb) to authenticated;
alter function public.pp5_submit(uuid,integer) set schema private;
create function public.pp5_submit(p_book uuid,p_revision integer) returns jsonb language sql volatile security invoker set search_path='' as $$ select private.pp5_submit(p_book,p_revision); $$;
revoke all on function public.pp5_submit(uuid,integer) from public,anon;
grant execute on function public.pp5_submit(uuid,integer) to authenticated;
alter function public.pp5_review_action(uuid,integer,text,text) set schema private;
create function public.pp5_review_action(p_book uuid,p_revision integer,p_action text,p_note text default '') returns jsonb language sql volatile security invoker set search_path='' as $$ select private.pp5_review_action(p_book,p_revision,p_action,p_note); $$;
revoke all on function public.pp5_review_action(uuid,integer,text,text) from public,anon;
grant execute on function public.pp5_review_action(uuid,integer,text,text) to authenticated;
alter function public.pp5_review_list() set schema private;
create function public.pp5_review_list() returns jsonb language sql stable security invoker set search_path='' as $$ select private.pp5_review_list(); $$;
revoke all on function public.pp5_review_list() from public,anon;
grant execute on function public.pp5_review_list() to authenticated;
commit;
