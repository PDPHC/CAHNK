const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');

function columnName(number) {
  let name = '';
  while (number) {
    name = String.fromCharCode(65 + (number - 1) % 26) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

const context = { window: {}, PP5Workbook: { col: columnName } };
vm.runInNewContext(fs.readFileSync('assets/pp5-tables.js', 'utf8'), context);
const tables = context.window.PP5Tables;
const serial = date => Math.round(Date.parse(date + 'T00:00:00Z') / 86400000) + 25569;
const fromSerial = value => new Date((value - 25569) * 86400000).toISOString().slice(0, 10);
const schedule = {
  'W1!F5': serial('2026-09-07'),
  'W1!H5': serial('2026-09-09'),
  'W1!J5': serial('2026-09-11')
};
const value = (sheet, ref) => schedule[sheet + '!' + ref] ?? '';
const dates = tables.attendanceDates(value, fromSerial);

assert.equal(dates[0], '2026-09-07');
assert.equal(dates[1], '');
assert.equal(dates[2], '2026-09-09');
assert.equal(dates[4], '2026-09-11');
assert.equal(dates[5], '2026-09-14');
assert.equal(tables.attendanceSlotConfigured('G7', value), true);
assert.equal(tables.attendanceSlotConfigured('H7', value), false);
assert.equal(tables.attendanceSlotConfigured('I7', value), true);
assert.equal(tables.attendanceSlotConfigured('L7', value), true);
assert.equal(tables.attendanceSlotConfigured('DD7', value), false);
assert.equal(tables.attendanceSlotConfigured('G6', value), false);

const holidays = new Map([['2026-09-09', 'วันหยุด']]);
const openSlots = Array.from(tables.attendanceSlots(dates, holidays, true));
assert.equal(openSlots.length, 59);
assert.equal(openSlots.includes(1), false);
assert.equal(openSlots.includes(2), false);
assert.deepEqual(Array.from(tables.attendanceSlots(dates, holidays, false, 1)), []);
assert.deepEqual(Array.from(tables.attendanceSlots(dates, holidays, false, 0)), [0]);

console.log('PASS: scheduled weekdays only, blank schedule slots blocked, holidays excluded from bulk marking');

