"use client";

import * as React from "react";
import { createPortal } from "react-dom";

// A slot on the right of a page's tab bar, so a tab's own header actions ("Live", "New sale") sit on
// the SAME row as the tabs instead of on a row of their own underneath. The tab bar owns the slot
// element; the active tab's content portals its actions into it with <TabsActions>. A view rendered
// outside such a tab bar gets no slot (`useTabsActionsSlot()` → false) and keeps its actions where it
// always had them.
const SlotContext = React.createContext<HTMLElement | null>(null);

/** The tab bar row: tabs on the left, the active tab's actions on the right. */
export function TabsBarWithActions({ tabs, className, children }: { tabs: React.ReactNode; className?: string; children: React.ReactNode }) {
  const [slot, setSlot] = React.useState<HTMLDivElement | null>(null);
  return (
    <SlotContext.Provider value={slot}>
      <div className={"flex flex-wrap items-center justify-between gap-3 " + (className ?? "")}>
        {tabs}
        <div ref={setSlot} className="flex shrink-0 items-center gap-2 empty:hidden" />
      </div>
      {children}
    </SlotContext.Provider>
  );
}

/** True when rendered under a tab bar that has an actions slot. */
export function useTabsActionsSlot(): boolean {
  return React.useContext(SlotContext) != null;
}

/** Renders `children` in the tab bar's actions slot (nothing until the slot exists). */
export function TabsActions({ children }: { children: React.ReactNode }) {
  const slot = React.useContext(SlotContext);
  return slot ? createPortal(children, slot) : null;
}
