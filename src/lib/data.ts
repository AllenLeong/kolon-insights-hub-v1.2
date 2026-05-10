import Papa from "papaparse";

export type YoyRow = {
  pay_yr: number;
  consume_large_area_name: string;
  members: number;
  amt: number;
  arpu: number;
  freq: number;
  qty: number;
  auv: number;
  upt: number;
  members_ly: number | null;
  members_growth_rate: number | null;
  amt_ly: number | null;
  amt_growth_rate: number | null;
  stores: number;
  stores_traffic: number;
  member_cnt_first: number;
  effective_new_pct: number;
  new_cust_amt: number;
  new_cust_amt_pct: number;
  old_cust_amt: number;
  old_cust_amt_pct: number;
  new_cust_cnt: number;
  old_cust_cnt: number;
  last_year_total: number | null;
  retained_cnt: number | null;
  retention_rate: number | null;
};

export type RepurchaseRow = {
  stat_month: string;
  stat_date: string;
  consume_large_area_name: string;
  repurchase_member_cnt_180d: number;
  member_cnt_180d: number;
  repurchase_rate_180d: number;
};

export type MidClassRow = {
  pay_dt_quarter: string; // 现为年份字符串，例如 "2022"
  consume_large_area_name: string;
  good_mid_class_merged: string;
  order_fst: number;
  order_re: number;
  order_wake: number;
  members: number;
  amt: number;
  qty: number;
  orders: number;
  works: number;
  styles: number;
  tag_price_avg: number;
  tag_price_std: number;
  tag_price_min: number;
  tag_price_p10: number;
  tag_price_p25: number;
  tag_price_p50: number;
  tag_price_p75: number;
  tag_price_p90: number;
  tag_price_max: number;
  barg_price_avg: number;
  barg_price_std: number;
};

// 中文表头 → 英文内部字段映射
const YOY_MAP: Record<string, string> = {
  "交易年": "pay_yr",
  "消费大区": "consume_large_area_name",
  "会员数": "members",
  "交易金额": "amt",
  "客单价": "arpu",
  "购买频次": "freq",
  "人均购买件数": "qty",
  "件单价": "auv",
  "单件数": "upt",
  "去年会员数": "members_ly",
  "会员增长率": "members_growth_rate",
  "去年交易金额": "amt_ly",
  "交易金额增长率": "amt_growth_rate",
  "门店数": "stores",
  "单店服务会员数": "stores_traffic",
  "首购会员数": "member_cnt_first",
  "首购会员占比": "effective_new_pct",
  "新客交易额": "new_cust_amt",
  "新客交易占比": "new_cust_amt_pct",
  "老客交易额": "old_cust_amt",
  "老客交易占比": "old_cust_amt_pct",
  "新客人数": "new_cust_cnt",
  "老客人数": "old_cust_cnt",
  "去年老客人数": "last_year_total",
  "留存老客": "retained_cnt",
  "老客留存率": "retention_rate",
};

const REP_MAP: Record<string, string> = {
  "计算月": "stat_month",
  "计算日期": "stat_date",
  "消费大区": "consume_large_area_name",
  "180天复购会员": "repurchase_member_cnt_180d",
  "180天购买会员": "member_cnt_180d",
  "180天复购率": "repurchase_rate_180d",
};

const MID_MAP: Record<string, string> = {
  "交易年": "pay_dt_quarter",
  "消费大区": "consume_large_area_name",
  "业务中类": "good_mid_class_merged",
  "首购订单数": "order_fst",
  "复购订单数": "order_re",
  "唤醒订单数": "order_wake",
  "会员数": "members",
  "交易金额": "amt",
  "交易件数": "qty",
  "订单数": "orders",
  "作品数": "works",
  "款数": "styles",
  "吊牌价均值": "tag_price_avg",
  "吊牌价标准差": "tag_price_std",
  "吊牌价最小值": "tag_price_min",
  "吊牌价10分位": "tag_price_p10",
  "吊牌价25分位": "tag_price_p25",
  "吊牌价中位数": "tag_price_p50",
  "吊牌价75分位": "tag_price_p75",
  "吊牌价90分位": "tag_price_p90",
  "吊牌价最大值": "tag_price_max",
  "成交价均值": "barg_price_avg",
  "成交价标准差": "barg_price_std",
};

async function loadCsvMapped<T>(path: string, map: Record<string, string>): Promise<T[]> {
  const res = await fetch(path);
  const text = await res.text();
  const { data } = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  return data.map((row) => {
    const out: Record<string, unknown> = {};
    for (const k in row) {
      const cleanKey = k.replace(/^\uFEFF/, "");
      const mapped = map[cleanKey];
      if (mapped) out[mapped] = row[k];
    }
    return out as T;
  });
}

export const loadYoy = () => loadCsvMapped<YoyRow>("/data/kpis.csv", YOY_MAP);
export const loadRepurchase = () =>
  loadCsvMapped<RepurchaseRow>("/data/180_repurchase.csv", REP_MAP);
export const loadMidClass = async () => {
  const rows = await loadCsvMapped<MidClassRow>("/data/prd_mid_class.csv", MID_MAP);
  // pay_dt_quarter 可能被 dynamicTyping 解析成数字，需要强制为字符串
  return rows.map((r) => ({ ...r, pay_dt_quarter: String(r.pay_dt_quarter) }));
};

export function fmtAmt(n: number) {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toFixed(0);
}
export function fmtPct(n: number | null | undefined, digits = 1) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}
export function fmtNum(n: number) {
  return n.toLocaleString();
}
