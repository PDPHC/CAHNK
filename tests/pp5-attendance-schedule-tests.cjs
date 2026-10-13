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

const values = { ...schedule, 'IN!C4': '001', 'IN!D4': 'ตัวอย่าง' };
const renderValue = (sheet, ref) => values[sheet + '!' + ref] ?? '';
const controls = {
  '#attendanceDay': { value: '', listeners: {}, addEventListener(name, fn) { this.listeners[name] = fn; } },
  '#markDay': { dataset: {}, disabled: false },
  '#markTerm': { dataset: {}, disabled: false }
};
const panel = {
  markup: '',
  appended: [],
  set innerHTML(value) { this.markup = value; },
  get innerHTML() { return this.markup; },
  querySelector(selector) { return controls[selector]; },
  querySelectorAll(selector) {
    if (selector !== '[data-mark-date]') return [];
    return [...this.markup.matchAll(/data-mark-date="(\d+)"/g)].map(match => ({ dataset: { markDate: match[1] } }));
  },
  append(element) { this.appended.push(element); }
};
const dialogs = [];
context.document = {
  createElement(tag) {
    if (tag === 'section') return { innerHTML: '' };
    if (tag !== 'dialog') throw new Error('Unexpected element ' + tag);
    const buttons = { '[data-confirm-attendance]': {}, '[data-cancel-attendance]': {} };
    const dialog = {
      className: '', innerHTML: '',
      querySelector(selector) { return buttons[selector]; },
      showModal() {}, close() {}, remove() {}
    };
    dialogs.push({ dialog, buttons });
    return dialog;
  }
};
const writes = [];
tables.attendance(panel, {
  value: renderValue,
  put: (sheet, ref, status) => writes.push({ sheet, ref, status }),
  editable: () => true,
  blockedCell: () => false,
  render: () => {},
  serialToDate: fromSerial,
  room: { holidays: [{ date: '2026-09-09', name: 'วันหยุด' }], use_thai_holidays: true }
});
assert.equal((panel.markup.match(/<td class="pp5-non-teaching"/g) || []).length, 40);
assert.equal((panel.markup.match(/<select data-sheet="CH"/g) || []).length, 59);
assert.equal(panel.querySelector('#attendanceDay').value, '0');
assert.equal(panel.querySelector('#markDay').disabled, false);
panel.querySelector('#attendanceDay').value = '1';
panel.querySelector('#attendanceDay').listeners.change();
assert.equal(panel.querySelector('#markDay').disabled, true);
panel.querySelector('#markDay').onclick();
assert.equal(dialogs.length, 0, 'bulk mark is blocked for an unscheduled weekday');
panel.querySelector('#markTerm').onclick();
dialogs.at(-1).buttons['[data-confirm-attendance]'].onclick();
assert.equal(writes.length, 59);
assert.ok(writes.every(({ sheet, ref, status }) => sheet === 'CH' && status === '/' && tables.attendanceSlotConfigured(ref, renderValue)));
assert.ok(writes.every(({ ref }) => dates[tables.attendanceSlotIndex(ref)] !== '2026-09-09'));

panel.querySelector('#attendanceDay').value = '0';
panel.querySelector('#attendanceDay').listeners.change();
writes.length = 0;
panel.querySelector('#markDay').onclick();
dialogs.at(-1).buttons['[data-confirm-attendance]'].onclick();
assert.deepEqual(writes, [{ sheet: 'CH', ref: 'G7', status: '/' }]);

console.log('PASS: scheduled weekdays only, unscheduled slots disabled, holiday bulk skips, daily and term bulk writes constrained');

