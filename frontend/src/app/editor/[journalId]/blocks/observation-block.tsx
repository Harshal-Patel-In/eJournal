"use client";

import { Info } from "lucide-react";
import { useDocumentStore } from "../use-document-store";

interface ObservationBlockProps {
  id: string;
  content: {
    text: string;
  };
  previewMode: boolean;
}

export default function ObservationBlock({ id, content, previewMode }: ObservationBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);
  const text = content.text || "";

  if (previewMode) {
    return (
      <div className="w-full my-4 border border-blue-200/60 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-950/10 p-4 rounded-xl shadow-xs">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 select-none">
          <Info className="size-3.5" /> Experimental Observation
        </span>
        <p className="text-sm leading-relaxed text-blue-950/80 dark:text-blue-100/80 whitespace-pre-wrap">
          {text || <span className="text-blue-400/50 italic">No observation logged</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full border border-blue-200/80 dark:border-blue-900/30 p-4 rounded-xl bg-blue-50/10 dark:bg-blue-950/5 shadow-xs">
      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
        <Info className="size-3.5" /> Observation Block
      </span>
      <textarea
        value={text}
        onChange={(e) => updateBlock(id, { text: e.target.value })}
        placeholder="Enter experimental variables, sensor readings, or data notes observed..."
        rows={3}
        className="w-full bg-transparent border-0 border-b border-blue-200/30 dark:border-blue-900/10 focus:border-blue-500/50 focus:ring-0 focus:outline-none text-sm py-1 transition-all resize-none"
      />
    </div>
  );
}
