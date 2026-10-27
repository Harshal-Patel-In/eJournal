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
  onSelect: (type: string, content?: Record<string, unknown>) => void;
  onClose: () => void;
  initialSearch?: string;
  externalSearch?: string;
  hideInput?: boolean;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  className?: string;
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

export function getFilteredMenuItems(search: string) {
  const q = search.toLowerCase().trim();
  if (!q) return MENU_ITEMS;
  return MENU_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q)
  );
}

export default function SlashMenu({
  onSelect,
  onClose,
  initialSearch = "",
  externalSearch,
  hideInput = false,
  selectedIndex: controlledIndex,
  onSelectedIndexChange,
  className = "",
}: SlashMenuProps) {
  const [internalSearch, setInternalSearch] = useState(initialSearch);
  const [internalIndex, setInternalIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);

  const search = externalSearch !== undefined ? externalSearch : internalSearch;
  const isControlled = controlledIndex !== undefined;
  const selectedIndex = isControlled ? controlledIndex : internalIndex;

  const updateSelectedIndex = (next: number) => {
    if (!isControlled) {
      setInternalIndex(next);
    }
    onSelectedIndexChange?.(next);
  };

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

  const filteredItems = getFilteredMenuItems(search);

  // Reset selected index when search changes
  useEffect(() => {
    updateSelectedIndex(0);
  }, [search]);

  // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      updateSelectedIndex(filteredItems.length === 0 ? 0 : (selectedIndex + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      updateSelectedIndex(filteredItems.length === 0 ? 0 : (selectedIndex - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        const item = filteredItems[selectedIndex];
        onSelect(item.type, item.content);
      }
    }
  };

  return (
    <div
      ref={menuRef}
      className={`z-50 w-76 rounded-2xl border border-white/70 dark:border-white/15 ring-1 ring-black/5 dark:ring-white/10 bg-gradient-to-b from-white/95 via-white/90 to-white/85 dark:from-zinc-900/95 dark:via-zinc-900/90 dark:to-zinc-950/85 backdrop-blur-2xl shadow-2xl shadow-black/15 dark:shadow-black/60 p-2.5 max-h-[380px] flex flex-col gap-1.5 transition-all duration-150 select-none ${className}`}
    >
      {!hideInput && (
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setInternalSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type block name (e.g. table, math, code)..."
          className="w-full text-xs font-medium bg-muted/60 hover:bg-muted/80 border border-border px-3 py-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background transition-all"
        />
      )}

      <div
        ref={itemsContainerRef}
        className="overflow-y-auto flex flex-col gap-1 max-h-[300px] custom-scrollbar pr-0.5"
      >
        {filteredItems.length === 0 ? (
          <div className="py-6 px-3 text-xs text-muted-foreground text-center flex flex-col items-center gap-1">
            <span className="font-semibold text-foreground/80">No matching blocks</span>
            <span className="text-[11px] text-muted-foreground/60">Try searching &quot;table&quot;, &quot;code&quot;, or &quot;heading&quot;</span>
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const Icon = item.icon;
            const isSelected = index === selectedIndex;

            return (
              <button
                key={`${item.type}-${item.label}-${index}`}
                type="button"
                onClick={() => onSelect(item.type, item.content)}
                onMouseEnter={() => updateSelectedIndex(index)}
                className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 text-primary ring-1 ring-primary/25 shadow-2xs"
                    : "hover:bg-muted/60 text-foreground/80 hover:text-foreground"
                }`}
              >
                <div
                  className={`p-2 rounded-lg shrink-0 transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs font-semibold truncate leading-tight">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate leading-tight">
                    {item.desc}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
export { MENU_ITEMS };
