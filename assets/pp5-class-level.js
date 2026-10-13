(() => {
  'use strict';

  function isPrimaryClassLevel(value) {
    const level = String(value ?? '').normalize('NFKC').trim();
    return /^(?:(?:ระดับ\s*)?(?:ชั้น\s*)?)?(?:ป\.?\s*|ประถม(?:ศึกษา)?\s*(?:ปีที่\s*)?)([1-6])(?=$|[\s/.-])/u.test(level);
  }

  function filterPrimaryRooms(rooms) {
    return (Array.isArray(rooms) ? rooms : []).filter(room => isPrimaryClassLevel(room?.class_level));
  }

  globalThis.PP5ClassLevel = Object.freeze({ isPrimaryClassLevel, filterPrimaryRooms });
})();
