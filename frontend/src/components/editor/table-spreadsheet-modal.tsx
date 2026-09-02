"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Trash2,
  Check,
  FileSpreadsheet,
  ArrowLeft,
  Calculator,
  ChevronDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  Edit3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineMathText } from "@/components/inline-math-text";
import { applyMathShortcuts } from "@/lib/math-shortcuts";
import { TableFormulaModal } from "./table-formula-modal";

import { evaluateFormulaOnRow } from "@/lib/table-formula";

interface TableSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  rows: string[][];
  columnFormulas?: Record<number, string>;
  columnPrecision?: Record<number, string>;
  onSave: (
    headers: string[],
    rows: string[][],
    columnFormulas: Record<number, string>,
    columnPrecision: Record<number, string>
  ) => void;
  initialFormulaCol?: number | null;
}

export function TableSpreadsheetModal({
  isOpen,
  onClose,
  headers: initialHeaders,
  rows: initialRows,
  columnFormulas: initialColumnFormulas = {},
  columnPrecision: initialColumnPrecision = {},
  onSave,
  initialFormulaCol = null,
}: TableSpreadsheetModalProps) {
  const [mounted, setMounted] = useState(false);
  const [headers, setHeaders] = useState<string[]>(initialHeaders);
  const [rows, setRows] = useState<string[][]>(initialRows);
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [editingHeader, setEditingHeader] = useState<number | null>(null);
  const [activeColumnMenu, setActiveColumnMenu] = useState<number | null>(null);
  const [formulaModalCol, setFormulaModalCol] = useState<number | null>(initialFormulaCol);
  const [columnFormulas, setColumnFormulas] = useState<Record<number, string>>(initialColumnFormulas);
  const [columnPrecision, setColumnPrecision] = useState<Record<number, string>>(initialColumnPrecision);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setHeaders(initialHeaders);
    setRows(initialRows);
    setColumnFormulas(initialColumnFormulas);
    setColumnPrecision(initialColumnPrecision);
  }, [initialHeaders, initialRows, initialColumnFormulas, initialColumnPrecision, isOpen]);

  useEffect(() => {
    if (initialFormulaCol !== null && initialFormulaCol !== undefined) {
      setFormulaModalCol(initialFormulaCol);
    }
  }, [initialFormulaCol]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && formulaModalCol === null) {
        handleSaveAndClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, headers, rows, formulaModalCol]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setActiveColumnMenu(null);
    if (activeColumnMenu !== null) {
      window.addEventListener("click", handleClickOutside);
      return () => window.removeEventListener("click", handleClickOutside);
    }
  }, [activeColumnMenu]);

  if (!isOpen || !mounted) return null;

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

  const updateHeader = (colIdx: number, val: string) => {
    const next = [...headers];
    next[colIdx] = applyMathShortcuts(val);
    setHeaders(next);
  };

  const updateCell = (rowIdx: number, colIdx: number, val: string) => {
    const next = rows.map((r, rIdx) => {
      if (rIdx === rowIdx) {
        let nextR = [...r];
        nextR[colIdx] = applyMathShortcuts(val);
        return recomputeRowFormulas(nextR);
      }
      return r;
    });
    setRows(next);
  };

  const addRow = () => {
    const newRow = Array(headers.length).fill("");
    setRows([...rows, recomputeRowFormulas(newRow)]);
  };

  const removeRow = (rIdx: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, idx) => idx !== rIdx));
  };

  const addColumn = () => {
    setHeaders([...headers, `Column ${headers.length + 1}`]);
    setRows(rows.map((r) => [...r, ""]));
  };

  const insertColumnAt = (colIdx: number) => {
    const nextHeaders = [
      ...headers.slice(0, colIdx),
      `Column ${headers.length + 1}`,
      ...headers.slice(colIdx),
    ];
    const nextRows = rows.map((row) => [
      ...row.slice(0, colIdx),
      "",
      ...row.slice(colIdx),
    ]);
    setHeaders(nextHeaders);
    setRows(nextRows);
    setActiveColumnMenu(null);
  };

  const removeColumn = (cIdx: number) => {
    if (headers.length <= 1) return;
    // Also clean up any formula on this column or shift formulas
    const nextFormulas: Record<number, string> = {};
    for (const [k, v] of Object.entries(columnFormulas)) {
      const idx = parseInt(k, 10);
      if (idx < cIdx) nextFormulas[idx] = v;
      else if (idx > cIdx) nextFormulas[idx - 1] = v;
    }
    setColumnFormulas(nextFormulas);

    setHeaders(headers.filter((_, idx) => idx !== cIdx));
    setRows(rows.map((r) => r.filter((_, idx) => idx !== cIdx)));
    setActiveColumnMenu(null);
  };

  const handleApplyFormula = (formula: string, calculatedValues: string[], precisionSetting: string = "2") => {
    if (formulaModalCol === null) return;
    const colIdx = formulaModalCol;
    const nextFormulas = { ...columnFormulas, [colIdx]: formula };
    const nextPrecision = { ...columnPrecision, [colIdx]: precisionSetting };
    setColumnFormulas(nextFormulas);
    setColumnPrecision(nextPrecision);

    const nextRows = rows.map((row, rIdx) => {
      const nextR = [...row];
      nextR[colIdx] = calculatedValues[rIdx] ?? "";
      return nextR;
    });
    setRows(nextRows);
  };

  // Direct Excel / TSV Paste inside Fullscreen Modal
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

      setHeaders(nextHeaders);
      setRows(nextRows);
    }
  };

  const handleSaveAndClose = () => {
    onSave(headers, rows, columnFormulas, columnPrecision);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99999] w-screen h-screen bg-background flex flex-col overflow-hidden animate-in fade-in-50 duration-150 select-text">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shadow-xs shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSaveAndClose}
            className="gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="size-4" /> Back to Journal
          </Button>

          <div className="h-5 w-px bg-border/80" />

          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <FileSpreadsheet className="size-4" />
            </div>
            <span className="text-sm font-bold text-foreground">Spreadsheet Focus Mode</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">
              {rows.length} Rows × {headers.length} Columns
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addColumn} className="gap-1.5 cursor-pointer">
            <Plus className="size-3.5" /> Add Column
          </Button>
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5 cursor-pointer">
            <Plus className="size-3.5" /> Add Row
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleSaveAndClose}
            className="gap-1.5 cursor-pointer ml-2 shadow-sm font-semibold"
          >
            <Check className="size-4" /> Save & Return to Journal
          </Button>
        </div>
      </div>

      {/* True Full-Width Spreadsheet Canvas */}
      <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-muted/5">
        <div className="inline-block min-w-full border border-border rounded-xl overflow-hidden shadow-sm bg-card">
          <table className="min-w-full divide-y divide-border border-collapse text-xs">
            <thead className="bg-muted/70 sticky top-0 z-10 shadow-2xs">
              <tr>
                {/* Row index header */}
                <th className="w-14 px-3 py-3 text-center font-bold text-muted-foreground border-r border-border bg-muted/90 select-none">
                  #
                </th>

                {headers.map((header, colIdx) => {
                  const colLetter = String.fromCharCode(65 + (colIdx % 26));
                  const isMenuOpen = activeColumnMenu === colIdx;
                  const hasFormula = Boolean(columnFormulas[colIdx]);

                  return (
                    <th
                      key={colIdx}
                      className="min-w-[190px] max-w-[340px] px-3 py-2 border-r border-border last:border-0 text-center font-bold text-foreground relative group select-none"
                    >
                      {editingHeader === colIdx ? (
                        <input
                          autoFocus
                          type="text"
                          value={header}
                          onChange={(e) => updateHeader(colIdx, e.target.value)}
                          onBlur={() => setEditingHeader(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setEditingHeader(null);
                          }}
                          placeholder={`Column ${colIdx + 1}`}
                          className="w-full bg-background border border-primary px-2 py-1 text-xs text-center font-bold rounded focus:outline-none focus:ring-1 focus:ring-primary shadow-xs font-mono"
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-1 w-full min-h-[32px]">
                          {/* Column Identifier + Title */}
                          <div
                            onClick={() => setEditingHeader(colIdx)}
                            className="flex items-center gap-1.5 flex-1 min-w-0 px-1 py-1 cursor-pointer hover:bg-primary/5 rounded transition-colors"
                            title="Click to edit column title"
                          >
                            <span className="text-[10px] font-mono text-muted-foreground/70 font-semibold shrink-0">
                              {colLetter}
                            </span>
                            <div className="truncate text-xs font-bold text-foreground">
                              <InlineMathText text={header || `Column ${colIdx + 1}`} />
                            </div>
                            {hasFormula && (
                              <span
                                className="px-1.5 py-0.2 rounded-md bg-primary/10 text-primary border border-primary/25 font-mono text-[9px] font-bold shrink-0"
                                title={`Active formula: = ${columnFormulas[colIdx]}`}
                              >
                                fx
                              </span>
                            )}
                          </div>

                          {/* Action Buttons: fx Quick Button & macOS Context Menu Toggle */}
                          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity shrink-0">
                            {/* fx Quick Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFormulaModalCol(colIdx);
                              }}
                              className={`h-6 px-1.5 rounded-md text-[10px] font-mono font-bold transition-all flex items-center gap-0.5 cursor-pointer ${
                                hasFormula
                                  ? "bg-primary text-primary-foreground shadow-2xs"
                                  : "hover:bg-primary/10 hover:text-primary text-muted-foreground"
                              }`}
                              title="Calculate column with scientific formula (fx)"
                            >
                              <Calculator className="size-3" />
                              <span>fx</span>
                            </button>

                            {/* Dropdown Menu Trigger */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveColumnMenu(isMenuOpen ? null : colIdx);
                              }}
                              className="h-6 w-5 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                              title="Column actions"
                            >
                              <ChevronDown className="size-3" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* macOS Context Menu */}
                      {isMenuOpen && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-2 top-full mt-1 w-48 bg-popover text-popover-foreground border border-border/80 rounded-2xl shadow-xl z-50 p-1.5 flex flex-col gap-0.5 animate-in fade-in-50 zoom-in-95 duration-100 text-left font-normal"
                        >
                          <button
                            onClick={() => {
                              setActiveColumnMenu(null);
                              setFormulaModalCol(colIdx);
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-xl hover:bg-primary/10 hover:text-primary transition-colors text-foreground font-semibold cursor-pointer w-full text-left"
                          >
                            <Calculator className="size-3.5 text-primary" />
                            <span>Calculate Formula (fx)...</span>
                          </button>

                          <button
                            onClick={() => {
                              setActiveColumnMenu(null);
                              setEditingHeader(colIdx);
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-xl hover:bg-muted transition-colors text-foreground cursor-pointer w-full text-left"
                          >
                            <Edit3 className="size-3.5 text-muted-foreground" />
                            <span>Rename Column</span>
                          </button>

                          <div className="h-px bg-border/60 my-0.5" />

                          <button
                            onClick={() => insertColumnAt(colIdx)}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-xl hover:bg-muted transition-colors text-foreground cursor-pointer w-full text-left"
                          >
                            <ArrowLeftToLine className="size-3.5 text-muted-foreground" />
                            <span>Insert Column Left</span>
                          </button>

                          <button
                            onClick={() => insertColumnAt(colIdx + 1)}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-xl hover:bg-muted transition-colors text-foreground cursor-pointer w-full text-left"
                          >
                            <ArrowRightToLine className="size-3.5 text-muted-foreground" />
                            <span>Insert Column Right</span>
                          </button>

                          {headers.length > 1 && (
                            <>
                              <div className="h-px bg-border/60 my-0.5" />
                              <button
                                onClick={() => removeColumn(colIdx)}
                                className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-xl hover:bg-destructive/10 text-destructive transition-colors cursor-pointer w-full text-left font-semibold"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Delete Column</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="w-12 px-2 border-l border-border bg-muted/60"></th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border bg-card">
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="hover:bg-muted/15 transition-colors">
                  {/* Row Number */}
                  <td className="w-14 px-3 py-2.5 text-center font-mono font-semibold text-muted-foreground/70 border-r border-border bg-muted/20 select-none">
                    {rowIdx + 1}
                  </td>

                  {row.map((cell, colIdx) => {
                    const isEditing = editingCell?.r === rowIdx && editingCell?.c === colIdx;

                    return (
                      <td
                        key={colIdx}
                        className="min-w-[190px] max-w-[340px] p-0 border-r border-border last:border-0 relative"
                      >
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
                              } else if (e.key === "Tab" && e.shiftKey) {
                                e.preventDefault();
                                if (colIdx > 0) {
                                  setEditingCell({ r: rowIdx, c: colIdx - 1 });
                                }
                              }
                            }}
                            placeholder="-"
                            className="w-full h-full min-h-[38px] bg-background border border-primary px-3 py-1.5 text-xs text-center font-medium focus:outline-none focus:ring-1 focus:ring-primary font-mono shadow-xs"
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCell({ r: rowIdx, c: colIdx })}
                            className="w-full min-h-[38px] px-3 py-2 text-center text-xs text-foreground/90 cursor-pointer hover:bg-primary/5 transition-colors flex items-center justify-center font-mono"
                          >
                            {cell ? <InlineMathText text={cell} /> : <span className="text-muted-foreground/30">-</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Delete Row Button */}
                  <td className="w-12 px-2 text-center border-l border-border">
                    <button
                      onClick={() => removeRow(rowIdx)}
                      disabled={rows.length <= 1}
                      className="p-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-20 cursor-pointer"
                      title="Delete this row"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Navigation Bar */}
      <div className="px-6 py-2.5 border-t border-border bg-card flex items-center justify-between text-xs text-muted-foreground shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span>Click any cell to edit • Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Tab</kbd> to move right, <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Enter</kbd> to move down</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
          <span>Click <kbd className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 text-[10px] font-mono font-bold">fx</kbd> on any column to compute</span>
          <span>•</span>
          <span>Paste Excel with <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Ctrl+V</kbd></span>
          <span>•</span>
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Esc</kbd> to Save & Close</span>
        </div>
      </div>

      {/* Table Formula Modal */}
      {formulaModalCol !== null && (
        <TableFormulaModal
          isOpen={formulaModalCol !== null}
          onClose={() => setFormulaModalCol(null)}
          targetColIdx={formulaModalCol}
          headers={headers}
          rows={rows}
          initialFormula={columnFormulas[formulaModalCol] || ""}
          initialPrecision={columnPrecision[formulaModalCol] || "2"}
          onApplyFormula={(formula, calculatedValues, precisionSetting) =>
            handleApplyFormula(formula, calculatedValues, precisionSetting)
          }
        />
      )}
    </div>,
    document.body
  );
}
