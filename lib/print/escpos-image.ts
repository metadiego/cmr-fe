// RGBA pixels → ESC/POS raster image command (GS v 0), 1 bit per dot. Transparency is composited
// over white (paper) and gray levels are Floyd–Steinberg dithered, so a color logo keeps its shape
// and shading on a thermal printer instead of turning into black blobs.
export function rgbaToEscPosRaster(rgba: ArrayLike<number>, width: number, height: number): Uint8Array<ArrayBuffer> {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const y = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    lum[i] = y * a + 255 * (1 - a);
  }
  const bytesPerRow = Math.ceil(width / 8);
  const data = new Uint8Array(bytesPerRow * height);
  for (let yy = 0; yy < height; yy++) {
    for (let x = 0; x < width; x++) {
      const i = yy * width + x;
      const old = lum[i];
      const black = old < 128;
      const err = old - (black ? 0 : 255);
      if (black) data[yy * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
      if (x + 1 < width) lum[i + 1] += (err * 7) / 16;
      if (yy + 1 < height) {
        if (x > 0) lum[i + width - 1] += (err * 3) / 16;
        lum[i + width] += (err * 5) / 16;
        if (x + 1 < width) lum[i + width + 1] += err / 16;
      }
    }
  }
  const header = [0x1d, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, height & 0xff, height >> 8];
  const out = new Uint8Array(header.length + data.length);
  out.set(header, 0);
  out.set(data, header.length);
  return out;
}

// Printed size of an image the way the on-screen receipt lays it out: CSS pixels at 96 dpi, capped
// to `maxHeightMm` tall (the receipt's max-h) and to the paper width, on a 203 dpi head.
export function logoDots(naturalWidth: number, naturalHeight: number, maxHeightMm: number, maxWidthDots = 576) {
  const dotsPerCssPx = 203 / 96;
  const maxH = Math.round((maxHeightMm * 203) / 25.4);
  let h = Math.min(naturalHeight * dotsPerCssPx, maxH);
  let w = (naturalWidth / naturalHeight) * h;
  if (w > maxWidthDots) {
    w = maxWidthDots;
    h = (naturalHeight / naturalWidth) * w;
  }
  return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}
