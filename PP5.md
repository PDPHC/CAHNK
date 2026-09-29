# ปพ.5 รายวิชา

เข้าเมนู **ปพ.5 ผลการเรียน** ภายในห้องเรียน กดเพิ่มเล่มรายวิชา ระบบใช้แม่แบบโรงเรียนที่เตรียมไว้และดึงรายชื่อนักเรียน เลขประจำตัว ครูที่ปรึกษา โรงเรียน ชั้น/ห้อง ปีการศึกษา และภาคเรียนจากระบบธุรการให้อัตโนมัติ ไม่ต้องอัปโหลดไฟล์ กรอกรหัสวิชา ชื่อวิชา และข้อมูลเฉพาะวิชาก่อนบันทึก

- รองรับหลายเล่มรายวิชาในห้องเดียวกัน เก็บข้อมูลใน `pp5_books` แยกจากเล่มธุรการรายเดือน
- กรอกคะแนนรวมรายช่วง ผลพิเศษ ตัวชี้วัด วันที่เรียนสัปดาห์แรก และเวลาเรียน 20 สัปดาห์ตามช่องของแม่แบบ
- อัปเดตรายชื่อจากห้องได้ คะแนนและเวลาเรียนจะติดตามเลขประจำตัวเดิมแม้ลำดับหรือชื่อเปลี่ยน ต้องใช้เลขประจำตัวไม่ว่างและไม่ซ้ำกัน นักเรียนใหม่เริ่มด้วยคะแนนว่าง และก่อนนำรายชื่อที่ออกจากห้องออกจากเล่มจะมีข้อความยืนยัน
- บันทึกด้วยปุ่มบันทึกบนคลาวด์ มีการเตือนก่อนออกจากงานที่ยังไม่บันทึก และตรวจ revision ป้องกันเขียนทับงานจากอีกหน้าต่าง
- ส่งออก Excel โดยเปลี่ยนเฉพาะค่าช่องกรอกและสั่งให้ Excel คำนวณใหม่เมื่อเปิด เก็บส่วนประกอบ รูปภาพ สูตร รูปแบบ และขอบเขตพิมพ์ของต้นฉบับ ไม่ส่งไฟล์นักเรียนไปเก็บใน GitHub
- แม่แบบกลางล้างรายชื่อ เลขประจำตัว ข้อมูลเฉพาะเล่ม ค่าผลสูตรเก่า ความคิดเห็น เอกสารฝัง และข้อมูลผู้แก้ไขเดิมออกแล้ว ลิงก์ครูที่ปรึกษาภายนอกเปลี่ยนเป็นข้อมูลในเล่ม รูปตราโรงเรียน รูปแบบ และขอบเขตพิมพ์ยังอยู่เดิม เล่มที่เคยนำเข้าก่อนหน้าไม่ได้ถูกแก้ไข
- ตารางกรอกรองรับ 60 แถวตาม IN แต่บางหน้าพิมพ์ของต้นฉบับจบที่นักเรียนลำดับ 44 ต้องตรวจช่วงพิมพ์เมื่อมีนักเรียนมากกว่านั้น

## PDF ผ่านเมนูพิมพ์ของเครื่อง

กด “พิมพ์ / PDF” แล้วกด “พิมพ์ / Save as PDF” ในหน้าตัวอย่าง เลือก Save as PDF หรือ Microsoft Print to PDF ปิดหัวกระดาษ/ท้ายกระดาษ ขอบกระดาษไม่มี และมาตราส่วน 100% ไม่ต้องติดตั้งตัวแปลงหรือใช้บริการภายนอก

แบบพิมพ์ถอดขนาดแถว คอลัมน์ เซลล์ผสาน เส้นตาราง ฟอนต์ และตราโรงเรียนจากแม่แบบ 10 หน้า ชีต A–E และ G (หน้าสุดท้าย Legal ตามต้นฉบับ) คำนวณสูตรที่ใช้ด้วยตัวแปลสูตรจำกัดฟังก์ชัน ไม่ใช้ eval ข้อมูลส่งระหว่างหน้าต่างด้วย postMessage ที่ตรวจ origin/source/job ไม่เก็บข้อมูลพิมพ์ใน localStorage

การจัดวางของเบราว์เซอร์และฟอนต์บนแต่ละเครื่องอาจต่างจาก Excel ให้ตรวจหน้าตัวอย่างก่อนบันทึก PDF ถ้ารายชื่อเกินแถวที่ 44 จะหยุดและให้ขยายช่วงพิมพ์ใน Excel เพื่อไม่ให้ตกหล่น เล่มเก่าที่มี external links ต้องพิมพ์จาก Excel หรือสร้างเล่มด้วยแม่แบบในระบบ หากสูตรคำนวณไม่ได้จะปิดปุ่มพิมพ์และแสดงตำแหน่งเซลล์

## ตรวจสอบ

`tests/pp5-export.html` ทดสอบการส่งออกในเบราว์เซอร์โดยเลือกไฟล์ต้นฉบับ (ไม่มีการอัปโหลด)
`tests/pp5-rls.sql` ใช้ข้อมูลจำลองภายใน transaction และ rollback ทดสอบสิทธิ์ editor, viewer, academic, ห้องอื่น, anonymous และการป้องกันข้อมูลซ้อน

ฐานข้อมูลใช้ RLS ตามสิทธิ์ห้อง: ผู้ดูอ่าน/ดาวน์โหลดได้ ผู้แก้ไขและผู้บริหารบันทึกได้ ไม่เปิดสิทธิ์ลบเล่มในรุ่นนี้


## เมนูตามไฟล์ต้นฉบับ

เมนูกรอก 1–5 แยกตัวชี้วัด (D), รายชื่อ/ข้อมูลพื้นฐาน/คะแนนรวม (IN), คะแนนย่อย (F), ตารางรายสัปดาห์ (W1), และเช็กเวลาเรียน (CH) ปุ่มพิมพ์เลือกเฉพาะ A, B, C, D, E หรือ G ได้

คะแนนย่อยกรอกแทนสูตรแจงอัตโนมัติเฉพาะช่องคะแนนที่เปิดให้แก้ และล้างช่องเพื่อคืนสูตรเดิม เก็บเป็น patches ตามเลขประจำตัวเมื่อเชื่อมรายชื่อใหม่ ตรวจค่าติดลบและคะแนนเกินเต็ม ตัวส่งออกขยาย shared formulas ของ F ก่อนแทนค่าเพื่อไม่ทำให้สูตรช่องอื่นเสีย คะแนนรวมใน IN ยังคงแยกตามรูปแบบต้นฉบับ ผู้กรอกต้องตรวจให้ตรงกับคะแนนย่อย

`tests/pp5-detail-export.html` ทดสอบคะแนนย่อยหลังส่งออก การรักษาสูตรข้างเคียงและการป้องกันทับช่องผลรวม

Shared signatories: apply database/school-signatories.sql before deploying the updated PP5 UI. This single-school deployment stores one director and eight department heads centrally. Management roles edit the names from course basic information; all signed-in users may read them. Books refresh central names on open and before save, Excel export, or print. Shared names have a separate save action with revision checking. Legacy per-book head metadata is removed when opening a book. The school_central_signatories cloud migration was applied on 2026-09-28.

PP5 opens through pp5-home.html in a separate tab. Select academic year/term, classroom, and subject book. Classroom visibility and editing follow existing classroom assignments and RLS. Editor URLs carry classroom and optional book IDs; PP5 caches use sessionStorage scoped by classroom, and do not change the administration tab's active classroom.

Central data: Admin → central-data.html manages school metadata, staff/signatories, classrooms, students, subjects, and teaching assignments. Apply database/central-data.sql first (applied 2026-09-28). Set up subjects and then assign teacher + classroom; PP5 lists these assignments and permits one book per assignment. Assignment activation grants existing classroom editor access; deactivation does not revoke room access automatically. Use Admin room permissions to revoke it. Shared metadata refreshes before saving/exporting PP5. Student names match by stable student code; roster membership changes require explicit roster refresh to preserve scores. Archived monthly books retain their snapshots. Management writes use RLS and optimistic revision/timestamp checks. Classroom creation is Admin-only.

The five entry steps use readable web forms mapped to the original IN, D, F, W1 and CH cells. Roster tables show populated pupils only, with wrapping name cells and Enter navigation between scores. PP5 names use † (transferred), ‡ (not present) and ★ (special), explained below entry tables and printed roster pages. Formula outputs refresh after input. Status locks and central data remain in force. Printed and exported roster sheets hide unused trailing rows while retaining formulas and row IDs. Exported names fit their cells; Excel adds a footer legend. PDF retains the source page layout and 25 mm binding margin. tests/pp5-roster-export.html checks row hiding, legends, fitted-name styles and score preservation.

Indicators: a full-width 15-item table includes row/column totals, practice/work allocation (D!N24 and O24:R24), hours and expandable pending-grade conditions. Additional conditions use multiline C30. Attendance presents all 20 weeks, confirms bulk present updates for the term or selected date/slot, skips blocked student statuses and shows the original CH summary formulas. Browser print uses one uniform SVG grid and fitted header text. Excel export wraps indicator text, expands condition rows and normalizes border weights.
Expanded entry: indicators retain original 15 rows and add items in D54 onward with count metadata; Excel extends the print range and sum formulas, while browser print inserts continuation pages after D. Detail scores use one academic table plus separate reading and characteristics tables. Attendance shows Thai abbreviated dates, uses classroom.holidays (respecting use_thai_holidays), shades holiday columns and blocked pupil rows, and offers present-for-all buttons under each non-holiday date. Bulk updates skip holidays and blocked pupils. tests/pp5-extra-indicators.html and tests/pp5-calendar.html cover export and calendar fixtures.


PP5 approval workflow (2026-09-29): apply `database/pp5-approval.sql` before publishing the matching UI. This is independent of monthly classroom approvals. Admin opens `pp5-review.html?view=settings` to map eight department heads, four assessment stages, the academic deputy (deputy_director account), and the director (director account). Mapping does not grant classroom editing. Each signer saves their own signature at signature.html; teachers can now do this too.

The assigned subject teacher submits a saved revision with their signature. Each configured reviewer can approve only their current stage, or return the entire book to the teacher with a required reason. Returned books start again at department review with a new round and fresh signatures. RPCs enforce identity, state and optimistic revision checks; a database trigger locks book edits during review and after archival. Reviewers see only assigned submissions; Admin can inspect all. Route and book snapshots are frozen per submission; the submit audit event retains each round's original snapshot. Mapping changes affect future submissions only. Teachers cannot submit a legacy book without an active teaching assignment. The four supported assessment stages are kindergarten, primary lower, primary upper and secondary lower; unsupported levels fail explicitly.

Review and archive pages open the frozen book and stamped cover for browser printing/Save as PDF. These are recorded image signatures and audit timestamps, not cryptographic PDF signatures. Excel export remains the editable workbook, without workflow signature images. Existing central signatory names remain defaults; signed covers show the actual signing account names. Do not assign reviewer identities merely from a matching text name.

Cloud installation: `database/pp5-approval.sql` was applied to classroom-admin-system on 2026-09-29. Live verification confirmed RLS on all three tables, no anonymous access, no direct authenticated updates, and authenticated-only RPC execution. Reviewer mappings were intentionally left empty for Admin setup.
