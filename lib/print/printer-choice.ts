// Which of the center's printers THIS machine prints on. A center has several (Reception, Billing…)
// and the choice belongs to the workstation, not to the user: the receptionist who covers Billing
// prints where she is sitting. So it is remembered in this browser, per center — a per-device
// convenience; if storage is unavailable, the first printer is used and nothing breaks.

export interface NamedPrinter {
  id: string;
  name: string;
}

export const printerChoiceKey = (centerId: string) => `cmr.printHub.printer.${centerId}`;

// The remembered printer if it still exists, else the first one (the BE orders them), else none.
export function pickPrinter<P extends NamedPrinter>(printers: P[], rememberedId: string | null | undefined): P | null {
  if (printers.length === 0) return null;
  return printers.find((p) => p.id === rememberedId) ?? printers[0];
}

export function readPrinterChoice(centerId: string): string | null {
  try {
    return window.localStorage.getItem(printerChoiceKey(centerId));
  } catch {
    return null;
  }
}

export function savePrinterChoice(centerId: string, printerId: string): void {
  try {
    window.localStorage.setItem(printerChoiceKey(centerId), printerId);
  } catch {
    /* private window / blocked storage: the choice just is not remembered */
  }
}
