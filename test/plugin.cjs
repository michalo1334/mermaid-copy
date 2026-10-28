const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const Module = require('node:module');
const original = Module._load;
const notices = [];
class Plugin {
  constructor() { this.app = { workspace: { onLayoutReady: f => f(), on: () => ({}) } }; }
  loadData() { return null; } addSettingTab() {} registerEvent() {}
}
Module._load = function(name, ...args) {
  if (name === 'obsidian') return { Plugin, PluginSettingTab: class {}, Notice: class { constructor(s) { notices.push(s); } }, setIcon: (el, icon) => { el.dataset.icon = icon; } };
  return original.call(this, name, ...args);
};
const CopyPlugin = require('../main.js').default;
const sleep = () => new Promise(r => setTimeout(r, 400));
test('live and reading renderers, delayed insertion, replacement and disposal', async () => {
  const dom = new JSDOM('<div class="workspace"><div class="cm-embed-block cm-lang-mermaid"><div class="edit-block-button"></div><div class="mermaid"><svg viewBox="0 0 100 50"></svg></div></div><div class="cm-embed-block cm-lang-mermaid-next"><div class="edit-block-button"></div><div class="mermaid-next"></div></div><div class="markdown-preview-view"><div><div class="mermaid"><svg viewBox="0 0 100 50"></svg></div></div><div><div class="mermaid-next"></div></div></div></div>');
  Object.assign(global, { document: dom.window.document, Element: dom.window.Element, MutationObserver: dom.window.MutationObserver, XMLSerializer: dom.window.XMLSerializer });
  Object.defineProperty(global, 'navigator', { configurable: true, value: { clipboard: { writeText: async s => { global.copied = s; } } } });
  const plugin = new CopyPlugin(); await plugin.onload();
  assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 2);
  document.querySelectorAll('.mermaid-next').forEach(el => el.innerHTML = '<svg viewBox="0 0 100 50"></svg>');
  await sleep(); assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 4);
  plugin.settings.copyFormat = 'svg';
  const next = document.querySelector('.markdown-preview-view .mermaid-next');
  next.innerHTML = '<svg viewBox="0 0 200 80"></svg>';
  await sleep(); next.nextElementSibling.click(); await sleep();
  assert.match(global.copied, /viewBox="0 0 200 80"/);
  assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 4);
  const replacement = next.cloneNode(true); next.replaceWith(replacement);
  await sleep(); assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 4);
  plugin.onunload(); assert.equal(document.querySelectorAll('.mermaid-copy-btn').length, 0);
  dom.window.close();
});
