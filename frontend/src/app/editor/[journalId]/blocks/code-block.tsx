"use client";

import { useDocumentStore } from "../use-document-store";

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
        <select
          value={language}
          onChange={(e) => updateBlock(id, { language: e.target.value })}
          className="text-xs font-semibold bg-muted hover:bg-muted/80 border border-border px-2 py-1 rounded-md cursor-pointer focus:outline-none"
        >
          <option value="python">Python</option>
          <option value="c">C Language</option>
          <option value="cpp">C++</option>
          <option value="java">Java</option>
          <option value="javascript">JavaScript</option>
        </select>
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
