import { Notice } from "obsidian";

function dimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  const rect = svg.getBoundingClientRect();
  const dimension = (name: "width" | "height", index: number) => {
    const attr = svg.getAttribute(name) || "";
    const numeric = /^\s*\d+(?:\.\d+)?(?:px)?\s*$/.test(attr) ? parseFloat(attr) : 0;
    return numeric || (viewBox.length === 4 && viewBox[index] > 0 ? viewBox[index] : 0) || rect[name] || svg.getBBox()[name];
  };
  const width = dimension("width", 2), height = dimension("height", 3);
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) throw new Error("Invalid diagram dimensions");
  return { width, height };
}

export function extractSvgString(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.removeAttribute("xmlns");
  clone.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns", "http://www.w3.org/2000/svg");

  // Copy only referenced inherited custom properties, including transitive var()
  // references. Inline values remain authoritative and no background is added.
  const computed = getComputedStyle(svg);
  const pending = Array.from(new XMLSerializer().serializeToString(clone).matchAll(/var\(\s*(--[\w-]+)/g), m => m[1]);
  const seen = new Set<string>();
  while (pending.length) {
    const name = pending.pop()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const value = computed.getPropertyValue(name).trim();
    if (!value || /url\s*\(/i.test(value)) continue;
    if (!clone.style.getPropertyValue(name)) clone.style.setProperty(name, value);
    for (const match of Array.from(value.matchAll(/var\(\s*(--[\w-]+)/g))) pending.push(match[1]);
  }
  for (const property of ["font-family", "color"] as const) {
    const value = computed.getPropertyValue(property).trim();
    if (value && !clone.style.getPropertyValue(property)) clone.style.setProperty(property, value);
  }
  // HTML-parsed Mermaid C4 can carry a literal xlink:href without an XML
  // namespace. Normalize it so the standalone SVG remains well-formed XML.
  let hasXlink = false;
  for (const element of [clone, ...Array.from(clone.querySelectorAll("*"))]) {
    const href = element.getAttribute("xlink:href");
    if (href !== null) {
      element.removeAttribute("xlink:href");
      element.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", href);
      hasXlink = true;
    }
  }
  if (hasXlink) {
    clone.removeAttribute("xmlns:xlink");
    clone.setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
  }

  const size = dimensions(svg);
  for (const name of ["width", "height"] as const) {
    if (!/^\s*\d+(?:\.\d+)?(?:px)?\s*$/.test(clone.getAttribute(name) || "")) {
      clone.setAttribute(name, String(size[name]));
    }
  }

  return new XMLSerializer().serializeToString(clone);
}

export async function svgToPngBlob(svg: SVGSVGElement, scale = 2): Promise<Blob> {
  const svgString = extractSvgString(svg);

  const { width, height } = dimensions(svg);

  const base64 = btoa(
    Array.from(new TextEncoder().encode(svgString), (b) => String.fromCharCode(b)).join("")
  );
  const dataUrl = `data:image/svg+xml;base64,${base64}`;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load SVG as image"));
    image.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas 2d context");

  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to create PNG blob"))),
      "image/png"
    );
  });
}

export async function copySvgToClipboard(svg: SVGSVGElement): Promise<void> {
  const svgString = extractSvgString(svg);
  await navigator.clipboard.writeText(svgString);
  new Notice("SVG copied to clipboard");
}

export async function copyPngToClipboard(svg: SVGSVGElement): Promise<void> {
  const blob = await svgToPngBlob(svg);

  if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) {
    throw new Error("PNG copy is not supported on this device — try SVG format in settings");
  }

  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
  new Notice("PNG copied to clipboard");
}
