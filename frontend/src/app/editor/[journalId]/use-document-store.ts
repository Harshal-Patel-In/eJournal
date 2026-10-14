import { create } from "zustand";

export interface JournalBlock {
  id: string;
  type: string;
  content: any;
  metadata: any;
}

export type SyncStatus = "synced" | "saving" | "unsaved" | "conflict" | "offline";

interface DocumentState {
  journalId: string;
  title: string;
  blocks: JournalBlock[];
  status: string;
  isDirty: boolean;
  isSaving: boolean;
  previewMode: boolean;

  clientRevision: number;
  serverRevision: number;
  activeRevisionNumber: number;
  lastSavedAt: string | null;
  syncStatus: SyncStatus;
  dirtyBlockIds: string[];
  serverBlockIds: string[];
  isStructureDirty: boolean;
  isOrderDirty: boolean;
  isTitleDirty: boolean;

  init: (
    journalId: string,
    title: string,
    blocks: JournalBlock[],
    status: string,
    revision?: number,
    activeRevisionNumber?: number
  ) => void;
  setStatus: (status: string) => void;
  setActiveRevisionNumber: (activeRevisionNumber: number) => void;
  setTitle: (title: string) => void;
  addBlock: (index: number, type: string, content?: any) => void;
  updateBlock: (id: string, content: any) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  setSaving: (status: boolean) => void;
  setDirty: (status: boolean) => void;
  setSyncStatus: (syncStatus: SyncStatus) => void;
  setRevision: (serverRevision: number, savedAt?: string) => void;
  acknowledgeSave: (
    serverRevision: number,
    savedAt?: string,
    savedBlockSnapshotMap?: Record<string, string>,
    savedStructureClean?: boolean,
    savedOrderClean?: boolean,
    savedTitleClean?: boolean
  ) => void;
  loadLocalRecovery: (title: string, blocks: JournalBlock[]) => void;
  togglePreview: () => void;
}

const saveLocalSnapshot = (
  journalId: string,
  title: string,
  blocks: JournalBlock[],
  revision: number
) => {
  if (typeof window === "undefined" || !journalId) return;
  try {
    const snapshot = {
      journalId,
      title,
      blocks,
      revision,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`ejournal_recovery_${journalId}`, JSON.stringify(snapshot));
  } catch (err) {
    console.error("Failed to save local recovery snapshot", err);
  }
};

export const clearLocalSnapshot = (journalId: string) => {
  if (typeof window === "undefined" || !journalId) return;
  try {
    localStorage.removeItem(`ejournal_recovery_${journalId}`);
  } catch (err) {
    console.error("Failed to clear local snapshot", err);
  }
};

export const getLocalSnapshot = (journalId: string) => {
  if (typeof window === "undefined" || !journalId) return null;
  try {
    const raw = localStorage.getItem(`ejournal_recovery_${journalId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("Failed to read local recovery snapshot", err);
    return null;
  }
};

export const useDocumentStore = create<DocumentState>((set, get) => ({
  journalId: "",
  title: "",
  blocks: [],
  status: "draft",
  isDirty: false,
  isSaving: false,
  previewMode: false,

  clientRevision: 1,
  serverRevision: 1,
  activeRevisionNumber: 1,
  lastSavedAt: null,
  syncStatus: "synced",
  dirtyBlockIds: [],
  serverBlockIds: [],
  isStructureDirty: false,
  isOrderDirty: false,
  isTitleDirty: false,

  init: (journalId, title, blocks, status, revision = 1, activeRevisionNumber = 1) =>
    set({
      journalId,
      title,
      blocks,
      status,
      clientRevision: revision,
      serverRevision: revision,
      activeRevisionNumber: activeRevisionNumber || 1,
      isDirty: false,
      isSaving: false,
      syncStatus: "synced",
      dirtyBlockIds: [],
      serverBlockIds: (blocks || []).map((b) => b.id),
      isStructureDirty: false,
      isOrderDirty: false,
      isTitleDirty: false,
      previewMode: status !== "draft" && status !== "changes_requested",
    }),

  setStatus: (status) =>
    set({
      status,
      previewMode: status !== "draft" && status !== "changes_requested",
    }),

  setActiveRevisionNumber: (activeRevisionNumber) =>
    set({
      activeRevisionNumber: activeRevisionNumber || 1,
    }),

  setTitle: (title) =>
    set((state) => {
      const isChanged = state.title !== title;
      if (isChanged) {
        saveLocalSnapshot(state.journalId, title, state.blocks, state.clientRevision);
      }
      return {
        title,
        isDirty: state.isDirty || isChanged,
        isTitleDirty: state.isTitleDirty || isChanged,
        syncStatus: isChanged ? "unsaved" : state.syncStatus,
      };
    }),

  addBlock: (index, type, content = {}) =>
    set((state) => {
      const newBlock: JournalBlock = {
        id: crypto.randomUUID(),
        type,
        content,
        metadata: { createdAt: new Date().toISOString() },
      };
      const updated = [...state.blocks];
      updated.splice(index, 0, newBlock);
      saveLocalSnapshot(state.journalId, state.title, updated, state.clientRevision);
      return {
        blocks: updated,
        isDirty: true,
        isStructureDirty: true,
        syncStatus: "unsaved",
        dirtyBlockIds: Array.from(new Set([...state.dirtyBlockIds, newBlock.id])),
      };
    }),

  updateBlock: (id, content) =>
    set((state) => {
      const updated = state.blocks.map((block) => {
        if (block.id === id) {
          return {
            ...block,
            content: { ...block.content, ...content },
            metadata: { ...block.metadata, updatedAt: new Date().toISOString() },
          };
        }
        return block;
      });
      saveLocalSnapshot(state.journalId, state.title, updated, state.clientRevision);
      return {
        blocks: updated,
        isDirty: true,
        syncStatus: "unsaved",
        dirtyBlockIds: Array.from(new Set([...state.dirtyBlockIds, id])),
      };
    }),

  deleteBlock: (id) =>
    set((state) => {
      const updated = state.blocks.filter((block) => block.id !== id);
      saveLocalSnapshot(state.journalId, state.title, updated, state.clientRevision);
      return {
        blocks: updated,
        isDirty: true,
        isStructureDirty: true,
        syncStatus: "unsaved",
        dirtyBlockIds: state.dirtyBlockIds.filter((bid) => bid !== id),
      };
    }),

  duplicateBlock: (id) =>
    set((state) => {
      const blockIndex = state.blocks.findIndex((block) => block.id === id);
      if (blockIndex === -1) return {};

      const sourceBlock = state.blocks[blockIndex];
      const duplicatedBlock: JournalBlock = {
        id: crypto.randomUUID(),
        type: sourceBlock.type,
        content: JSON.parse(JSON.stringify(sourceBlock.content)),
        metadata: {
          createdAt: new Date().toISOString(),
          duplicatedFrom: id,
        },
      };

      const updated = [...state.blocks];
      updated.splice(blockIndex + 1, 0, duplicatedBlock);
      saveLocalSnapshot(state.journalId, state.title, updated, state.clientRevision);
      return {
        blocks: updated,
        isDirty: true,
        isStructureDirty: true,
        syncStatus: "unsaved",
        dirtyBlockIds: Array.from(new Set([...state.dirtyBlockIds, duplicatedBlock.id])),
      };
    }),

  moveBlock: (fromIndex, toIndex) =>
    set((state) => {
      if (
        fromIndex < 0 ||
        fromIndex >= state.blocks.length ||
        toIndex < 0 ||
        toIndex >= state.blocks.length
      ) {
        return {};
      }
      const updated = [...state.blocks];
      const [movedBlock] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedBlock);
      saveLocalSnapshot(state.journalId, state.title, updated, state.clientRevision);
      return {
        blocks: updated,
        isDirty: true,
        isOrderDirty: true,
        syncStatus: "unsaved",
      };
    }),

  setSaving: (isSaving) =>
    set((state) => ({
      isSaving,
      syncStatus: isSaving ? "saving" : state.isDirty ? "unsaved" : "synced",
    })),

  setDirty: (isDirty) =>
    set((state) => (state.isDirty === isDirty ? state : { isDirty })),

  setSyncStatus: (syncStatus) =>
    set((state) => (state.syncStatus === syncStatus ? state : { syncStatus })),

  setRevision: (serverRevision, savedAt) =>
    set((state) => {
      clearLocalSnapshot(state.journalId);
      return {
        clientRevision: serverRevision,
        serverRevision,
        lastSavedAt: savedAt || new Date().toISOString(),
        isDirty: false,
        isSaving: false,
        syncStatus: "synced",
        dirtyBlockIds: [],
        serverBlockIds: state.blocks.map((b) => b.id),
        isStructureDirty: false,
        isOrderDirty: false,
        isTitleDirty: false,
      };
    }),

  acknowledgeSave: (
    serverRevision: number,
    savedAt?: string,
    savedBlockSnapshotMap: Record<string, string> = {},
    savedStructureClean: boolean = false,
    savedOrderClean: boolean = false,
    savedTitleClean: boolean = false
  ) =>
    set((state) => {
      // Determine which dirty blocks still have unsaved changes typed during in-flight save
      const remainingDirtyIds = state.dirtyBlockIds.filter((id) => {
        const sentContentJson = savedBlockSnapshotMap[id];
        if (sentContentJson === undefined) {
          // Block was not part of this save request -> must remain dirty
          return true;
        }
        const currentBlock = state.blocks.find((b) => b.id === id);
        const currentContentJson = JSON.stringify(currentBlock?.content || {});
        // If student typed into this block while save was in-flight, content differs -> remains dirty!
        return currentContentJson !== sentContentJson;
      });

      const isStructureStillDirty = savedStructureClean ? false : state.isStructureDirty;
      const isOrderStillDirty = savedOrderClean ? false : state.isOrderDirty;
      const isTitleStillDirty = savedTitleClean ? false : state.isTitleDirty;

      const isStillDirty =
        remainingDirtyIds.length > 0 ||
        isStructureStillDirty ||
        isOrderStillDirty ||
        isTitleStillDirty;

      if (!isStillDirty) {
        clearLocalSnapshot(state.journalId);
      } else {
        saveLocalSnapshot(state.journalId, state.title, state.blocks, serverRevision);
      }

      return {
        clientRevision: serverRevision,
        serverRevision,
        lastSavedAt: savedAt || new Date().toISOString(),
        dirtyBlockIds: remainingDirtyIds,
        isStructureDirty: isStructureStillDirty,
        isOrderDirty: isOrderStillDirty,
        isTitleDirty: isTitleStillDirty,
        isDirty: isStillDirty,
        isSaving: false,
        syncStatus: isStillDirty ? "unsaved" : "synced",
        serverBlockIds: state.blocks.map((b) => b.id),
      };
    }),

  loadLocalRecovery: (title, blocks) =>
    set((state) => ({
      title,
      blocks,
      isDirty: true,
      isStructureDirty: true,
      syncStatus: "unsaved",
    })),

  togglePreview: () => set((state) => ({ previewMode: !state.previewMode })),
}));

