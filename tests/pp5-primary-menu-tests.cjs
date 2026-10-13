const assert = require('node:assert/strict');
require('../assets/pp5-class-level.js');

const { isPrimaryClassLevel, filterPrimaryRooms } = globalThis.PP5ClassLevel;

for (let grade = 1; grade <= 6; grade++) {
  assert.equal(isPrimaryClassLevel('ป.' + grade), true, 'ป.' + grade + ' should be primary');
}

for (const level of [
  'ประถมศึกษาปีที่ 1',
  'ชั้นประถมศึกษาปีที่ 4',
  'ระดับชั้น ป.6',
  'ป.4/1',
  'ประถมศึกษา ปีที่ 3',
]) {
  assert.equal(isPrimaryClassLevel(level), true, level + ' should be primary');
}

for (const level of [
  'มัธยมศึกษาปีที่ 1',
  'ม.1',
  'อนุบาล 3',
  'ป.7',
  'ป.10',
  '',
  null,
]) {
  assert.equal(isPrimaryClassLevel(level), false, String(level) + ' should not be primary');
}

const rooms = [
  { id: 'p4', class_level: 'ป.4' },
  { id: 'm1', class_level: 'มัธยมศึกษาปีที่ 1' },
  { id: 'p6', class_level: 'ชั้นประถมศึกษาปีที่ 6' },
];
assert.deepEqual(filterPrimaryRooms(rooms).map(room => room.id), ['p4', 'p6']);
assert.deepEqual(filterPrimaryRooms(null), []);

console.log('PP5 primary menu classification checks passed');
