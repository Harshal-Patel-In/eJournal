/**
 * Core application Zustand store.
 *
 * RULE-FE04: Client state management MUST use Zustand.
 * RULE-FE09: Client-side store is an in-memory active editing layer.
 */

import { create } from "zustand";

interface AppState {
  user: { name: string; role: string } | null;
  setUser: (user: { name: string; role: string } | null) => void;
  activeJournalId: string | null;
  setActiveJournalId: (id: string | null) => void;
  syncStatus: "idle" | "saving" | "synced" | "error";
  setSyncStatus: (status: "idle" | "saving" | "synced" | "error") => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  activeJournalId: null,
  setActiveJournalId: (activeJournalId) => set({ activeJournalId }),
  syncStatus: "idle",
  setSyncStatus: (syncStatus) => set({ syncStatus }),
}));
