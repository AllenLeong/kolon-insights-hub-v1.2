import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadMidClass, type MidClassRow } from "@/lib/data";
import {
  ALL_REGIONS, CHANNEL_ORDER, CHANNEL_REGIONS, REGION_COLOR,
  fullName, shortName, sortRegions,
} from "@/lib/regions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Filter, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  ComposedChart, Line,
} from "recharts";

export const Route = createFileRoute("/products")({
  head: () => ({ meta: [{ title: "商品中类结构 · Kolon" }] }),
  component: ProductsPage,
});

// ============ 类型 & 常量 ============
type StructMetric = "amt" | "members" | "orders" | "qty" | "order_fst" | "order_re" | "order_wake";
const STRUCT_METRICS: { value: StructMetric; label: string }[] = [
  { value: "amt", label: "销售额" },
  { value: "members", label: "会员" },
  { value: "orders", label: "订单" },
  { value: "qty", label: "销量" },
  { value: "order_fst", label: "首单" },
  { value: "order_re", label: "回购" },
  { value: "order_wake", label: "唤醒" },
];
type ViewMode = "share" | "yoy";

const PALETTE_20 = [
  "#2563eb", "#16a34a", "#dc2626", "#f59e0b", "#7c3aed",
  "#0891b2", "#ea580c", "#65a30d", "#db2777", "#0d9488",
  "#9333ea", "#ca8a04", "#0284c7", "#15803d", "#b91c1c",
  "#a16207", "#6d28d9", "#0e7490", "#be123c", "#4d7c0f",
];
const OTHERS_COLOR = "hsl(220 8% 70%)";
const OTHERS = "__其他__";

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--foreground)",
};

const fmtAmt = (v: number) => v >= 1e8 ? `${(v / 1e8).toFixed(2)}亿` : v >= 1e4 ? `${(v / 1e4).toFixed(1)}万` : `${Math.round(v)}`;
const fmtNum = (v: number) => Math.round(v).toLocaleString();
const fmtPct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const fmtMoney = (v: number) => `¥${Math.round(v).toLocaleString()}`;
const valueFmt = (m: StructMetric, v: number) => m === "amt" ? fmtAmt(v) : fmtNum(v);

// 上一年同期（季度或年）
const prevYearQuarter = (q: string): string | null => {
  const mq = /^(\d{4})Q([1-4])$/.exec(q);
  if (mq) return `${Number(mq[1]) - 1}Q${mq[2]}`;
  const my = /^(\d{4})$/.exec(q);
  if (my) return `${Number(my[1]) - 1}`;
  return null;
};

type Granularity = "quarter" | "year";

// 把按季度的数据聚合到年（按 qNums 过滤后的季度合并），输出 pay_dt_quarter = 年份字符串
function aggregateToYear(data: MidClassRow[], qNums: number[]): MidClassRow[] {
  const map = new Map<string, { row: MidClassRow; n: number }>();
  for (const r of data) {
    const m = /^(\d{4})Q([1-4])$/.exec(r.pay_dt_quarter);
    if (!m) continue;
    if (!qNums.includes(Number(m[2]))) continue;
    const year = m[1];
    const key = `${year}|${r.consume_large_area_name}|${r.good_mid_class_merged}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { row: { ...r, pay_dt_quarter: year }, n: 1 });
    } else {
      const a = cur.row;
      a.order_fst += r.order_fst || 0;
      a.order_re += r.order_re || 0;
      a.order_wake += r.order_wake || 0;
      a.members += r.members || 0;
      a.amt += r.amt || 0;
      a.qty += r.qty || 0;
      a.orders += r.orders || 0;
      // 价格类：累加，最后求平均
      a.tag_price_avg += r.tag_price_avg || 0;
      a.tag_price_std += r.tag_price_std || 0;
      a.tag_price_p10 += r.tag_price_p10 || 0;
      a.tag_price_p25 += r.tag_price_p25 || 0;
      a.tag_price_p50 += r.tag_price_p50 || 0;
      a.tag_price_p75 += r.tag_price_p75 || 0;
      a.tag_price_p90 += r.tag_price_p90 || 0;
      a.barg_price_avg += r.barg_price_avg || 0;
      a.barg_price_std += r.barg_price_std || 0;
      a.tag_price_min = Math.min(a.tag_price_min || Infinity, r.tag_price_min || Infinity);
      a.tag_price_max = Math.max(a.tag_price_max || 0, r.tag_price_max || 0);
      cur.n += 1;
    }
  }
  const out: MidClassRow[] = [];
  for (const { row, n } of map.values()) {
    if (n > 1) {
      row.tag_price_avg /= n;
      row.tag_price_std /= n;
      row.tag_price_p10 /= n;
      row.tag_price_p25 /= n;
      row.tag_price_p50 /= n;
      row.tag_price_p75 /= n;
      row.tag_price_p90 /= n;
      row.barg_price_avg /= n;
      row.barg_price_std /= n;
    }
    if (!isFinite(row.tag_price_min)) row.tag_price_min = 0;
    out.push(row);
  }
  return out;
}

// ============ 主页面 ============
function ProductsPage() {
  const q = useQuery({ queryKey: ["midclass"], queryFn: loadMidClass });

  if (q.isLoading) return <div className="p-6 text-muted-foreground">数据加载中...</div>;
  if (q.error || !q.data) return <div className="p-6 text-destructive">数据加载失败</div>;

  const data = q.data.filter((r) => r && r.good_mid_class_merged);
  return <ProductsInner data={data} />;
}

function ProductsInner({ data: rawData }: { data: MidClassRow[] }) {
  // 原始数据中的所有年份
  const allYearsRaw = useMemo(
    () => [...new Set(rawData.map((r) => Number(r.pay_dt_quarter.slice(0, 4))).filter(Number.isFinite))].sort((a, b) => a - b),
    [rawData],
  );
  const ALL_QS = [1, 2, 3, 4];

  // ========= 筛选状态 =========
  const [granularity] = useState<Granularity>("year");
  const [years, setYears] = useState<number[]>(() => allYearsRaw.slice(-2));
  const [qNums, setQNums] = useState<number[]>(ALL_QS);

  // 全部中类（按销售额全局排名）
  const allClasses = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rawData) {
      totals.set(r.good_mid_class_merged, (totals.get(r.good_mid_class_merged) ?? 0) + (Number(r.amt) || 0));
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [rawData]);

  // 中类多选；null = 全部
  const [selectedClasses, setSelectedClasses] = useState<string[] | null>(null);

  const data = useMemo(
    () => selectedClasses == null ? rawData : rawData.filter((r) => selectedClasses.includes(r.good_mid_class_merged)),
    [rawData, selectedClasses],
  );
  void qNums;


  const allQuarters = useMemo(
    () => [...new Set(data.map((r) => r.pay_dt_quarter))].sort(),
    [data],
  );
  const allRegions = useMemo(
    () => sortRegions([...new Set(data.map((r) => shortName(r.consume_large_area_name)))]),
    [data],
  );

  const quarters = useMemo(
    () => granularity === "year"
      ? allQuarters.filter((q) => years.includes(Number(q)))
      : allQuarters.filter((q) => years.includes(Number(q.slice(0, 4))) && qNums.includes(Number(q.slice(5, 6)))),
    [allQuarters, granularity, years, qNums],
  );

  const [regions, setRegions] = useState<string[]>(allRegions);
  const [topK, setTopK] = useState<number>(5);
  const [metric, setMetric] = useState<StructMetric>("amt");
  const [mode, setMode] = useState<ViewMode>("share");
  const [focusedClass, setFocusedClass] = useState<string | null>(null);
  const [hoveredClass, setHoveredClass] = useState<string | null>(null);
  const [valueDisplay, setValueDisplay] = useState<"hover" | "static">("hover");
  const [cellMinW, setCellMinW] = useState<number>(110);
  const [cellMaxW, setCellMaxW] = useState<number>(0); // 0 = 不限（填满）

  const sortedRegions = useMemo(() => sortRegions(regions), [regions]);


  // ========= 索引：(region+quarter) → rows =========
  const cellIndex = useMemo(() => {
    const m = new Map<string, MidClassRow[]>();
    for (const r of data) {
      const key = `${shortName(r.consume_large_area_name)}|${r.pay_dt_quarter}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    }
    return m;
  }, [data]);

  // ========= 颜色映射（按全局排名稳定分配）+ 每个 cell 内 Top K 的并集 =========
  const { topClasses, classColor } = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of data) {
      const reg = shortName(r.consume_large_area_name);
      if (!regions.includes(reg)) continue;
      if (!quarters.includes(r.pay_dt_quarter)) continue;
      const v = Number(r[metric]) || 0;
      totals.set(r.good_mid_class_merged, (totals.get(r.good_mid_class_merged) ?? 0) + v);
    }
    const globalRank = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const color: Record<string, string> = {};
    globalRank.forEach((k, i) => { color[k] = PALETTE_20[i % PALETTE_20.length]; });
    color[OTHERS] = OTHERS_COLOR;

    // 每个 cell 内的 Top K 并集
    const displayed = new Set<string>();
    for (const reg of regions) {
      for (const q of quarters) {
        const rows = cellIndex.get(`${reg}|${q}`) ?? [];
        const cellTotals = new Map<string, number>();
        for (const r of rows) {
          const v = Number(r[metric]) || 0;
          cellTotals.set(r.good_mid_class_merged, (cellTotals.get(r.good_mid_class_merged) ?? 0) + v);
        }
        const cellTop = [...cellTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, topK)
          .map(([k]) => k);
        cellTop.forEach((k) => displayed.add(k));
      }
    }
    const top = globalRank.filter((k) => displayed.has(k));
    return { topClasses: top, classColor: color };
  }, [data, regions, quarters, metric, topK, cellIndex]);

  // ========= 单中类模式数据准备 =========
  const focusedAvailable = focusedClass && (topClasses.includes(focusedClass) || data.some((r) => r.good_mid_class_merged === focusedClass));

  return (
    <div className="mx-auto max-w-[1700px] space-y-5">
      {/* 标题 */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Stage 02 · 商品</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">区域 × 时间 商品消费结构</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            悬停中类块或图例可联动高亮所有 cell 中的同一中类
          </p>
        </div>
      </div>

      {/* 筛选条 */}
      <FilterBar
        granularity={granularity}
        setGranularity={() => {}}
        allYears={allYearsRaw}
        years={years}
        setYears={setYears}
        qNums={qNums}
        setQNums={setQNums}
        quartersCount={quarters.length}
        allRegions={allRegions}
        regions={regions}
        setRegions={setRegions}
        allClasses={allClasses}
        selectedClasses={selectedClasses}
        setSelectedClasses={setSelectedClasses}
        topK={topK}
        setTopK={setTopK}
        metric={metric}
        setMetric={setMetric}
        mode={mode}
        setMode={setMode}
        valueDisplay={valueDisplay}
        setValueDisplay={setValueDisplay}
        cellMinW={cellMinW}
        setCellMinW={setCellMinW}
        cellMaxW={cellMaxW}
        setCellMaxW={setCellMaxW}
      />

      {/* 主内容 */}
      {focusedAvailable ? (
        <FocusedClassView
          data={data}
          klass={focusedClass!}
          regions={sortedRegions}
          quarters={quarters}
          color={classColor[focusedClass!] ?? PALETTE_20[0]}
          onExit={() => setFocusedClass(null)}
        />
      ) : (
        <MatrixView
          regions={sortedRegions}
          quarters={quarters}
          cellIndex={cellIndex}
          topClasses={topClasses}
          classColor={classColor}
          metric={metric}
          mode={mode}
          topK={topK}
          valueDisplay={valueDisplay}
          cellMinW={cellMinW}
          cellMaxW={cellMaxW}
          hoveredClass={hoveredClass}
          setHoveredClass={setHoveredClass}
          onClassClick={(c) => setFocusedClass(c)}
        />
      )}

    </div>
  );
}

// ============ 筛选条 ============
function FilterBar(props: {
  granularity: Granularity; setGranularity: (v: Granularity) => void;
  allYears: number[];
  years: number[]; setYears: (v: number[]) => void;
  qNums: number[]; setQNums: (v: number[]) => void;
  quartersCount: number;
  allRegions: string[];
  regions: string[]; setRegions: (v: string[]) => void;
  allClasses: string[];
  selectedClasses: string[] | null; setSelectedClasses: (v: string[] | null) => void;
  topK: number; setTopK: (v: number) => void;
  metric: StructMetric; setMetric: (v: StructMetric) => void;
  mode: ViewMode; setMode: (v: ViewMode) => void;
  valueDisplay: "hover" | "static"; setValueDisplay: (v: "hover" | "static") => void;
  cellMinW: number; setCellMinW: (v: number) => void;
  cellMaxW: number; setCellMaxW: (v: number) => void;
}) {
  const { granularity, setGranularity, allYears, years, setYears, qNums, setQNums, quartersCount,
    allRegions, regions, setRegions,
    allClasses, selectedClasses, setSelectedClasses,
    topK, setTopK, metric, setMetric, mode, setMode, valueDisplay, setValueDisplay,
    cellMinW, setCellMinW, cellMaxW, setCellMaxW } = props;
  const toggleY = (y: number) =>
    setYears(years.includes(y) ? years.filter((x) => x !== y) : [...years, y].sort((a, b) => a - b));
  const toggleR = (r: string) =>
    setRegions(regions.includes(r) ? regions.filter((x) => x !== r) : [...regions, r]);
  const effectiveClasses = selectedClasses ?? allClasses;
  const toggleC = (c: string) => {
    const cur = selectedClasses ?? allClasses;
    setSelectedClasses(cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
  };
  const classLabel = selectedClasses == null
    ? `全部 ${allClasses.length}`
    : `${effectiveClasses.length}/${allClasses.length}`;
  void setQNums; void qNums; void granularity; void setGranularity;

  const yearLabel = years.length === 0 ? "无"
    : years.length === allYears.length ? "全部"
    : years.length <= 2 ? years.join(",")
    : `${years.length} 年`;

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-3">
        {/* 年份 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Filter className="h-3.5 w-3.5" />年份 ({yearLabel})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56">
            <div className="mb-2 flex justify-between text-xs">
              <button className="text-primary hover:underline" onClick={() => setYears(allYears)}>全选</button>
              <button className="text-primary hover:underline" onClick={() => setYears(allYears.slice(-2))}>近 2 年</button>
              <button className="text-muted-foreground hover:underline" onClick={() => setYears([])}>清空</button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto">
              {allYears.map((y) => (
                <label key={y} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox checked={years.includes(y)} onCheckedChange={() => toggleY(y)} />
                  {y}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <span className="text-[11px] text-muted-foreground">共 {quartersCount} {granularity === "year" ? "年" : "季度"}</span>

        {/* 大区 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Filter className="h-3.5 w-3.5" />大区 ({regions.length}/{allRegions.length})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <button className="text-primary hover:underline" onClick={() => setRegions(allRegions)}>全选</button>
                <button className="text-muted-foreground hover:underline" onClick={() => setRegions([])}>清空</button>
              </div>
              {CHANNEL_ORDER.map((ch) => (
                <div key={ch}>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{ch}</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CHANNEL_REGIONS[ch].filter((r) => allRegions.includes(r)).map((r) => (
                      <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={regions.includes(r)} onCheckedChange={() => toggleR(r)} />
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: REGION_COLOR[r] }} />
                        {r}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {(() => {
                const known = new Set(CHANNEL_ORDER.flatMap((c) => CHANNEL_REGIONS[c]));
                const others = allRegions.filter((r) => !known.has(r));
                if (others.length === 0) return null;
                return (
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">其他</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {others.map((r) => (
                        <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={regions.includes(r)} onCheckedChange={() => toggleR(r)} />
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: REGION_COLOR[r] ?? "#9ca3af" }} />
                          {r}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </PopoverContent>
        </Popover>

        {/* 中类 */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <Filter className="h-3.5 w-3.5" />中类 ({classLabel})
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <div className="mb-2 flex justify-between text-xs">
              <button className="text-primary hover:underline" onClick={() => setSelectedClasses(null)}>全部</button>
              <button className="text-muted-foreground hover:underline" onClick={() => setSelectedClasses([])}>清空</button>
            </div>
            <div className="grid grid-cols-1 gap-1 max-h-72 overflow-y-auto">
              {allClasses.map((c) => (
                <label key={c} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={effectiveClasses.includes(c)} onCheckedChange={() => toggleC(c)} />
                  <span className="truncate">{c}</span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-5 w-px bg-border" />

        {/* Top K */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Top</span>
          <input
            type="number"
            min={1}
            max={20}
            value={topK}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 1 && n <= 20) setTopK(Math.floor(n));
            }}
            className="h-7 w-14 rounded border bg-background px-2 text-xs"
          />
        </div>

        {/* 指标口径 */}
        <SegToggle
          value={metric}
          options={STRUCT_METRICS.map((m) => ({ value: m.value, label: m.label }))}
          onChange={(v) => setMetric(v as StructMetric)}
        />

        {/* 显示模式 */}
        <SegToggle
          value={mode}
          options={[
            { value: "share", label: "结构占比" },
            { value: "yoy", label: "同比变化" },
          ]}
          onChange={(v) => setMode(v as ViewMode)}
        />

        {/* 数字显示 */}
        <SegToggle
          label="数字"
          value={valueDisplay}
          options={[
            { value: "hover", label: "悬浮" },
            { value: "static", label: "静态" },
          ]}
          onChange={(v) => setValueDisplay(v as "hover" | "static")}
        />

        {/* Cell 宽度 */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">宽 min</span>
          <input
            type="number"
            min={40}
            max={600}
            value={cellMinW}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 40 && n <= 600) setCellMinW(Math.floor(n));
            }}
            className="h-7 w-16 rounded border bg-background px-2 text-xs"
          />
          <span className="text-[11px] text-muted-foreground">max</span>
          <input
            type="number"
            min={0}
            max={1200}
            value={cellMaxW}
            placeholder="填满"
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 0 && n <= 1200) setCellMaxW(Math.floor(n));
            }}
            className="h-7 w-16 rounded border bg-background px-2 text-xs"
          />
          <span className="text-[10px] text-muted-foreground">{cellMaxW === 0 ? "(0=填满)" : "px"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SegToggle({ value, options, onChange, label }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-[11px] text-muted-foreground">{label}</span>}
      <div className="flex rounded-md border p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-2 py-0.5 text-[11px] rounded ${value === o.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >{o.label}</button>
        ))}
      </div>
    </div>
  );
}

// ============ 矩阵视图 ============
function MatrixView({
  regions, quarters, cellIndex, topClasses, classColor, metric, mode, topK, valueDisplay,
  cellMinW, cellMaxW,
  hoveredClass, setHoveredClass, onClassClick,
}: {
  regions: string[]; quarters: string[];
  cellIndex: Map<string, MidClassRow[]>;
  topClasses: string[]; classColor: Record<string, string>;
  metric: StructMetric; mode: ViewMode; topK: number;
  valueDisplay: "hover" | "static";
  cellMinW: number; cellMaxW: number;
  hoveredClass: string | null;
  setHoveredClass: (c: string | null) => void;
  onClassClick: (c: string) => void;
}) {
  if (regions.length === 0 || quarters.length === 0) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">请选择至少一个大区和一个季度</CardContent></Card>;
  }

  // 每个 cell 内独立选 Top K
  const computeShares = (region: string, quarter: string) => {
    const rows = cellIndex.get(`${region}|${quarter}`) ?? [];
    let total = 0;
    const byClass = new Map<string, number>();
    for (const r of rows) {
      const v = Number(r[metric]) || 0;
      total += v;
      byClass.set(r.good_mid_class_merged, (byClass.get(r.good_mid_class_merged) ?? 0) + v);
    }
    if (total === 0) return null;
    const allShares = [...byClass.entries()]
      .map(([klass, v]) => ({ klass, value: v, share: v / total }))
      .sort((a, b) => b.share - a.share);
    const shares = allShares.slice(0, topK);
    const otherShare = Math.max(0, 1 - shares.reduce((s, x) => s + x.share, 0));
    return { shares, otherShare, total };
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">区域 × 时间 单元内 Top {topK} 结构矩阵</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-3 pt-0">
        <div className="w-full">
          {/* 表头 */}
          <div className="grid gap-1 sticky top-0 z-10 bg-card pb-1"
               style={{ gridTemplateColumns: `90px repeat(${quarters.length}, minmax(${cellMinW}px, ${cellMaxW > 0 ? cellMaxW + "px" : "1fr"}))` }}>
            <div />
            {quarters.map((q) => (
              <div key={q} className="text-center text-[11px] font-medium text-muted-foreground">{q}</div>
            ))}
          </div>

          {/* 行 */}
          {regions.map((reg) => (
            <div key={reg} className="grid gap-1 mb-1"
                 style={{ gridTemplateColumns: `90px repeat(${quarters.length}, minmax(${cellMinW}px, ${cellMaxW > 0 ? cellMaxW + "px" : "1fr"}))` }}>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: REGION_COLOR[reg] }} />
                <span className="font-medium">{reg}</span>
              </div>
              {quarters.map((q) => {
                const c = computeShares(reg, q);
                return (
                  <Cell
                    key={q}
                    region={reg}
                    quarter={q}
                    data={c}
                    classColor={classColor}
                    metric={metric}
                    mode={mode}
                    valueDisplay={valueDisplay}
                    hoveredClass={hoveredClass}
                    setHoveredClass={setHoveredClass}
                    onClassClick={onClassClick}
                    yoyShares={mode === "yoy" ? computeShares(reg, prevYearQuarter(q) ?? "") : null}
                  />
                );
              })}
            </div>
          ))}

          {/* 图例 */}
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-2">
            {topClasses.map((k) => (
              <div
                key={k}
                onMouseEnter={() => setHoveredClass(k)}
                onMouseLeave={() => setHoveredClass(null)}
                className="flex items-center gap-1.5 text-[11px]"
                style={{ opacity: hoveredClass && hoveredClass !== k ? 0.4 : 1 }}
              >
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: classColor[k] }} />
                {k}
              </div>
            ))}
            {mode === "yoy" && (
              <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5" style={{ background: "#16a34a" }} />上升</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5" style={{ background: "#dc2626" }} />下降</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5" style={{ background: "hsl(220 8% 70%)" }} />变化小</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function yoyColor(diff: number): string {
  if (Math.abs(diff) < 0.005) return "hsl(220 8% 75%)";
  const intensity = Math.min(1, Math.abs(diff) / 0.05);
  if (diff > 0) {
    const a = 0.25 + 0.55 * intensity;
    return `rgba(22,163,74,${a.toFixed(2)})`;
  }
  const a = 0.25 + 0.55 * intensity;
  return `rgba(220,38,38,${a.toFixed(2)})`;
}

// 简化版 squarified treemap
type Rect = { x: number; y: number; w: number; h: number };
function squarify(values: number[], W: number, H: number): Rect[] {
  const n = values.length;
  const result: Rect[] = new Array(n).fill(null).map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0 || n === 0) return result;
  // 按降序排，记录原始 idx
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const scaled = order.map((o) => (o.v * W * H) / total);

  let cx = 0, cy = 0, cw = W, ch = H;
  let row: number[] = [];
  let rowIdx: number[] = [];

  const worst = (r: number[], side: number) => {
    if (r.length === 0 || side <= 0) return Infinity;
    const s = r.reduce((a, b) => a + b, 0);
    const max = Math.max(...r), min = Math.min(...r);
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };

  const layoutRow = () => {
    const side = Math.min(cw, ch);
    const sum = row.reduce((a, b) => a + b, 0);
    if (sum <= 0 || side <= 0) { row = []; rowIdx = []; return; }
    const thick = sum / side;
    if (cw >= ch) {
      // 在左侧切一列，宽 = thick
      let py = cy;
      for (let k = 0; k < row.length; k++) {
        const hh = row[k] / thick;
        result[order[rowIdx[k]].i] = { x: cx, y: py, w: thick, h: hh };
        py += hh;
      }
      cx += thick; cw -= thick;
    } else {
      // 在顶部切一行，高 = thick
      let px = cx;
      for (let k = 0; k < row.length; k++) {
        const ww = row[k] / thick;
        result[order[rowIdx[k]].i] = { x: px, y: cy, w: ww, h: thick };
        px += ww;
      }
      cy += thick; ch -= thick;
    }
    row = []; rowIdx = [];
  };

  let i = 0;
  while (i < scaled.length) {
    const side = Math.min(cw, ch);
    const candidate = [...row, scaled[i]];
    if (row.length === 0 || worst(candidate, side) <= worst(row, side)) {
      row = candidate;
      rowIdx.push(i);
      i++;
    } else {
      layoutRow();
    }
  }
  if (row.length) layoutRow();
  return result;
}

const CELL_MIN_W = 110;
const CELL_H = 68;

function useElementWidth<T extends HTMLElement>(fallback = CELL_MIN_W) {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setW(el.clientWidth || fallback));
    ro.observe(el);
    setW(el.clientWidth || fallback);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w] as const;
}

function Cell({
  region, quarter, data, classColor, metric, mode, valueDisplay,
  hoveredClass, setHoveredClass, onClassClick, yoyShares,
}: {
  region: string; quarter: string;
  data: { shares: { klass: string; share: number; value: number }[]; otherShare: number; total: number } | null;
  classColor: Record<string, string>;
  metric: StructMetric; mode: ViewMode;
  valueDisplay: "hover" | "static";
  hoveredClass: string | null;
  setHoveredClass: (c: string | null) => void;
  onClassClick: (c: string) => void;
  yoyShares: { shares: { klass: string; share: number; value: number }[]; otherShare: number; total: number } | null;
}) {
  const [ref, W] = useElementWidth<HTMLDivElement>(CELL_MIN_W);

  if (!data) {
    return (
      <div
        ref={ref}
        className="flex items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground"
        style={{ width: "100%", height: CELL_H }}
      >
        无数据
      </div>
    );
  }

  // 仅展示 Top K（已是降序的全局排名）；按本 cell 内 share 降序，再做 treemap
  const items = data.shares
    .filter((s) => s.share > 0)
    .sort((a, b) => b.share - a.share);
  const rects = squarify(items.map((s) => s.share), Math.max(1, W - 2), CELL_H - 2);

  return (
    <div
      ref={ref}
      className="relative rounded border bg-background overflow-hidden"
      style={{ width: "100%", height: CELL_H }}
      title={`${region} · ${quarter} · 总计 ${valueFmt(metric, data.total)} · Top${items.length} 合计 ${fmtPct(items.reduce((s, x) => s + x.share, 0))}`}
    >
      {items.map((s, idx) => {
        const r = rects[idx];
        if (!r || r.w <= 0 || r.h <= 0) return null;
        const baseColor = classColor[s.klass];
        let color = baseColor;
        if (mode === "yoy") {
          const lyShare = yoyShares?.shares.find((x) => x.klass === s.klass)?.share ?? null;
          color = lyShare == null ? "hsl(220 8% 85%)" : yoyColor(s.share - lyShare);
        }
        const dim = hoveredClass && hoveredClass !== s.klass;
        const showLabel = r.w >= 38 && r.h >= 22;
        return (
          <div
            key={s.klass}
            onMouseEnter={() => setHoveredClass(s.klass)}
            onMouseLeave={() => setHoveredClass(null)}
            
            className="absolute flex items-center justify-center text-[10px] text-white font-medium overflow-hidden whitespace-nowrap transition-opacity"
            style={{
              left: r.x + 1, top: r.y + 1, width: r.w, height: r.h,
              background: color,
              opacity: dim ? 0.2 : 1,
              outline: hoveredClass === s.klass ? "2px solid white" : "1px solid rgba(255,255,255,0.4)",
              outlineOffset: -1,
            }}
            title={`${s.klass} · ${fmtPct(s.share)} · ${valueFmt(metric, s.value)}${mode === "yoy" && yoyShares ? ` · 同比 ${formatDiff(s.share - (yoyShares.shares.find((x) => x.klass === s.klass)?.share ?? 0))}` : ""}`}
          >
            {showLabel && (
              <div className="px-1 leading-tight text-center truncate">
                <div className="truncate" style={{ maxWidth: r.w - 4 }}>{s.klass}</div>
                {valueDisplay === "static" && (
                  <div className="opacity-90 text-[9px]">
                    {fmtPct(s.share)} · {valueFmt(metric, s.value)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatDiff(d: number) {
  const sign = d >= 0 ? "+" : "";
  return `${sign}${(d * 100).toFixed(1)}pp`;
}


// ============ 单中类聚焦视图 ============
type FocusDim = "time" | "region";

function FocusedClassView({
  data, klass, regions, quarters, color, onExit,
}: {
  data: MidClassRow[];
  klass: string;
  regions: string[];
  quarters: string[];
  color: string;
  onExit: () => void;
}) {
  const [dim, setDim] = useState<FocusDim>("time");
  const [pivotRegion, setPivotRegion] = useState<string>(regions[0] ?? "");
  const [pivotQuarter, setPivotQuarter] = useState<string>(quarters[quarters.length - 1] ?? "");
  const [priceMode, setPriceMode] = useState<"tag" | "barg">("tag");

  // 准备 X 轴
  const xValues = dim === "time" ? quarters : regions;

  const series = useMemo(() => {
    return xValues.map((x) => {
      const rows = data.filter((r) => r.good_mid_class_merged === klass && (
        dim === "time"
          ? (r.pay_dt_quarter === x && shortName(r.consume_large_area_name) === pivotRegion)
          : (shortName(r.consume_large_area_name) === x && r.pay_dt_quarter === pivotQuarter)
      ));
      const sum = (k: keyof MidClassRow) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
      const avg = (k: keyof MidClassRow) => rows.length ? rows.reduce((s, r) => s + (Number(r[k]) || 0), 0) / rows.length : 0;
      const orders = sum("orders");
      return {
        x,
        amt: sum("amt"),
        members: sum("members"),
        orders,
        qty: sum("qty"),
        order_fst: sum("order_fst"),
        order_re: sum("order_re"),
        order_wake: sum("order_wake"),
        fst_rate: orders ? sum("order_fst") / orders : 0,
        re_rate: orders ? sum("order_re") / orders : 0,
        wake_rate: orders ? sum("order_wake") / orders : 0,
        // 价格分布 (avg over sources)
        tag_p10: avg("tag_price_p10"),
        tag_p25: avg("tag_price_p25"),
        tag_p50: avg("tag_price_p50"),
        tag_p75: avg("tag_price_p75"),
        tag_p90: avg("tag_price_p90"),
        tag_min: avg("tag_price_min"),
        tag_max: avg("tag_price_max"),
        barg_avg: avg("barg_price_avg"),
        barg_std: avg("barg_price_std"),
      };
    });
  }, [data, klass, xValues, dim, pivotRegion, pivotQuarter]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded" style={{ background: color }} />
          <CardTitle className="text-base">{klass}</CardTitle>
          <span className="text-[11px] text-muted-foreground">单中类聚焦</span>
        </div>
        <div className="flex items-center gap-2">
          <SegToggle
            value={dim}
            options={[{ value: "time", label: "按时间" }, { value: "region", label: "按区域" }]}
            onChange={(v) => setDim(v as FocusDim)}
          />
          {dim === "time" ? (
            <SegToggle
              label="区域"
              value={pivotRegion}
              options={regions.map((r) => ({ value: r, label: r }))}
              onChange={setPivotRegion}
            />
          ) : (
            <SegToggle
              label="季度"
              value={pivotQuarter}
              options={quarters.map((q) => ({ value: q, label: q }))}
              onChange={setPivotQuarter}
            />
          )}
          <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={onExit}><X className="h-3.5 w-3.5" />退出</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 基础指标 */}
        <div>
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">基础指标对比</div>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="x" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis yAxisId="L" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={fmtAmt} width={60} />
              <YAxis yAxisId="R" orientation="right" stroke="var(--muted-foreground)" fontSize={11} tickFormatter={fmtNum} width={60} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown, n: unknown) => {
                const name = String(n);
                if (name === "销售额") return fmtAmt(Number(v));
                return fmtNum(Number(v));
              }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="L" dataKey="amt" name="销售额" fill={color} />
              <Line yAxisId="R" type="monotone" dataKey="members" name="会员数" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
              <Line yAxisId="R" type="monotone" dataKey="orders" name="订单数" stroke="#0891b2" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 订单类型占比 */}
        <div>
          <div className="mb-2 text-[11px] font-medium text-muted-foreground">订单类型占比（首单 / 回购 / 唤醒）</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="x" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} domain={[0, 1]} width={50} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => fmtPct(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="fst_rate" name="首单率" stackId="1" fill="#16a34a" />
              <Bar dataKey="re_rate" name="回购率" stackId="1" fill="#2563eb" />
              <Bar dataKey="wake_rate" name="唤醒率" stackId="1" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 价格分布 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-medium text-muted-foreground">价格分布对比（{priceMode === "tag" ? "吊牌价 P10/P25/P50/P75/P90 近似箱线" : "成交价均值 ± 标准差"}）</div>
            <SegToggle
              value={priceMode}
              options={[{ value: "tag", label: "吊牌价" }, { value: "barg", label: "成交价" }]}
              onChange={(v) => setPriceMode(v as "tag" | "barg")}
            />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BoxPlotApprox data={series} mode={priceMode} color={color} />
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// 用 SVG 直接绘制箱线图近似（不依赖 recharts box）
function BoxPlotApprox({ data, mode, color }: {
  data: Array<Record<string, number | string>>;
  mode: "tag" | "barg";
  color: string;
}) {
  // ResponsiveContainer 注入宽高时，需要支持作为函数子节点；这里包装成普通 SVG
  return (
    <BoxPlotSvg data={data} mode={mode} color={color} />
  );
}

function BoxPlotSvg({ data, mode, color }: {
  data: Array<Record<string, number | string>>;
  mode: "tag" | "barg";
  color: string;
}) {
  const W = 1000, H = 280, padL = 50, padR = 16, padT = 12, padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const n = data.length;
  if (n === 0) return <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} />;

  // 计算 Y 轴范围
  let yMin = Infinity, yMax = -Infinity;
  for (const d of data) {
    if (mode === "tag") {
      const min = Number(d.tag_min), max = Number(d.tag_max);
      if (min > 0) yMin = Math.min(yMin, min);
      if (max > 0) yMax = Math.max(yMax, max);
    } else {
      const a = Number(d.barg_avg), s = Number(d.barg_std);
      if (a > 0) {
        yMin = Math.min(yMin, a - s);
        yMax = Math.max(yMax, a + s);
      }
    }
  }
  if (!isFinite(yMin) || !isFinite(yMax) || yMax <= yMin) {
    return <div className="text-xs text-muted-foreground p-4">价格数据不足</div>;
  }
  const pad = (yMax - yMin) * 0.1;
  yMin = Math.max(0, yMin - pad);
  yMax = yMax + pad;
  const yScale = (v: number) => padT + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const slot = innerW / n;
  const boxW = Math.min(40, slot * 0.4);

  const ticks = 5;
  const tickValues = Array.from({ length: ticks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / ticks);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      {/* Y 轴网格 */}
      {tickValues.map((v) => (
        <g key={v}>
          <line x1={padL} x2={W - padR} y1={yScale(v)} y2={yScale(v)} stroke="var(--border)" strokeDasharray="3 3" />
          <text x={padL - 6} y={yScale(v) + 3} fontSize="10" fill="var(--muted-foreground)" textAnchor="end">¥{Math.round(v)}</text>
        </g>
      ))}
      {/* X 轴标签 */}
      {data.map((d, i) => (
        <text key={String(d.x)} x={padL + slot * (i + 0.5)} y={H - padB + 16} fontSize="10" fill="var(--muted-foreground)" textAnchor="middle">{String(d.x)}</text>
      ))}
      {/* 箱体 */}
      {data.map((d, i) => {
        const cx = padL + slot * (i + 0.5);
        if (mode === "tag") {
          const p10 = Number(d.tag_p10), p25 = Number(d.tag_p25), p50 = Number(d.tag_p50);
          const p75 = Number(d.tag_p75), p90 = Number(d.tag_p90);
          if (!p50) return null;
          return (
            <g key={String(d.x)}>
              {/* 须线 p10-p90 */}
              <line x1={cx} x2={cx} y1={yScale(p10)} y2={yScale(p90)} stroke={color} strokeWidth={1.5} />
              <line x1={cx - boxW * 0.4} x2={cx + boxW * 0.4} y1={yScale(p10)} y2={yScale(p10)} stroke={color} strokeWidth={1.5} />
              <line x1={cx - boxW * 0.4} x2={cx + boxW * 0.4} y1={yScale(p90)} y2={yScale(p90)} stroke={color} strokeWidth={1.5} />
              {/* 箱体 p25-p75 */}
              <rect x={cx - boxW / 2} y={yScale(p75)} width={boxW} height={Math.max(2, yScale(p25) - yScale(p75))}
                    fill={color} fillOpacity={0.35} stroke={color} />
              {/* 中位线 */}
              <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yScale(p50)} y2={yScale(p50)} stroke={color} strokeWidth={2.5} />
              <title>{String(d.x)}: P10 ¥{Math.round(p10)} · P25 ¥{Math.round(p25)} · P50 ¥{Math.round(p50)} · P75 ¥{Math.round(p75)} · P90 ¥{Math.round(p90)}</title>
            </g>
          );
        }
        const a = Number(d.barg_avg), s = Number(d.barg_std);
        if (!a) return null;
        return (
          <g key={String(d.x)}>
            <line x1={cx} x2={cx} y1={yScale(a - s)} y2={yScale(a + s)} stroke={color} strokeWidth={1.5} />
            <line x1={cx - boxW * 0.4} x2={cx + boxW * 0.4} y1={yScale(a - s)} y2={yScale(a - s)} stroke={color} strokeWidth={1.5} />
            <line x1={cx - boxW * 0.4} x2={cx + boxW * 0.4} y1={yScale(a + s)} y2={yScale(a + s)} stroke={color} strokeWidth={1.5} />
            <circle cx={cx} cy={yScale(a)} r={4} fill={color} />
            <title>{String(d.x)}: 均值 ¥{Math.round(a)} ± {Math.round(s)}</title>
          </g>
        );
      })}
    </svg>
  );
}

// ============ 价格结构矩阵 ============

