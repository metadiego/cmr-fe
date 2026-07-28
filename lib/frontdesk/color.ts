// Color estable por nombre (hash → HSL). Determinista: la misma persona siempre el mismo color,
// sin depender del backend ni hardcodear una paleta. Buen contraste (saturación/luz fijas).
export function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 65%, 45%)`;
}
