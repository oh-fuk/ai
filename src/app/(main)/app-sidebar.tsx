"use client";

import {
  BookOpen, BrainCircuit, CalendarDays, FileText, LayoutDashboard,
  LineChart, PenSquare, Settings, Timer, History, ImageIcon,
  FileSearch, Sigma, BookCopy, MessageCircle, FileCheck,
  SpellCheck, Briefcase, CheckSquare, Plug,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarContent, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { useNotification } from "@/context/notification-context";
import { memo } from "react";
import { AthenaLogo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavIcon = React.ComponentType<{ className?: string }>;

/* ─── Nav structure ─────────────────────────────────────────────────────── */

const navSections = [
  {
    label: null, // no label for top items
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, notificationKey: "dashboard" },
      { href: "/chat", label: "AI Chat", icon: MessageCircle, notificationKey: "chat" },
    ],
  },
  {
    label: "Generate",
    items: [
      { href: "/quiz", label: "Quiz Generator", icon: BrainCircuit },
      { href: "/paper-generator", label: "Paper Generator", icon: PenSquare },
      { href: "/guess-paper", label: "Guess Paper", icon: FileCheck },
    ],
  },
  {
    label: "Analyze",
    items: [
      { href: "/summarize", label: "Summarizer", icon: FileSearch },
      { href: "/notes-maker", label: "Notes Maker", icon: BookCopy },
      { href: "/image-to-text", label: "Image to Text", icon: ImageIcon },
      { href: "/analyzer/text-analyzer", label: "Text Analyzer", icon: Sigma },
      { href: "/analyzer/grammar-checker", label: "Grammar Checker", icon: SpellCheck },
    ],
  },
  {
    label: "Write",
    items: [
      { href: "/writing/essay", label: "Essay Writer", icon: PenSquare },
      { href: "/writing/email", label: "Email Writer", icon: FileText },
      { href: "/writing/application", label: "Application Writer", icon: Briefcase },
      { href: "/writing/letter", label: "Letter Writer", icon: BookOpen },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/tasks", label: "My Tasks", icon: CheckSquare, notificationKey: "tasks" },
      { href: "/planner", label: "Study Planner", icon: CalendarDays, notificationKey: "planner" },
      { href: "/timer", label: "Study Timer", icon: Timer, notificationKey: "timer" },
      { href: "/progress", label: "Progress", icon: LineChart, notificationKey: "progress" },
      { href: "/history", label: "History", icon: History, notificationKey: "history" },
    ],
  },
  {
    label: "Connectors",
    items: [
      { href: "/connectors", label: "Connectors", icon: Plug },
    ],
  },
];

/* ─── Single nav item ───────────────────────────────────────────────────── */

function NavItem({
  item,
  pathname,
  collapsed,
  notificationKey,
}: {
  item: { href: string; label: string; icon: NavIcon };
  pathname: string;
  collapsed: boolean;
  notificationKey?: string;
}) {
  const { notifications } = useNotification();
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

  const inner = (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-medium transition-all duration-150",
        collapsed
          ? "justify-center w-10 h-10 mx-auto"
          : "gap-2.5 px-3 py-2 w-full",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
          : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      {/* active indicator bar */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-r-full" />
      )}

      <item.icon className={cn(
        "flex-shrink-0 transition-all duration-150",
        collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
        isActive
          ? "text-sidebar-primary"
          : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80"
      )} />

      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

      {/* notification dot */}
      {notificationKey && (notifications as any)[notificationKey] && (
        <span className={cn(
          "rounded-full bg-primary animate-pulse",
          collapsed
            ? "absolute top-1 right-1 h-1.5 w-1.5"
            : "h-1.5 w-1.5"
        )} />
      )}
    </Link>
  );

  if (!collapsed) return inner;

  return (
    <Tooltip delayDuration={80}>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right" className="font-medium text-xs">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/* ─── Section label ─────────────────────────────────────────────────────── */

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="my-2 mx-2 border-t border-sidebar-border/40" />;
  }
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 select-none">
      {label}
    </p>
  );
}

/* ─── Main sidebar ──────────────────────────────────────────────────────── */

const AppSidebar = memo(function AppSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-sidebar w-full">

        {/* Logo */}
        <SidebarHeader className={cn(
          "flex-shrink-0 py-4 border-b border-sidebar-border",
          collapsed ? "px-0 flex justify-center" : "px-4"
        )}>
          {collapsed ? (
            <Tooltip delayDuration={80}>
              <TooltipTrigger asChild>
                <Link href="/dashboard">
                  <AthenaLogo className="h-9 w-9 ring-2 ring-sidebar-border hover:ring-sidebar-primary/40 transition-all duration-200" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium text-xs">AthenaAI</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <AthenaLogo className="h-9 w-9 ring-2 ring-sidebar-border group-hover:ring-sidebar-primary/40 transition-all duration-200" />
              <div className="flex flex-col leading-none">
                <span className="font-headline text-base font-bold text-sidebar-foreground">AthenaAI</span>
                <span className="text-[11px] text-sidebar-foreground/45 font-medium tracking-wide">Study Buddy</span>
              </div>
            </Link>
          )}
        </SidebarHeader>

        {/* Nav */}
        <SidebarContent className="flex-1 overflow-y-auto scrollbar-hide py-2 px-1.5">
          {navSections.map((section, si) => (
            <div key={si}>
              {section.label && (
                <SectionLabel label={section.label} collapsed={collapsed} />
              )}
              <div className={cn("space-y-0.5", collapsed && "flex flex-col items-center")}>
                {section.items.map(item => (
                  <NavItem
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    notificationKey={(item as any).notificationKey}
                  />
                ))}
              </div>
            </div>
          ))}
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="flex-shrink-0 px-1.5 py-2 border-t border-sidebar-border">
          <NavItem
            item={{ href: "/settings", label: "Settings", icon: Settings }}
            pathname={pathname}
            collapsed={collapsed}
          />
        </SidebarFooter>
      </div>
    </TooltipProvider>
  );
});

export default AppSidebar;
