import { createFileRoute } from "@tanstack/react-router";
import { AnalysisReports, reportsFromGlob } from "@/components/analysis-reports";

export const Route = createFileRoute("/purchase-path")({
  head: () => ({ meta: [{ title: "购买路径 · Kolon" }] }),
  component: PurchasePathPage,
});

const reports = import.meta.glob("../reports/purchase-path/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const items = reportsFromGlob(reports);

function PurchasePathPage() {
  return (
    <AnalysisReports
      stage="购买路径 · 分析"
      title="购买路径"
      subtitle="HTML 放入 src/reports/purchase-path/；卡片可拖拽排序，右下角拖动可缩放"
      items={items}
    />
  );
}
