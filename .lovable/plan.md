# 商品中类结构分析 — 重构计划

按 spec 第 13 节 MVP 范围重构 `/products`，区域顺序参考 YOY 的渠道分组（自营/经销商/线上，同渠道挨着）。

## 数据与常量

`MidClassRow` 已包含价格分位字段（p10/p25/p50/p75/p90, min/max, std, barg_price_avg/std），无需扩展。

新增 `src/lib/regions.ts`（从 yoy.tsx 抽取）：
- `CHANNEL_REGIONS`、`CHANNEL_PALETTE`、`ALL_REGIONS`（渠道顺序：自营 → 经销商 → 线上）
- `REGION_COLOR`、`fullName`、`shortName`
- yoy.tsx 改为引用此模块（去重）

## 页面结构（src/routes/products.tsx 重写）

```
顶部筛选条
├─ 时间范围 (默认最近 6 季度)
├─ 大区多选 (默认全部，按渠道排序)
├─ Top K (5/8/10，默认 8)
├─ 指标口径 (销售额/会员/订单/销量/首单/回购/唤醒结构)
├─ 展示模式 (结构占比 / 同比变化)
└─ 中类聚焦 (清空 = 矩阵模式；选中 = 单中类模式)

主区
├─ 矩阵模式：区域×时间 Top K 结构卡片矩阵 (+ 右侧明细抽屉)
└─ 单中类模式：基础指标对比图 + 价格分布近似箱线图

底部
└─ 当前选中 cell 的 首单/回购/唤醒 中类结构对比（三栏条形图）
```

## 关键实现要点

**Top K 全局统一**（spec 7.5）：在当前筛选条件下，对所有 cell 数据先按指标口径全局聚合，取 Top K 中类，其余合并为「其他」。所有 cell 共享同一中类列表 + 同一颜色（`PALETTE_20` 按全局排名分配）。**禁止 cell 内二次归一化**——Top K 块按原始 share 显示，剩余面积留给「其他」。

**Cell 渲染**：使用固定顺序的水平条带（每个中类一个色块，宽度 = 原始占比 × 100%；剩余宽度 = 其他，灰色）。这比 treemap 更稳定、可比性强（spec 12.2）。块内显示中类简称 + 占比，过窄时只显示色块，hover tooltip 给完整信息。

**同比变化模式**（spec 7.7 模式 B）：颜色不再用中类色，而用 share_diff_vs_ly 着色（绿涨红跌）。需要查找上一年同季度的 share。

**Hover 联动**（spec 11.1）：hover 某中类时，所有 cell 中同名块加边框/全亮，其他块降透明度。用 `hoveredClass` state + CSS opacity。

**点击交互**（spec 11.2）：
- 点击 cell → 右侧 Sheet 抽屉显示该区域+季度的 Top K 明细表（amt/qty/orders/members/order_fst/order_re/order_wake/tag_price_avg/barg_price_avg/p10/p50/p90）
- 点击中类块 → 设置 `focusedClass`，整页切换为单中类模式

**单中类模式**：
- 基础指标对比：分组柱状图，X 轴 = 时间 或 区域（开关），系列 = members/amt/orders（默认）+ 可加 order_fst/re/wake；派生 fst_rate/re_rate/wake_rate 切换
- 价格分布近似箱线图：用 Recharts 的 `ComposedChart` + 自定义 SVG（一根 Bar 表示 p25-p75 箱体，ErrorBar 或 ReferenceLine 表示 p10/p90 须线，散点表示 p50 中位线，端点 min/max 用浅色线）；价格口径切换吊牌价/成交价（成交价仅 avg±std 误差线）

**底部 fst/re/wake 对比**：三栏并排横向条形图，X = 各中类的 fst_share / re_share / wake_share（针对当前选中 cell 或全局）。

## 颜色与排序

- 区域（行）顺序：`ALL_REGIONS`（自营→经销商→线上，同渠道相邻）
- 季度（列）顺序：升序，默认取最近 6 个
- 中类颜色：全局 Top K 排名 → `PALETTE_20[i]`，其他 = `hsl(0 0% 70%)`

## 文件改动

- 新建：`src/lib/regions.ts`
- 重写：`src/routes/products.tsx`
- 编辑：`src/routes/yoy.tsx`（改为 import regions.ts，去掉本地定义）

## 不做（spec 13 之外）

动画播放、PPT 导出、注释、自定义计算字段。

---

确认后我直接开干。如果某部分要简化（例如箱线图先用「均值±std 误差线」过渡）告诉我即可。