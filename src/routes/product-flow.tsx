import { createFileRoute } from "@tanstack/react-router";
import { AnalysisReports, reportsFromGlob } from "@/components/analysis-reports";

export const Route = createFileRoute("/product-flow")({
  head: () => ({ meta: [{ title: "商品流转 · Kolon" }] }),
  component: ProductFlowPage,
});

const reports = import.meta.glob("../reports/product-flow/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const items = reportsFromGlob(reports);

function ProductFlowPage() {
  return (
    <AnalysisReports
      stage="商品流转 · 分析"
      title="商品流转"
      subtitle="HTML 放入 src/reports/product-flow/；卡片可拖拽排序，右下角拖动可缩放"
      items={items}
    />
  );
}
