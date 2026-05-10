import { Link, useRouterState } from "@tanstack/react-router";
import {
  Mountain,
  TrendingUp,
  Package,
  Route as RouteIcon,
  Shuffle,
  Target,
  Presentation,
  CircleDot,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const stages = [
  { url: "/", icon: Presentation, label: "封面", status: "ready" },
  {
    icon: TrendingUp,
    label: "YOY 分析",
    status: "ready",
    children: [
      { url: "/yoy", label: "YOY 与复购" },
      { url: "/yoy-other", label: "分析" },
      { url: "/products", label: "商品中类结构" },
      { url: "/products-yoy", label: "商品中类 YOY" },
    ],
  },
  { url: "/purchase-path", icon: RouteIcon, label: "购买路径", status: "planned" },
  { url: "/product-flow", icon: Shuffle, label: "商品流转", status: "planned" },
  { url: "/attribution", icon: Target, label: "归因分析", status: "planned" },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent">
            <Mountain className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex flex-col leading-tight overflow-hidden">
            <span className="text-sm font-bold tracking-wide text-sidebar-foreground">KOLON</span>
            <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60 truncate">
              人货场汇报
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>汇报阶段</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {stages.map((s) => {
                if ("children" in s) {
                  const groupActive = s.children.some((c) => c.url === pathname);
                  return (
                    <SidebarMenuItem key={s.label}>
                      <SidebarMenuButton tooltip={s.label} isActive={groupActive}>
                        <s.icon className="h-4 w-4" />
                        <span>{s.label}</span>
                      </SidebarMenuButton>
                      <SidebarMenuSub>
                        {s.children.map((c) => (
                          <SidebarMenuSubItem key={c.url}>
                            <SidebarMenuSubButton asChild isActive={pathname === c.url}>
                              <Link to={c.url}>{c.label}</Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  );
                }
                const active = pathname === s.url;
                return (
                  <SidebarMenuItem key={s.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={s.label}>
                      <Link to={s.url} className="flex items-center gap-2">
                        <s.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{s.label}</span>
                        {s.status === "planned" && (
                          <CircleDot className="ml-auto h-3 w-3 shrink-0 opacity-50" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="text-[10px] text-sidebar-foreground/50 leading-relaxed">
          Mock Data · 2022–2026
          <br />可隆户外 · 内部汇报使用
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
