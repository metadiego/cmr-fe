import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Adapted from the EHR source: the original used a manual useEffect+setState
// pair, which trips this repo's `react-hooks/set-state-in-effect` lint rule
// (calling setState synchronously inside an effect body). useSyncExternalStore
// is the React-recommended pattern for subscribing to an external source like
// matchMedia and avoids that rule entirely while preserving identical
// behavior (reactive boolean, SSR-safe default).
function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
