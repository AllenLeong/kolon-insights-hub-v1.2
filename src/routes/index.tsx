import { createFileRoute, Link } from "@tanstack/react-router";
import { TrendingUp, Route as RouteIcon, Shuffle, Target, ArrowRight, Mountain } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kolon 人货场汇报 · 封面" },
      { name: "description", content: "可隆户外人-货-场分阶段汇报平台" },
    ],
  }),
  component: Cover,
});

const agenda = [
  { no: "01", to: "/yoy", title: "YOY 分析", icon: TrendingUp, status: "已完成", ready: true },
  { no: "02", to: "/purchase-path", title: "购买路径", icon: RouteIcon, status: "待接入", ready: false },
  { no: "03", to: "/product-flow", title: "商品流转", icon: Shuffle, status: "待接入", ready: false },
  { no: "04", to: "/attribution", title: "归因分析", icon: Target, status: "待接入", ready: false },
] as const;

function Cover() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/70 p-10 text-primary-foreground shadow-xl md:p-14">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary-foreground/70">
            <Mountain className="h-4 w-4" /> Kolon Sport · Internal Briefing
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">
            可隆户外
            <br />
            人 · 货 · 场 数据汇报
          </h1>
          <div className="mt-8">
            <Link
              to="/yoy"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
            >
              开始汇报 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <h2 id="agenda" className="mt-12 mb-5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        汇报议程
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {agenda.map((a) => (
          <Link
            key={a.no}
            to={a.to}
            className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
          >
            <div className="flex items-start justify-between">
              <span className="text-4xl font-bold text-primary/15 leading-none">{a.no}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${
                  a.ready ? "bg-accent/15 text-accent" : "bg-secondary text-secondary-foreground"
                }`}
              >
                {a.status}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-primary">
              <a.icon className="h-4 w-4" />
              <span className="text-base font-semibold text-foreground">{a.title}</span>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary opacity-60 transition group-hover:opacity-100">
              进入 <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
