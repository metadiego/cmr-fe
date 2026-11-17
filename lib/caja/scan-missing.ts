// Check for the «Scan settlements» dialog (components/caja/cuadre-scan-button.tsx). The scanner is
// pre-filled with the last one used (or the first active one); the options all have defaults.

export type ScanField = "scanner";

/** ["scanner"] while no scanner is picked. */
export function scanMissing(s: { scannerId: string }): ScanField[] {
  return s.scannerId ? [] : ["scanner"];
}
