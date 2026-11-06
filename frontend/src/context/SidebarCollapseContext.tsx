import { createContext, useContext } from "react";

/**
 * Desktop sidebar collapse. Temporary collapse (e.g. moment detail open)
 * does not rewrite the persisted preference; restore clears the override.
 */
export interface SidebarCollapseContextValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Collapse without writing localStorage; remember to restore later. */
  beginTemporaryCollapse: () => void;
  /** Restore pre-temporary expanded state when we forced collapse. */
  endTemporaryCollapse: () => void;
}

export const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(
  null,
);

export function useSidebarCollapse() {
  return useContext(SidebarCollapseContext);
}
