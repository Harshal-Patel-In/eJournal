"use client";

import { useEffect, useRef } from "react";
import { useDocumentStore } from "../use-document-store";
import { applyMathShortcuts } from "@/lib/math-shortcuts";

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
        {text || <span className="text-muted-foreground/30 italic">Empty paragraph</span>}
      </p>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      value={text}
      onChange={(e) => {
        const value = applyMathShortcuts(e.target.value);
        updateBlock(id, { text: value });
      }}
      placeholder="Type paragraph content here... (use / to insert other blocks)"
      className="w-full bg-transparent resize-none overflow-hidden border-0 border-b border-transparent hover:border-border/30 focus:border-primary/50 focus:ring-0 focus:outline-none transition-all py-1 text-sm leading-relaxed"
    />
  );
}
