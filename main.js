var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MermaidCopyPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/export.ts
var import_obsidian = require("obsidian");
function extractSvgString(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clone.getAttribute("width") || !clone.getAttribute("height")) {
    const bbox = svg.getBBox();
    clone.setAttribute("width", String(bbox.width));
    clone.setAttribute("height", String(bbox.height));
  }
  return new XMLSerializer().serializeToString(clone);
}
async function svgToPngBlob(svg, scale = 2) {
  const svgString = extractSvgString(svg);
  const width = parseFloat(svg.getAttribute("width") || String(svg.getBBox().width));
  const height = parseFloat(svg.getAttribute("height") || String(svg.getBBox().height));
  const base64 = btoa(
    Array.from(new TextEncoder().encode(svgString), (b) => String.fromCharCode(b)).join("")
  );
  const dataUrl = `data:image/svg+xml;base64,${base64}`;
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load SVG as image"));
    image.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("Failed to get canvas 2d context");
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Failed to create PNG blob")),
      "image/png"
    );
  });
}
async function copySvgToClipboard(svg) {
  const svgString = extractSvgString(svg);
  await navigator.clipboard.writeText(svgString);
  new import_obsidian.Notice("SVG copied to clipboard");
}
async function copyPngToClipboard(svg) {
  const blob = await svgToPngBlob(svg);
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) {
    new import_obsidian.Notice("PNG copy is not supported on this device \u2014 try SVG format in settings");
    return;
  }
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob })
  ]);
  new import_obsidian.Notice("PNG copied to clipboard");
}

// src/main.ts
var DEFAULT_SETTINGS = {
  copyFormat: "png"
};
var MermaidCopyPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.observer = null;
    this.debounceTimer = null;
    this.activeTimeouts = /* @__PURE__ */ new Set();
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MermaidCopySettingTab(this.app, this));
    this.app.workspace.onLayoutReady(() => {
      this.processAll();
      this.startObserver();
    });
    this.registerEvent(
      this.app.workspace.on("layout-change", () => this.scheduleProcess())
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.scheduleProcess())
    );
  }
  onunload() {
    var _a;
    (_a = this.observer) == null ? void 0 : _a.disconnect();
    if (this.debounceTimer)
      clearTimeout(this.debounceTimer);
    for (const t of this.activeTimeouts)
      clearTimeout(t);
    this.activeTimeouts.clear();
    document.querySelectorAll(".mermaid-copy-btn").forEach((el) => el.remove());
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  startObserver() {
    const target = document.querySelector(".workspace");
    if (!target)
      return;
    this.observer = new MutationObserver(() => this.scheduleProcess());
    this.observer.observe(target, { childList: true, subtree: true });
  }
  scheduleProcess() {
    if (this.debounceTimer)
      clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processAll(), 300);
  }
  processAll() {
    document.querySelectorAll(".cm-embed-block.cm-lang-mermaid, .cm-embed-block.cm-lang-mermaid-next").forEach((block) => {
      if (block.querySelector(".mermaid-copy-btn"))
        return;
      if (!block.querySelector(".mermaid svg"))
        return;
      const editBtn = block.querySelector(".edit-block-button");
      if (!editBtn)
        return;
      const copyBtn = document.createElement("div");
      copyBtn.className = "edit-block-button mermaid-copy-btn";
      copyBtn.setAttribute("aria-label", "Copy diagram");
      (0, import_obsidian2.setIcon)(copyBtn, "copy");
      copyBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const svg = block.querySelector(".mermaid svg");
        if (!svg) {
          new import_obsidian2.Notice("No diagram found");
          return;
        }
        const copyPromise = this.settings.copyFormat === "svg" ? copySvgToClipboard(svg) : copyPngToClipboard(svg);
        copyPromise.then(() => {
          (0, import_obsidian2.setIcon)(copyBtn, "check");
          const t = setTimeout(() => {
            (0, import_obsidian2.setIcon)(copyBtn, "copy");
            this.activeTimeouts.delete(t);
          }, 2e3);
          this.activeTimeouts.add(t);
        }).catch((err) => {
          new import_obsidian2.Notice("Failed to copy diagram");
          console.error(err);
        });
      });
      editBtn.insertAdjacentElement("afterend", copyBtn);
    });
  }
};
var MermaidCopySettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Copy format").setDesc("Choose whether the copy button copies the diagram as PNG or SVG.").addDropdown(
      (dropdown) => dropdown.addOption("png", "PNG (image)").addOption("svg", "SVG (markup)").setValue(this.plugin.settings.copyFormat).onChange((value) => {
        this.plugin.settings.copyFormat = value;
        void this.plugin.saveSettings();
      })
    );
  }
};
