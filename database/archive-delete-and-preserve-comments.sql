-- Deletion is limited to the actual deputy role, including direct API calls.
GRANT DELETE ON public.classroom_monthly_archives TO authenticated;
CREATE POLICY classroom_monthly_archives_delete_deputy
ON public.classroom_monthly_archives FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='deputy_director'));

-- Keep review history when an administrator removes an Auth account.
ALTER TABLE public.submission_comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.submission_comments DROP CONSTRAINT submission_comments_author_id_fkey;
ALTER TABLE public.submission_comments ADD CONSTRAINT submission_comments_author_id_fkey
FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;
