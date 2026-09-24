-- Separate subject books from monthly classroom administration submissions.
create table public.pp5_books (
 id uuid primary key default gen_random_uuid(),
 classroom_id uuid not null references public.classrooms(id) on delete cascade,
 title text not null check (length(title) between 1 and 160),
 template_name text not null,
 template_base64 text not null check (length(template_base64) <= 5592408),
 patches jsonb not null default '{}'::jsonb check (jsonb_typeof(patches)='object'),
 revision integer not null default 1,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create index pp5_books_classroom_idx on public.pp5_books(classroom_id);
alter table public.pp5_books enable row level security;
revoke all on public.pp5_books from anon,authenticated;
grant select,insert,update on public.pp5_books to authenticated;
create policy pp5_read on public.pp5_books for select to authenticated using (private.can_view_classroom(classroom_id));
create policy pp5_insert on public.pp5_books for insert to authenticated with check ((private.is_management() or exists (select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_books.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))) and updated_by=(select auth.uid()));
create policy pp5_update on public.pp5_books for update to authenticated using ((private.is_management() or exists (select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_books.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor')))) with check ((private.is_management() or exists (select 1 from public.classroom_teachers ct where ct.classroom_id=pp5_books.classroom_id and ct.teacher_id=(select auth.uid()) and ct.permission in ('owner','editor'))) and updated_by=(select auth.uid()));
create function private.pp5_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.classroom_id<>old.classroom_id then raise exception 'Cannot move a subject book to another classroom'; end if;
 new.revision=old.revision+1; new.updated_at=now(); return new;
end $$;
revoke all on function private.pp5_revision() from public,anon,authenticated;
create trigger pp5_revision before update on public.pp5_books for each row execute function private.pp5_revision();

