CREATE OR REPLACE FUNCTION private.guard_academic_recall()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE actor_role text;
BEGIN
  SELECT role INTO actor_role FROM public.profiles WHERE id=auth.uid();
  IF actor_role='academic' THEN
    IF NOT (
      (OLD.status IN ('submitted_to_academic','returned_by_deputy') AND NEW.status IN ('forwarded_to_deputy','returned_by_academic'))
      OR (OLD.status='forwarded_to_deputy' AND NEW.status='submitted_to_academic' AND OLD.approved_at IS NULL)
    ) THEN
      RAISE EXCEPTION 'งานเปลี่ยนสถานะแล้ว หรือรองวิชาการอนุมัติแล้ว กรุณาโหลดรายการใหม่';
    END IF;
    -- Only the requested transition may change; preserve the submission identity and dates.
    DECLARE target_status text := NEW.status;
    BEGIN
      NEW := OLD;
      NEW.status := target_status;
    END;
    IF NEW.status='submitted_to_academic' THEN
      NEW.forwarded_by:=NULL; NEW.forwarded_at:=NULL;
      NEW.academic_approved_by:=NULL; NEW.academic_approved_at:=NULL;
      NEW.academic_approved_name:=NULL; NEW.academic_signature_data:=NULL;
      NEW.approved_by:=NULL; NEW.approved_at:=NULL;
      NEW.approved_name:=NULL; NEW.deputy_signature_data:=NULL;
      INSERT INTO public.submission_comments(submission_id,author_id,comment)
      VALUES(OLD.id,auth.uid(),'วิชาการยกเลิกการส่งต่อรองวิชาการ และดึงงานกลับมาตรวจใหม่');
    END IF;
  ELSIF actor_role='deputy_director' THEN
    IF OLD.status<>'forwarded_to_deputy' OR NEW.status NOT IN ('returned_by_deputy','approved') THEN
      RAISE EXCEPTION 'งานนี้ไม่ได้อยู่ระหว่างรอรองวิชาการตรวจ อาจถูกยกเลิกการส่งต่อแล้ว';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_academic_recall() FROM PUBLIC;
CREATE TRIGGER trg_guard_academic_recall BEFORE UPDATE ON public.classroom_submissions
FOR EACH ROW EXECUTE FUNCTION private.guard_academic_recall();
ALTER POLICY classroom_submissions_update ON public.classroom_submissions
WITH CHECK (
 private.is_management()
 OR (private.is_academic() AND status IN ('returned_by_academic','forwarded_to_deputy','submitted_to_academic'))
 OR (submitted_by=(SELECT auth.uid()) AND status='submitted_to_academic'
   AND EXISTS(SELECT 1 FROM public.classroom_teachers ct WHERE ct.classroom_id=classroom_submissions.classroom_id AND ct.teacher_id=(SELECT auth.uid())))
);

