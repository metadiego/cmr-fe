"use client"

import * as React from "react"

// Returns a height (px) that makes the referenced element end exactly where the page has to end
// to fit the window: the viewport bottom, minus whatever the page renders BELOW the element
// (pagination, footers) and minus the shell's bottom padding.
//
// Why measure instead of CSS: the app shell's <main> grows with its content instead of being a
// bounded flex box, so a pure-CSS "fill the rest" is not available without changing every page,
// and a hard-coded calc(100vh - Xrem) breaks as soon as the toolbar above changes height.
// Re-measures on resize and whenever the page content changes size (a strip or a pager appears).
//
// Returns undefined until the first measurement and on narrow screens (below `minWidth`), where
// the page scrolls normally and elements keep their natural height.
export function useFillViewportHeight(
  ref: React.RefObject<HTMLElement | null>,
  { minHeight = 420, minWidth = 1024, enabled = true } = {}
): number | undefined {
  const [height, setHeight] = React.useState<number>()

  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el || !enabled) {
      setHeight(undefined)
      return
    }
    const main = el.closest("main")
    const measure = () => {
      if (window.innerWidth < minWidth) {
        setHeight(undefined)
        return
      }
      const rect = el.getBoundingClientRect()
      let trailing = 0
      let padBottom = 24
      if (main) {
        padBottom = parseFloat(getComputedStyle(main).paddingBottom) || 0
        const contentBottom = Math.max(
          rect.bottom,
          ...Array.from(main.children, (c) => c.getBoundingClientRect().bottom)
        )
        trailing = contentBottom - rect.bottom
      }
      const top = rect.top + window.scrollY
      setHeight(
        Math.max(
          minHeight,
          Math.floor(window.innerHeight - top - trailing - padBottom)
        )
      )
    }
    measure()
    window.addEventListener("resize", measure)
    const observer = new ResizeObserver(measure)
    observer.observe(main ?? el.parentElement ?? el)
    return () => {
      window.removeEventListener("resize", measure)
      observer.disconnect()
    }
  }, [ref, minHeight, minWidth, enabled])

  return height
}
