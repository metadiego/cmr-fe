export type EnterEvent = {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  targetTag: string;
  targetRole: string | null;
  targetExpanded: boolean;
};

/** Whether an Enter keydown inside a dialog form should submit it. */
export function shouldSubmitOnEnter(e: EnterEvent, disabled: boolean): boolean {
  if (disabled || e.key !== "Enter" || e.shiftKey || e.isComposing) return false;
  if (e.targetTag === "TEXTAREA" || e.targetTag === "BUTTON") return false;
  if (e.targetRole === "combobox" && e.targetExpanded) return false;
  return true;
}
