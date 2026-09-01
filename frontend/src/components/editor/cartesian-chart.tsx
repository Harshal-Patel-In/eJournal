"use client";

import React, { useMemo, useState, useRef } from "react";
import { Download, Check } from "lucide-react";
import { InlineMathText } from "@/components/inline-math-text";
import { Button } from "@/components/ui/button";

export interface DataPoint {
  x: number;
  y: number;
  rawX?: string;
  rawY?: string;
}

export interface CartesianChartProps {
  data: DataPoint[];
  title?: string;
  xLabel?: string;
  yLabel?: string;
  chartType?: "scatter" | "line" | "bar";
  showTrendline?: boolean;
  showGrid?: boolean;
  width?: number;
  height?: number;
  readOnly?: boolean;
}

/**
 * Heckbert's "Nice Numbers" Algorithm for clean, round human-friendly axis scales
 */
function niceNum(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exponent = Math.floor(Math.log10(range));
  const fraction = range / Math.pow(10, exponent);
  let niceFraction: number;

  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }

  return niceFraction * Math.pow(10, exponent);
}

function calculateNiceScale(rawMin: number, rawMax: number, targetTicks = 6) {
  let min = rawMin;
  let max = rawMax;

  if (min === max) {
    min = min - 1;
    max = max + 1;
  }

  // Anchor origin to 0 if data is all positive and within 35% of 0
  if (min >= 0 && min <= max * 0.35) {
    min = 0;
  }
  // Anchor origin to 0 if data is all negative and within 35% of 0
  if (max <= 0 && max >= min * 0.35) {
    max = 0;
  }

  const range = niceNum(max - min, false);
  const tickSpacing = niceNum(range / (targetTicks - 1), true);
  const niceMin = Math.floor(min / tickSpacing) * tickSpacing;
  const niceMax = Math.ceil(max / tickSpacing) * tickSpacing;

  const ticks: number[] = [];
  const count = Math.max(1, Math.round((niceMax - niceMin) / tickSpacing));
  for (let i = 0; i <= count; i++) {
    const val = Number((niceMin + i * tickSpacing).toFixed(6));
    ticks.push(val);
  }

  return { niceMin, niceMax, tickSpacing, ticks };
}

export function CartesianChart({
  data,
  title = "Experimental Graph Plot",
  xLabel = "X-Axis",
  yLabel = "Y-Axis",
  chartType = "scatter",
  showTrendline = true,
  showGrid = true,
  width = 680,
  height = 400,
  readOnly = false,
}: CartesianChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // 1. Data Sanitization & Linear Regression Engine
  const validData = useMemo(() => {
    return data.filter((d) => !isNaN(d.x) && !isNaN(d.y) && isFinite(d.x) && isFinite(d.y));
  }, [data]);

  const regression = useMemo(() => {
    const N = validData.length;
    if (N < 2) return null;

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    let sumY2 = 0;

    for (const d of validData) {
      sumX += d.x;
      sumY += d.y;
      sumXY += d.x * d.y;
      sumX2 += d.x * d.x;
      sumY2 += d.y * d.y;
    }

    const denomX = N * sumX2 - sumX * sumX;
    if (Math.abs(denomX) < 1e-12) return null;

    const slope = (N * sumXY - sumX * sumY) / denomX;
    const intercept = (sumY - slope * sumX) / N;

    // R^2 calculation
    const denomY = N * sumY2 - sumY * sumY;
    let r2 = 1.0;
    if (denomY > 1e-12) {
      const numerator = N * sumXY - sumX * sumY;
      r2 = (numerator * numerator) / (denomX * denomY);
    }

    return { slope, intercept, r2: Math.min(1.0, Math.max(0.0, r2)) };
  }, [validData]);

  // 2. Cartesian Dimensions & Scales with Nice Numbers
  const margin = { top: 40, right: 35, bottom: 45, left: 65 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const { minX, maxX, minY, maxY, xTicks, yTicks } = useMemo(() => {
    if (validData.length === 0) {
      return {
        minX: 0,
        maxX: 10,
        minY: 0,
        maxY: 10,
        xTicks: [0, 2, 4, 6, 8, 10],
        yTicks: [0, 2, 4, 6, 8, 10],
      };
    }

    const rawMinX = Math.min(...validData.map((d) => d.x));
    const rawMaxX = Math.max(...validData.map((d) => d.x));
    const rawMinY = Math.min(...validData.map((d) => d.y));
    const rawMaxY = Math.max(...validData.map((d) => d.y));

    // Target 6 ticks for optimal vertical canvas utilization
    const xScale = calculateNiceScale(rawMinX, rawMaxX, 6);
    const yScale = calculateNiceScale(rawMinY, rawMaxY, 6);

    return {
      minX: xScale.niceMin,
      maxX: xScale.niceMax,
      minY: yScale.niceMin,
      maxY: yScale.niceMax,
      xTicks: xScale.ticks,
      yTicks: yScale.ticks,
    };
  }, [validData]);

  // Coordinate mapping functions
  const scaleX = (val: number) => {
    if (maxX === minX) return margin.left + innerWidth / 2;
    return margin.left + ((val - minX) / (maxX - minX)) * innerWidth;
  };

  const scaleY = (val: number) => {
    if (maxY === minY) return margin.top + innerHeight / 2;
    return margin.top + innerHeight - ((val - minY) / (maxY - minY)) * innerHeight;
  };

  // Trendline endpoints
  const trendlineCoords = useMemo(() => {
    if (!regression || !showTrendline || validData.length < 2) return null;
    const x1 = Math.min(...validData.map((d) => d.x));
    const y1 = regression.slope * x1 + regression.intercept;
    const x2 = Math.max(...validData.map((d) => d.x));
    const y2 = regression.slope * x2 + regression.intercept;

    return {
      x1: scaleX(x1),
      y1: scaleY(y1),
      x2: scaleX(x2),
      y2: scaleY(y2),
    };
  }, [regression, showTrendline, scaleX, scaleY, validData]);

  // Line path generator for "line" chart
  const linePathD = useMemo(() => {
    if (validData.length < 2 || chartType === "bar") return "";
    const sorted = [...validData].sort((a, b) => a.x - b.x);
    return sorted.reduce((acc, pt, idx) => {
      const px = scaleX(pt.x);
      const py = scaleY(pt.y);
      return idx === 0 ? `M ${px} ${py}` : `${acc} L ${px} ${py}`;
    }, "");
  }, [validData, chartType, scaleX, scaleY]);

  // Export SVG handler
  const handleDownloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/\s+/g, "_")}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clamped Tooltip with 14px upward elevation & instant fade
  const tooltipStyle = useMemo(() => {
    if (!hoveredPoint) return null;
    const xPct = (hoveredPoint.px / width) * 100;
    const yPct = (hoveredPoint.py / height) * 100;

    let transform = "translate(-50%, calc(-100% - 14px))";
    let alignment: "center" | "left" | "right" = "center";

    // Clamp right edge
    if (xPct > 78) {
      transform = "translate(-100%, calc(-100% - 14px))";
      alignment = "right";
    }
    // Clamp left edge
    else if (xPct < 22) {
      transform = "translate(0%, calc(-100% - 14px))";
      alignment = "left";
    }

    return {
      left: `${xPct}%`,
      top: `${yPct}%`,
      transform,
      alignment,
    };
  }, [hoveredPoint, width, height]);

  return (
    <div className="flex flex-col gap-3 w-full bg-card border border-border rounded-xl p-5 shadow-xs overflow-hidden print:border print:border-zinc-300 print:shadow-none print:p-3 print:my-2 page-break-avoid">
      {/* Chart Title Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2.5 print:pb-1.5 print:border-zinc-300">
        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="text-primary font-bold">📊</span>
          <InlineMathText text={title} />
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono font-semibold print:bg-zinc-100 print:text-zinc-800 print:border-zinc-300">
            {validData.length} data points
          </span>
          {!readOnly && (
            <Button
              variant="ghost"
              size="xs"
              onClick={handleDownloadSVG}
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 cursor-pointer print:hidden"
              title="Download SVG Vector Graphic"
            >
              {copied ? <Check className="size-3 text-emerald-500" /> : <Download className="size-3" />}
              {copied ? "Downloaded" : "Export SVG"}
            </Button>
          )}
        </div>
      </div>

      {/* Y-Axis Label Directly Above Vertical Axis */}
      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground pl-2 pt-0.5 select-none">
        <span className="text-primary text-[10px]">▲</span>
        <InlineMathText text={yLabel} className="font-bold" />
      </div>

      {/* SVG Canvas Container (strictly overflow-hidden) */}
      <div className="relative w-full flex flex-col items-center overflow-hidden">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-2xl h-auto select-none rounded-xl bg-background border border-border/60 shadow-inner"
        >
          {/* Engineering Graph Paper Gridlines */}
          {showGrid && (
            <g className="opacity-60">
              {/* Vertical grid lines */}
              {xTicks.map((tick, i) => (
                <line
                  key={`gx-${i}`}
                  x1={scaleX(tick)}
                  y1={margin.top}
                  x2={scaleX(tick)}
                  y2={margin.top + innerHeight}
                  stroke="currentColor"
                  className="text-border/60 stroke-1 stroke-dasharray-1"
                  strokeDasharray="3 3"
                />
              ))}
              {/* Horizontal grid lines */}
              {yTicks.map((tick, i) => (
                <line
                  key={`gy-${i}`}
                  x1={margin.left}
                  y1={scaleY(tick)}
                  x2={margin.left + innerWidth}
                  y2={scaleY(tick)}
                  stroke="currentColor"
                  className="text-border/60 stroke-1 stroke-dasharray-1"
                  strokeDasharray="3 3"
                />
              ))}
            </g>
          )}

          {/* Major Axes */}
          <line
            x1={margin.left}
            y1={margin.top + innerHeight}
            x2={margin.left + innerWidth}
            y2={margin.top + innerHeight}
            stroke="currentColor"
            className="text-foreground stroke-1.5"
          />
          <line
            x1={margin.left}
            y1={margin.top}
            x2={margin.left}
            y2={margin.top + innerHeight}
            stroke="currentColor"
            className="text-foreground stroke-1.5"
          />

          {/* X-Axis Ticks & Values */}
          {xTicks.map((tick, i) => {
            const px = scaleX(tick);
            return (
              <g key={`xtick-${i}`} transform={`translate(${px}, ${margin.top + innerHeight})`}>
                <line y2="6" stroke="currentColor" className="text-foreground/80 stroke-1.5" />
                <text
                  y="20"
                  textAnchor="middle"
                  className="text-[11px] font-mono font-medium fill-muted-foreground select-none"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Y-Axis Ticks & Values */}
          {yTicks.map((tick, i) => {
            const py = scaleY(tick);
            return (
              <g key={`ytick-${i}`} transform={`translate(${margin.left}, ${py})`}>
                <line x2="-6" stroke="currentColor" className="text-foreground/80 stroke-1.5" />
                <text
                  x="-10"
                  y="4"
                  textAnchor="end"
                  className="text-[11px] font-mono font-medium fill-muted-foreground select-none"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Bar Chart Rectangles (Grounded to y = 0) */}
          {chartType === "bar" &&
            validData.map((d, i) => {
              const px = scaleX(d.x);
              const py = scaleY(d.y);
              const baselineY = scaleY(Math.max(0, minY));
              const barWidth = Math.max(12, Math.min(36, innerWidth / (validData.length * 1.8)));
              const barHeight = Math.abs(baselineY - py);
              const barY = Math.min(baselineY, py);

              return (
                <rect
                  key={`bar-${i}`}
                  x={px - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  rx="3"
                  className="fill-blue-600 dark:fill-blue-500 hover:fill-blue-500 transition-colors cursor-pointer shadow-xs"
                  onMouseEnter={() => setHoveredPoint({ x: d.x, y: d.y, px, py: barY })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })}

          {/* Continuous Characteristic Curve */}
          {chartType === "line" && linePathD && (
            <path
              d={linePathD}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-xs pointer-events-none"
            />
          )}

          {/* Best-Fit Linear Trendline */}
          {showTrendline && trendlineCoords && (
            <line
              x1={trendlineCoords.x1}
              y1={trendlineCoords.y1}
              x2={trendlineCoords.x2}
              y2={trendlineCoords.y2}
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="6 4"
              className="pointer-events-none"
            />
          )}

          {/* Data Points with Clean Static Halo */}
          {(chartType === "scatter" || chartType === "line") &&
            validData.map((d, i) => {
              const px = scaleX(d.x);
              const py = scaleY(d.y);
              const isHovered = hoveredPoint?.x === d.x && hoveredPoint?.y === d.y;

              return (
                <g key={`pt-${i}`}>
                  {/* Static glowing halo on hover */}
                  {isHovered && (
                    <circle
                      cx={px}
                      cy={py}
                      r="10"
                      className="fill-blue-500/25 stroke-blue-500/50 stroke-1 pointer-events-none"
                    />
                  )}
                  {/* Core visual circular node */}
                  <circle
                    cx={px}
                    cy={py}
                    r={isHovered ? "6" : "4.5"}
                    className="fill-blue-600 dark:fill-blue-500 stroke-background stroke-2 transition-all shadow-md pointer-events-none"
                  />
                  {/* Invisible rock-solid static hover target */}
                  <circle
                    cx={px}
                    cy={py}
                    r="16"
                    className="fill-transparent cursor-pointer"
                    onMouseEnter={() => setHoveredPoint({ x: d.x, y: d.y, px, py })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                </g>
              );
            })}
        </svg>

        {/* Elevated Clamped Tooltip with Instant Appearance and Direction Pointer */}
        {hoveredPoint && tooltipStyle && (
          <div
            className="absolute z-30 pointer-events-none bg-zinc-900/95 dark:bg-zinc-100/95 text-white dark:text-zinc-900 shadow-2xl rounded-xl px-3 py-1.5 text-xs font-mono select-none whitespace-nowrap ring-1 ring-black/10 transition-opacity duration-75"
            style={{
              left: tooltipStyle.left,
              top: tooltipStyle.top,
              transform: tooltipStyle.transform,
            }}
          >
            <div className="flex items-center gap-2 font-semibold">
              <span>X = <strong className="text-blue-400 dark:text-blue-600 font-bold">{hoveredPoint.x}</strong></span>
              <span className="opacity-40">|</span>
              <span>Y = <strong className="text-blue-400 dark:text-blue-600 font-bold">{hoveredPoint.y}</strong></span>
            </div>

            {/* Downward Directional Arrow Pointer */}
            <div
              className={`absolute top-full -mt-0.5 border-[5px] border-transparent border-t-zinc-900/95 dark:border-t-zinc-100/95 ${
                tooltipStyle.alignment === "right"
                  ? "right-3"
                  : tooltipStyle.alignment === "left"
                  ? "left-3"
                  : "left-1/2 -translate-x-1/2"
              }`}
            />
          </div>
        )}
      </div>

      {/* X-Axis Label Centered Directly Under Horizontal Numbers */}
      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-foreground select-none pb-0.5">
        <InlineMathText text={xLabel} className="font-bold" />
        <span className="text-primary text-[10px]">►</span>
      </div>

      {/* Regression & Slope Analysis Card */}
      {regression && showTrendline && (
        <div className="mt-2 p-3.5 bg-muted/40 border border-border/70 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-red-500 shrink-0 shadow-xs" />
            <span className="font-bold text-foreground">Linear Regression:</span>
            <span className="font-mono text-foreground bg-background px-2.5 py-0.5 rounded-md border border-border font-semibold shadow-2xs">
              y = {regression.slope.toFixed(4)}x {regression.intercept >= 0 ? "+" : "-"}{" "}
              {Math.abs(regression.intercept).toFixed(4)}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-muted-foreground">Slope (Δy/Δx): </span>
              <strong className="text-foreground font-bold">{regression.slope.toFixed(4)}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">R² Correlation: </span>
              <strong className={regression.r2 > 0.95 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-amber-600 font-bold"}>
                {regression.r2.toFixed(4)}
              </strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CartesianChart;
