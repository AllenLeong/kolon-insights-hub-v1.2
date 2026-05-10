import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useRef } from "react";
import { loadYoy, loadRepurchase, type YoyRow, type RepurchaseRow } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Filter, GripVertical } from "lucide-react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/yoy")({
  head: () => ({ meta: [{ title: "YOY 与复购 · Kolon" }] }),
  component: YoyPage,
});

import {
  CHANNEL_REGIONS, ALL_REGIONS, DEFAULT_REGIONS, REGION_COLOR, fullName, CHANNEL_ORDER,
  type ChannelKey,
} from "@/lib/regions";
import { KPIS, type KpiDef, type SeriesDef } from "@/lib/kpi-config";

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

function YoyPage() {
  const yoyQ = useQuery({ queryKey: ["yoy"], queryFn: loadYoy });
  const repQ = useQuery({ queryKey: ["repurchase"], queryFn: loadRepurchase });
  const [order, setOrder] = useState<string[]>(KPIS.map((k) => k.id));
  const [visible, setVisible] = useState<string[]>(KPIS.map((k) => k.id));
  const [selectedRegions, setSelectedRegions] = useState<string[]>(DEFAULT_REGIONS);
  const [selectedYears, setSelectedYears] = useState<number[] | null>(null); // null = 全选
  // 4 个渠道列宽（fr 单位）— 全局共享，所有卡片同步
  const [colWidths, setColWidths] = useState<number[]>([2, 2, 2, 1]);

  const toggleVisible = (k: string) =>
    setVisible((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const toggleRegion = (r: string) =>
    setSelectedRegions((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  const dragKey = useRef<string | null>(null);

  if (yoyQ.isLoading || repQ.isLoading) return <div className="text-muted-foreground">数据加载中...</div>;
  if (yoyQ.error || repQ.error || !yoyQ.data || !repQ.data) return <div className="text-destructive">数据加载失败</div>;

  const onDragStart = (k: string) => { dragKey.current = k; };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (target: string) => {
    const src = dragKey.current;
    if (!src || src === target) return;
    setOrder((cur) => {
      const next = cur.filter((k) => k !== src);
      const idx = next.indexOf(target);
      next.splice(idx, 0, src);
      return next;
    });
    dragKey.current = null;
  };

  const kpiMap = Object.fromEntries(KPIS.map((k) => [k.id, k]));
  const allYears = [...new Set(yoyQ.data.map((r) => r.pay_yr))].sort((a, b) => a - b);
  const defaultYears = allYears.filter((y) => y >= 2022 && y <= 2025);
  const activeYears = selectedYears ?? (defaultYears.length ? defaultYears : allYears);
  const toggleYear = (y: number) =>
    setSelectedYears((s) => {
      const cur = s ?? allYears;
      return cur.includes(y) ? cur.filter((x) => x !== y) : [...cur, y].sort((a, b) => a - b);
    });

  return (
    <div className="mx-auto max-w-[1700px] space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Stage 01</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">YOY 与复购</h1>
          <p className="mt-1 text-xs text-muted-foreground">拖拽卡片左侧手柄可调整顺序</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <Filter className="h-3.5 w-3.5" />
                年份 ({activeYears.length}/{allYears.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <button className="text-primary hover:underline" onClick={() => setSelectedYears(null)}>全选</button>
                  <button className="text-muted-foreground hover:underline" onClick={() => setSelectedYears([])}>清空</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {allYears.map((y) => (
                    <label key={y} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={activeYears.includes(y)} onCheckedChange={() => toggleYear(y)} />
                      {y}
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <Filter className="h-3.5 w-3.5" />
                大区 ({selectedRegions.length}/{ALL_REGIONS.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <button className="text-primary hover:underline" onClick={() => setSelectedRegions(ALL_REGIONS)}>全选</button>
                  <button className="text-muted-foreground hover:underline" onClick={() => setSelectedRegions([])}>清空</button>
                </div>
                {(Object.keys(CHANNEL_REGIONS) as ChannelKey[]).map((ch) => (
                  <div key={ch}>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">{ch}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CHANNEL_REGIONS[ch].map((r) => (
                        <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={selectedRegions.includes(r)} onCheckedChange={() => toggleRegion(r)} />
                          {r}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <Filter className="h-3.5 w-3.5" />
                指标 ({visible.length}/{KPIS.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <button className="text-primary hover:underline" onClick={() => setVisible(KPIS.map((k) => k.id))}>全选</button>
                  <button className="text-muted-foreground hover:underline" onClick={() => setVisible([])}>清空</button>
                </div>
                {KPIS.map((k) => (
                  <label key={k.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                    <Checkbox checked={visible.includes(k.id)} onCheckedChange={() => toggleVisible(k.id)} />
                    {k.title}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-6">
        {order.filter((k) => visible.includes(k)).map((id) => (
          <div
            key={id}
            draggable
            onDragStart={() => onDragStart(id)}
            onDragOver={onDragOver}
            onDrop={() => onDrop(id)}
          >
            <KpiCard kpi={kpiMap[id]} yoy={yoyQ.data} rep={repQ.data} selected={selectedRegions} years={activeYears} colWidths={colWidths} setColWidths={setColWidths} />
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiCard({
  kpi, yoy, rep, selected, years, colWidths, setColWidths,
}: {
  kpi: KpiDef;
  yoy: YoyRow[];
  rep: RepurchaseRow[];
  selected: string[];
  years: number[];
  colWidths: number[];
  setColWidths: React.Dispatch<React.SetStateAction<number[]>>;
}) {
  // 单 series 且非堆叠面积：支持合并/分大区切换
  const canMerge = kpi.series.length === 1 && !kpi.stackedArea;
  const [merged, setMerged] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const startResize = (idx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const containerW = gridRef.current?.getBoundingClientRect().width ?? 1;
    const startWidths = [...colWidths];
    const totalFr = startWidths.reduce((a, b) => a + b, 0);
    const frPerPx = totalFr / containerW;
    const onMove = (ev: MouseEvent) => {
      const deltaFr = (ev.clientX - startX) * frPerPx;
      const next = [...startWidths];
      const a = next[idx] + deltaFr;
      const b = next[idx + 1] - deltaFr;
      const MIN = 0.3;
      if (a < MIN || b < MIN) return;
      next[idx] = a;
      next[idx + 1] = b;
      setColWidths(next);
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const innerCols: Record<string, string> = {
    自营: "grid-cols-2",
    经销商: "grid-cols-2",
    电商: "grid-cols-1",
    总体: "grid-cols-1",
  };
  // 模板：col1 8px col2 8px col3 8px col4
  const template = `${colWidths[0]}fr 8px ${colWidths[1]}fr 8px ${colWidths[2]}fr 8px ${colWidths[3]}fr`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
          <CardTitle className="text-base">{kpi.title}</CardTitle>
          {kpi.desc && <span className="text-xs text-muted-foreground">{kpi.desc}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setColWidths([2, 2, 2, 1])}
            className="text-[11px] text-muted-foreground hover:text-foreground border rounded px-2 py-0.5"
            title="重置列宽"
          >重置列宽</button>
          {canMerge && (
            <div className="flex rounded-md border p-0.5">
              <button
                onClick={() => setMerged(true)}
                className={`px-2 py-0.5 text-[11px] rounded ${merged ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >合并大区</button>
              <button
                onClick={() => setMerged(false)}
                className={`px-2 py-0.5 text-[11px] rounded ${!merged ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >分大区</button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div ref={gridRef} className="grid" style={{ gridTemplateColumns: template }}>
          {CHANNEL_ORDER.map((ch, i) => {
            const regions = CHANNEL_REGIONS[ch].filter((r) => selected.includes(r));
            return (
              <React.Fragment key={ch}>
                <div className="min-w-0 px-1">
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{ch}</div>
                  {regions.length === 0 ? (
                    <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground border rounded-md">
                      未选择该渠道下的大区
                    </div>
                  ) : canMerge && merged ? (
                    <ChartView kpi={kpi} yoy={yoy} rep={rep} years={years} regions={regions} height={260} />
                  ) : ch === "总体" ? (
                    <ChartView kpi={kpi} yoy={yoy} rep={rep} years={years} regions={regions} height={260} />
                  ) : (
                    <div className={`grid gap-2 ${innerCols[ch]}`}>
                      {regions.map((r) => (
                        <div key={r} className="min-w-0">
                          <div className="mb-0.5 text-[11px] text-muted-foreground">{r}</div>
                          <ChartView kpi={kpi} yoy={yoy} rep={rep} years={years} regions={[r]} height={200} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {i < CHANNEL_ORDER.length - 1 && (
                  <div
                    onMouseDown={startResize(i)}
                    className="cursor-col-resize flex items-center justify-center group"
                  >
                    <div className="w-px h-full bg-border group-hover:bg-primary group-hover:w-0.5 transition-all" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}


function getVal(row: YoyRow | RepurchaseRow | undefined, s: SeriesDef): number | null {
  if (!row) return null;
  if (s.compute) return s.compute(row);
  const v = (row as unknown as Record<string, unknown>)[s.key];
  return typeof v === "number" ? v : null;
}

type DataPoint = Record<string, number | string | null>;

function ChartView({
  kpi, yoy, rep, years, regions, height,
}: {
  kpi: KpiDef;
  yoy: YoyRow[];
  rep: RepurchaseRow[];
  years: number[];
  regions: string[];
  height: number;
}) {
  const isMerged = regions.length > 1; // 合并模式：单 series × 多大区
  const xKey = kpi.source === "yoy" ? "x" : "x";
  const xLabel = kpi.source === "yoy" ? "年份" : "月份";

  // 构建 x 轴（按年份过滤）
  const yearSet = new Set(years.map(String));
  let xs: string[] = [];
  if (kpi.source === "yoy") {
    xs = [...new Set(yoy.map((r) => String(r.pay_yr)))]
      .filter((y) => yearSet.has(y))
      .sort();
  } else {
    xs = [...new Set(rep.map((r) => r.stat_month))]
      .filter((m) => yearSet.has(m.slice(0, 4)))
      .sort();
  }

  // 构建 series 列表（dataKey + 显示属性）
  type Plot = {
    dataKey: string;
    label: string;
    color: string;
    axis: AxisType;
    kind: "line" | "area" | "lineYoy";
    dashed?: boolean;
  };
  type AxisType = "y1" | "y2";
  const plots: Plot[] = [];

  if (isMerged) {
    // 单 series，多大区
    const s = kpi.series[0];
    for (const r of regions) {
      const color = REGION_COLOR[r] ?? "#64748b";
      plots.push({
        dataKey: `${r}__${s.key}`,
        label: r,
        color,
        axis: s.axis ?? "y1",
        kind: "line",
        dashed: s.style ? s.style === "dashed" : (s.axis ?? "y1") === "y2",
      });
      if (kpi.showYoY) {
        plots.push({
          dataKey: `${r}__${s.key}__yoy`,
          label: `${r} 同比`,
          color,
          axis: "y2",
          kind: "lineYoy",
          dashed: true,
        });
      }
    }
  } else {
    // 单大区，多 series
    const r = regions[0];
    for (const s of kpi.series) {
      const color = s.color ?? REGION_COLOR[r] ?? "#2563eb";
      plots.push({
        dataKey: `${s.key}`,
        label: s.label,
        color,
        axis: s.axis ?? "y1",
        kind: kpi.stackedArea ? "area" : "line",
        dashed: s.style ? s.style === "dashed" : (s.axis ?? "y1") === "y2",
      });
      if (kpi.showYoY) {
        plots.push({
          dataKey: `${s.key}__yoy`,
          label: `${s.label} 同比`,
          color,
          axis: "y2",
          kind: "lineYoy",
          dashed: true,
        });
      }
    }
  }

  // 上一期 key（年度: 年-1；月度: 同月去年）
  const prevKey = (x: string) => {
    if (kpi.source === "yoy") return String(Number(x) - 1);
    // x = "YYYY-MM"
    const [y, m] = x.split("-");
    return `${Number(y) - 1}-${m}`;
  };

  // 构建数据
  const data: DataPoint[] = xs.map((x) => {
    const point: DataPoint = { x };
    const px = prevKey(x);
    if (isMerged) {
      const s = kpi.series[0];
      for (const r of regions) {
        const row = kpi.source === "yoy"
          ? yoy.find((d) => String(d.pay_yr) === x && d.consume_large_area_name === fullName(r))
          : rep.find((d) => d.stat_month === x && d.consume_large_area_name === fullName(r));
        const v = getVal(row, s);
        point[`${r}__${s.key}`] = v;
        if (kpi.showYoY) {
          const prevRow = kpi.source === "yoy"
            ? yoy.find((d) => String(d.pay_yr) === px && d.consume_large_area_name === fullName(r))
            : rep.find((d) => d.stat_month === px && d.consume_large_area_name === fullName(r));
          const pv = getVal(prevRow, s);
          point[`${r}__${s.key}__yoy`] = v != null && pv != null && pv !== 0 ? (v - pv) / pv : null;
        }
      }
    } else {
      const r = regions[0];
      for (const s of kpi.series) {
        const row = kpi.source === "yoy"
          ? yoy.find((d) => String(d.pay_yr) === x && d.consume_large_area_name === fullName(r))
          : rep.find((d) => d.stat_month === x && d.consume_large_area_name === fullName(r));
        const v = getVal(row, s);
        point[s.key] = v;
        if (kpi.showYoY) {
          const prevRow = kpi.source === "yoy"
            ? yoy.find((d) => String(d.pay_yr) === px && d.consume_large_area_name === fullName(r))
            : rep.find((d) => d.stat_month === px && d.consume_large_area_name === fullName(r));
          const pv = getVal(prevRow, s);
          point[`${s.key}__yoy`] = v != null && pv != null && pv !== 0 ? (v - pv) / pv : null;
        }
      }
    }
    return point;
  });

  const hasY2 = plots.some((p) => p.axis === "y2");

  const tooltipFormatter = (v: unknown, name: string) => {
    if (v == null) return ["—", name];
    if (name.includes("同比")) return [`${(Number(v) * 100).toFixed(1)}%`, name];
    // 找到对应 plot 判断格式
    const isPctSeries = !!kpi.stackedArea || (kpi.series.length === 1 && (kpi.y1Fmt === undefined ? false : false));
    if (isPctSeries) return [`${(Number(v) * 100).toFixed(2)}%`, name];
    return [typeof v === "number" ? v.toLocaleString() : String(v), name];
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey={xKey}
          stroke="var(--muted-foreground)"
          fontSize={10}
          interval={0}
          angle={-30}
          textAnchor="end"
          height={50}
        />
        <YAxis
          yAxisId="y1"
          stroke="var(--muted-foreground)"
          fontSize={10}
          tickFormatter={kpi.y1Fmt}
          width={55}
        />
        {hasY2 && (
          <YAxis
            yAxisId="y2"
            orientation="right"
            stroke="var(--muted-foreground)"
            fontSize={10}
            tickFormatter={kpi.y2Fmt ?? ((v) => String(v))}
            width={55}
          />
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {plots.map((p) =>
          p.kind === "area" ? (
            <Area
              key={p.dataKey}
              type="monotone"
              dataKey={p.dataKey}
              name={p.label}
              yAxisId={p.axis}
              stackId="1"
              stroke={p.color}
              fill={p.color}
              fillOpacity={0.5}
            />
          ) : (
            <Line
              key={p.dataKey}
              type="monotone"
              dataKey={p.dataKey}
              name={p.label}
              yAxisId={p.axis}
              stroke={p.color}
              strokeWidth={p.kind === "lineYoy" ? 1.5 : 2}
              strokeDasharray={p.dashed ? "4 3" : undefined}
              strokeOpacity={p.kind === "lineYoy" ? 0.45 : 1}
              dot={
                p.kind === "lineYoy" || (kpi.id === "rep180" && p.axis === "y2")
                  ? false
                  : { r: 2.5 }
              }
              connectNulls
            />
          )
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
