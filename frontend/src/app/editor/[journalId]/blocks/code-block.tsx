"use client";

import React, { useState, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { useTheme } from "next-themes";
import { Check, Copy, Terminal } from "lucide-react";

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
  const { resolvedTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  const languageExtension = useMemo(() => {
    switch (language.toLowerCase()) {
      case "python":
        return [python()];
      case "c":
      case "cpp":
        return [cpp()];
      case "java":
        return [java()];
      case "javascript":
      case "js":
        return [javascript({ jsx: true })];
      default:
        return [python()];
    }
  }, [language]);

  const lineCount = useMemo(() => {
    if (!text) return 1;
    return text.split("\n").length;
  }, [text]);

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isDarkMode = resolvedTheme === "dark";

  return (
    <div className="w-full my-4 rounded-2xl border border-border/80 dark:border-white/15 bg-card dark:bg-zinc-950/80 shadow-md transition-all relative z-10 print:break-inside-avoid print:shadow-none print:border-zinc-300 print:my-2">
      {/* macOS Studio Window Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-t-2xl bg-muted/40 dark:bg-zinc-900/60 border-b border-border/70 dark:border-white/10 select-none print:bg-zinc-100 print:border-zinc-300">
        {/* Left: Academic Code Terminal Badge & Language Picker */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-xs font-mono font-medium border border-border/40 print:hidden select-none">
            <Terminal className="size-3 text-primary/80" />
            <span className="text-[11px] font-semibold tracking-tight">Terminal</span>
          </div>

          <div className="h-3.5 w-px bg-border/60 dark:bg-white/10 shrink-0 print:hidden" />

          {/* Language Selector (Editable in Edit Mode, Badge in Preview Mode) */}
          {previewMode ? (
            <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-mono font-bold text-foreground/80 border border-border/60 uppercase tracking-wider print:border-zinc-400 print:text-zinc-800">
              {language}
            </span>
          ) : (
            <GlassDropdown
              size="sm"
              value={language}
              options={LANGUAGE_OPTIONS}
              onChange={(val) => updateBlock(id, { language: val })}
              className="shrink-0"
              buttonClassName="h-7 px-2 text-xs font-semibold rounded-lg bg-background/80 dark:bg-zinc-800/80"
              menuClassName="w-56"
              showBadgeInTrigger={false}
              renderMath={false}
            />
          )}
        </div>

        {/* Right: Metrics & Copy Button */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono text-muted-foreground font-medium hidden sm:inline-block">
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>

          <div className="h-3.5 w-px bg-border/60 dark:bg-white/10 shrink-0 hidden sm:inline-block" />

          <button
            type="button"
            onClick={handleCopy}
            data-tooltip={copied ? "Copied to clipboard!" : "Copy code snippet"}
            data-tooltip-side="bottom"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer active:scale-95 ${
              copied
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                : "bg-background/80 dark:bg-zinc-800/80 hover:bg-muted dark:hover:bg-zinc-700/80 text-foreground/80 hover:text-foreground border border-border/70 dark:border-white/10 shadow-2xs"
            }`}
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-500 stroke-[2.5]" />
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5 text-muted-foreground" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* CodeMirror 6 Editor Canvas with Fira Code Ligatures */}
      <div className="relative font-code text-[13px] leading-relaxed p-1 rounded-b-2xl">
        <CodeMirror
          value={text}
          extensions={languageExtension}
          onChange={(val) => {
            if (!previewMode) {
              updateBlock(id, { text: val });
            }
          }}
          theme={isDarkMode ? "dark" : "light"}
          readOnly={previewMode}
          editable={!previewMode}
          minHeight="90px"
          maxHeight="600px"
          placeholder={`// Write your ${language} code here...`}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: !previewMode,
            highlightActiveLineGutter: !previewMode,
            foldGutter: false,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: false,
            tabSize: 4,
          }}
        />
      </div>
    </div>
  );
}
