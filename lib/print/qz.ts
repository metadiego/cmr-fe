"use client";

// Cliente de QZ Tray (puente local que imprime RAW a cualquier impresora del sistema, independiente
// del navegador). QZ Tray es una app gratuita que el centro instala; el navegador le habla por
// WebSocket a localhost. Sin firma digital, QZ pide al usuario "permitir" una vez (modo interno OK).
// Todo degrada con gracia: si QZ no está instalado/conectado, quien llama cae al print del navegador.
//
// La librería `qz-tray` es UMD y toca `window` → import DINÁMICO (nunca en SSR).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Qz = any;

let qzPromise: Promise<Qz> | null = null;

async function loadQz(): Promise<Qz> {
  if (!qzPromise) {
    qzPromise = import("qz-tray").then((m) => {
      const qz = (m as { default?: Qz }).default ?? (m as Qz);
      // Sin firmar: prometemos certificado/firma vacíos para no romper (QZ mostrará el prompt de permiso).
      try {
        qz.security.setCertificatePromise((resolve: (v: string) => void) => resolve(""));
        qz.security.setSignaturePromise(() => (resolve: (v: string) => void) => resolve(""));
      } catch {
        /* versiones que no exponen security aún → se ignora */
      }
      return qz;
    });
  }
  return qzPromise;
}

// ¿Hay conexión con QZ Tray? Conecta si hace falta. Lanza si QZ no está corriendo.
export async function qzConnect(): Promise<Qz> {
  const qz = await loadQz();
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect();
  }
  return qz;
}

// Lista de impresoras del sistema (nombres exactos). [] si QZ no responde.
export async function qzListPrinters(): Promise<string[]> {
  try {
    const qz = await qzConnect();
    const found = await qz.printers.find();
    return Array.isArray(found) ? found : [found].filter(Boolean);
  } catch {
    return [];
  }
}

// Envía bytes crudos (ESC/POS) a una impresora por nombre. Lanza si falla (el llamador hace fallback).
export async function qzPrintRaw(printer: string, bytes: Uint8Array): Promise<void> {
  const qz = await qzConnect();
  const cfg = qz.configs.create(printer);
  const data = [{ type: "raw", format: "command", flavor: "plain", data: Array.from(bytes) }];
  await qz.print(cfg, data);
}

// ¿Está QZ Tray disponible (instalado y corriendo)? Para mostrar/ocultar la opción sin romper.
export async function qzAvailable(): Promise<boolean> {
  try {
    await qzConnect();
    return true;
  } catch {
    return false;
  }
}
