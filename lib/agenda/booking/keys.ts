// Keyboard helpers for the booking screen's global shortcuts (Esc ends a move; D / W / M switch view).

/** The parts of an event target the guard reads (an HTMLElement in the browser). */
export interface KeyTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

/** A key pressed while typing belongs to that field: inputs, textareas, selects and contentEditable. */
export function isTypingTarget(el: KeyTarget | null | undefined): boolean {
  if (!el) return false;
  return !!el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName ?? "");
}

/** A plain letter shortcut: no Ctrl / ⌘ / Alt (Cmd+W must still close the tab), not a repeat. */
export function isPlainKey(e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat?: boolean }): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat;
}
