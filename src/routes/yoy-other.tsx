import { createFileRoute } from "@tanstack/react-router";
import { AnalysisReports, reportsFromGlob } from "@/components/analysis-reports";

export const Route = createFileRoute("/yoy-other")({
  head: () => ({ meta: [{ title: "YOY · 分析 · Kolon" }] }),
  component: YoyOtherPage,
});

const reports = import.meta.glob("../reports/yoy/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const items = reportsFromGlob(reports);

function YoyOtherPage() {
  return (
    <AnalysisReports
      stage="Stage 01 · 分析"
      title="分析"
      subtitle="HTML 放入 src/reports/yoy/；卡片可拖拽排序，右下角拖动可缩放"
      items={items}
    />
  );
}
