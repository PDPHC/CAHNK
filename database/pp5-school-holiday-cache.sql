create table public.pp5_school_holiday_cache(year integer primary key check(year between 2020 and 2100), holidays jsonb not null, source text not null, updated_at timestamptz not null default now());
alter table public.pp5_school_holiday_cache enable row level security;
revoke all on public.pp5_school_holiday_cache from anon,authenticated;
grant select on public.pp5_school_holiday_cache to authenticated;
create policy holiday_cache_read on public.pp5_school_holiday_cache for select to authenticated using(true);
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
select cron.schedule('primary-school-holidays-monthly','0 18 1 * *',$job$
select net.http_post(url:='https://kbfgkjwufhspnftxsany.supabase.co/functions/v1/primary-school-holidays',headers:=jsonb_build_object('Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiZmdrand1ZmhzcG5mdHhzYW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk3NDY3ODQsImV4cCI6MjEwNTMyMjc4NH0.oTq9JKmCkVAT7lIH4q9EX01Fu_E9HVoGdRhwqy_zGU8','Content-Type','application/json'),body:=jsonb_build_object('year',y),timeout_milliseconds:=30000) from generate_series(extract(year from now() at time zone 'Asia/Bangkok')::int,extract(year from now() at time zone 'Asia/Bangkok')::int+1) y;
$job$);
