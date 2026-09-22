"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bold, Italic, Code, Highlighter, Sigma, Sparkles } from "lucide-react";
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
  const [showToolbar, setShowToolbar] = useState(false);

  // Auto-resize height based on text content length
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  // Toggle formatting around currently selected text
  const toggleFormatting = useCallback(
    (prefix: string, suffix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const rawText = text;

      // If no text selected, insert a placeholder or delimiter
      if (start === end) {
        const placeholder =
          prefix === "$"
            ? "formula"
            : prefix === "**"
            ? "bold text"
            : prefix === "*"
            ? "italic text"
            : prefix === "`"
            ? "code"
            : "highlighted text";
        const inserted = `${prefix}${placeholder}${suffix}`;
        const newText = rawText.slice(0, start) + inserted + rawText.slice(end);
        updateBlock(id, { text: newText });

        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(start + prefix.length, start + prefix.length + placeholder.length);
        });
        return;
      }

      const selectedText = rawText.slice(start, end);

      // Case 1: The selection itself is already wrapped in prefix and suffix
      if (
        selectedText.startsWith(prefix) &&
        selectedText.endsWith(suffix) &&
        selectedText.length >= prefix.length + suffix.length
      ) {
        const unwrapped = selectedText.slice(prefix.length, selectedText.length - suffix.length);
        const newText = rawText.slice(0, start) + unwrapped + rawText.slice(end);
        updateBlock(id, { text: newText });

        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(start, start + unwrapped.length);
        });
        return;
      }

      // Case 2: The characters just outside the selection match prefix and suffix
      if (
        start >= prefix.length &&
        end + suffix.length <= rawText.length &&
        rawText.slice(start - prefix.length, start) === prefix &&
        rawText.slice(end, end + suffix.length) === suffix
      ) {
        const newText = rawText.slice(0, start - prefix.length) + selectedText + rawText.slice(end + suffix.length);
        updateBlock(id, { text: newText });

        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(start - prefix.length, end - prefix.length);
        });
        return;
      }

      // Case 3: Wrap selection
      const wrapped = `${prefix}${selectedText}${suffix}`;
      const newText = rawText.slice(0, start) + wrapped + rawText.slice(end);
      updateBlock(id, { text: newText });

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + wrapped.length);
      });
    },
    [id, text, updateBlock]
  );

  // Monitor text selection to show/hide the floating bubble toolbar
  const handleSelectionChange = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (textarea.selectionStart !== textarea.selectionEnd) {
      setShowToolbar(true);
    } else {
      setShowToolbar(false);
    }
  };

  // Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+E, Ctrl+Shift+H, Ctrl+Shift+M)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    if (cmdOrCtrl) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        toggleFormatting("**", "**");
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        toggleFormatting("*", "*");
      } else if (e.key === "e" || e.key === "E" || (e.shiftKey && (e.key === "c" || e.key === "C"))) {
        e.preventDefault();
        toggleFormatting("`", "`");
      } else if (e.shiftKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault();
        toggleFormatting("==", "==");
      } else if (e.shiftKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        toggleFormatting("$", "$");
      }
    }
  };

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

  // Detect whether text has active math or inline markdown formatting
  const hasFormattingOrMath =
    (text.includes("$") && /\$[^$]+\$/.test(text)) ||
    /\*\*[^*]+\*\*/.test(text) ||
    /==[^=]+==/.test(text) ||
    /`[^`]+`/.test(text) ||
    /\*[^*]+?\*/.test(text);

  return (
    <div className="flex flex-col gap-1.5 w-full group relative">
      {/* Floating Selection Bubble Toolbar */}
      {showToolbar && (
        <div
          className="absolute -top-9 left-1 z-30 flex items-center gap-0.5 p-1 rounded-xl bg-background/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-border/80 shadow-lg ring-1 ring-black/5 dark:ring-white/10 animate-in fade-in-50 zoom-in-95 duration-150 select-none"
          onMouseDown={(e) => e.preventDefault()} // Keeps textarea focused!
        >
          <button
            type="button"
            onClick={() => toggleFormatting("**", "**")}
            className="h-7 px-2 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            title="Bold (Ctrl+B)"
          >
            <Bold className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleFormatting("*", "*")}
            className="h-7 px-2 rounded-lg text-xs font-semibold italic text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            title="Italic (Ctrl+I)"
          >
            <Italic className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleFormatting("`", "`")}
            className="h-7 px-2 rounded-lg text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            title="Inline Code (Ctrl+E)"
          >
            <Code className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => toggleFormatting("==", "==")}
            className="h-7 px-2 rounded-lg text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            title="Highlight (Ctrl+Shift+H)"
          >
            <Highlighter className="size-3.5" />
          </button>
          <div className="w-px h-4 bg-border/60 mx-0.5" />
          <button
            type="button"
            onClick={() => toggleFormatting("$", "$")}
            className="h-7 px-2 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
            title="Inline Equation (Ctrl+Shift+M)"
          >
            <Sigma className="size-3.5" />
          </button>
        </div>
      )}

      {/* Primary Auto-Resizing Textarea */}
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(e) => {
          const value = applyMathShortcuts(e.target.value);
          updateBlock(id, { text: value });
        }}
        onSelect={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Small delay to allow button click before dismissing
          setTimeout(() => setShowToolbar(false), 200);
        }}
        placeholder="Type paragraph content here... (select text for Bold/Italic, use $...$ for inline math, / for blocks)"
        className="w-full bg-transparent resize-none overflow-hidden border-0 border-b border-transparent hover:border-border/30 focus:border-primary/50 focus:ring-0 focus:outline-none transition-all py-1 text-sm leading-relaxed"
      />

      {/* Live Formatted Typography & KaTeX Preview Chip */}
      {hasFormattingOrMath && (
        <div className="text-xs py-2 px-3.5 rounded-xl bg-muted/40 border border-border/50 text-foreground/90 flex flex-wrap items-center gap-2 animate-in fade-in-50 duration-150 select-text">
          <span className="text-[10px] font-extrabold text-primary/70 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="size-3 text-primary" />
            Live Preview:
          </span>
          <InlineMathText text={text} />
        </div>
      )}
    </div>
  );
}
