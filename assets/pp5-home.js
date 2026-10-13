(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const option = (value, label) => {
    const item = document.createElement('option');
    item.value = value;
    item.textContent = label;
    return item;
  };
  const empty = (title, text) => {
    $('hubEmpty').hidden = false;
    $('emptyTitle').textContent = title;
    $('emptyText').textContent = text;
  };

  const primaryMode = new URLSearchParams(location.search).get('level') === 'primary';
  const classLevel = window.PP5ClassLevel;
  const primaryMenuItems = ['primaryMenuBasics', 'primaryMenuStudents', 'primaryMenuCalendar', 'primaryMenuHolidays', 'primaryMenuAttendance', 'primaryMenuStructure', 'primaryMenuSubjects', 'primaryMenuCourseBook', 'primaryMenuReading', 'primaryMenuTraits'];
  let request = 0;
  let selected = '';

  function setPrimaryMenuRoom(room) {
    if (!primaryMode) return;
    const enabled = !!room;
    for (const id of primaryMenuItems) {
      const link = $(id);
      if (!link) continue;
      link.href = enabled ? link.dataset.route : '#primaryWorkbookMenu';
      link.setAttribute('aria-disabled', String(!enabled));
      link.classList[enabled ? 'remove' : 'add']('is-disabled');
      link.onclick = event => {
        if (!enabled) {
          event.preventDefault();
          $('hubStatus').textContent = 'เลือกห้องประถมศึกษาก่อน แล้วจึงเปิดเมนูนี้';
        }
      };
    }
    if ($('primaryMenuContext')) {
      $('primaryMenuContext').textContent = enabled
        ? room.class_level + '/' + room.room + ' • ปี ' + room.academic_year + ' • ภาคเรียน ' + room.term
        : 'เลือกชั้นเรียนเพื่อเปิดเมนู';
    }
    if ($('primaryAttendanceTerm') && room) {
      $('primaryAttendanceTerm').textContent = 'ภาคเรียนที่ ' + room.term + ' • บันทึกการมาเรียนของห้อง';
    }
  }

  if (primaryMode) {
    document.body.classList.add('pp5-primary-home');
    document.title = 'ปพ.5 ประถมศึกษา • เลือกชั้นเรียนและวิชา';
    const eyebrow = document.querySelector('.welcome .eyebrow');
    const heading = document.querySelector('.welcome h1');
    const subtitle = document.querySelector('.welcome .muted');
    const brand = document.querySelector('.topbar .brand');
    const levelSwitch = $('hubLevelSwitch');
    if (brand) brand.href = 'pp5-home.html?level=primary';
    if (eyebrow) eyebrow.textContent = 'ปพ.5 ประถมศึกษา';
    if (heading) heading.textContent = 'เลือกห้องเรียนประถมศึกษา';
    if (subtitle) subtitle.textContent = 'เลือกชั้น ป.1–ป.6 แล้วเลือกรายวิชาที่ต้องการบันทึก';
    if (levelSwitch) {
      levelSwitch.href = 'pp5-home.html';
      levelSwitch.textContent = 'ปพ.5 ผลการเรียนทุกระดับ';
    }
    $('primaryWorkbookMenu').hidden = false;
    setPrimaryMenuRoom(null);
  } else {
    const levelSwitch = $('hubLevelSwitch');
    if (levelSwitch) {
      levelSwitch.href = 'pp5-home.html?level=primary';
      levelSwitch.textContent = 'ปพ.5 ประถมศึกษา';
    }
  }

  startPP5Home(async rooms => {
    const eligibleRooms = primaryMode
      ? classLevel.filterPrimaryRooms(rooms)
      : rooms;
    const termKey = room => String(room.academic_year) + '/' + String(room.term);
    const terms = [...new Set(eligibleRooms.map(termKey))];

    $('hubTerm').replaceChildren(...terms.map(term =>
      option(term, 'ปี ' + term.split('/')[0] + ' • ภาคเรียน ' + term.split('/')[1])
    ));
    if (!terms.length) {
      $('hubTerm').append(option('', primaryMode ? 'ยังไม่มีชั้นเรียนประถมศึกษา' : 'ยังไม่มีชั้นเรียน'));
      $('hubTerm').disabled = true;
    }

    function resetBooks() {
      request++;
      $('hubBooks').replaceChildren();
      $('hubNew').hidden = true;
      $('hubNew').removeAttribute('href');
    }

    function renderRooms() {
      resetBooks();
      selected = '';
      setPrimaryMenuRoom(null);
      $('selectedRoom').textContent = 'ยังไม่ได้เลือกชั้นเรียน';
      $('subjectStep').classList.remove('current');
      const filtered = eligibleRooms.filter(room => termKey(room) === $('hubTerm').value);
      $('roomCount').textContent = filtered.length + ' ห้อง';
      $('hubRooms').replaceChildren();

      for (const room of filtered) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'room-card';
        card.dataset.room = room.id;
        card.setAttribute('aria-pressed', 'false');

        const icon = document.createElement('span');
        icon.className = 'room-icon';
        icon.textContent = '▦';
        icon.setAttribute('aria-hidden', 'true');

        const body = document.createElement('span');
        const name = document.createElement('strong');
        const sub = document.createElement('small');
        name.textContent = room.class_level + '/' + room.room;
        sub.textContent = 'ดูรายวิชาในห้องนี้';
        body.append(name, sub);

        const arrow = document.createElement('span');
        arrow.className = 'room-arrow';
        arrow.textContent = '›';
        card.append(icon, body, arrow);
        card.onclick = () => selectRoom(room);
        $('hubRooms').append(card);
      }

      $('hubStatus').textContent = filtered.length
        ? 'เลือกชั้นเรียนเพื่อแสดงรายวิชา'
        : (primaryMode
          ? 'ไม่พบห้องเรียนประถมศึกษาในปีและภาคเรียนนี้'
          : 'ยังไม่มีห้องที่ได้รับสิทธิ์');

      if (filtered.length) {
        empty('เริ่มจากเลือกชั้นเรียน', 'กดเลือกห้องเรียน แล้วเลือกรายวิชาที่ต้องการ');
      } else if (primaryMode && !eligibleRooms.length) {
        empty('ยังไม่มีชั้นเรียนประถมศึกษา', 'ให้ผู้ดูแลเพิ่มห้อง ป.1–ป.6 และกำหนดสิทธิ์ให้ครู');
      } else if (primaryMode) {
        empty('ไม่มีห้องในภาคเรียนนี้', 'เลือกปีการศึกษาและภาคเรียนอื่นเพื่อตรวจสอบชั้นเรียน');
      } else {
        empty('ยังไม่มีชั้นเรียน', 'ให้ผู้ดูแลเพิ่มสิทธิ์ห้องที่สอนในหน้าจัดการผู้ใช้');
      }
    }

    async function selectRoom(room) {
      if (primaryMode && !classLevel.isPrimaryClassLevel(room.class_level)) return;
      resetBooks();
      selected = room.id;
      if (primaryMode) {
        try { localStorage.setItem('hnk_cloud_active_classroom', room.id); } catch {}
        setPrimaryMenuRoom(room);
      }
      const sequence = request;
      for (const button of $('hubRooms').children) {
        button.setAttribute('aria-pressed', String(button.dataset.room === selected));
      }
      $('selectedRoom').textContent = room.class_level + '/' + room.room;
      $('subjectStep').classList.add('current');
      const primaryParam = primaryMode ? '&level=primary' : '';
      const base = 'modules/pp5.html?classroom=' + encodeURIComponent(selected) + primaryParam;
      $('hubStatus').textContent = 'กำลังโหลดรายวิชา…';
      empty('กำลังโหลดรายวิชา', 'รอสักครู่');

      try {
        const [books, assignment, teaching] = await Promise.all([
          cloudClient.from('pp5_books')
            .select('id,title,updated_at,assignment_id')
            .eq('classroom_id', selected)
            .order('updated_at', { ascending: false }),
          cloudClient.from('classroom_teachers')
            .select('permission')
            .eq('classroom_id', selected)
            .eq('teacher_id', cloudState.user.id)
            .maybeSingle(),
          cloudClient.from('teaching_assignments')
            .select('*,subject_catalog(*)')
            .eq('classroom_id', selected)
            .eq('active', true),
        ]);
        if (sequence !== request) return;
        if (books.error) throw books.error;
        if (assignment.error) throw assignment.error;
        if (teaching.error) throw teaching.error;

        const canEdit = ['admin', 'director', 'deputy_director'].includes(cloudState.profile.role)
          || (cloudState.profile.role === 'teacher'
            && ['owner', 'editor'].includes(assignment.data?.permission));
        $('hubNew').href = base;
        $('hubNew').hidden = !canEdit;

        const linked = (teaching.data || [])
          .filter(item => item.subject_catalog?.active)
          .map(item => {
            const book = books.data.find(saved => saved.assignment_id === item.id);
            return {
              ...book,
              title: item.subject_catalog.code + ' ' + item.subject_catalog.name,
              assignment_id: item.id,
              teacher_name: item.teacher_name,
            };
          });
        const cards = [...linked, ...books.data.filter(book => !linked.some(item => item.id === book.id))];
        $('hubStatus').textContent = cards.length
          ? 'ทั้งหมด ' + cards.length + ' รายวิชา • เลือกวิชาเพื่อเปิดเล่ม ปพ.5'
          : 'ยังไม่มีรายวิชาในห้องนี้';
        $('hubEmpty').hidden = cards.length > 0;
        if (!cards.length) {
          empty('เพิ่มรายวิชาแรกของห้องนี้', canEdit
            ? 'กด “＋ เพิ่มรายวิชา” ด้านบนเพื่อเริ่มสร้างเล่ม ปพ.5'
            : 'ยังไม่มีเล่มรายวิชาที่เปิดดูได้');
        }

        for (const book of cards) {
          const card = document.createElement('article');
          card.className = 'book-card';
          const symbol = document.createElement('span');
          symbol.className = 'book-symbol';
          symbol.textContent = primaryMode ? 'ปพ.5 ประถมศึกษา · รายวิชา' : 'ปพ.5 · รายวิชา';
          const title = document.createElement('h3');
          title.textContent = book.title;
          const date = document.createElement('p');
          date.textContent = book.teacher_name
            ? 'ครูผู้สอน: ' + book.teacher_name
            : 'แก้ไขล่าสุด ' + new Date(book.updated_at).toLocaleDateString('th-TH');
          const link = document.createElement('a');
          link.className = 'primary';
          link.textContent = book.id
            ? (canEdit ? 'เปิดกรอกข้อมูล →' : 'เปิดดูรายวิชา →')
            : (canEdit ? 'เริ่มเล่มรายวิชานี้ →' : 'ยังไม่สร้างเล่ม');
          if (book.id || canEdit) {
            link.href = base + (book.id
              ? '&book=' + encodeURIComponent(book.id)
              : '&assignment=' + encodeURIComponent(book.assignment_id));
          }
          card.append(symbol, title, date, link);
          $('hubBooks').append(card);
        }
      } catch (error) {
        if (sequence === request) {
          $('hubStatus').textContent = 'โหลดรายวิชาไม่สำเร็จ';
          empty('โหลดข้อมูลไม่ได้', error.message + ' • กดเลือกชั้นเรียนอีกครั้งเพื่อลองใหม่');
        }
      }
    }

    $('hubTerm').onchange = renderRooms;
    renderRooms();
  });
})();
