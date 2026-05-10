// KPI 配置：支持多 series、双 Y 轴、同比叠加、堆叠面积

import type { YoyRow, RepurchaseRow } from "./data";

export type KpiSource = "yoy" | "rep";
export type AxisId = "y1" | "y2";
export type SeriesStyle = "solid" | "dashed";

export type SeriesDef = {
  /** 用作 dataKey 的稳定标识 */
  key: string;
  label: string;
  axis?: AxisId;
  style?: SeriesStyle;
  color?: string;
  /** 自定义取值（替代 row[key]） */
  compute?: (row: YoyRow | RepurchaseRow) => number | null;
};

export type KpiDef = {
  id: string;
  title: string;
  desc?: string;
  source: KpiSource;
  series: SeriesDef[];
  /** 给每条 series 自动叠加同比变化率（同色高透明 + 虚线，y2 轴） */
  showYoY?: boolean;
  /** 堆叠面积（如新老客占比） */
  stackedArea?: boolean;
  y1Fmt: (v: number) => string;
  y2Fmt?: (v: number) => string;
};

const fmtAmtAxis = (v: number) =>
  v >= 1e8 ? `${(v / 1e8).toFixed(1)}亿` : v >= 1e4 ? `${(v / 1e4).toFixed(0)}万` : `${v}`;
const fmtPctAxis = (v: number) => `${(v * 100).toFixed(0)}%`;
const fmtNumAxis = (v: number) =>
  Math.abs(v) >= 1e8
    ? `${(v / 1e8).toFixed(1)}亿`
    : Math.abs(v) >= 1e4
      ? `${(v / 1e4).toFixed(1)}万`
      : v.toLocaleString();
const fmtMoney = (v: number) => `¥${Math.round(v).toLocaleString()}`;

export const KPIS: KpiDef[] = [
  // 1. 销售额 + 同比
  {
    id: "sales",
    title: "销售额",
    desc: "元（虚线 = 同比）",
    source: "yoy",
    series: [{ key: "amt", label: "销售额" }],
    showYoY: true,
    y1Fmt: fmtAmtAxis,
    y2Fmt: fmtPctAxis,
  },
  // 2. 会员数 + 同比
  {
    id: "members",
    title: "会员数",
    desc: "人（虚线 = 同比）",
    source: "yoy",
    series: [{ key: "members", label: "会员数" }],
    showYoY: true,
    y1Fmt: fmtNumAxis,
    y2Fmt: fmtPctAxis,
  },
  // 3. 人均消费 + 同比（计算字段）
  {
    id: "arpu",
    title: "人均消费",
    desc: "元/人 = 交易金额 / 会员数（虚线 = 同比）",
    source: "yoy",
    series: [
      {
        key: "arpu_calc",
        label: "人均消费",
        compute: (r) => {
          const row = r as YoyRow;
          return row.members ? row.amt / row.members : null;
        },
      },
    ],
    showYoY: true,
    y1Fmt: fmtMoney,
    y2Fmt: fmtPctAxis,
  },
  // 4. 频次/连带率 (y1) + 件单价 (y2)
  {
    id: "freq_upt_auv",
    title: "购买频次 / 单件数 / 件单价",
    source: "yoy",
    series: [
      { key: "freq", label: "购买频次", axis: "y1", color: "#2563eb", style: "solid" },
      { key: "upt", label: "单件数", axis: "y1", color: "#16a34a", style: "solid" },
      { key: "auv", label: "件单价", axis: "y2", color: "#dc2626", style: "dashed" },
    ],
    y1Fmt: (v) => v.toFixed(2),
    y2Fmt: fmtMoney,
  },
  // 5. 新客人数 + 同比
  {
    id: "new_cnt",
    title: "新客人数",
    desc: "人（虚线 = 同比）",
    source: "yoy",
    series: [{ key: "new_cust_cnt", label: "新客人数" }],
    showYoY: true,
    y1Fmt: fmtNumAxis,
    y2Fmt: fmtPctAxis,
  },
  // 6. 老客人数 + 同比
  {
    id: "old_cnt",
    title: "老客人数",
    desc: "人（虚线 = 同比）",
    source: "yoy",
    series: [{ key: "old_cust_cnt", label: "老客人数" }],
    showYoY: true,
    y1Fmt: fmtNumAxis,
    y2Fmt: fmtPctAxis,
  },
  // 7. 新客交易额 + 同比
  {
    id: "new_amt",
    title: "新客交易额",
    desc: "元（虚线 = 同比）",
    source: "yoy",
    series: [{ key: "new_cust_amt", label: "新客交易额" }],
    showYoY: true,
    y1Fmt: fmtAmtAxis,
    y2Fmt: fmtPctAxis,
  },
  // 8. 老客交易额 + 同比
  {
    id: "old_amt",
    title: "老客交易额",
    desc: "元（虚线 = 同比）",
    source: "yoy",
    series: [{ key: "old_cust_amt", label: "老客交易额" }],
    showYoY: true,
    y1Fmt: fmtAmtAxis,
    y2Fmt: fmtPctAxis,
  },
  // 9. 新老客交易占比（堆叠面积）
  {
    id: "new_old_pct",
    title: "新老客交易占比",
    source: "yoy",
    series: [
      { key: "new_cust_amt_pct", label: "新客", color: "#2563eb" },
      { key: "old_cust_amt_pct", label: "老客", color: "#f59e0b" },
    ],
    stackedArea: true,
    y1Fmt: fmtPctAxis,
  },
  // 10. 老客留存率 (y1) + 去年老客 / 留存老客 (y2)
  {
    id: "retention",
    title: "老客留存",
    source: "yoy",
    series: [
      { key: "retention_rate", label: "老客留存率", axis: "y1", color: "#2563eb" },
      { key: "last_year_total", label: "去年老客人数", axis: "y2", color: "#94a3b8" },
      { key: "retained_cnt", label: "留存老客", axis: "y2", color: "#16a34a", style: "dashed" },
    ],
    y1Fmt: fmtPctAxis,
    y2Fmt: fmtNumAxis,
  },
  // 11. 门店数
  {
    id: "stores",
    title: "门店数",
    source: "yoy",
    series: [{ key: "stores", label: "门店数" }],
    y1Fmt: fmtNumAxis,
  },
  // 12. 180天复购率 (y1) + 复购/购买人数 (y2)
  {
    id: "rep180",
    title: "180天复购",
    desc: "按月",
    source: "rep",
    series: [
      { key: "repurchase_rate_180d", label: "复购率", axis: "y1", color: "#2563eb" },
      { key: "member_cnt_180d", label: "购买会员", axis: "y2", color: "#94a3b8" },
      { key: "repurchase_member_cnt_180d", label: "复购会员", axis: "y2", color: "#16a34a", style: "dashed" },
    ],
    y1Fmt: fmtPctAxis,
    y2Fmt: fmtNumAxis,
  },
];
