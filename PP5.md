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
