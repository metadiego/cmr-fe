"use client";

// Impresión DIRECTA por WebUSB: la página le habla por USB a la impresora y le manda los bytes ESC/POS,
// SIN instalar nada y SIN diálogo del navegador. Solo Chrome/Edge (Firefox/Safari no exponen WebUSB) y
// solo sobre HTTPS + gesto del usuario (un clic). En Windows puede requerir que el USB esté en modo
// WinUSB (choca con el driver Epson); en macOS/Linux suele bastar con que la cola de impresión no lo tenga.
// Epson usa vendorId 0x04b8. Todo lanza con mensaje claro para que el llamador avise y no rompa.

// La tipería de WebUSB no está en el lib DOM por defecto → tratamos navigator.usb como any, acotado aquí.
/* eslint-disable @typescript-eslint/no-explicit-any */

const EPSON_VENDOR = 0x04b8;

export function webUsbSupported(): boolean {
  return typeof navigator !== "undefined" && "usb" in (navigator as any);
}

// Pide al usuario elegir la impresora (una vez; el navegador recuerda el permiso), reclama la interfaz
// con endpoint bulk OUT y envía los bytes. `vendorId` configurable por si no es Epson.
export async function printEscPosWebUsb(bytes: Uint8Array, vendorId: number = EPSON_VENDOR): Promise<void> {
  const usb = (navigator as any).usb;
  if (!usb) throw new Error("Este navegador no soporta WebUSB (usa Chrome o Edge).");

  const device = await usb.requestDevice({ filters: vendorId ? [{ vendorId }] : [] });
  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  // Buscar la primera interfaz con un endpoint bulk de salida (por donde se envían los datos de impresión).
  let ifaceNum = -1;
  let epNum = -1;
  for (const iface of device.configuration.interfaces) {
    for (const alt of iface.alternates) {
      const out = alt.endpoints.find((e: any) => e.direction === "out" && e.type === "bulk");
      if (out) {
        ifaceNum = iface.interfaceNumber;
        epNum = out.endpointNumber;
        break;
      }
    }
    if (ifaceNum >= 0) break;
  }
  if (ifaceNum < 0) throw new Error("No se encontró un endpoint de impresión (bulk OUT) en el dispositivo.");

  await device.claimInterface(ifaceNum);
  try {
    await device.transferOut(epNum, bytes);
  } finally {
    try {
      await device.releaseInterface(ifaceNum);
    } catch {
      /* noop */
    }
    try {
      await device.close();
    } catch {
      /* noop */
    }
  }
}
