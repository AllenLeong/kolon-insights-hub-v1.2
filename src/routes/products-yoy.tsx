import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { loadMidClass, type MidClassRow } from "@/lib/data";
import {
  CHANNEL_REGIONS, CHANNEL_ORDER, ALL_REGIONS, DEFAULT_REGIONS, REGION_COLOR, fullName, shortName,
  type ChannelKey,
} from "@/lib/regions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Filter } from "lucide-react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  BarChart, Bar, Cell, ReferenceLine, Scatter,
} from "recharts";

export const Route = createFileRoute("/products-yoy")({
  head: () => ({ meta: [{ title: "商品中类 YOY · Kolon" }] }),
  component: Page,
});

type MetricKey = "amt" | "qty" | "members" | "styles" | "works" | "orders" | "order_fst" | "order_re" | "order_wake" | "price";
const METRICS: { key: MetricKey; label: string }[] = [
  { key: "amt", label: "金额" },
  { key: "qty", label: "件数" },
  { key: "members", label: "会员数" },
  { key: "styles", label: "款数" },
  { key: "works", label: "作品数" },
  { key: "orders", label: "订单数" },
  { key: "order_fst", label: "首单数" },
  { key: "order_re", label: "复购数" },
  { key: "order_wake", label: "唤醒数" },
  { key: "price", label: "价格分布" },
];

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

const fmtAmt = (v: number) =>
  v >= 1e8 ? `${(v / 1e8).toFixed(1)}亿` : v >= 1e4 ? `${(v / 1e4).toFixed(1)}万` : `${Math.round(v)}`;
const fmtNum = (v: number) =>
  Math.abs(v) >= 1e4 ? `${(v / 1e4).toFixed(1)}万` : Math.round(v).toLocaleString();
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

function valFmt(m: MetricKey, v: number) {
  if (m === "amt") return fmtAmt(v);
  if (m === "price") return `¥${Math.round(v)}`;
  return fmtNum(v);
}

function getMetric(r: MidClassRow, m: MetricKey): number {
  if (m === "price") return r.tag_price_p50 || 0;
  return (r[m as keyof MidClassRow] as number) || 0;
}

function Page() {
  const q = useQuery({ queryKey: ["midclass"], queryFn: loadMidClass });
  if (q.isLoading) return <div className="p-6 text-muted-foreground">数据加载中...</div>;
  if (q.error || !q.data) return <div className="p-6 text-destructive">数据加载失败</div>;
  return <Inner data={q.data.filter((r) => r && r.good_mid_class_merged)} />;
}

function Inner({ data: rawData }: { data: MidClassRow[] }) {
  const allYears = useMemo(
    () => [...new Set(rawData.map((r) => Number(r.pay_dt_quarter.slice(0, 4))).filter(Number.isFinite))].sort((a, b) => a - b),
    [rawData],
  );
  const allClasses = useMemo(() => {
    const t = new Map<string, number>();
    for (const r of rawData) t.set(r.good_mid_class_merged, (t.get(r.good_mid_class_merged) ?? 0) + (r.amt || 0));
    return [...t.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [rawData]);

  const [years, setYears] = useState<number[]>(allYears);
  const [regions, setRegions] = useState<string[]>(DEFAULT_REGIONS);
  const [metric, setMetric] = useState<MetricKey>("amt");
  const [selectedClasses, setSelectedClasses] = useState<string[] | null>(null);
  const [showDiffArea, setShowDiffArea] = useState(true);

  const activeClasses = selectedClasses ?? allClasses.slice(0, 8);

  // 排序：按 metric 在筛选范围（年份+大区）内总和
  const sortedClasses = useMemo(() => {
    if (metric === "price") {
      // 价格按全局中位数排序
      const med = new Map<string, number[]>();
      for (const r of rawData) {
        if (!activeClasses.includes(r.good_mid_class_merged)) continue;
        if (!years.includes(Number(r.pay_dt_quarter.slice(0, 4)))) continue;
        const arr = med.get(r.good_mid_class_merged) ?? [];
        arr.push(r.tag_price_p50 || 0);
        med.set(r.good_mid_class_merged, arr);
      }
      return [...activeClasses].sort((a, b) => {
        const av = (med.get(a) ?? [0]).reduce((s, x) => s + x, 0) / Math.max(1, (med.get(a) ?? [0]).length);
        const bv = (med.get(b) ?? [0]).reduce((s, x) => s + x, 0) / Math.max(1, (med.get(b) ?? [0]).length);
        return bv - av;
      });
    }
    const sums = new Map<string, number>();
    for (const r of rawData) {
      if (!activeClasses.includes(r.good_mid_class_merged)) continue;
      if (!years.includes(Number(r.pay_dt_quarter.slice(0, 4)))) continue;
      const reg = shortName(r.consume_large_area_name);
      if (!regions.includes(reg)) continue;
      sums.set(r.good_mid_class_merged, (sums.get(r.good_mid_class_merged) ?? 0) + getMetric(r, metric));
    }
    return [...activeClasses].sort((a, b) => (sums.get(b) ?? 0) - (sums.get(a) ?? 0));
  }, [rawData, activeClasses, years, regions, metric]);

  const toggleY = (y: number) =>
    setYears((s) => (s.includes(y) ? s.filter((x) => x !== y) : [...s, y].sort((a, b) => a - b)));
  const toggleR = (r: string) =>
    setRegions((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));
  const toggleC = (c: string) =>
    setSelectedClasses((cur) => {
      const base = cur ?? allClasses;
      return base.includes(c) ? base.filter((x) => x !== c) : [...base, c];
    });

  return (
    <div className="mx-auto max-w-[1700px] space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Stage 01</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">商品中类 YOY 分析</h1>
          <p className="mt-1 text-xs text-muted-foreground">按指标排序的中类卡片；y2 显示该中类在所选范围内的占比</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 年份 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <Filter className="h-3.5 w-3.5" />年份 ({years.length}/{allYears.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <button className="text-primary hover:underline" onClick={() => setYears(allYears)}>全选</button>
                  <button className="text-muted-foreground hover:underline" onClick={() => setYears([])}>清空</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {allYears.map((y) => (
                    <label key={y} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={years.includes(y)} onCheckedChange={() => toggleY(y)} />
                      {y}
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {/* 大区 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <Filter className="h-3.5 w-3.5" />大区 ({regions.length}/{ALL_REGIONS.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <button className="text-primary hover:underline" onClick={() => setRegions(ALL_REGIONS)}>全选</button>
                  <button className="text-muted-foreground hover:underline" onClick={() => setRegions([])}>清空</button>
                </div>
                {(Object.keys(CHANNEL_REGIONS) as ChannelKey[]).map((ch) => (
                  <div key={ch}>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">{ch}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CHANNEL_REGIONS[ch].map((r) => (
                        <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={regions.includes(r)} onCheckedChange={() => toggleR(r)} />
                          {r}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {/* 指标单选 */}
          <div className="flex rounded-md border p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetric(m.key)}
                className={`px-2 py-1 text-[11px] rounded ${metric === m.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >{m.label}</button>
            ))}
          </div>
          {/* 占比差异面积开关 */}
          <label className="flex items-center gap-1.5 text-xs cursor-pointer rounded-md border px-2 h-8">
            <Checkbox checked={showDiffArea} onCheckedChange={(v) => setShowDiffArea(!!v)} />
            占比差异面积
          </label>
          {/* 中类多选 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8">
                <Filter className="h-3.5 w-3.5" />中类 ({activeClasses.length}/{allClasses.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <button className="text-primary hover:underline" onClick={() => setSelectedClasses(allClasses)}>全选</button>
                  <button className="text-muted-foreground hover:underline" onClick={() => setSelectedClasses([])}>清空</button>
                  <button className="text-muted-foreground hover:underline" onClick={() => setSelectedClasses(null)}>默认Top8</button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {allClasses.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                      <Checkbox checked={activeClasses.includes(c)} onCheckedChange={() => toggleC(c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-6">
        {sortedClasses.map((cls) =>
          metric === "price" ? (
            <PriceCard key={cls} cls={cls} rawData={rawData} years={years} regions={regions} />
          ) : (
            <MetricCard key={cls} cls={cls} metric={metric} rawData={rawData} years={years} regions={regions} showDiffArea={showDiffArea} />
          )
        )}
        {sortedClasses.length === 0 && (
          <div className="text-center text-muted-foreground py-12">未选择中类</div>
        )}
      </div>
    </div>
  );
}

// ===== 普通指标卡片：4 渠道列 × 多大区 line =====
function MetricCard({
  cls, metric, rawData, years, regions, showDiffArea,
}: {
  cls: string;
  metric: MetricKey;
  rawData: MidClassRow[];
  years: number[];
  regions: string[];
  showDiffArea: boolean;
}) {
  const innerCols: Record<string, string> = {
    自营: "grid-cols-2",
    经销商: "grid-cols-2",
    电商: "grid-cols-1",
    总体: "grid-cols-1",
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{cls}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 2fr 2fr 1fr" }}>
          {CHANNEL_ORDER.map((ch) => {
            const chRegions = CHANNEL_REGIONS[ch].filter((r) => regions.includes(r));
            return (
              <div key={ch} className="min-w-0 px-1">
                <div className="mb-1 text-xs font-medium text-muted-foreground">{ch}</div>
                {chRegions.length === 0 ? (
                  <div className="flex h-[240px] items-center justify-center text-xs text-muted-foreground border rounded-md">
                    未选择该渠道下的大区
                  </div>
                ) : ch === "总体" || ch === "电商" ? (
                  <div className={`grid gap-2 ${innerCols[ch] ?? "grid-cols-1"}`}>
                    {chRegions.map((r) => (
                      <div key={r} className="min-w-0">
                        <div className="mb-0.5 text-[11px] text-muted-foreground">{r}</div>
                        <MetricChart
                          cls={cls} metric={metric} rawData={rawData} years={years} regions={[r]} height={180} showDiffArea={showDiffArea}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`grid gap-2 ${innerCols[ch]}`}>
                    {chRegions.map((r) => (
                      <div key={r} className="min-w-0">
                        <div className="mb-0.5 text-[11px] text-muted-foreground">{r}</div>
                        <MetricChart
                          cls={cls} metric={metric} rawData={rawData} years={years} regions={[r]} height={180} showDiffArea={showDiffArea}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricChart({
  cls, metric, rawData, years, regions, height, showDiffArea,
}: {
  cls: string;
  metric: MetricKey;
  rawData: MidClassRow[];
  years: number[];
  regions: string[];
  height: number;
  showDiffArea: boolean;
}) {
  const yearNums = [...years].sort((a, b) => a - b);

  // 构建：每条大区 line 的 metric 值 + 占比
  type DP = Record<string, number | [number, number] | null>;
  const baseRows: DP[] = yearNums.map((yi) => {
    const point: DP = { x: yi };
    // 总体当年该中类占总体所有中类的比例（用于对比参考线）
    const totalRows = rawData.filter(
      (d) => Number(d.pay_dt_quarter.slice(0, 4)) === yi && d.consume_large_area_name === "总体",
    );
    const totalAllSum = totalRows.reduce((s, d) => s + getMetric(d, metric), 0);
    const totalClsSum = totalRows
      .filter((d) => d.good_mid_class_merged === cls)
      .reduce((s, d) => s + getMetric(d, metric), 0);
    point["__overall_p"] = totalAllSum > 0 ? totalClsSum / totalAllSum : null;

    for (const r of regions) {
      const full = fullName(r);
      const regionRows = rawData.filter(
        (d) => Number(d.pay_dt_quarter.slice(0, 4)) === yi && d.consume_large_area_name === full,
      );
      const allSum = regionRows.reduce((s, d) => s + getMetric(d, metric), 0);
      const clsSum = regionRows
        .filter((d) => d.good_mid_class_merged === cls)
        .reduce((s, d) => s + getMetric(d, metric), 0);
      point[`${r}__v`] = clsSum || null;
      const p = allSum > 0 ? clsSum / allSum : null;
      point[`${r}__p`] = p;
      const op = point["__overall_p"] as number | null;
      if (p != null && op != null) {
        point[`${r}__pos_range`] = p >= op ? [op, p] : [op, op];
        point[`${r}__neg_range`] = p < op ? [p, op] : [op, op];
      } else {
        point[`${r}__pos_range`] = null;
        point[`${r}__neg_range`] = null;
      }
    }
    return point;
  });

  // 在正负切换的位置插入交叉行（线性插值），消除年端 0-band 折角
  const extraRows: DP[] = [];
  for (const r of regions) {
    for (let i = 0; i < yearNums.length - 1; i++) {
      const a = baseRows[i], b = baseRows[i + 1];
      const p1 = a[`${r}__p`] as number | null;
      const p2 = b[`${r}__p`] as number | null;
      const o1 = a["__overall_p"] as number | null;
      const o2 = b["__overall_p"] as number | null;
      if (p1 == null || p2 == null || o1 == null || o2 == null) continue;
      const d1 = p1 - o1, d2 = p2 - o2;
      if (d1 === 0 || d2 === 0) continue;
      if ((d1 < 0) === (d2 < 0)) continue;
      const t = Math.abs(d1) / (Math.abs(d1) + Math.abs(d2));
      const x1 = a.x as number, x2 = b.x as number;
      const xc = x1 + t * (x2 - x1);
      const opc = o1 + t * (o2 - o1);
      const cp: DP = { x: xc };
      cp["__overall_p"] = opc;
      cp[`${r}__p`] = opc;
      cp[`${r}__pos_range`] = [opc, opc];
      cp[`${r}__neg_range`] = [opc, opc];
      extraRows.push(cp);
    }
  }
  const data: DP[] = [...baseRows, ...extraRows].sort(
    (a, b) => (a.x as number) - (b.x as number),
  );

  const fmtY1 = metric === "amt" ? fmtAmt : fmtNum;
  // 是否显示总体对比线：当前图非"总体"自身时显示
  const showOverall = !(regions.length === 1 && regions[0] === "总体");

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="x" type="number" domain={[yearNums[0], yearNums[yearNums.length - 1]]}
          ticks={yearNums} allowDecimals={false}
          stroke="var(--muted-foreground)" fontSize={10}
        />
        <YAxis yAxisId="y1" stroke="var(--muted-foreground)" fontSize={10} tickFormatter={fmtPct} width={45} />
        <YAxis yAxisId="y2" orientation="right" stroke="var(--muted-foreground)" fontSize={10} tickFormatter={fmtY1} width={55} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(label: unknown) => {
            const n = Number(label);
            return Number.isInteger(n) ? String(n) : n.toFixed(2);
          }}
          formatter={(v: unknown, name: string) => {
            if (v == null) return ["—", name];
            if (name.includes("占比")) return [fmtPct(Number(v)), name];
            return [valFmt(metric, Number(v)), name];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 10 }} />
        {showOverall && showDiffArea && regions.flatMap((r) => [
          <Area
            key={`${r}-pos`}
            yAxisId="y1" type="monotone" dataKey={`${r}__pos_range`} name="高于总体"
            stroke="none" fill="#10b981" fillOpacity={0.25} connectNulls activeDot={false} legendType="none"
          />,
          <Area
            key={`${r}-neg`}
            yAxisId="y1" type="monotone" dataKey={`${r}__neg_range`} name="低于总体"
            stroke="none" fill="#ef4444" fillOpacity={0.25} connectNulls activeDot={false} legendType="none"
          />,
        ])}
        {regions.flatMap((r) => {
          const color = showDiffArea && showOverall ? "var(--foreground)" : (REGION_COLOR[r] ?? "#64748b");
          return [
            <Line
              key={`${r}-p`}
              yAxisId="y1" type="monotone" dataKey={`${r}__p`} name={`${r} 占比`}
              stroke={color} strokeWidth={2} dot={false} connectNulls legendType="plainline"
            />,
            <Line
              key={`${r}-v`}
              yAxisId="y2" type="monotone" dataKey={`${r}__v`} name={`${r} 指标`}
              stroke={color} strokeWidth={1.5} strokeDasharray="4 3" strokeOpacity={0.4} dot={false} connectNulls legendType="plainline"
            />,
          ];
        })}
        {showOverall && (
          <Line
            key="overall-p"
            yAxisId="y1" type="monotone" dataKey="__overall_p" name="总体 占比"
            stroke="#94a3b8" strokeWidth={1.5} strokeOpacity={0.9} dot={false} connectNulls legendType="plainline"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ===== 价格分布卡片：按年份 box plot（不分渠道） =====
function PriceCard({
  cls, rawData, years, regions,
}: {
  cls: string;
  rawData: MidClassRow[];
  years: number[];
  regions: string[];
}) {
  const ys = [...years].sort((a, b) => a - b);
  const sortedRs = [...regions].sort(
    (a, b) => ALL_REGIONS.indexOf(a) - ALL_REGIONS.indexOf(b),
  );

  // 每个 (region, year) 一根箱：min / Q1 / median / Q3 / max + mean
  type Row = {
    x: string; region: string; year: number;
    base: number; lowW: number; box25: number; box50: number; highW: number;
    pmin: number; p25: number; p50: number; p75: number; pmax: number; avg: number;
  };
  const data: Row[] = [];
  for (const r of sortedRs) {
    const full = fullName(r);
    for (const y of ys) {
      const rows = rawData.filter(
        (d) =>
          Number(d.pay_dt_quarter.slice(0, 4)) === y &&
          d.good_mid_class_merged === cls &&
          d.consume_large_area_name === full,
      );
      const totalQty = rows.reduce((s, d) => s + (d.qty || 0), 0);
      const w = (k: keyof MidClassRow) =>
        totalQty > 0
          ? rows.reduce((s, d) => s + ((d[k] as number) || 0) * (d.qty || 0), 0) / totalQty
          : rows.length > 0
            ? rows.reduce((s, d) => s + ((d[k] as number) || 0), 0) / rows.length
            : 0;
      const pmin = rows.length > 0 ? Math.min(...rows.map((d) => d.tag_price_min || Infinity).filter(isFinite)) : 0;
      const pmax = rows.length > 0 ? Math.max(...rows.map((d) => d.tag_price_max || 0)) : 0;
      const p25 = w("tag_price_p25");
      const p50 = w("tag_price_p50");
      const p75 = w("tag_price_p75");
      const avg = w("tag_price_avg");
      data.push({
        x: `${r}|${y}`, region: r, year: y,
        base: pmin, lowW: Math.max(0, p25 - pmin), box25: Math.max(0, p50 - p25), box50: Math.max(0, p75 - p50), highW: Math.max(0, pmax - p75),
        pmin, p25, p50, p75, pmax, avg,
      });
    }
  }

  const allMin = Math.min(...data.map((d) => d.pmin).filter((v) => v > 0), Infinity);
  const allMax = Math.max(...data.map((d) => d.pmax), 0);
  const yDomain: [number, number] = [
    isFinite(allMin) ? Math.floor(allMin * 0.9) : 0,
    Math.ceil(allMax * 1.05),
  ];

  // 自定义 tick：显示年份；每组首个 tick 上方再显示大区名
  const YearTick = (props: { x?: number; y?: number; payload?: { value?: string; index?: number } }) => {
    const { x = 0, y = 0, payload } = props;
    const value = String(payload?.value ?? "");
    const [region, year] = value.split("|");
    const idx = data.findIndex((d) => d.x === value);
    const isGroupStart = idx === 0 || data[idx - 1]?.region !== region;
    return (
      <g transform={`translate(${x},${y})`}>
        <text dy={12} textAnchor="middle" fill="var(--muted-foreground)" fontSize={10}>{year?.length === 4 ? year.slice(2) : year}</text>
        {isGroupStart && (
          <text dy={28} textAnchor="start" fill="var(--foreground)" fontSize={11} fontWeight={600}>
            {region}
          </text>
        )}
      </g>
    );
  };

  // 大区分隔参考线（落在每个新 region 第一个 x 的左侧）
  const separatorXs = data
    .map((d, i) => (i > 0 && d.region !== data[i - 1].region ? d.x : null))
    .filter((v): v is string => v != null);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {cls} <span className="text-xs font-normal text-muted-foreground">价格分布（最小 / P25 / P50 / P75 / 最大 + 均值）· 按大区 × 年份</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="w-full">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={data} barCategoryGap="40%" margin={{ top: 10, right: 16, bottom: 40, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="x" interval={0} height={50} tick={YearTick as never} />
                <YAxis
                  stroke="var(--muted-foreground)" fontSize={11}
                  tickFormatter={(v) => `¥${fmtNum(v)}`} domain={yDomain} width={70}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--muted)", opacity: 0.3 }}
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload as Row;
                    return (
                      <div style={tooltipStyle as React.CSSProperties} className="p-2">
                        <div className="font-medium mb-1">{d.region} · {d.year}</div>
                        <div className="space-y-0.5 text-xs">
                          <div>最大: ¥{Math.round(d.pmax).toLocaleString()}</div>
                          <div>P75: ¥{Math.round(d.p75).toLocaleString()}</div>
                          <div className="font-medium">中位 P50: ¥{Math.round(d.p50).toLocaleString()}</div>
                          <div>P25: ¥{Math.round(d.p25).toLocaleString()}</div>
                          <div>最小: ¥{Math.round(d.pmin).toLocaleString()}</div>
                          <div className="text-primary">均值: ¥{Math.round(d.avg).toLocaleString()}</div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="base" stackId="b" fill="transparent" legendType="none" />
                <Bar dataKey="lowW" stackId="b" name="最小–P25">
                  {data.map((d, i) => <Cell key={i} fill={REGION_COLOR[d.region] ?? "#94a3b8"} fillOpacity={0.2} />)}
                </Bar>
                <Bar dataKey="box25" stackId="b" name="P25–P50">
                  {data.map((d, i) => {
                    const c = REGION_COLOR[d.region] ?? "#2563eb";
                    return <Cell key={i} fill={c} fillOpacity={0.55} stroke={c} strokeWidth={1} />;
                  })}
                </Bar>
                <Bar dataKey="box50" stackId="b" name="P50–P75">
                  {data.map((d, i) => {
                    const c = REGION_COLOR[d.region] ?? "#2563eb";
                    return <Cell key={i} fill={c} fillOpacity={0.8} stroke={c} strokeWidth={1} />;
                  })}
                </Bar>
                <Bar dataKey="highW" stackId="b" name="P75–最大">
                  {data.map((d, i) => <Cell key={i} fill={REGION_COLOR[d.region] ?? "#94a3b8"} fillOpacity={0.2} />)}
                </Bar>
                <Scatter dataKey="avg" fill="#f59e0b" shape="diamond" name="均值" />
                {separatorXs.map((sx) => (
                  <ReferenceLine key={sx} x={sx} stroke="var(--border)" strokeDasharray="2 2" />
                ))}
                <ReferenceLine y={0} stroke="var(--border)" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
