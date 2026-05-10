import { createFileRoute } from "@tanstack/react-router";
import { AnalysisReports, reportsFromGlob } from "@/components/analysis-reports";

export const Route = createFileRoute("/attribution")({
  head: () => ({ meta: [{ title: "归因分析 · Kolon" }] }),
  component: AttributionPage,
});

const reports = import.meta.glob("../reports/attribution/*.html", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const items = reportsFromGlob(reports);

function AttributionPage() {
  return (
    <AnalysisReports
      stage="归因分析"
      title="归因分析"
      subtitle="HTML 放入 src/reports/attribution/；卡片可拖拽排序，右下角拖动可缩放"
      items={items}
    />
  );
}
