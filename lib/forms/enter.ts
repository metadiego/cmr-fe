export type EnterEvent = {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  /** Legacy keyCode; 229 means an IME is composing (Safari fires keydown with isComposing=false after compositionend). */
  keyCode?: number;
  targetTag: string;
  targetRole: string | null;
  targetExpanded: boolean;
};

/** Whether an Enter keydown inside a dialog form should submit it. */
export function shouldSubmitOnEnter(e: EnterEvent, disabled: boolean): boolean {
  if (disabled || e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return false;
  if (e.targetTag === "TEXTAREA" || e.targetTag === "BUTTON") return false;
  if (e.targetTag === "SELECT" || e.targetTag === "A") return false;
  if (e.targetRole === "button" || e.targetRole === "link" || e.targetRole === "menuitem") return false;
  if (e.targetRole === "combobox" && e.targetExpanded) return false;
  return true;
}
