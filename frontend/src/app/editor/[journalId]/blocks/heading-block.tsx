"use client";

import { useDocumentStore } from "../use-document-store";
import { applyMathShortcuts } from "@/lib/math-shortcuts";
import { InlineMathText } from "@/components/inline-math-text";

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
      <select
        value={level}
        onChange={(e) => updateBlock(id, { level: parseInt(e.target.value) })}
        className="text-xs font-semibold bg-muted hover:bg-muted/80 border border-border px-2 py-1 rounded-md cursor-pointer focus:outline-none"
      >
        <option value={1}>H1</option>
        <option value={2}>H2</option>
        <option value={3}>H3</option>
      </select>

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
