"use client";

import { Award } from "lucide-react";
import { useDocumentStore } from "../use-document-store";
import { applyMathShortcuts } from "@/lib/math-shortcuts";
import { InlineMathText } from "@/components/inline-math-text";

interface ResultBlockProps {
  id: string;
  content: {
    text: string;
  };
  previewMode: boolean;
}

export default function ResultBlock({ id, content, previewMode }: ResultBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);
  const text = content.text || "";

  if (previewMode) {
    return (
      <div className="w-full my-4 border border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-950/10 p-4 rounded-xl shadow-xs">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 select-none">
          <Award className="size-3.5" /> Experiment Result
        </span>
        <p className="text-sm font-semibold leading-relaxed text-emerald-950/90 dark:text-emerald-100/90 whitespace-pre-wrap">
          {text ? <InlineMathText text={text} /> : <span className="text-emerald-400/50 italic">No result statement logged</span>}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full border border-emerald-200/80 dark:border-emerald-900/30 p-4 rounded-xl bg-emerald-50/10 dark:bg-emerald-950/5 shadow-xs">
      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
        <Award className="size-3.5" /> Result Block
      </span>
      <textarea
        value={text}
        onChange={(e) => {
          const val = applyMathShortcuts(e.target.value);
          updateBlock(id, { text: val });
        }}
        placeholder="Enter final calculation results, validation outcomes, or deductions..."
        rows={3}
        className="w-full bg-transparent border-0 border-b border-emerald-200/30 dark:border-emerald-900/10 focus:border-emerald-500/50 focus:ring-0 focus:outline-none text-sm py-1 transition-all resize-none font-semibold text-emerald-900 dark:text-emerald-200"
      />
    </div>
  );
}
