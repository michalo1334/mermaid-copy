import { Plugin, PluginSettingTab, App, Setting, Notice, setIcon } from "obsidian";
import { copyPngToClipboard, copySvgToClipboard } from "./export";

type CopyFormat = "png" | "svg";

interface MermaidCopySettings {
  copyFormat: CopyFormat;
}

const DEFAULT_SETTINGS: MermaidCopySettings = {
  copyFormat: "png",
};

export default class MermaidCopyPlugin extends Plugin {
  settings: MermaidCopySettings = DEFAULT_SETTINGS;
  private observer: MutationObserver | null = null;
  private buttons = new Map<HTMLElement, HTMLElement>();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private activeTimeouts: Set<ReturnType<typeof setTimeout>> = new Set();

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
    this.observer?.disconnect();
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    for (const t of this.activeTimeouts) clearTimeout(t);
    this.activeTimeouts.clear();
    this.buttons.forEach((button) => button.remove());
    this.buttons.clear();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private startObserver(): void {
    const target = document.querySelector(".workspace");
    if (!target) return;

    this.observer = new MutationObserver((records) => {
      if (records.some((r) => [...Array.from(r.addedNodes), ...Array.from(r.removedNodes)].some((n) => !(n instanceof Element) || !n.classList.contains("mermaid-copy-btn")))) this.scheduleProcess();
    });
    this.observer.observe(target, { childList: true, subtree: true });
  }

  private scheduleProcess(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processAll(), 300);
  }

  private processAll(): void {
    this.buttons.forEach((button, block) => {
      if (!block.isConnected || !button.isConnected || !block.querySelector("svg")) {
        button.remove();
        this.buttons.delete(block);
      }
    });
    const blocks = document.querySelectorAll<HTMLElement>(
      ".cm-embed-block.cm-lang-mermaid, .cm-embed-block.cm-lang-mermaid-next, .markdown-preview-view .mermaid, .markdown-preview-view .mermaid-next"
    );
    blocks.forEach((block) => {
      // Reading-view renderers replace their own children asynchronously, so put
      // the button in their parent rather than inside the renderer's output.
      const live = block.matches(".cm-embed-block");
      const host = live ? block : block.parentElement;
      if (!host || !block.querySelector("svg")) return;
      if (this.buttons.has(block)) return;
      const editBtn = live ? block.querySelector<HTMLElement>(".edit-block-button") : null;
      if (live && !editBtn) return;

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "edit-block-button mermaid-copy-btn";
      copyBtn.setAttribute("aria-label", "Copy diagram");
      copyBtn.setAttribute("title", "Copy diagram");
      setIcon(copyBtn, "copy");
      copyBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const svg = block.querySelector<SVGSVGElement>("svg");
        if (!svg) { new Notice("No diagram found"); return; }
        try {
          if (this.settings.copyFormat === "svg") await copySvgToClipboard(svg);
          else await copyPngToClipboard(svg);
          setIcon(copyBtn, "check");
          const t = setTimeout(() => {
            if (copyBtn.isConnected) setIcon(copyBtn, "copy");
            this.activeTimeouts.delete(t);
          }, 2000);
          this.activeTimeouts.add(t);
        } catch (err) {
          new Notice("Failed to copy diagram");
          console.error(err);
        }
      });
      if (editBtn) editBtn.insertAdjacentElement("afterend", copyBtn);
      else block.insertAdjacentElement("afterend", copyBtn);
      this.buttons.set(block, copyBtn);
    });
  }
}

class MermaidCopySettingTab extends PluginSettingTab {
  plugin: MermaidCopyPlugin;

  constructor(app: App, plugin: MermaidCopyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Copy format")
      .setDesc("Choose whether the copy button copies the diagram as PNG or SVG.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("png", "PNG (image)")
          .addOption("svg", "SVG (markup)")
          .setValue(this.plugin.settings.copyFormat)
          .onChange(async (value) => {
            this.plugin.settings.copyFormat = value as CopyFormat;
            await this.plugin.saveSettings();
          })
      );
  }
}
