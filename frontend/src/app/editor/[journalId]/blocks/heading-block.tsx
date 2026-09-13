"use client";

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

  if (previewMode) {
    if (level === 1) return <h1 className="text-3xl font-extrabold tracking-tight mt-6 mb-3"><InlineMathText text={text} /></h1>;
    if (level === 2) return <h2 className="text-2xl font-bold tracking-tight mt-5 mb-2.5"><InlineMathText text={text} /></h2>;
    return <h3 className="text-xl font-semibold tracking-tight mt-4 mb-2"><InlineMathText text={text} /></h3>;
  }

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Level Selector */}
      <GlassDropdown
        size="sm"
        value={String(level)}
        options={HEADING_OPTIONS}
        onChange={(val) => updateBlock(id, { level: parseInt(val, 10) })}
        className="shrink-0"
        buttonClassName="h-8 px-2.5 min-w-[56px] font-bold rounded-lg"
        menuClassName="w-64"
        showBadgeInTrigger={false}
        renderMath={false}
      />

      {/* Input */}
      <input
        type="text"
        value={text}
        onChange={(e) => {
          const value = applyMathShortcuts(e.target.value);
          updateBlock(id, { text: value });
        }}
        placeholder={`Heading ${level}`}
        className={`w-full bg-transparent border-0 border-b border-transparent hover:border-border/40 focus:border-primary focus:ring-0 focus:outline-none transition-all py-1 font-bold ${
          level === 1 ? "text-2xl" : level === 2 ? "text-xl" : "text-lg"
        }`}
      />
    </div>
  );
}
