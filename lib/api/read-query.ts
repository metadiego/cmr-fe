// The query string of a list read: the filters only, empty ones left out. A list (the stage filters
// `bookingStatus` / `careStatus`) goes comma separated, which the backend accepts like repeated keys.
export function readQuery(filters: object): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
    } else if (v) sp.set(k, String(v));
  }
  return sp;
}
