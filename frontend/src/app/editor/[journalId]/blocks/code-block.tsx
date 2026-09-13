"use client";

import { useDocumentStore } from "../use-document-store";
import { GlassDropdown, DropdownOption } from "@/components/ui/glass-dropdown";

const LANGUAGE_OPTIONS: DropdownOption[] = [
  { value: "python", label: "Python", badge: "PY", description: "Python 3" },
  { value: "c", label: "C Language", badge: "C", description: "C99 / C11 native" },
  { value: "cpp", label: "C++", badge: "C++", description: "Modern C++" },
  { value: "java", label: "Java", badge: "JAVA", description: "Java Standard Edition" },
  { value: "javascript", label: "JavaScript", badge: "JS", description: "Node.js / Web" },
];

interface CodeBlockProps {
  id: string;
  content: {
    text: string;
    language?: string;
  };
  previewMode: boolean;
}

export default function CodeBlock({ id, content, previewMode }: CodeBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);
  const text = content.text || "";
  const language = content.language || "python";

  if (previewMode) {
    return (
      <div className="w-full my-4 rounded-lg overflow-hidden border border-border/80 shadow-xs bg-muted/30">
        {/* Code header bar */}
        <div className="flex items-center justify-between bg-muted/65 px-4 py-1.5 border-b border-border/60 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>{language}</span>
        </div>
        {/* Code display */}
        <pre className="p-4 overflow-x-auto font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap bg-card dark:bg-muted/15">
          <code>{text || <span className="text-muted-foreground/30 italic">No code written</span>}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full border border-border p-4 rounded-xl bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Code Block</span>
        <GlassDropdown
          size="sm"
          value={language}
          options={LANGUAGE_OPTIONS}
          onChange={(val) => updateBlock(id, { language: val })}
          className="shrink-0"
          buttonClassName="h-7.5 px-2.5 text-xs font-semibold rounded-lg"
          menuClassName="w-56"
          showBadgeInTrigger={false}
          renderMath={false}
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => updateBlock(id, { text: e.target.value })}
        placeholder={`Write your ${language} code here...`}
        rows={8}
        className="w-full bg-muted/10 font-mono text-xs p-3 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
      />
    </div>
  );
}
