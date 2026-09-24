CREATE TABLE public.workflow_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 classroom_id uuid NOT NULL REFERENCES public.classrooms(id) ON DELETE CASCADE,
 report_month date NOT NULL, actor_id uuid, actor_name text NOT NULL,
 action text NOT NULL, reason text, snapshot jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.workflow_events TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.workflow_events FROM anon,authenticated;
CREATE POLICY workflow_events_read ON public.workflow_events FOR SELECT TO authenticated
USING (private.can_view_classroom(classroom_id));
CREATE INDEX workflow_events_room_month ON public.workflow_events(classroom_id,report_month,created_at DESC);

CREATE FUNCTION private.log_workflow_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text;
BEGIN
 SELECT coalesce(nullif(display_name,''),email,'ระบบ') INTO actor FROM public.profiles WHERE id=auth.uid();
 IF TG_OP='DELETE' THEN
   INSERT INTO public.workflow_events(classroom_id,report_month,actor_id,actor_name,action)
   VALUES(OLD.classroom_id,OLD.report_month,auth.uid(),coalesce(actor,'ระบบ'),'archive_removed');
 ELSE
   IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
     INSERT INTO public.workflow_events(classroom_id,report_month,actor_id,actor_name,action)
     VALUES(NEW.classroom_id,NEW.report_month,auth.uid(),coalesce(actor,'ระบบ'),NEW.status);
   END IF;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.log_workflow_event() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_log_workflow AFTER INSERT OR UPDATE ON public.classroom_submissions FOR EACH ROW EXECUTE FUNCTION private.log_workflow_event();
CREATE TRIGGER trg_audit_archive_delete AFTER DELETE ON public.classroom_monthly_archives FOR EACH ROW EXECUTE FUNCTION private.log_workflow_event();

-- Restricted lifecycle operation. The archive snapshot and review comments are
-- retained before resetting the submission, in a single transaction.
CREATE FUNCTION public.return_archived_book(p_archive_id uuid,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.classroom_monthly_archives%ROWTYPE; s public.classroom_submissions%ROWTYPE;
 comments jsonb; actor text;
BEGIN
 SELECT display_name INTO actor FROM public.profiles WHERE id=auth.uid() AND role='deputy_director';
 IF NOT FOUND THEN RAISE EXCEPTION 'เฉพาะรอง ผอ. เท่านั้นที่คืนเล่มให้ครูแก้ไขได้' USING ERRCODE='42501'; END IF;
 IF length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'กรุณาระบุสิ่งที่ครูต้องแก้ไขอย่างน้อย 3 ตัวอักษร'; END IF;
 SELECT * INTO a FROM public.classroom_monthly_archives WHERE id=p_archive_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'เล่มนี้ถูกดำเนินการแล้ว กรุณาโหลดรายการใหม่'; END IF;
 SELECT * INTO s FROM public.classroom_submissions WHERE id=a.submission_id FOR UPDATE;
 IF NOT FOUND OR s.status<>'approved' THEN RAISE EXCEPTION 'สถานะเล่มเปลี่ยนไปแล้ว'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) INTO comments FROM public.submission_comments c WHERE submission_id=s.id;
 DELETE FROM public.classroom_monthly_archives WHERE id=a.id;
 s.status:='returned_by_academic';
 s.forwarded_by:=NULL; s.forwarded_at:=NULL;
 s.academic_approved_by:=NULL; s.academic_approved_at:=NULL; s.academic_approved_name:=NULL; s.academic_signature_data:=NULL;
 s.approved_by:=NULL; s.approved_at:=NULL; s.approved_name:=NULL; s.deputy_signature_data:=NULL;
 s.updated_at:=now();
 INSERT INTO public.classroom_submissions SELECT s.*;
 INSERT INTO public.submission_comments SELECT * FROM jsonb_populate_recordset(NULL::public.submission_comments,comments);
 INSERT INTO public.submission_comments(submission_id,author_id,comment) VALUES(s.id,auth.uid(),'รอง ผอ. คืนเล่มให้ครูแก้ไข: '||trim(p_reason));
 INSERT INTO public.workflow_events(classroom_id,report_month,actor_id,actor_name,action,reason,snapshot)
 VALUES(a.classroom_id,a.report_month,auth.uid(),coalesce(actor,'รอง ผอ.'),'reopened',trim(p_reason),a.snapshot);
END $$;
REVOKE ALL ON FUNCTION public.return_archived_book(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.return_archived_book(uuid,text) TO authenticated;

ALTER TABLE public.workflow_events ADD COLUMN comment_id uuid UNIQUE;
CREATE FUNCTION private.log_review_comment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.workflow_events(classroom_id,report_month,actor_id,actor_name,action,reason,comment_id,created_at)
 SELECT s.classroom_id,s.report_month,NEW.author_id,coalesce(p.display_name,'ผู้ตรวจ'),'comment',NEW.comment,NEW.id,NEW.created_at
 FROM public.classroom_submissions s LEFT JOIN public.profiles p ON p.id=NEW.author_id WHERE s.id=NEW.submission_id
 ON CONFLICT(comment_id) DO NOTHING;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.log_review_comment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_log_review_comment AFTER INSERT ON public.submission_comments FOR EACH ROW EXECUTE FUNCTION private.log_review_comment();
CREATE FUNCTION public.return_submission_for_revision(p_submission_id uuid,p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r text; s public.classroom_submissions%ROWTYPE; target text;
BEGIN
 SELECT role INTO r FROM public.profiles WHERE id=auth.uid();
 IF r NOT IN ('academic','deputy_director','admin') OR r IS NULL THEN RAISE EXCEPTION 'ไม่มีสิทธิ์ส่งกลับ' USING ERRCODE='42501'; END IF;
 IF length(trim(coalesce(p_reason,'')))<3 THEN RAISE EXCEPTION 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร'; END IF;
 SELECT * INTO s FROM public.classroom_submissions WHERE id=p_submission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบรายการส่ง'; END IF;
 IF r='academic' AND s.status IN ('submitted_to_academic','returned_by_deputy') THEN target:='returned_by_academic';
 ELSIF r IN ('deputy_director','admin') AND s.status='forwarded_to_deputy' THEN target:='returned_by_deputy';
 ELSE RAISE EXCEPTION 'สถานะเปลี่ยนไปแล้ว กรุณาโหลดรายการใหม่'; END IF;
 UPDATE public.classroom_submissions SET status=target WHERE id=s.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ไม่มีสิทธิ์แก้ไขรายการ'; END IF;
 INSERT INTO public.submission_comments(submission_id,author_id,comment) VALUES(s.id,auth.uid(),trim(p_reason));
END $$;
REVOKE ALL ON FUNCTION public.return_submission_for_revision(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.return_submission_for_revision(uuid,text) TO authenticated;
ALTER FUNCTION public.return_archived_book(uuid,text) SET SCHEMA private;
CREATE FUNCTION public.return_archived_book(p_archive_id uuid,p_reason text) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.return_archived_book(p_archive_id,p_reason); $$;
REVOKE ALL ON FUNCTION public.return_archived_book(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.return_archived_book(uuid,text) TO authenticated;