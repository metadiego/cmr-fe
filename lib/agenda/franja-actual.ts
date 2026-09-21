// Which timed franja is "now" in the call-center bridge's day view — the row that should get a
// subtle highlight, moving on its own as the clock advances (owner's request, 2026-09-21). Pure:
// `horas` is the day's list of REAL (non-null) franja times, pre-sorted by the backend the same
// way it displays them (see cmr-be's orden-cronologico-hora.ts). `ahora` is the browser's clock,
// unambiguous zero-padded 24h "HH:MM".
//
// Bridge franjas are NOT that format: they're stored 12h, no leading zero, no AM/PM ("9:00",
// "1:00" — docs/specs/scheduling-bridge-consultas.md), so plain string/lexicographic comparison
// against `ahora` is wrong (e.g. "9:00" <= "13:15" is false as strings, though 9am is before
// 1:15pm). Resolve a bridge hour to minutes-since-midnight the same way the backend orders it for
// display: an hour already >= 13 is literal 24h; otherwise it's this business's 6am-6pm day, so
// 7-12 is morning as-is and 1-6 is afternoon (+12h). `ahora` needs no such resolution — it is
// already unambiguous.
function minutosBridge(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  const minutos = m || 0;
  if (h >= 13) return h * 60 + minutos;
  const horaReal = h === 12 ? 12 : h <= 6 ? h + 12 : h;
  return horaReal * 60 + minutos;
}

function minutosReloj(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function franjaActual(horas: string[], ahora: string): string | null {
  const ahoraMin = minutosReloj(ahora);
  let actual: string | null = null;
  for (const h of horas) {
    if (minutosBridge(h) <= ahoraMin) actual = h;
    else break;
  }
  return actual;
}
