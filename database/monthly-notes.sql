CREATE OR REPLACE FUNCTION public.validate_monthly_submission(p_classroom_id uuid,p_report_month date)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
 c public.classrooms%rowtype; modules jsonb; checks jsonb; errors jsonb:='[]';
 ym text; last_day date; days date[]; d date; s record; uid text; rowdata jsonb; v text;
 missing_att integer:=0; missing_save integer:=0; missing_health integer:=0; missing_behavior integer:=0;
 missing_home integer:=0; missing_vol integer:=0; bad_grants integer:=0; grants integer:=0;
 headers jsonb; activity record; activity_count integer:=0; all_savings_empty boolean:=true;
 has_vol_data boolean:=false; r jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'กรุณาเข้าสู่ระบบ'; END IF;
 SELECT * INTO c FROM public.classrooms WHERE id=p_classroom_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ไม่พบห้องเรียนหรือไม่มีสิทธิ์เข้าถึง'; END IF;
 IF p_report_month IS NULL THEN RAISE EXCEPTION 'กรุณาเลือกเดือนที่รายงาน'; END IF;
 p_report_month:=date_trunc('month',p_report_month)::date;
 ym:=to_char(p_report_month,'YYYY-MM');last_day:=(p_report_month+interval '1 month - 1 day')::date;
 IF c.open_date IS NULL OR c.close_date IS NULL OR c.open_date>c.close_date THEN
  RETURN jsonb_build_array(jsonb_build_object('module','settings','message','กรุณาตั้งวันเปิด–ปิดภาคเรียนให้ถูกต้อง'));
 END IF;
 IF p_report_month>c.close_date OR last_day<c.open_date THEN
  RETURN jsonb_build_array(jsonb_build_object('module','settings','message','เดือนที่ส่งไม่อยู่ในภาคเรียน'));
 END IF;
 IF (now() AT TIME ZONE 'Asia/Bangkok')::date<least(last_day,c.close_date) THEN
  errors:=errors||jsonb_build_array(jsonb_build_object('module','settings','message','ยังไม่สิ้นสุดเดือนที่รายงานหรือวันปิดภาคเรียน'));
 END IF;
 SELECT coalesce(jsonb_object_agg(module_name,data),'{}') INTO modules FROM public.module_data WHERE classroom_id=p_classroom_id;
 checks:=coalesce(modules->'report_checks'->ym,'{}');
 SELECT coalesce(array_agg(x::date),'{}'::date[]) INTO days FROM pg_catalog.generate_series(greatest(p_report_month,c.open_date)::timestamp,least(last_day,c.close_date)::timestamp,interval '1 day') x
 WHERE extract(isodow FROM x)<6 AND NOT (c.use_thai_holidays AND EXISTS(SELECT 1 FROM jsonb_array_elements(c.holidays) h WHERE h->>'date'=to_char(x,'YYYY-MM-DD')));
 IF NOT EXISTS(SELECT 1 FROM public.students WHERE classroom_id=p_classroom_id AND active) THEN
  errors:=errors||jsonb_build_array(jsonb_build_object('module','students','message','ยังไม่มีรายชื่อนักเรียนในห้อง'));
 END IF;
 FOR s IN SELECT * FROM public.students WHERE classroom_id=p_classroom_id AND active LOOP
  uid:=coalesce(nullif(s.client_uid,''),s.id::text);
  FOREACH d IN ARRAY days LOOP
   v:=modules->'attendance'->ym->uid->>extract(day FROM d)::integer::text;
   IF v IS NULL OR v NOT IN ('/','ม','ข','ล','น','ส') THEN missing_att:=missing_att+1; END IF;
   v:=modules->'savings'->ym->uid->>extract(day FROM d)::integer::text;
   IF coalesce(btrim(v),'')<>'' THEN
    IF v!~'^[0-9]+([.][0-9]+)?$' THEN all_savings_empty:=false;
    ELSIF v::numeric<>0 THEN all_savings_empty:=false; END IF;
   END IF;
   IF coalesce(v,'')!~'^[0-9]+([.][0-9]+)?$' THEN missing_save:=missing_save+1; END IF;
  END LOOP;
  v:=modules->'behavior'->ym->uid->>'rating';
  IF v IS NULL OR v NOT IN ('ดีมาก','ดี','พอใช้','ปรับปรุง') THEN missing_behavior:=missing_behavior+1; END IF;
  rowdata:=coalesce(modules->'health'->ym->uid,'{}');
  IF coalesce(rowdata->>'age','')!~'^[0-9]+([.][0-9]+)?$' OR coalesce(rowdata->>'weight','')!~'^[0-9]+([.][0-9]+)?$' OR coalesce(rowdata->>'height','')!~'^[0-9]+([.][0-9]+)?$'
    OR coalesce(rowdata->>'hair','') NOT IN ('1','2','3') OR coalesce(nullif(rowdata->>'hygiene',''),rowdata->>'nails','') NOT IN ('1','2','3') OR coalesce(rowdata->>'clothes','') NOT IN ('1','2','3') OR coalesce(rowdata->>'mouth','') NOT IN ('1','2','3') THEN missing_health:=missing_health+1; END IF;
 END LOOP;
 FOREACH d IN ARRAY days LOOP
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(modules->'homeroom'->'rows','[]')) h WHERE h->>'date'=d::text
    AND (h->>'hmMath' IN ('true','on','1') OR h->>'hmPoem' IN ('true','on','1') OR coalesce(btrim(h->>'hmOtherText'),'')<>'' OR coalesce(btrim(h->>'topic'),'')<>'')
    AND (coalesce(h->>'hmOther','false') NOT IN ('true','on','1') OR coalesce(btrim(h->>'hmOtherText'),'')<>'')) THEN missing_home:=missing_home+1; END IF;
 END LOOP;
 IF checks->>'savings_none'='true' AND NOT all_savings_empty THEN errors:=errors||jsonb_build_array(jsonb_build_object('module','savings','message','มีข้อมูลการออมทรัพย์แล้ว กรุณายกเลิกเครื่องหมาย “เดือนนี้ไม่มีการออมทรัพย์”')); END IF;
 IF missing_att>0 THEN errors:=errors||jsonb_build_array(jsonb_build_object('module','attendance','message','การมาเรียน: ยังไม่ได้ระบุสถานะหรือสถานะไม่ถูกต้อง '||missing_att||' ช่อง (เฉพาะวันเรียน)')); END IF;
 IF missing_save>0 AND NOT (coalesce(checks->>'savings_none','false')='true' AND all_savings_empty) THEN errors:=errors||jsonb_build_array(jsonb_build_object('module','savings','message','ออมทรัพย์: ยังไม่ได้กรอกหรือยอดไม่ถูกต้อง '||missing_save||' ช่อง ให้กรอก 0 เมื่อไม่ได้ออม หรือยืนยันว่าไม่มีการออมทั้งเดือน')); END IF;
 IF missing_behavior>0 THEN errors:=errors||jsonb_build_array(jsonb_build_object('module','behavior','message','พฤติกรรม: ยังไม่ประเมินหรือค่าไม่ถูกต้อง '||missing_behavior||' คน')); END IF;
 IF missing_health>0 THEN errors:=errors||jsonb_build_array(jsonb_build_object('module','health','message','สุขภาพ: ข้อมูลอายุ น้ำหนัก ส่วนสูง หรือผลตรวจไม่ครบ/ไม่ถูกต้อง '||missing_health||' คน')); END IF;
 IF missing_home>0 THEN errors:=errors||jsonb_build_array(jsonb_build_object('module','homeroom','message','โฮมรูม: ยังไม่มีเนื้อหากิจกรรมครบ '||missing_home||' วันเรียน')); END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(coalesce(modules->'scholarship'->'rows','[]')) LOOP
  IF coalesce(r->>'date','')='' OR left(r->>'date',7)=ym THEN
   grants:=grants+1;
   IF coalesce(btrim(r->>'fund'),'')='' OR coalesce(btrim(r->>'type'),'')='' OR coalesce(btrim(r->>'org'),'')='' OR coalesce(r->>'amount','')!~'^[0-9]+([.][0-9]+)?$' OR coalesce(r->>'date','')='' OR NOT EXISTS(SELECT 1 FROM public.students st WHERE st.classroom_id=p_classroom_id AND (coalesce(nullif(st.client_uid,''),st.id::text)=r->>'studentUid' OR (coalesce(r->>'studentUid','')='' AND st.full_name=r->>'student'))) THEN bad_grants:=bad_grants+1; END IF;
  END IF;
 END LOOP;
 IF checks->>'scholarship_none'='true' AND grants>0 THEN errors:=errors||jsonb_build_array(jsonb_build_object('module','scholarship','message','มีรายการรับทุนแล้ว กรุณายกเลิกเครื่องหมาย “เดือนนี้ไม่มีการมอบทุนใด ๆ”')); END IF;
 IF grants=0 AND coalesce(checks->>'scholarship_none','false')<>'true' THEN errors:=errors||jsonb_build_array(jsonb_build_object('module','scholarship','message','รับทุน: ยังไม่มีรายการ กรุณากรอกหรือยืนยันว่าเดือนนี้ไม่มีผู้รับทุน')); END IF;
 IF bad_grants>0 THEN errors:=errors||jsonb_build_array(jsonb_build_object('module','scholarship','message','รับทุน: รายการวันที่ ผู้รับทุน ชื่อทุน ประเภท จำนวนเงิน หรือหน่วยงานไม่ครบ/ไม่ถูกต้อง '||bad_grants||' รายการ')); END IF;
 rowdata:=coalesce(modules->'volunteer'->'months'->ym,'{}');headers:=coalesce(rowdata->'headers','[]');
 FOR activity IN SELECT value,ordinality FROM jsonb_array_elements_text(headers) WITH ORDINALITY LOOP
  IF btrim(activity.value)<>'' THEN
   activity_count:=activity_count+1;
   FOR s IN SELECT * FROM public.students WHERE classroom_id=p_classroom_id AND active LOOP
    uid:=coalesce(nullif(s.client_uid,''),s.id::text);v:=rowdata->'data'->uid->>(activity.ordinality-1)::text;
    IF v IS NULL OR v NOT IN ('/','ม','ข','ล','น') THEN missing_vol:=missing_vol+1; END IF;
   END LOOP;
  END IF;
 END LOOP;
 SELECT EXISTS(SELECT 1 FROM jsonb_each(coalesce(rowdata->'data','{}')) a, LATERAL jsonb_each_text(a.value) b WHERE coalesce(btrim(b.value),'')<>'') INTO has_vol_data;
 -- Volunteer is optional, including partially recorded activities, per school requirements.
 RETURN errors;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_monthly_submission(uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.validate_monthly_submission(uuid,date) TO authenticated;


DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.archive_approved_monthly_submission()'::regprocedure) INTO definition;
 IF position('''report_checks''' in definition)=0 THEN
  IF position('''homeroom_times'')' in definition)=0 THEN RAISE EXCEPTION 'Archive definition changed'; END IF;
  EXECUTE replace(definition,'''homeroom_times'')','''homeroom_times'',''report_checks'')');
 END IF;
END;
$migration$;

