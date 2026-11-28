"use client";

import { useEffect, useRef } from "react";
import { useDocumentStore } from "../use-document-store";
import { applyMathShortcuts } from "@/lib/math-shortcuts";
import { InlineMathText } from "@/components/inline-math-text";
import { GlassDropdown, DropdownOption } from "@/components/ui/glass-dropdown";

const HEADING_OPTIONS: DropdownOption[] = [
  {
    value: "1",
    label: "H1",
    badge: "H1",
    description: "Title · Primary Heading",
  },
  {
    value: "2",
    label: "H2",
    badge: "H2",
    description: "Section · Major Header",
  },
  {
    value: "3",
    label: "H3",
    badge: "H3",
    description: "Subsection · Detail Header",
  },
];

interface HeadingBlockProps {
  id: string;
  content: {
    text: string;
    level?: number;
  };
  previewMode: boolean;
}

export default function HeadingBlock({ id, content, previewMode }: HeadingBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);
  const text = content.text || "";
  const level = content.level || 1;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [text, level, previewMode]);

  if (previewMode) {
    if (level === 1) return <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-6 mb-3 break-words min-w-0"><InlineMathText text={text} /></h1>;
    if (level === 2) return <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-5 mb-2.5 break-words min-w-0"><InlineMathText text={text} /></h2>;
    return <h3 className="text-lg sm:text-xl font-semibold tracking-tight mt-4 mb-2 break-words min-w-0"><InlineMathText text={text} /></h3>;
  }

  return (
    <div className="flex items-start gap-2.5 sm:gap-3 w-full min-w-0">
      {/* Level Selector */}
      <GlassDropdown
        size="sm"
        value={String(level)}
        options={HEADING_OPTIONS}
        onChange={(val) => updateBlock(id, { level: parseInt(val, 10) })}
        className="shrink-0 pt-0.5"
        buttonClassName="h-9 sm:h-8 px-2.5 min-w-[56px] font-bold rounded-lg"
        menuClassName="w-64"
        showBadgeInTrigger={false}
        renderMath={false}
      />

      {/* Multi-line wrapping Heading Input */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => {
          const raw = e.target.value.replace(/\r?\n/g, " ");
          const value = applyMathShortcuts(raw);
          updateBlock(id, { text: value });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
          }
        }}
        placeholder={`Heading ${level}`}
        className={`w-full min-w-0 flex-1 resize-none overflow-hidden bg-transparent border-0 border-b border-transparent hover:border-border/40 focus:border-primary focus:ring-0 focus:outline-none transition-[border-color] duration-150 py-1 font-bold leading-snug break-words ${
          level === 1 ? "text-xl sm:text-2xl" : level === 2 ? "text-lg sm:text-xl" : "text-base sm:text-lg"
        }`}
      />
    </div>
  );
}
