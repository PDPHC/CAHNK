-- Shared professional names for this school's deployment.
create table public.school_signatories (
 id integer primary key check(id=1),
 director_name text not null default '' check(length(director_name)<=160),
 department_heads jsonb not null default '["","","","","","","",""]'::jsonb check(jsonb_typeof(department_heads)='array' and jsonb_array_length(department_heads)=8),
 revision integer not null default 1,
 updated_at timestamptz not null default now()
);
insert into public.school_signatories(id) values(1);
alter table public.school_signatories enable row level security;
revoke all on public.school_signatories from anon,authenticated;
grant select,update on public.school_signatories to authenticated;
create policy school_names_read on public.school_signatories for select to authenticated using(true);
create policy school_names_update on public.school_signatories for update to authenticated using(private.is_management()) with check(private.is_management());

