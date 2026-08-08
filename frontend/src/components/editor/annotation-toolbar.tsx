/**
 * Compact Annotation Toolbar — triggered on hover/click per block.
 *
 * 6 annotation types with distinct visual identity:
 * - Comment (blue)   — general feedback
 * - Suggestion (amber) — proposed replacement
 * - Highlight (cyan)  — draw attention
 * - Warning (rose)    — issue/error
 * - Approval (green)  — marks correct
 * - Question (violet) — needs clarification
 */

"use client";

import { useState } from "react";
import {
  MessageSquare,
  Sparkles,
  Highlighter,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type AnnotationType = "Comment" | "Suggestion" | "Highlight" | "Warning" | "Approval" | "Question";

interface AnnotationToolbarProps {
  blockId: string;
  onAddAnnotation: (type: AnnotationType, content: string) => void;
  isSubmitting?: boolean;
  onClose?: () => void;
}

const annotationTypes: { type: AnnotationType; icon: any; color: string; activeBg: string; label: string }[] = [
  { type: "Comment", icon: MessageSquare, color: "text-blue-500", activeBg: "bg-blue-500 text-white shadow-sm", label: "Comment" },
  { type: "Suggestion", icon: Sparkles, color: "text-amber-500", activeBg: "bg-amber-500 text-white shadow-sm", label: "Suggestion" },
  { type: "Highlight", icon: Highlighter, color: "text-cyan-500", activeBg: "bg-cyan-500 text-white shadow-sm", label: "Highlight" },
  { type: "Warning", icon: AlertTriangle, color: "text-rose-500", activeBg: "bg-rose-500 text-white shadow-sm", label: "Warning" },
  { type: "Approval", icon: CheckCircle, color: "text-emerald-500", activeBg: "bg-emerald-500 text-white shadow-sm", label: "Approval" },
  { type: "Question", icon: HelpCircle, color: "text-violet-500", activeBg: "bg-violet-500 text-white shadow-sm", label: "Question" },
];

export function AnnotationToolbar({
  blockId,
  onAddAnnotation,
  isSubmitting = false,
  onClose,
}: AnnotationToolbarProps) {
  const [selectedType, setSelectedType] = useState<AnnotationType | null>(null);
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!selectedType || !text.trim()) return;
    onAddAnnotation(selectedType, text.trim());
    setText("");
    setSelectedType(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-border/60 shadow-lg text-xs animate-in fade-in zoom-in-95 duration-150">
      {/* Type Selector — icon-only pills with tooltip labels */}
      <div className="flex items-center gap-1">
        {annotationTypes.map((b) => {
          const Icon = b.icon;
          const isSelected = selectedType === b.type;
          return (
            <button
              key={b.type}
              onClick={() => setSelectedType(isSelected ? null : b.type)}
              title={b.label}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                isSelected
                  ? b.activeBg
                  : `hover:bg-muted/60 ${b.color}`
              }`}
            >
              <Icon className="size-3.5" />
              <span className={isSelected ? "" : "hidden sm:inline"}>{b.label}</span>
            </button>
          );
        })}

        {/* Close button */}
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-all cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Compose Area — appears when a type is selected */}
      {selectedType && (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <textarea
            autoFocus
            placeholder={`Add ${selectedType.toLowerCase()} for this block...`}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border border-input bg-muted/20 p-2.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary resize-none transition-all placeholder:text-muted-foreground/40"
          />

          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/40 font-medium">
              {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+Enter to send
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSelectedType(null); setText(""); }}
                className="h-7 text-[11px] rounded-lg text-muted-foreground cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!text.trim() || isSubmitting}
                className="h-7 text-[11px] rounded-lg gap-1 cursor-pointer"
              >
                <Send className="size-3" />
                <span>Post</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
