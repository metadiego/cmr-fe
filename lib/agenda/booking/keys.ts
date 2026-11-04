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

/** An open modal (dialog or alert dialog) owns the keyboard. */
export const OPEN_MODAL_SELECTOR =
  '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]';

/**
 * Widgets whose letters are theirs (type-ahead, typing): dialogs, menus, and Radix Select's listbox,
 * options and trigger, which are portaled to <body>, outside the dialog that opened them.
 */
export const OWNS_LETTERS_SELECTOR =
  '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[role="option"],[role="combobox"]';

/** The parts of a target the view-shortcut guard reads (an HTMLElement in the browser). */
export interface ShortcutTarget extends KeyTarget {
  closest?: (selector: string) => unknown;
}

/**
 * D / W / M must not switch the view: while a modal is open anywhere, while typing, or inside a widget
 * that owns its letters (see OWNS_LETTERS_SELECTOR).
 */
export function blocksViewShortcut(target: ShortcutTarget | null | undefined, modalOpen: boolean): boolean {
  if (modalOpen || isTypingTarget(target)) return true;
  return !!target?.closest?.(OWNS_LETTERS_SELECTOR);
}

/** A plain letter shortcut: no Ctrl / ⌘ / Alt (Cmd+W must still close the tab), not a repeat. */
export function isPlainKey(e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; repeat?: boolean }): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat;
}
