// Run with node tests/home-sketches-menu.cjs. This tests controller behavior,
// not native keyboard input or rendered focus; that browser check remains separate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/home-sketches/app.js'), 'utf8');

function setup() {
  let now = 10000, nextId = 0;
  const timers = new Map();
  const later = (fn, delay = 0) => {
    const id = ++nextId;
    timers.set(id, { fn, at: now + delay });
    return id;
  };
  const tick = duration => {
    const end = now + duration;
    for (;;) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].fn(now);
    }
    now = end;
  };
  class Element {
    constructor() {
      this.dataset = {};
      this.attributes = {};
      this.events = {};
      this.children = [];
      this.classes = new Set();
      this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) };
      this.style = { setProperty() {} };
      this.textContent = '';
    }
    addEventListener(type, fn) { (this.events[type] ||= []).push(fn); }
    dispatchEvent(event) { for (const fn of this.events[event.type] || []) fn(event); }
    setAttribute(name, value) { this.attributes[name] = value; }
    hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    contains(target) { return target === this || this.children.some(child => child.contains(target)); }
    matches(selector) { return selector === ':focus-visible' && this.keyboardFocus === true; }
    getBoundingClientRect() { return { width: 200, height: 104 }; }
    getAnimations() { return []; }
    getContext() { return { setTransform() {}, clearRect() {}, drawImage() {} }; }
  }
  const home = new Element(), menu = new Element(), stage = new Element();
  const canvas = new Element(), status = new Element(), document = new Element();
  home.dataset.sketchStyle = 'pencil';
  home.setAttribute('data-intro-sketches', '');
  const rows = ['build', 'think', 'path'].map(kind => {
    const row = new Element(), trigger = new Element(), branch = new Element();
    const link = new Element(), description = new Element();
    row.dataset.kind = kind;
    description.textContent = kind + ' description';
    trigger.append(branch, link);
    row.append(trigger, description);
    row.querySelector = selector => ({ '.trigger': trigger, '.branch': branch, '.section-link': link, '.description': description })[selector];
    return { row, trigger, branch, link };
  });
  menu.append(...rows.map(item => item.row));
  document.querySelector = selector => ({ '[data-intro-sketches]': home, '.menu-area': menu })[selector];
  document.querySelectorAll = () => rows.map(item => item.row);
  document.getElementById = id => ({ 'sketch-stage': stage, sketch: canvas, 'sketch-status': status })[id];
  document.createElement = () => new Element();
  vm.runInNewContext(source, {
    document, window: { devicePixelRatio: 1, drawMidoRefined() {} },
    matchMedia: query => ({ matches: !query.includes('prefers-reduced-motion') }),
    getComputedStyle: () => ({ color: '#1a1a1a' }), Date: { now: () => now },
    setTimeout: later, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => later(fn, 16), cancelAnimationFrame: id => timers.delete(id),
    ResizeObserver: class { observe() {} },
    CustomEvent: class { constructor(type, { detail }) { this.type = type; this.detail = detail; } }
  });
  return { home, rows, document, tick };
}

(async () => {
  for (const kind of ['build', 'think', 'path']) {
    for (const control of ['branch', 'link']) {
      const s = setup();
      const item = s.rows.find(item => item.row.dataset.kind === kind);
      item.trigger.dispatchEvent({ type: 'mouseenter' });
      await Promise.resolve();
      await Promise.resolve();
      s.tick(32);
      assert.equal(s.home.dataset.animation, 'drawing');
      item[control].keyboardFocus = true;
      item.trigger.dispatchEvent({ type: 'focusin', target: item[control] });
      item.trigger.dispatchEvent({ type: 'mouseleave' });
      s.tick(101);
      assert.equal(s.home.dataset.animation, 'drawing', `${kind} ${control}: pointer exit must preserve the focused sketch`);
      item.trigger.dispatchEvent({ type: 'focusout', relatedTarget: s.document });
      assert.equal(s.home.dataset.animation, 'idle', `${kind} ${control}: leaving the trigger must dismiss its focus preview`);
    }
  }
  console.log('PASS: all menu branches and links retain focus previews after hover exit, then dismiss on blur');

  const s = setup(), item = s.rows[0];
  item.trigger.dispatchEvent({ type: 'mouseenter' });
  await Promise.resolve();
  await Promise.resolve();
  s.tick(32);
  item.trigger.dispatchEvent({ type: 'mouseleave' });
  s.tick(101);
  assert.equal(s.home.dataset.animation, 'idle', 'Pure hover must still dismiss on pointer exit');
  console.log('PASS: hover-only menu preview dismisses after the existing leave grace');
})().catch(error => { console.error(error); process.exitCode = 1; });
