import { create } from "zustand";

/**
 * Client UI state (dialogs, mobile sidebar). Page data lives in loaders +
 * TanStack Query; this store is only for ephemeral UI.
 */
type UiState = {
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  quickAddOpen: boolean;
  quickAddType: "expense" | "income";
  openQuickAdd: (type?: "expense" | "income") => void;
  closeQuickAdd: () => void;

  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;

  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  /** Branded hand-off shown between signing in and the first app paint. */
  splashVisible: boolean;
  showSplash: () => void;
  hideSplash: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),

  quickAddOpen: false,
  quickAddType: "expense",
  openQuickAdd: (type) => set({ quickAddOpen: true, quickAddType: type ?? "expense" }),
  closeQuickAdd: () => set({ quickAddOpen: false }),

  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),

  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  splashVisible: false,
  showSplash: () => set({ splashVisible: true }),
  hideSplash: () => set({ splashVisible: false }),
}));
