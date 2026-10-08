// Minimal ESC/POS writer for 80mm receipt printers (Epson TM-T20 family): text encoded in code page
// PC850 so Spanish accents print as accents, word wrapping, two-column lines, raster images and cut.

const ESC = 0x1b;
const GS = 0x1d;

// The hub's font is the printer's own Font A at its native size and spacing — on purpose: the owner
// tells a hub ticket from a browser-printed one by the typeface, so it is never changed here.
export const COLUMNS = 48; // 576 dots / 12
export const DOTS_PER_MM = 203 / 25.4;

// Unicode → PC850 (ESC t 2 on Epson). Plain ASCII passes through; the rest of the characters a
// receipt uses are mapped here; anything else prints as "?".
const PC850: Record<string, number> = {
  Ç: 0x80, ü: 0x81, é: 0x82, â: 0x83, ä: 0x84, à: 0x85, å: 0x86, ç: 0x87, ê: 0x88, ë: 0x89, è: 0x8a,
  ï: 0x8b, î: 0x8c, ì: 0x8d, Ä: 0x8e, Å: 0x8f, É: 0x90, ô: 0x93, ö: 0x94, ò: 0x95, û: 0x96, ù: 0x97,
  Ö: 0x99, Ü: 0x9a, "×": 0x9e, á: 0xa0, í: 0xa1, ó: 0xa2, ú: 0xa3, ñ: 0xa4, Ñ: 0xa5, ª: 0xa6, º: 0xa7,
  "¿": 0xa8, "½": 0xab, "¡": 0xad, "«": 0xae, "»": 0xaf, Á: 0xb5, Â: 0xb6, À: 0xb7, "─": 0xc4, Ê: 0xd2,
  Ë: 0xd3, È: 0xd4, Í: 0xd6, Î: 0xd7, Ï: 0xd8, Ì: 0xde, Ó: 0xe0, Ô: 0xe2, Ò: 0xe3, Ú: 0xe9, Û: 0xea,
  Ù: 0xeb, "°": 0xf8, "·": 0xfa,
};
const SUBSTITUTES: Record<string, string> = {
  "−": "-", "–": "-", "—": "-", "‐": "-", "“": '"', "”": '"', "‘": "'", "’": "'", "…": "...", " ": " ",
};

export function encodePc850(s: string): number[] {
  const out: number[] = [];
  for (const ch of s ?? "") {
    const c = SUBSTITUTES[ch] ?? ch;
    for (const x of c) {
      const code = x.charCodeAt(0);
      if (code >= 0x20 && code <= 0x7e) out.push(code);
      else out.push(PC850[x] ?? 0x3f);
    }
  }
  return out;
}

// Word wrap to `width` characters; words longer than a line are split. Breaks only at plain spaces, so
// a non-breaking space (U+00A0) keeps two words together; it prints as a normal space.
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const para of String(text ?? "").split("\n")) {
    let line = "";
    for (const word of para.split(/[ \t]+/).filter(Boolean)) {
      let w = word;
      while (w.length > width) {
        if (line) { lines.push(line); line = ""; }
        lines.push(w.slice(0, width));
        w = w.slice(width);
      }
      if (!line) line = w;
      else if (line.length + 1 + w.length <= width) line += " " + w;
      else { lines.push(line); line = w; }
    }
    lines.push(line);
  }
  return lines;
}

// Label on the left, value flush right — like the flex justify-between rows of the on-screen receipt:
// the label wraps inside the room the value leaves, and the value sits on the FIRST line.
export function twoColumns(label: string, value: string, width: number): string[] {
  const lines = wrap(label, Math.max(1, width - value.length - 1));
  lines[0] = lines[0] + " ".repeat(Math.max(1, width - lines[0].length - value.length)) + value;
  return lines;
}

export type Align = "left" | "center";

export class EscPosWriter {
  private bytes: number[] = [];
  readonly columns = COLUMNS;

  raw(b: ArrayLike<number>) {
    for (let i = 0; i < b.length; i++) this.bytes.push(b[i]);
    return this;
  }
  init() {
    return this.raw([ESC, 0x40, ESC, 0x74, 2]); // reset + code page PC850
  }
  align(a: Align) {
    return this.raw([ESC, 0x61, a === "center" ? 1 : 0]);
  }
  bold(on: boolean) {
    return this.raw([ESC, 0x45, on ? 1 : 0]);
  }
  doubleSize(on: boolean) {
    return this.raw([GS, 0x21, on ? 0x11 : 0x00]);
  }
  feedMm(mm: number) {
    let dots = Math.round(mm * DOTS_PER_MM);
    while (dots > 0) {
      const n = Math.min(255, dots);
      this.raw([ESC, 0x4a, n]);
      dots -= n;
    }
    return this;
  }
  text(s: string) {
    return this.raw(encodePc850(s));
  }
  line(s = "") {
    return this.text(s).raw([0x0a]);
  }
  wrapped(s: string, indent = 0) {
    for (const l of wrap(s, this.columns - indent)) this.line(" ".repeat(indent) + l);
    return this;
  }
  columnsRow(label: string, value: string, indent = 0) {
    for (const l of twoColumns(label, value, this.columns - indent)) this.line(" ".repeat(indent) + l);
    return this;
  }
  dashed() {
    return this.line("-".repeat(this.columns));
  }
  solid() {
    return this.line("─".repeat(this.columns));
  }
  // Feeds to the cutter and cuts (GS V 65 n): the cut lands below the last line, no paper wasted.
  cut() {
    return this.raw([GS, 0x56, 0x41, 0x03]);
  }
  toBytes(): Uint8Array<ArrayBuffer> {
    return Uint8Array.from(this.bytes);
  }
}
