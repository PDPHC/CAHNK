CREATE OR REPLACE FUNCTION private.reset_submission_after_archive_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='deputy_director'
  ) THEN
    RAISE EXCEPTION 'เฉพาะรองผู้อำนวยการเท่านั้นที่ลบเล่มและล้างสถานะการส่งได้' USING ERRCODE='42501';
  END IF;
  -- Internal lifecycle cleanup only: never expose submission DELETE to clients.
  -- Both deletions commit or roll back together, including the old review comments.
  DELETE FROM public.classroom_submissions
  WHERE id=OLD.submission_id AND classroom_id=OLD.classroom_id AND report_month=OLD.report_month;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ไม่พบรายการส่งที่ตรงกับเล่ม กรุณาโหลดรายการใหม่';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION private.reset_submission_after_archive_delete() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_reset_submission_after_archive_delete
AFTER DELETE ON public.classroom_monthly_archives
FOR EACH ROW EXECUTE FUNCTION private.reset_submission_after_archive_delete();