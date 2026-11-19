import * as React from "react";

/** `value` once it has stopped changing for `ms` — debounce for previews that ask the BE on every change. */
export function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = React.useState(value);
  React.useEffect(() => {
    const h = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(h);
  }, [value, ms]);
  return settled;
}
