"use client";

import { Bookmark } from "lucide-react";
import { useDocumentStore } from "../use-document-store";

interface ReferenceBlockProps {
  id: string;
  content: {
    text: string;
  };
  previewMode: boolean;
}

export default function ReferenceBlock({ id, content, previewMode }: ReferenceBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);
  const text = content.text || "";

  if (previewMode) {
    return (
      <div className="w-full my-3 flex items-start gap-3 pl-3 border-l-2 border-primary/50 text-sm">
        <Bookmark className="size-4 text-primary mt-0.5 shrink-0" />
        <p className="italic text-muted-foreground/90 leading-relaxed font-serif">
          {text || <span className="text-muted-foreground/30 not-italic">No citation citation</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full border border-border p-4 rounded-xl bg-card shadow-sm">
      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1">
        <Bookmark className="size-3.5" /> Reference Block
      </span>
      <textarea
        value={text}
        onChange={(e) => updateBlock(id, { text: e.target.value })}
        placeholder="Enter bibliographic references or web link citations (e.g. Standard IEEE formats)..."
        rows={2}
        className="w-full bg-transparent border-0 border-b border-border/30 focus:border-primary/50 focus:ring-0 focus:outline-none text-sm font-serif italic py-1 transition-all resize-none text-muted-foreground"
      />
    </div>
  );
}
