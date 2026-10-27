"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bold, Italic, Code, Highlighter, Sigma, Sparkles } from "lucide-react";
import { useDocumentStore } from "../use-document-store";
import { applyMathShortcuts } from "@/lib/math-shortcuts";
import { InlineMathText } from "@/components/inline-math-text";
import SlashMenu, { getFilteredMenuItems } from "../slash-menu";

interface ParagraphBlockProps {
  id: string;
  content: {
    text: string;
  };
  previewMode: boolean;
}

export default function ParagraphBlock({ id, content, previewMode }: ParagraphBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);
  const convertBlock = useDocumentStore((state) => state.convertBlock);
  const text = content.text || "";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  // Start in edit mode only if block has no text yet; otherwise render clean in-place preview
  const [isFocused, setIsFocused] = useState<boolean>(() => !content.text);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const isSlashActive = isFocused && text.startsWith("/") && !text.includes("\n");
  const slashSearch = isSlashActive ? text.slice(1) : "";
  const filteredSlashItems = isSlashActive ? getFilteredMenuItems(slashSearch) : [];

  // Auto-resize height based on text content length
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text, isFocused]);

  // When entering editing mode, focus the textarea automatically
  useEffect(() => {
    if (isFocused && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isFocused]);

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

  // Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+E, Ctrl+Shift+H, Ctrl+Shift+M, Escape, Slash Menu navigation)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashActive) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashSelectedIndex((prev) =>
          filteredSlashItems.length === 0 ? 0 : (prev + 1) % filteredSlashItems.length
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashSelectedIndex((prev) =>
          filteredSlashItems.length === 0 ? 0 : (prev - 1 + filteredSlashItems.length) % filteredSlashItems.length
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredSlashItems[slashSelectedIndex]) {
          const selected = filteredSlashItems[slashSelectedIndex];
          convertBlock(id, selected.type, selected.content);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        updateBlock(id, { text: "" });
        return;
      }
    }

    if (e.key === "Escape") {
      e.preventDefault();
      textareaRef.current?.blur();
      return;
    }

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

  // Handle click on rendered text to enter editing mode (unless user was selecting text to copy)
  const handleStartEdit = () => {
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (selection && selection.toString().length > 0) {
      return;
    }
    setIsFocused(true);
  };

  if (previewMode) {
    return (
      <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap py-1">
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
    <div className="flex flex-col w-full group relative">
      {/* 1. When blurred / user leaves block: show clean rendered preview in-place */}
      {!isFocused ? (
        <div
          onClick={handleStartEdit}
          className="w-full text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap py-1 cursor-text transition-colors rounded-lg hover:bg-muted/15 min-h-[30px]"
          title="Click to edit paragraph"
        >
          {text ? (
            <InlineMathText text={text} />
          ) : (
            <span className="text-muted-foreground/40 italic select-none">
              Type paragraph content... (select text for formatting, $...$ for math, / for blocks)
            </span>
          )}
        </div>
      ) : (
        /* 2. When focused / user clicks to edit: show textarea + multiline Live Preview card */
        <div className="flex flex-col gap-1.5 w-full relative">
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
              setTimeout(() => {
                setShowToolbar(false);
                setIsFocused(false);
              }, 150);
            }}
            placeholder="Type paragraph content here... (select text for Bold/Italic, use $...$ for inline math, / for blocks, Esc to finish)"
            className="w-full bg-transparent resize-none overflow-hidden border-0 border-b border-transparent hover:border-border/30 focus:border-primary/50 focus:ring-0 focus:outline-none transition-all py-1 text-sm leading-relaxed"
          />

          {/* In-place Floating Slash Command Menu */}
          {isSlashActive && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              className="absolute top-full left-0 mt-1 z-50 animate-in fade-in-0 zoom-in-95 duration-150"
            >
              <SlashMenu
                externalSearch={slashSearch}
                hideInput={true}
                selectedIndex={slashSelectedIndex}
                onSelectedIndexChange={setSlashSelectedIndex}
                onSelect={(type, blockContent) => {
                  convertBlock(id, type, blockContent);
                }}
                onClose={() => {
                  updateBlock(id, { text: "" });
                }}
              />
            </div>
          )}

          {/* Multiline Live Preview Card (Only visible when block is active & contains math/formatting) */}
          {hasFormattingOrMath && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              className="w-full mt-2 p-3.5 rounded-xl bg-muted/40 border border-border/60 text-foreground/90 select-text animate-in fade-in-50 duration-150"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-primary/80 uppercase tracking-wider mb-2 select-none border-b border-border/30 pb-1.5">
                <Sparkles className="size-3 text-primary" />
                <span>LIVE PREVIEW:</span>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                <InlineMathText text={text} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
