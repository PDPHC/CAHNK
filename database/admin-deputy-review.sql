DO $migration$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('private.guard_academic_recall()'::regprocedure) INTO def;
 IF position('actor_role=''admin''' in def)=0 THEN
 def:=replace(def,'  ELSIF actor_role=''deputy_director'' THEN', $replace$
  ELSIF actor_role='admin' AND NEW.status IN ('approved','returned_by_deputy') THEN
    IF OLD.status<>'forwarded_to_deputy' THEN
      RAISE EXCEPTION 'งานนี้ไม่ได้อยู่ระหว่างรอรองวิชาการตรวจ กรุณาโหลดรายการใหม่';
    END IF;
    IF NEW.status='approved' AND NOT EXISTS(
      SELECT 1 FROM public.user_signatures WHERE user_id=auth.uid() AND length(signature_data)>20
    ) THEN RAISE EXCEPTION 'กรุณาอัปโหลดลายเซ็นของ Admin ก่อนอนุมัติ'; END IF;
    NEW.classroom_id:=OLD.classroom_id; NEW.report_month:=OLD.report_month;
    NEW.submitted_by:=OLD.submitted_by; NEW.submitted_at:=OLD.submitted_at;
    NEW.academic_approved_by:=OLD.academic_approved_by;
    NEW.academic_approved_at:=OLD.academic_approved_at;
    NEW.academic_approved_name:=OLD.academic_approved_name;
    NEW.academic_signature_data:=OLD.academic_signature_data;
  ELSIF actor_role='deputy_director' THEN$replace$);
 IF position('actor_role=''admin''' in def)=0 THEN RAISE EXCEPTION 'Guard definition changed'; END IF;
 EXECUTE def;
 END IF;
 SELECT pg_get_functiondef('private.stamp_submission_approvals()'::regprocedure) INTO def;
 def:=replace(def,'elsif v_role = ''deputy_director'' then','elsif v_role in (''deputy_director'',''admin'') then');
 def:=replace(def,'coalesce(nullif(v_name,''''),''Deputy Director'')','coalesce(nullif(v_name,''''),case when v_role=''admin'' then ''Admin'' else ''Deputy Director'' end)');
 EXECUTE def;
END;
$migration$;

