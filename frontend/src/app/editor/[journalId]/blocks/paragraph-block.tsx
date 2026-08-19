"use client";

import { useEffect, useRef } from "react";
import { useDocumentStore } from "../use-document-store";
import { applyMathShortcuts } from "@/lib/math-shortcuts";
import { InlineMathText } from "@/components/inline-math-text";

interface ParagraphBlockProps {
  id: string;
  content: {
    text: string;
  };
  previewMode: boolean;
}

export default function ParagraphBlock({ id, content, previewMode }: ParagraphBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);
  const text = content.text || "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize height based on text content length
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  if (previewMode) {
    return (
      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
        {text ? (
          <InlineMathText text={text} />
        ) : (
          <span className="text-muted-foreground/30 italic">Empty paragraph</span>
        )}
      </p>
    );
  }

  const hasInlineLatex = text.includes("$") && /\$[^$]+\$/.test(text);

  return (
    <div className="flex flex-col gap-1 w-full group">
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => {
          const value = applyMathShortcuts(e.target.value);
          updateBlock(id, { text: value });
        }}
        placeholder="Type paragraph content here... (use $...$ for inline math, / for blocks)"
        className="w-full bg-transparent resize-none overflow-hidden border-0 border-b border-transparent hover:border-border/30 focus:border-primary/50 focus:ring-0 focus:outline-none transition-all py-1 text-sm leading-relaxed"
      />
      {hasInlineLatex && (
        <div className="text-xs py-1.5 px-3 rounded-xl bg-muted/40 border border-border/50 text-foreground/90 flex flex-wrap items-center gap-2 animate-in fade-in-50 duration-150 select-text">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">
            Live Math:
          </span>
          <InlineMathText text={text} />
        </div>
      )}
    </div>
  );
}
