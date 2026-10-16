alter table public.pp5_primary_attendance drop constraint pp5_primary_attendance_term_check;
alter table public.pp5_primary_attendance add constraint pp5_primary_attendance_term_check check(term in (1,2));
