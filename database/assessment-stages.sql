-- Shared assessment signatories by school stage; existing RLS applies.
alter table public.school_signatories
  add column assessment_kindergarten text check (length(assessment_kindergarten) <= 250),
  add column assessment_primary_lower text check (length(assessment_primary_lower) <= 250),
  add column assessment_primary_upper text check (length(assessment_primary_upper) <= 250),
  add column assessment_secondary_lower text check (length(assessment_secondary_lower) <= 250);

