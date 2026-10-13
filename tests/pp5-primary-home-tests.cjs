const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
require('../assets/pp5-class-level.js');

const source = fs.readFileSync(require.resolve('../assets/pp5-home.js'), 'utf8');

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.classNames = new Set();
    this.classList = {
      add: name => this.classNames.add(name),
      remove: name => this.classNames.delete(name),
    };
    this.hidden = false;
    this.value = null;
  }

  append(...items) {
    this.children.push(...items);
    if (this.tagName === 'select' && this.value === null && this.children.length) {
      this.value = this.children[0].value;
    }
  }

  replaceChildren(...items) {
    this.children = [];
    this.value = null;
    this.append(...items);
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'href') delete this.href;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

const rooms = [
  { id: 'primary-4', class_level: 'ป.4', room: '1', academic_year: 2569, term: 1 },
  { id: 'primary-6', class_level: 'ชั้นประถมศึกษาปีที่ 6', room: '2', academic_year: 2569, term: 1 },
  { id: 'secondary-1', class_level: 'มัธยมศึกษาปีที่ 1', room: '1', academic_year: 2569, term: 1 },
];

async function renderHub(search) {
  const elements = new Map();
  const queryElements = new Map();
  const document = {
    title: '',
    body: { classList: new Element().classList },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element(id === 'hubTerm' ? 'select' : 'div'));
      return elements.get(id);
    },
    querySelector(selector) {
      if (!queryElements.has(selector)) queryElements.set(selector, new Element());
      return queryElements.get(selector);
    },
    createElement(tagName) { return new Element(tagName); },
  };
  const cloudQuery = table => ({
    select() { return this; },
    eq() { return this; },
    order() { return this; },
    maybeSingle() { return Promise.resolve({ data: { permission: 'editor' } }); },
    then(resolve, reject) {
      return Promise.resolve({ data: table === 'classroom_teachers' ? { permission: 'editor' } : [] })
        .then(resolve, reject);
    },
  });
  const context = {
    document,
    location: { search },
    URLSearchParams,
    window: { PP5ClassLevel: globalThis.PP5ClassLevel },
    cloudState: { user: { id: 'teacher-1' }, profile: { role: 'teacher' } },
    cloudClient: { from: cloudQuery },
    startPP5Home: callback => callback(rooms),
    encodeURIComponent,
    Date,
    Promise,
  };
  vm.runInNewContext(source, context);
  await Promise.resolve();
  return { elements, queryElements, document };
}

(async () => {
  const primary = await renderHub('?level=primary');
  const primaryCards = primary.elements.get('hubRooms').children;
  assert.deepEqual(primaryCards.map(card => card.children[1].children[0].textContent), [
    'ป.4/1',
    'ชั้นประถมศึกษาปีที่ 6/2',
  ]);
  assert.equal(primary.document.title, 'ปพ.5 ประถมศึกษา • เลือกชั้นเรียนและวิชา');
  assert.match(primary.queryElements.get('.topbar .brand').href, /level=primary/);
  await primaryCards[0].onclick();
  assert.match(primary.elements.get('hubNew').href, /classroom=primary-4&level=primary/);
  assert.equal(primary.elements.get('hubNew').hidden, false);

  const general = await renderHub('');
  assert.equal(general.elements.get('hubRooms').children.length, 3);
  assert.match(general.elements.get('hubLevelSwitch').href, /level=primary/);
  assert.equal(general.elements.get('hubLevelSwitch').textContent, 'ปพ.5 ประถมศึกษา');
  console.log('PP5 primary classroom filter and editor route checks passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
