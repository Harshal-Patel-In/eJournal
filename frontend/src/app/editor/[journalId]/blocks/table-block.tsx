"use client";

import React, { useState } from "react";
import { Plus, Trash2, Maximize2, LineChart } from "lucide-react";
import { useDocumentStore } from "../use-document-store";
import { Button } from "@/components/ui/button";
import { InlineMathText } from "@/components/inline-math-text";
import { applyMathShortcuts } from "@/lib/math-shortcuts";
import { TableSpreadsheetModal } from "@/components/editor/table-spreadsheet-modal";
import { evaluateFormulaOnRow } from "@/lib/table-formula";

interface TableBlockProps {
  id: string;
  content: {
    headers?: string[];
    rows?: string[][];
    columnFormulas?: Record<number, string>;
    columnPrecision?: Record<number, string>;
  };
  previewMode: boolean;
}

export default function TableBlock({ id, content, previewMode }: TableBlockProps) {
  const { blocks, addBlock, updateBlock } = useDocumentStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialFormulaCol, setInitialFormulaCol] = useState<number | null>(null);
  const [editingHeaderIdx, setEditingHeaderIdx] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);

  // Self-healing schema normalization (defends against legacy corrupt payloads)
  const safeHeaders: string[] = Array.isArray(content?.headers) && content.headers.length > 0
    ? content.headers
    : ["Column 1", "Column 2"];

  const safeRows: string[][] = Array.isArray(content?.rows) && content.rows.length > 0
    ? content.rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : Array(safeHeaders.length).fill("")))
    : [Array(safeHeaders.length).fill("")];

  const headers = safeHeaders;
  const rows = safeRows;
  const columnFormulas = content?.columnFormulas || {};
  const columnPrecision = content?.columnPrecision || {};
  const teacherNote = (content as any)?.teacherNote;

  // Helper to dynamically evaluate all active formulas on a single row (O(1) constant time)
  const recomputeRowFormulas = (
    row: string[],
    currentHeaders: string[] = headers,
    formulas: Record<number, string> = columnFormulas,
    precisions: Record<number, string> = columnPrecision
  ): string[] => {
    let computedRow = [...row];
    for (const [colIdxStr, formula] of Object.entries(formulas)) {
      const targetCol = parseInt(colIdxStr, 10);
      if (isNaN(targetCol) || targetCol < 0 || targetCol >= currentHeaders.length) continue;
      if (!formula || !formula.trim()) continue;

      const prec = precisions[targetCol] || "auto";
      const res = evaluateFormulaOnRow(formula, currentHeaders, computedRow, "deg", prec);
      if (res.success && res.formatted) {
        computedRow[targetCol] = res.formatted;
      }
    }
    return computedRow;
  };

  const updateHeader = (colIndex: number, value: string) => {
    const nextHeaders = [...headers];
    nextHeaders[colIndex] = applyMathShortcuts(value);
    updateBlock(id, { headers: nextHeaders });
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = rows.map((row, rIdx) => {
      if (rIdx === rowIndex) {
        let nextRow = [...row];
        nextRow[colIndex] = applyMathShortcuts(value);
        return recomputeRowFormulas(nextRow);
      }
      return row;
    });
    updateBlock(id, { rows: nextRows });
  };

  const addRow = () => {
    const newRow = Array(headers.length).fill("");
    updateBlock(id, { rows: [...rows, recomputeRowFormulas(newRow)] });
  };

  const removeRow = (rowIndex: number) => {
    if (rows.length <= 1) return; // Keep at least 1 row
    const nextRows = rows.filter((_, idx) => idx !== rowIndex);
    updateBlock(id, { rows: nextRows });
  };

  const addColumn = () => {
    const nextHeaders = [...headers, `Column ${headers.length + 1}`];
    const nextRows = rows.map((row) => [...row, ""]);
    updateBlock(id, { headers: nextHeaders, rows: nextRows });
  };

  const removeColumn = () => {
    if (headers.length <= 1) return; // Keep at least 1 column
    const nextHeaders = headers.slice(0, -1);
    const nextRows = rows.map((row) => row.slice(0, -1));
    updateBlock(id, { headers: nextHeaders, rows: nextRows });
  };

  const addGraphFromTable = () => {
    const currentBlockIdx = blocks.findIndex((b) => b.id === id);
    const targetIdx = currentBlockIdx !== -1 ? currentBlockIdx + 1 : blocks.length;
    addBlock(targetIdx, "graph", {
      sourceTableId: id,
      title: "Experimental Graph Plot",
      xAxisColumn: headers[0] || "X-Axis",
      yAxisColumn: headers[1] || headers[0] || "Y-Axis",
      chartType: "scatter",
      showTrendline: true,
      showGrid: true,
    });
  };

  // Direct Excel / TSV / CSV Paste in Table
  const handlePaste = (e: React.ClipboardEvent, startRow: number, startCol: number) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    if (text.includes("\t") || text.includes("\n")) {
      e.preventDefault();
      const rawRows = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const parsedData = rawRows.map((line) => line.split("\t"));

      const numNewRows = Math.max(rows.length, startRow + parsedData.length);
      const maxColsInPaste = Math.max(...parsedData.map((r) => r.length));
      const numNewCols = Math.max(headers.length, startCol + maxColsInPaste);

      let nextHeaders = [...headers];
      while (nextHeaders.length < numNewCols) {
        nextHeaders.push(`Column ${nextHeaders.length + 1}`);
      }

      let nextRows: string[][] = [];
      for (let r = 0; r < numNewRows; r++) {
        let rowData = r < rows.length ? [...rows[r]] : Array(headers.length).fill("");
        while (rowData.length < numNewCols) {
          rowData.push("");
        }

        const pasteRowIdx = r - startRow;
        if (pasteRowIdx >= 0 && pasteRowIdx < parsedData.length) {
          const pasteCols = parsedData[pasteRowIdx];
          for (let c = 0; c < pasteCols.length; c++) {
            const targetCol = startCol + c;
            if (targetCol < numNewCols) {
              rowData[targetCol] = applyMathShortcuts(pasteCols[c].trim());
            }
          }
        }
        nextRows.push(rowData);
      }

      const recomputedPastedRows = nextRows.map((r) => recomputeRowFormulas(r, nextHeaders));
      updateBlock(id, { headers: nextHeaders, rows: recomputedPastedRows });
    }
  };

  const handleModalSave = (
    newHeaders: string[],
    newRows: string[][],
    newFormulas?: Record<number, string>,
    newPrecision?: Record<number, string>
  ) => {
    updateBlock(id, {
      headers: newHeaders,
      rows: newRows,
      columnFormulas: newFormulas ?? columnFormulas,
      columnPrecision: newPrecision ?? columnPrecision,
    });
    setIsModalOpen(false);
  };

  if (previewMode) {
    return (
      <div className="overflow-x-auto w-full my-4 border border-border rounded-xl shadow-xs custom-scrollbar bg-card print:overflow-visible print:border-none print:shadow-none print:my-2 page-break-avoid">
        {teacherNote && (
          <div className="mx-3 mt-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center gap-2">
            <span className="font-extrabold uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20">Teacher Note</span>
            <span>{teacherNote}</span>
          </div>
        )}
        <table className="min-w-full divide-y divide-border text-xs print:min-w-0 print:w-full print:table-auto print:border-collapse print:divide-zinc-400">
          <thead className="bg-muted/40 print:bg-zinc-100">
            <tr className="print:border-b print:border-zinc-400">
              <th className="w-10 px-3 py-2.5 text-center font-bold text-muted-foreground/70 border-r border-border/40 select-none bg-muted/60 print:w-7 print:px-1 print:py-1 print:text-[10px] print:border-zinc-400">
                #
              </th>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-center font-bold text-foreground border-r border-border/40 last:border-0 min-w-[120px] print:min-w-0 print:px-1.5 print:py-1 print:border-zinc-400 print:text-[10px]">
                  <InlineMathText text={h} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background print:divide-zinc-300">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/10 transition-colors print:border-b print:border-zinc-200">
                <td className="w-10 px-3 py-2 text-center font-mono font-semibold text-muted-foreground/60 border-r border-border/40 select-none bg-muted/10 print:w-7 print:px-1 print:py-1 print:border-zinc-400 print:text-[10px]">
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-4 py-2 text-center border-r border-border/40 last:border-0 whitespace-nowrap print:whitespace-normal text-foreground/90 font-mono print:px-1.5 print:py-1 print:border-zinc-300 print:text-[10px]">
                    {cell ? <InlineMathText text={cell} /> : <span className="text-muted-foreground/30">-</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full border border-border p-4 rounded-xl bg-card shadow-xs">
      {/* Table Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Data Grid Table
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-mono">
            {rows.length}R × {headers.length}C
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Plot Graph Button */}
          <Button
            variant="outline"
            size="xs"
            onClick={addGraphFromTable}
            className="gap-1.5 cursor-pointer bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 font-semibold"
            title="Plot an experimental graph using this table's readings"
          >
            <LineChart className="size-3" /> Plot Graph
          </Button>

          {/* Focus Spreadsheet Mode Button */}
          <Button
            variant="outline"
            size="xs"
            onClick={() => setIsModalOpen(true)}
            className="gap-1.5 cursor-pointer bg-primary/5 hover:bg-primary/10 text-primary border-primary/20 hover:border-primary/40 font-semibold"
            title="Open distraction-free fullscreen spreadsheet editor"
          >
            <Maximize2 className="size-3" /> Focus Spreadsheet
          </Button>

          <Button variant="outline" size="xs" onClick={addColumn} className="gap-1 cursor-pointer">
            <Plus className="size-3" /> Column
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={removeColumn}
            disabled={headers.length <= 1}
            className="gap-1 cursor-pointer"
          >
            <Trash2 className="size-3" /> Column
          </Button>
        </div>
      </div>

      {teacherNote && (
        <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-extrabold uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20">Teacher Note</span>
            <span>{teacherNote}</span>
          </div>
          <button
            onClick={() => {
              const updated = { ...content };
              delete (updated as any).teacherNote;
              updateBlock(id, updated);
            }}
            className="text-[10px] text-amber-600/70 hover:text-amber-700 dark:hover:text-amber-200 cursor-pointer underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Grid Canvas with Math Render & Inline Inputs */}
      <div className="overflow-x-auto border border-border/60 rounded-xl custom-scrollbar bg-background">
        <table className="min-w-full divide-y divide-border text-xs border-collapse">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-10 px-2 py-2 text-center font-bold text-muted-foreground/60 border-r border-border/50 select-none">
                #
              </th>
              {headers.map((header, colIdx) => (
                <th key={colIdx} className="p-1 border-r border-border/50 last:border-0 min-w-[130px]">
                  {editingHeaderIdx === colIdx ? (
                    <input
                      autoFocus
                      type="text"
                      value={header}
                      onChange={(e) => updateHeader(colIdx, e.target.value)}
                      onBlur={() => setEditingHeaderIdx(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setEditingHeaderIdx(null);
                      }}
                      className="w-full bg-background border border-primary font-bold focus:outline-none focus:ring-1 focus:ring-primary text-center text-xs py-1 px-1 rounded"
                    />
                  ) : (
                    <div className="flex items-center justify-center gap-1 group/header relative">
                      <div
                        onClick={() => setEditingHeaderIdx(colIdx)}
                        className="flex-1 py-1 px-1 cursor-pointer hover:bg-primary/5 rounded transition-colors text-center font-bold text-foreground flex items-center justify-center min-h-[28px] truncate"
                        title="Click to edit column label"
                      >
                        <InlineMathText text={header} />
                      </div>
                      {/* Active Formula Indicator Badge */}
                      {columnFormulas[colIdx] ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInitialFormulaCol(colIdx);
                            setIsModalOpen(true);
                          }}
                          className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/25 font-mono text-[9px] font-bold shrink-0 cursor-pointer hover:bg-primary/20 transition-colors shadow-2xs"
                          title={`Active formula: = ${columnFormulas[colIdx]}`}
                        >
                          fx
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInitialFormulaCol(colIdx);
                            setIsModalOpen(true);
                          }}
                          className="size-5 rounded hover:bg-primary/10 hover:text-primary text-muted-foreground/60 opacity-0 group-hover/header:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-mono font-bold shrink-0 cursor-pointer"
                          title="Calculate this column in Spreadsheet Mode (fx)"
                        >
                          fx
                        </button>
                      )}
                    </div>
                  )}
                </th>
              ))}
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-muted/10 transition-colors">
                <td className="w-10 px-2 py-1 text-center font-mono font-semibold text-muted-foreground/60 border-r border-border/50 select-none bg-muted/20">
                  {rowIdx + 1}
                </td>
                {row.map((cell, colIdx) => {
                  const isEditing = editingCell?.r === rowIdx && editingCell?.c === colIdx;

                  return (
                    <td key={colIdx} className="p-0.5 border-r border-border/50 last:border-0 min-w-[130px]">
                      {isEditing ? (
                        <input
                          autoFocus
                          type="text"
                          value={cell}
                          onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          onPaste={(e) => handlePaste(e, rowIdx, colIdx)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setEditingCell(null);
                              if (rowIdx < rows.length - 1) {
                                setEditingCell({ r: rowIdx + 1, c: colIdx });
                              }
                            } else if (e.key === "Tab" && !e.shiftKey) {
                              e.preventDefault();
                              if (colIdx < headers.length - 1) {
                                setEditingCell({ r: rowIdx, c: colIdx + 1 });
                              } else if (rowIdx < rows.length - 1) {
                                setEditingCell({ r: rowIdx + 1, c: 0 });
                              }
                            }
                          }}
                          placeholder="-"
                          className="w-full bg-background border border-primary focus:outline-none focus:ring-1 focus:ring-primary text-center py-1 px-2 text-xs rounded font-mono"
                        />
                      ) : (
                        <div
                          onClick={() => setEditingCell({ r: rowIdx, c: colIdx })}
                          className="w-full min-h-[30px] px-2 py-1 text-center text-xs text-foreground/90 cursor-pointer hover:bg-primary/5 transition-colors flex items-center justify-center font-mono"
                        >
                          {cell ? <InlineMathText text={cell} /> : <span className="text-muted-foreground/30">-</span>}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="p-1 text-center">
                  <button
                    onClick={() => removeRow(rowIdx)}
                    disabled={rows.length <= 1}
                    className="p-1 hover:bg-muted text-muted-foreground hover:text-destructive rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                    title="Delete Row"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 w-full mt-1 cursor-pointer">
        <Plus className="size-3.5" /> Add Row
      </Button>

      {/* Focus Spreadsheet Modal */}
      <TableSpreadsheetModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setInitialFormulaCol(null);
        }}
        headers={headers}
        rows={rows}
        columnFormulas={columnFormulas}
        columnPrecision={columnPrecision}
        onSave={handleModalSave}
        initialFormulaCol={initialFormulaCol}
      />
    </div>
  );
}
