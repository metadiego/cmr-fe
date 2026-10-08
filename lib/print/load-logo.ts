import { logoDots, rgbaToEscPosRaster } from "./escpos-image";

// Browser-only: loads the receipt logo and rasterizes it at the size the on-screen receipt prints it.
// Any failure (missing image, CORS-tainted canvas) returns null so the ticket prints without a logo
// rather than not at all.
export async function loadLogoRaster(url: string, maxHeightMm: number): Promise<Uint8Array | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const { width, height } = logoDots(img.naturalWidth, img.naturalHeight, maxHeightMm);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    return rgbaToEscPosRaster(ctx.getImageData(0, 0, width, height).data, width, height);
  } catch {
    return null;
  }
}
