# Mermaid Copy

An Obsidian plugin that adds a copy button to rendered Mermaid and Mermaid Next diagrams in Live Preview and Reading View.

## Features

- One-click copy of any Mermaid diagram
- Copy as **PNG** (image) or **SVG** (markup) — configurable in settings
- Button appears next to the edit button in Live Preview, or below the diagram in Reading View
- Transparent PNG background preserves theme colors

## Usage

1. Write a `mermaid` or `mermaid-next` code block in any note (the latter requires the Mermaid Next plugin)
2. Open the rendered diagram in Live Preview or Reading View
3. Click the copy icon
4. Paste into any app — Slack, Docs, email, etc.

## Settings

**Copy format** — Choose between PNG (default) and SVG output.

## Installation

### From Community Plugins

1. Open Obsidian Settings > Community Plugins
2. Search for "Mermaid Copy"
3. Install and enable

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder `mermaid-copy` in your vault's `.obsidian/plugins/` directory
3. Place the downloaded files into that folder
4. Enable the plugin in Obsidian Settings > Community Plugins
