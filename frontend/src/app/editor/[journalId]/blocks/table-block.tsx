"use client";

import { Plus, Trash2 } from "lucide-react";
import { useDocumentStore } from "../use-document-store";
import { Button } from "@/components/ui/button";

interface TableBlockProps {
  id: string;
  content: {
    headers?: string[];
    rows?: string[][];
  };
  previewMode: boolean;
}

export default function TableBlock({ id, content, previewMode }: TableBlockProps) {
  const updateBlock = useDocumentStore((state) => state.updateBlock);

  const headers = content.headers || ["Column 1", "Column 2"];
  const rows = content.rows || [["", ""]];

  const updateHeader = (colIndex: number, value: string) => {
    const nextHeaders = [...headers];
    nextHeaders[colIndex] = value;
    updateBlock(id, { headers: nextHeaders });
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const nextRows = rows.map((row, rIdx) => {
      if (rIdx === rowIndex) {
        const nextRow = [...row];
        nextRow[colIndex] = value;
        return nextRow;
      }
      return row;
    });
    updateBlock(id, { rows: nextRows });
  };

  const addRow = () => {
    const newRow = Array(headers.length).fill("");
    updateBlock(id, { rows: [...rows, newRow] });
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

  if (previewMode) {
    return (
      <div className="overflow-x-auto w-full my-4 border border-border rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/40">
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="px-4 py-2 text-left font-semibold text-foreground/90 border-r border-border/40 last:border-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-muted/20">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-4 py-2 border-r border-border/40 last:border-0 whitespace-nowrap text-foreground/80">
                    {cell}
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
    <div className="flex flex-col gap-3 w-full border border-border p-4 rounded-xl bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Data Grid Table</span>
        <div className="flex gap-2">
          <Button variant="outline" size="xs" onClick={addColumn} className="gap-1 cursor-pointer">
            <Plus className="size-3" /> Column
          </Button>
          <Button variant="outline" size="xs" onClick={removeColumn} disabled={headers.length <= 1} className="gap-1 cursor-pointer">
            <Trash2 className="size-3" /> Column
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto border border-border/50 rounded-lg">
        <table className="min-w-full divide-y divide-border text-xs">
          <thead className="bg-muted/50">
            <tr>
              {headers.map((header, colIdx) => (
                <th key={colIdx} className="p-1.5 border-r border-border/50 last:border-0">
                  <input
                    type="text"
                    value={header}
                    onChange={(e) => updateHeader(colIdx, e.target.value)}
                    className="w-full bg-transparent border-0 font-semibold focus:outline-none focus:ring-1 focus:ring-primary focus:bg-background text-center text-xs py-0.5 rounded"
                  />
                </th>
              ))}
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, colIdx) => (
                  <td key={colIdx} className="p-1 border-r border-border/50 last:border-0">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                      placeholder="-"
                      className="w-full bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary/60 focus:bg-background text-center py-0.5 rounded"
                    />
                  </td>
                ))}
                <td className="p-1 text-center">
                  <button
                    onClick={() => removeRow(rowIdx)}
                    disabled={rows.length <= 1}
                    className="p-1 hover:bg-muted text-muted-foreground hover:text-destructive rounded transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
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
    </div>
  );
}
