const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const Module = require('node:module');
const original = Module._load;
const notices = [];
let deferredReady = false, ready;
class Plugin {
  constructor() { this.app = { workspace: { onLayoutReady: f => deferredReady ? ready = f : f(), on: () => ({}) } }; }
  loadData() { return null; } addSettingTab() {} registerEvent() {}
}
Module._load = function(name, ...args) {
  if (name === 'obsidian') return { Plugin, PluginSettingTab: class {}, Notice: class { constructor(s) { notices.push(s); } }, setIcon: (el, icon) => { el.innerHTML = `<svg data-icon="${icon}"><path/></svg>`; } };
  return original.call(this, name, ...args);
};
const CopyPlugin = require('../main.js').default;
const sleep = () => new Promise(r => setTimeout(r, 380));
function setup(html) {
  const dom = new JSDOM(`<div class="workspace">${html}</div>`);
  Object.assign(global, { document: dom.window.document, Element: dom.window.Element, MutationObserver: dom.window.MutationObserver, XMLSerializer: dom.window.XMLSerializer, getComputedStyle: dom.window.getComputedStyle.bind(dom.window) });
  Object.defineProperty(global, 'navigator', { configurable: true, value: { clipboard: { writeText: async s => { global.copied = s; } } } });
  notices.length = 0; global.copied = undefined;
  return dom;
}
const svg = '<svg viewBox="0 0 100 50"></svg>';
const live = `<div class="cm-embed-block cm-lang-mermaid"><div class="edit-block-button"><svg></svg></div><div class="mermaid">${svg}</div></div>`;
test('both modes and renderers: delayed SVG, replacement, icon exclusion and disposal', async () => {
  const dom = setup(`${live}<div class="cm-embed-block cm-lang-mermaid-next"><div class="edit-block-button"></div><div class="mermaid-next"></div></div><div class="markdown-preview-view"><div><div class="mermaid">${svg}</div></div><div><div class="mermaid-next"></div></div></div>`);
  const plugin = new CopyPlugin(); await plugin.onload();
  assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 2);
  document.querySelectorAll('.mermaid-next').forEach(el => el.innerHTML = svg);
  await sleep(); assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 4);
  plugin.settings.copyFormat = 'svg';
  const next = document.querySelector('.markdown-preview-view .mermaid-next');
  next.innerHTML = '<svg viewBox="0 0 200 80"></svg>';
  await sleep(); next.nextElementSibling.click(); await sleep();
  assert.match(global.copied, /viewBox="0 0 200 80"/);
  assert.equal(plugin.debounceTimer, null, 'icon changes do not schedule rescans');
  const replacement = next.cloneNode(true); next.replaceWith(replacement);
  await sleep(); assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 4);
  const block = document.querySelector('.cm-lang-mermaid');
  const button = block.querySelector('.mermaid-copy-btn');
  block.querySelector('.mermaid svg').remove();
  global.copied = undefined; button.click();
  assert.equal(global.copied, undefined); assert.ok(notices.includes('No diagram found'));
  await sleep(); assert.equal(block.querySelector('.mermaid-copy-btn'), null);
  plugin.onunload(); assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 0);
  dom.window.close();
});
test('unload prevents deferred ready and asynchronous copy completion from restarting work', async () => {
  const dom = setup(live); deferredReady = true;
  const plugin = new CopyPlugin(); await plugin.onload(); plugin.onunload(); ready();
  assert.equal(plugin.observer, null); assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 0);
  deferredReady = false;
  const p = new CopyPlugin(); await p.onload(); p.settings.copyFormat = 'svg';
  let resolve; navigator.clipboard.writeText = () => new Promise(r => resolve = r);
  document.querySelector('.mermaid-copy-btn').click(); p.onunload(); resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(p.activeTimeouts.size, 0); assert.equal(p.observer, null); assert.equal(p.debounceTimer, null);
  dom.window.close();
});
test('standalone SVG preserves theme variables, valid dimensions and C4 xlink', async () => {
  const dom = setup(`<div class="markdown-preview-view"><div><div class="mermaid-next"><svg width="100%" viewBox="0 0 420 210"><style>text{font-family:var(--font-mermaid);fill:var(--text-normal)}</style><image xlink:href="data:image/png;base64,aGVsbG8=" width="10" height="10"></image><text>Person</text></svg></div></div></div>`);
  // jsdom does not compute inherited custom properties; emulate browser computed style.
  global.getComputedStyle = () => ({ getPropertyValue: name => ({ '--font-mermaid': 'var(--font-base)', '--font-base': 'TestFont', '--text-normal': 'rgb(1, 2, 3)', 'font-family': 'TestFont', color: 'rgb(1, 2, 3)' }[name] || '') });
  const p = new CopyPlugin(); await p.onload(); p.settings.copyFormat = 'svg';
  document.querySelector('.mermaid-copy-btn').click(); await Promise.resolve(); await Promise.resolve();
  const doc = new dom.window.DOMParser().parseFromString(global.copied, 'image/svg+xml');
  assert.equal(doc.querySelector('parsererror'), null, global.copied);
  assert.equal(doc.documentElement.getAttribute('width'), '420'); assert.equal(doc.documentElement.getAttribute('height'), '210');
  assert.match(doc.documentElement.getAttribute('style'), /--font-mermaid:\s*var\(--font-base\)/);
  assert.match(doc.documentElement.getAttribute('style'), /--font-base:\s*TestFont/);
  assert.match(doc.documentElement.getAttribute('style'), /--text-normal:/);
  assert.equal(doc.querySelector('image').getAttributeNS('http://www.w3.org/1999/xlink', 'href'), 'data:image/png;base64,aGVsbG8=');
  p.onunload(); dom.window.close();
});
test('non-finite dimensions fail instead of producing a broken export', async () => {
  const dom = setup(live.replace('0 0 100 50', '0 0 Infinity 50'));
  const p = new CopyPlugin(); await p.onload(); p.settings.copyFormat = 'svg';
  const oldError = console.error; console.error = () => {};
  document.querySelector('.mermaid-copy-btn').click(); await Promise.resolve(); await Promise.resolve();
  console.error = oldError;
  assert.equal(global.copied, undefined); assert.ok(notices.includes('Failed to copy diagram'));
  p.onunload(); dom.window.close();
});
test('clipboard rejection is an error and PNG writes image MIME, not text', async () => {
  const dom = setup(live); const p = new CopyPlugin(); await p.onload();
  p.settings.copyFormat = 'svg'; navigator.clipboard.writeText = async () => { throw Error('denied'); };
  const oldError = console.error; console.error = () => {};
  document.querySelector('.mermaid-copy-btn').click(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  console.error = oldError; assert.ok(notices.includes('Failed to copy diagram')); assert.ok(!notices.includes('SVG copied to clipboard'));
  p.settings.copyFormat = 'png'; let written;
  global.Image = class { set src(v) { this.onload(); } };
  global.ClipboardItem = class { constructor(data) { this.data = data; } };
  navigator.clipboard.write = async items => { written = items; };
  dom.window.HTMLCanvasElement.prototype.getContext = () => ({ scale() {}, drawImage() {} });
  dom.window.HTMLCanvasElement.prototype.toBlob = function(cb) { assert.equal(this.width, 200); assert.equal(this.height, 100); cb(new Blob(['png'], { type: 'image/png' })); };
  document.querySelector('.mermaid-copy-btn').click();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(written[0].data['image/png'].type, 'image/png'); assert.ok(notices.includes('PNG copied to clipboard'));
  p.onunload(); dom.window.close();
});
