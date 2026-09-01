"use client";

import React, { useMemo } from "react";
import { LineChart, BarChart2, ScatterChart, Table as TableIcon, Settings2 } from "lucide-react";
import { useDocumentStore } from "../use-document-store";
import { CartesianChart, DataPoint } from "@/components/editor/cartesian-chart";
import { GlassDropdown, DropdownOption } from "@/components/ui/glass-dropdown";

interface GraphBlockProps {
  id: string;
  content: {
    title?: string;
    sourceTableId?: string;
    xAxisColumn?: string;
    yAxisColumn?: string;
    chartType?: "scatter" | "line" | "bar";
    showTrendline?: boolean;
    showGrid?: boolean;
  };
  previewMode: boolean;
  allBlocks?: any[];
}

// Helper to parse numerical cell values (handles "1.5 * 10^-3", "2.5e-3", "-4.2", etc.)
function parseScientificNumber(val: string): number {
  if (!val) return NaN;
  const clean = val.trim();

  // Direct parseFloat
  const direct = parseFloat(clean);
  if (!isNaN(direct) && !clean.includes("*") && !clean.includes("^")) {
    return direct;
  }

  // Parse "1.5 * 10^-3" or "1.5 \times 10^{-3}"
  const sciMatch = clean.match(/([-+]?[0-9]*\.?[0-9]+)\s*(?:\*|\\times|x)\s*10\^?\{?([-+]?[0-9]+)\}?/i);
  if (sciMatch) {
    const coeff = parseFloat(sciMatch[1]);
    const exp = parseInt(sciMatch[2], 10);
    return coeff * Math.pow(10, exp);
  }

  return direct;
}

export default function GraphBlock({ id, content, previewMode, allBlocks }: GraphBlockProps) {
  const { blocks, updateBlock } = useDocumentStore();

  const title = content.title ?? "Experimental Graph Plot";
  const chartType = content.chartType ?? "scatter";
  const showTrendline = content.showTrendline ?? true;
  const showGrid = content.showGrid ?? true;

  // Find all table blocks in the document
  const tableBlocks = useMemo(() => {
    const sourceList = allBlocks || blocks;
    return sourceList.filter((b) => b.type === "table");
  }, [allBlocks, blocks]);

  // Determine active source table
  const sourceTable = useMemo(() => {
    if (content.sourceTableId) {
      const found = tableBlocks.find((t) => t.id === content.sourceTableId);
      if (found) return found;
    }
    return tableBlocks[0] || null;
  }, [tableBlocks, content.sourceTableId]);

  const headers: string[] = sourceTable?.content?.headers || [];
  const rows: string[][] = sourceTable?.content?.rows || [];

  const xAxisColumn = content.xAxisColumn || headers[0] || "X-Axis";
  const yAxisColumn = content.yAxisColumn || headers[1] || headers[0] || "Y-Axis";

  // Extract numerical (X, Y) data points from the table rows
  const chartData: DataPoint[] = useMemo(() => {
    if (!sourceTable || headers.length === 0 || rows.length === 0) return [];

    let colXIdx = headers.indexOf(xAxisColumn);
    let colYIdx = headers.indexOf(yAxisColumn);

    if (colXIdx === -1) colXIdx = 0;
    if (colYIdx === -1) colYIdx = Math.min(1, headers.length - 1);

    const points: DataPoint[] = [];
    for (const r of rows) {
      const rawX = r[colXIdx] || "";
      const rawY = r[colYIdx] || "";
      const numX = parseScientificNumber(rawX);
      const numY = parseScientificNumber(rawY);

      if (!isNaN(numX) && !isNaN(numY)) {
        points.push({ x: numX, y: numY, rawX, rawY });
      }
    }
    return points;
  }, [sourceTable, headers, rows, xAxisColumn, yAxisColumn]);

  const update = (patch: Partial<typeof content>) => {
    updateBlock(id, { ...content, ...patch });
  };

  // Dropdown Options for Tables
  const tableOptions: DropdownOption[] = useMemo(() => {
    return tableBlocks.map((tbl, idx) => ({
      value: tbl.id,
      label: `Table #${idx + 1} (${tbl.content?.headers?.length || 0} cols × ${tbl.content?.rows?.length || 0} rows)`,
      icon: <TableIcon className="size-3.5 text-muted-foreground" />,
    }));
  }, [tableBlocks]);

  // Dropdown Options for Column Headers with KaTeX math rendering!
  const columnOptions: DropdownOption[] = useMemo(() => {
    return headers.map((h, idx) => ({
      value: h,
      label: h || `Column ${idx + 1}`,
    }));
  }, [headers]);

  if (previewMode) {
    return (
      <div className="w-full my-4">
        <CartesianChart
          data={chartData}
          title={title}
          xLabel={xAxisColumn}
          yLabel={yAxisColumn}
          chartType={chartType}
          showTrendline={showTrendline}
          showGrid={showGrid}
          readOnly={true}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full border border-border p-4 rounded-xl bg-card shadow-xs">
      {/* Graph Toolbar & Settings Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            📊 Graph Generator
          </span>
          {sourceTable && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono font-medium">
              Linked to Table #{tableBlocks.findIndex((t) => t.id === sourceTable.id) + 1}
            </span>
          )}
        </div>

        {/* Chart Type Selector */}
        <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
          <button
            onClick={() => update({ chartType: "scatter" })}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              chartType === "scatter"
                ? "bg-background text-primary shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Scatter Plot with Trendline"
          >
            <ScatterChart className="size-3.5" /> Scatter
          </button>

          <button
            onClick={() => update({ chartType: "line" })}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              chartType === "line"
                ? "bg-background text-primary shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Continuous Characteristic Curve"
          >
            <LineChart className="size-3.5" /> Line
          </button>

          <button
            onClick={() => update({ chartType: "bar" })}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              chartType === "bar"
                ? "bg-background text-primary shadow-2xs font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Bar Chart"
          >
            <BarChart2 className="size-3.5" /> Bar
          </button>
        </div>
      </div>

      {/* Configuration Controls Bar with Custom GlassDropdowns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-4 bg-muted/20 border border-border/60 rounded-xl text-xs">
        {/* Source Table Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-muted-foreground">Source Table</label>
          <GlassDropdown
            value={sourceTable?.id || ""}
            options={tableOptions}
            onChange={(val) => update({ sourceTableId: val })}
            placeholder={tableBlocks.length === 0 ? "No tables in document" : "Select Table..."}
            renderMath={false}
          />
        </div>

        {/* X-Axis Column Selector (Custom KaTeX Dropdown) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-muted-foreground">X-Axis (Horizontal)</label>
          <GlassDropdown
            value={xAxisColumn}
            options={columnOptions}
            onChange={(val) => update({ xAxisColumn: val })}
            placeholder="Select X Column..."
            renderMath={true}
          />
        </div>

        {/* Y-Axis Column Selector (Custom KaTeX Dropdown) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-muted-foreground">Y-Axis (Vertical)</label>
          <GlassDropdown
            value={yAxisColumn}
            options={columnOptions}
            onChange={(val) => update({ yAxisColumn: val })}
            placeholder="Select Y Column..."
            renderMath={true}
          />
        </div>

        {/* Title Input */}
        <div className="md:col-span-2 flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-muted-foreground">Graph Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="e.g. Forward V-I Characteristic Curve"
            className="w-full h-9 bg-background border border-border rounded-xl px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 font-semibold shadow-2xs"
          />
        </div>

        {/* Toggle Options */}
        <div className="flex items-center gap-4 pt-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showTrendline}
              onChange={(e) => update({ showTrendline: e.target.checked })}
              className="rounded border-border text-primary focus:ring-primary cursor-pointer size-4"
            />
            <span>Best-Fit Line</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => update({ showGrid: e.target.checked })}
              className="rounded border-border text-primary focus:ring-primary cursor-pointer size-4"
            />
            <span>Grid Paper</span>
          </label>
        </div>
      </div>

      {/* Render the Cartesian Graph */}
      {tableBlocks.length === 0 ? (
        <div className="p-8 border border-dashed border-border rounded-xl text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <TableIcon className="size-8 opacity-40" />
          <p className="text-sm font-semibold">No data table available to plot</p>
          <p className="text-xs">Add a Data Table block first with your experimental readings.</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="p-8 border border-dashed border-border rounded-xl text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Settings2 className="size-8 opacity-40" />
          <p className="text-sm font-semibold">No numeric data found in selected columns</p>
          <p className="text-xs">Enter numbers or readings into your table to plot the graph.</p>
        </div>
      ) : (
        <CartesianChart
          data={chartData}
          title={title}
          xLabel={xAxisColumn}
          yLabel={yAxisColumn}
          chartType={chartType}
          showTrendline={showTrendline}
          showGrid={showGrid}
        />
      )}
    </div>
  );
}
