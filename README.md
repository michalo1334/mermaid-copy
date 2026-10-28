# Mermaid Copy

[michalo1334's fork](https://github.com/michalo1334/mermaid-copy) of [MBlogs/mermaid-copy](https://github.com/MBlogs/mermaid-copy).

Copies rendered Mermaid diagrams as **PNG** or **SVG markup**. The installed plugin bundle is the source of truth for this release; `main.js` is tracked directly, without a TypeScript rebuild.

## Installation

1. Download `main.js`, `manifest.json` and `styles.css` from [release 1.1.0](https://github.com/michalo1334/mermaid-copy/releases/tag/1.1.0).
2. Disable Mermaid Copy, replace those files in `.obsidian/plugins/mermaid-copy/`, then re-enable it. Preserve your existing `data.json`.

The Community Plugins listing installs upstream, not this fork.

## Usage

Render a `mermaid` or `mermaid-next` block in Live Preview, then click its copy button. Mermaid Next blocks require the Mermaid Next plugin.

Choose **PNG** or **SVG** in Settings → Mermaid Copy → Copy format.

**Known limitation:** the copy button can be hidden or unavailable in Reading View. Use Live Preview.

## Validation

```bash
node --check main.js
```

Local settings (`data.json`) are not distributed. The upstream MIT license is retained.
