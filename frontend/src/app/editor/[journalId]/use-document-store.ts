import { create } from "zustand";

export interface JournalBlock {
  id: string;
  type: string;
  content: any;
  metadata: any;
}

interface DocumentState {
  journalId: string;
  title: string;
  blocks: JournalBlock[];
  status: string;
  isDirty: boolean;
  isSaving: boolean;
  previewMode: boolean;

  init: (journalId: string, title: string, blocks: JournalBlock[], status: string) => void;
  setStatus: (status: string) => void;
  setTitle: (title: string) => void;
  addBlock: (index: number, type: string, content?: any) => void;
  updateBlock: (id: string, content: any) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  moveBlock: (fromIndex: number, toIndex: number) => void;
  setSaving: (status: boolean) => void;
  setDirty: (status: boolean) => void;
  togglePreview: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  journalId: "",
  title: "",
  blocks: [],
  status: "draft",
  isDirty: false,
  isSaving: false,
  previewMode: false,

  init: (journalId, title, blocks, status) =>
    set({
      journalId,
      title,
      blocks,
      status,
      isDirty: false,
      isSaving: false,
      previewMode: status !== "draft" && status !== "changes_requested",
    }),

  setStatus: (status) =>
    set({
      status,
      previewMode: status !== "draft" && status !== "changes_requested",
    }),

  setTitle: (title) =>
    set((state) => ({
      title,
      isDirty: state.title !== title ? true : state.isDirty,
    })),

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
      return { blocks: updated, isDirty: true };
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
      return { blocks: updated, isDirty: true };
    }),

  deleteBlock: (id) =>
    set((state) => {
      const updated = state.blocks.filter((block) => block.id !== id);
      return { blocks: updated, isDirty: true };
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
      return { blocks: updated, isDirty: true };
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
      return { blocks: updated, isDirty: true };
    }),

  setSaving: (isSaving) => set({ isSaving }),
  setDirty: (isDirty) => set({ isDirty }),
  togglePreview: () => set((state) => ({ previewMode: !state.previewMode })),
}));
