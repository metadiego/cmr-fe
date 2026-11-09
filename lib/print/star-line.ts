/**
 * ESC/POS (Epson) → Star Line Mode, for a printer whose `commandSet` is `star_line`.
 *
 * Covers exactly the ESC/POS subset this system writes (the FE receipt and the queue tickets); any
 * other byte passes as it is, so nothing is invented. The raster logo has no safe Star equivalent
 * here and is left out. See docs/specs/impresoras-star-line-mode.md.
 */
const ESC = 0x1b;
const GS = 0x1d;
/** Star's code page table: 4 = PC858, which is PC850 plus the euro sign. */
const STAR_PC858 = 4;

export function escposToStarLine(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < input.length) {
    const b = input[i];
    const c = input[i + 1];
    const n = input[i + 2];
    if (b === ESC && c === 0x40) {
      out.push(ESC, 0x40);
      i += 2;
    } else if (b === ESC && c === 0x74 && n !== undefined) {
      // Only PC850 is ever selected; any other page is passed on with Star's own command.
      out.push(ESC, GS, 0x74, n === 2 ? STAR_PC858 : n);
      i += 3;
    } else if (b === ESC && c === 0x61 && n !== undefined) {
      out.push(ESC, GS, 0x61, n);
      i += 3;
    } else if (b === ESC && c === 0x45 && n !== undefined) {
      out.push(ESC, n & 1 ? 0x45 : 0x46);
      i += 3;
    } else if (b === GS && c === 0x21 && n !== undefined) {
      // ESC/POS: high nibble = width - 1, low nibble = height - 1. Star: ESC i height width.
      out.push(ESC, 0x69, n & 0x0f, (n >> 4) & 0x0f);
      i += 3;
    } else if (b === ESC && c === 0x4a && n !== undefined) {
      // n dots at 203 dpi (1/8 mm) → n quarter millimetres in Star.
      out.push(ESC, 0x4a, Math.max(1, Math.round(n / 2)));
      i += 3;
    } else if (b === GS && c === 0x56 && n === 0x41) {
      out.push(ESC, 0x64, 3);
      i += 4;
    } else if (b === GS && c === 0x76 && n === 0x30 && i + 7 < input.length) {
      const bytesPerRow = input[i + 4] | (input[i + 5] << 8);
      const rows = input[i + 6] | (input[i + 7] << 8);
      i += 8 + bytesPerRow * rows;
    } else {
      out.push(b);
      i += 1;
    }
  }
  return Uint8Array.from(out);
}
