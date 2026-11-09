"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Split,
  AlertTriangle,
  ArrowRight,
  Code,
  Table as TableIcon,
  AlignLeft,
  Binary,
  Loader2,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface SideBySideComparisonDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  match: {
    studentA: { id: string; name: string; enrollment: string; email?: string };
    studentB: { id: string; name: string; enrollment: string; email?: string };
    journalIdA: string;
    journalIdB: string;
    overallSimilarity: number;
    categoryMatches: Record<string, number>;
    matchedBlockPairs: Array<{
      blockType: string;
      blockIdA: string;
      blockIdB: string;
      similarity: number;
      snippetA?: string;
      snippetB?: string;
    }>;
  } | null;
}

export function SideBySideComparisonDrawer({
  isOpen,
  onClose,
  match,
}: SideBySideComparisonDrawerProps) {
  const [syncScroll, setSyncScroll] = useState(true);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const paneARef = useRef<HTMLDivElement>(null);
  const paneBRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  // 1. Fetch Journal A
  const { data: journalA, isLoading: loadingA } = useQuery<any>({
    queryKey: ["journal-diff-a", match?.journalIdA],
    queryFn: () => api.get(`/journals/${match?.journalIdA}`),
    enabled: isOpen && !!match?.journalIdA,
  });

  // 2. Fetch Journal B
  const { data: journalB, isLoading: loadingB } = useQuery<any>({
    queryKey: ["journal-diff-b", match?.journalIdB],
    queryFn: () => api.get(`/journals/${match?.journalIdB}`),
    enabled: isOpen && !!match?.journalIdB,
  });

  // Synchronized scroll handlers
  const handleScrollA = () => {
    if (!syncScroll || isSyncingRef.current || !paneARef.current || !paneBRef.current) return;
    isSyncingRef.current = true;
    const scrollPct =
      paneARef.current.scrollTop /
      (paneARef.current.scrollHeight - paneARef.current.clientHeight || 1);
    paneBRef.current.scrollTop =
      scrollPct * (paneBRef.current.scrollHeight - paneBRef.current.clientHeight);
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 50);
  };

  const handleScrollB = () => {
    if (!syncScroll || isSyncingRef.current || !paneARef.current || !paneBRef.current) return;
    isSyncingRef.current = true;
    const scrollPct =
      paneBRef.current.scrollTop /
      (paneBRef.current.scrollHeight - paneBRef.current.clientHeight || 1);
    paneARef.current.scrollTop =
      scrollPct * (paneARef.current.scrollHeight - paneARef.current.clientHeight);
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 50);
  };

  if (!isOpen || !match) return null;

  const matchedPairs = match.matchedBlockPairs || [];
  const matchedIdsA = new Set(matchedPairs.map((p) => p.blockIdA));
  const matchedIdsB = new Set(matchedPairs.map((p) => p.blockIdB));

  const jumpToMatch = (idx: number) => {
    if (idx < 0 || idx >= matchedPairs.length) return;
    setActiveMatchIndex(idx);
    const targetPair = matchedPairs[idx];

    const elA = document.getElementById(`diff-block-a-${targetPair.blockIdA}`);
    const elB = document.getElementById(`diff-block-b-${targetPair.blockIdB}`);

    if (elA) elA.scrollIntoView({ behavior: "smooth", block: "center" });
    if (elB) elB.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const renderBlockContent = (block: any, isMatching: boolean, side: "A" | "B") => {
    const type = block.type;
    const content = block.content || {};

    return (
      <div
        id={`diff-block-${side.toLowerCase()}-${block.id}`}
        key={block.id}
        className={`p-4 rounded-2xl border transition-all ${
          isMatching
            ? "border-amber-500/80 bg-amber-500/10 dark:bg-amber-500/15 shadow-sm ring-1 ring-amber-500/30"
            : "border-border/60 bg-card"
        }`}
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40 text-[11px]">
          <span className="font-mono font-bold uppercase text-muted-foreground flex items-center gap-1.5">
            {type === "code" && <Code className="size-3 text-blue-500" />}
            {type === "table" && <TableIcon className="size-3 text-emerald-500" />}
            {type === "paragraph" && <AlignLeft className="size-3 text-purple-500" />}
            {type === "math" && <Binary className="size-3 text-rose-500" />}
            {type}
          </span>
          {isMatching && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
              Matching Block
            </span>
          )}
        </div>

        {/* Content Preview */}
        {type === "code" ? (
          <pre className="p-3 rounded-xl bg-zinc-950 text-zinc-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-zinc-800">
            <code>{content.code || "// Empty code block"}</code>
          </pre>
        ) : type === "table" ? (
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-[11px] divide-y divide-border/60">
              <tbody className="divide-y divide-border/40">
                {(content.rows || []).map((row: any, rIdx: number) => (
                  <tr key={rIdx} className={rIdx === 0 ? "bg-muted/40 font-semibold" : ""}>
                    {(Array.isArray(row) ? row : Object.values(row)).map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="p-2 border-r border-border/40 last:border-r-0">
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : type === "math" ? (
          <div className="p-3 rounded-xl bg-muted/40 font-mono text-xs text-foreground border border-border/60 overflow-x-auto">
            {content.latex || content.formula || content.text || "$$ ... $$"}
          </div>
        ) : (
          <p className="text-xs text-foreground/90 leading-relaxed font-serif">
            {content.text || "(Empty paragraph)"}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col animate-in fade-in-50 duration-200">
      {/* Top Header Bar */}
      <div className="h-16 px-6 bg-card border-b border-border/80 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Split className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-foreground">
                Side-by-Side Visual Comparison Drawer
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                {Math.round(match.overallSimilarity * 100)}% Similarity
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cross-student verification with synchronized scrolling and highlighted duplicate blocks
            </p>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center gap-3">
          {matchedPairs.length > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-xl border border-border/60 text-xs">
              <span className="text-muted-foreground font-semibold">
                Match {activeMatchIndex + 1} of {matchedPairs.length}
              </span>
              <button
                type="button"
                onClick={() => jumpToMatch(Math.max(0, activeMatchIndex - 1))}
                disabled={activeMatchIndex === 0}
                className="size-6 rounded flex items-center justify-center hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronUp className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => jumpToMatch(Math.min(matchedPairs.length - 1, activeMatchIndex + 1))}
                disabled={activeMatchIndex === matchedPairs.length - 1}
                className="size-6 rounded flex items-center justify-center hover:bg-muted disabled:opacity-40 cursor-pointer"
              >
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="rounded accent-primary"
            />
            <span>Sync Scrolling</span>
          </label>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="size-8 rounded-xl p-0 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Category Breakdown Bar */}
      <div className="h-10 px-6 bg-muted/30 border-b border-border/50 flex items-center gap-4 text-xs shrink-0 overflow-x-auto">
        <span className="text-muted-foreground font-bold shrink-0">Block Breakdown:</span>
        {Object.entries(match.categoryMatches || {}).map(([cat, sim]) => (
          <div key={cat} className="flex items-center gap-1.5 shrink-0">
            <span className="capitalize font-semibold text-foreground/80">{cat}:</span>
            <span
              className={`font-mono font-bold px-1.5 py-0.2 rounded text-[11px] ${
                sim >= 0.70
                  ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  : sim >= 0.40
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {Math.round(sim * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* Main Dual-Pane Comparison Area */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/80 overflow-hidden">
        {/* Left Pane: Student A */}
        <div className="flex flex-col h-full overflow-hidden bg-background">
          <div className="p-3.5 px-6 border-b border-border/60 bg-card/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-blue-500 tracking-wider">
                Submission A
              </span>
              <h3 className="text-sm font-bold text-foreground">{match.studentA.name}</h3>
              <p className="text-[11px] font-mono text-muted-foreground">
                {match.studentA.enrollment} • {match.studentA.email}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-muted border border-border">
              {journalA?.blocks?.length || 0} blocks
            </span>
          </div>

          <div
            ref={paneARef}
            onScroll={handleScrollA}
            className="flex-1 p-6 overflow-y-auto space-y-4"
          >
            {loadingA ? (
              <div className="py-20 text-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                Loading Student A Document...
              </div>
            ) : journalA?.blocks?.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">No blocks found.</div>
            ) : (
              (journalA?.blocks || []).map((b: any) =>
                renderBlockContent(b, matchedIdsA.has(b.id), "A")
              )
            )}
          </div>
        </div>

        {/* Right Pane: Student B */}
        <div className="flex flex-col h-full overflow-hidden bg-background">
          <div className="p-3.5 px-6 border-b border-border/60 bg-card/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-purple-500 tracking-wider">
                Submission B
              </span>
              <h3 className="text-sm font-bold text-foreground">{match.studentB.name}</h3>
              <p className="text-[11px] font-mono text-muted-foreground">
                {match.studentB.enrollment} • {match.studentB.email}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-muted border border-border">
              {journalB?.blocks?.length || 0} blocks
            </span>
          </div>

          <div
            ref={paneBRef}
            onScroll={handleScrollB}
            className="flex-1 p-6 overflow-y-auto space-y-4"
          >
            {loadingB ? (
              <div className="py-20 text-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin mx-auto mb-2 text-primary" />
                Loading Student B Document...
              </div>
            ) : journalB?.blocks?.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">No blocks found.</div>
            ) : (
              (journalB?.blocks || []).map((b: any) =>
                renderBlockContent(b, matchedIdsB.has(b.id), "B")
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

