"use client";

import { useEffect, useRef, useState } from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  Table as TableIcon,
  Image as ImageIcon,
  Code as CodeIcon,
  CheckSquare,
  BookOpen,
  Split,
  FileDown,
  FileSymlink,
  Sigma,
} from "lucide-react";

interface SlashMenuProps {
  onSelect: (type: string) => void;
  onClose: () => void;
}

const MENU_ITEMS = [
  {
    type: "heading",
    label: "Heading 1",
    desc: "Large section heading",
    icon: Heading1,
    content: { text: "", level: 1 },
  },
  {
    type: "heading",
    label: "Heading 2",
    desc: "Medium section heading",
    icon: Heading2,
    content: { text: "", level: 2 },
  },
  {
    type: "heading",
    label: "Heading 3",
    desc: "Small sub-section heading",
    icon: Heading3,
    content: { text: "", level: 3 },
  },
  {
    type: "paragraph",
    label: "Paragraph",
    desc: "Rich paragraph plain text",
    icon: AlignLeft,
    content: { text: "" },
  },
  {
    type: "table",
    label: "Table",
    desc: "Structured data matrix",
    icon: TableIcon,
    content: {
      headers: ["Column 1", "Column 2", "Column 3"],
      rows: [["", "", ""]],
    },
  },
  {
    type: "image",
    label: "Image Upload",
    desc: "Visual diagrams and captures",
    icon: ImageIcon,
    content: { url: "", caption: "" },
  },
  {
    type: "code",
    label: "Code Snippet",
    desc: "Syntax-highlighted code source",
    icon: CodeIcon,
    content: { text: "", language: "python" },
  },
  {
    type: "observation",
    label: "Observation Block",
    desc: "Record experiment variables",
    icon: FileSymlink,
    content: { text: "" },
  },
  {
    type: "result",
    label: "Result Statement",
    desc: "Final numerical outcomes",
    icon: CheckSquare,
    content: { text: "" },
  },
  {
    type: "reference",
    label: "Reference Citation",
    desc: "Academic literature citation",
    icon: BookOpen,
    content: { text: "" },
  },
  {
    type: "divider",
    label: "Divider Separator",
    desc: "Visual section line breaker",
    icon: Split,
    content: {},
  },
  {
    type: "page_break",
    label: "Page Break",
    desc: "Force PDF printing page split",
    icon: FileDown,
    content: {},
  },
  {
    type: "equation",
    label: "Math Equation",
    desc: "Visual LaTeX display formula",
    icon: Sigma,
    content: { latex: "" },
  },
];

export default function SlashMenu({ onSelect, onClose }: SlashMenuProps) {
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outer click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const filteredItems = MENU_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={menuRef}
      className="absolute z-50 w-72 rounded-2xl border border-white/60 dark:border-white/20 ring-1 ring-black/5 dark:ring-white/10 bg-gradient-to-b from-white/90 to-white/75 dark:from-gray-900/95 dark:to-gray-900/85 backdrop-blur-2xl shadow-2xl shadow-black/10 dark:shadow-black/40 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.8)] dark:shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)] p-2 max-h-[380px] overflow-y-auto flex flex-col gap-1 transition-all duration-150 select-none"
    >
      <input
        type="text"
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Type to filter blocks..."
        className="w-full text-xs font-medium bg-muted/60 hover:bg-muted/80 border border-border px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all mb-1"
      />

      {filteredItems.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground text-center">No blocks found</div>
      ) : (
        filteredItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={() => onSelect(item.type)}
              className="w-full flex items-start gap-3 p-2 hover:bg-muted rounded-lg text-left transition-all active:scale-99"
            >
              <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                <Icon className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
                <span className="text-[10px] text-muted-foreground truncate">{item.desc}</span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}
export { MENU_ITEMS };
