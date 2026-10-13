const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const attendanceSummary = require('../assets/pp5-calc.js').attendanceSummary;

const nodes = {
  '[data-ch-result]': [{ dataset: { chResult: 'DJ7' }, textContent: '', title: '', closest: () => ({ classList: { contains: () => false } }) }],
  '[data-attendance-percent]': [{ dataset: { attendancePercent: '7' }, textContent: '', title: '', closest: () => ({ classList: { contains: () => false } }) }],
  'input[data-final-score]': [],
  'input[data-sheet="F"]': []
};
const slots = ['/', '/', '/', '', ''].map((status, index) => ({ dataset: { ref: String.fromCharCode(71 + index) + '7' }, value: status }));
const panel = {
  isConnected: true,
  append() {},
  addEventListener(name, handler) { this.listeners[name] = handler; },
  listeners: {},
  querySelectorAll(selector) { return selector === 'select[data-sheet="CH"]' ? slots : nodes[selector] || []; }
};
const context = {
  window: {},
  setTimeout,
  clearTimeout,
  document: { createElement: () => ({ className: '', textContent: '' }) },
  PP5Tables: {
    attendanceSummary
  },
  PP5Calc: { ...require('../assets/pp5-calc.js'), Calculator: class { get() { return ''; } } }
};
const root = path.resolve(__dirname, '..');
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets', 'pp5-entry.js'), 'utf8'), context);
context.window.PP5Entry.enhance(panel, { book: { cells: {} }, patches: {}, tab: 'attendance', value: () => '' });

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  await wait(20);
  assert.equal(nodes['[data-ch-result]'][0].textContent, 'มส.');
  assert.equal(nodes['[data-attendance-percent]'][0].textContent, '60%');

  slots[3].value = '/';
  panel.listeners.change();
  await wait(30);
  assert.equal(nodes['[data-ch-result]'][0].textContent, 'ผ่าน');
  assert.equal(nodes['[data-attendance-percent]'][0].textContent, '80%');
  console.log('PASS: summary displays attendance percent and switches from มส. to ผ่าน at 80%');
})().catch(error => { console.error(error); process.exitCode = 1; });

