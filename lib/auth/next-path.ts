// Where to send the user after signing in: the in-app path they were going to, or null (go home).
// Strict on purpose: `?next=` comes from the URL, so anything that could leave the app (another
// host, a protocol-relative `//host`, a backslash a browser reads as `/`, an encoded `//`, a control
// character) is refused rather than "cleaned". See docs/specs/mcp-connector-consent-page.md §2.

const BASE = "http://app.invalid"
const LOGIN = "/login"

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw[0] !== "/") return null
  if (raw[1] === "/" || raw.includes("\\")) return null
  // Control characters and spaces (a newline can split `/` and `/evil.host` in some parsers).
  if (/[\u0000- \u007f]/.test(raw)) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (decoded.startsWith("//") || decoded.includes("\\")) return null

  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  // Dot segments collapse AFTER the checks above: "/.//evil.example" parses to the pathname
  // "//evil.example", which any later new URL(next, origin) or redirect() reads as another host.
  // So the NORMALIZED path is checked again, and that is what gets returned.
  if (url.pathname.startsWith("//") || url.pathname.includes("\\")) return null
  if (url.pathname === LOGIN) return null
  return `${url.pathname}${url.search}`
}
