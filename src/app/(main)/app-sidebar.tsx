"use client";

import {
  BookOpen, BrainCircuit, CalendarDays, FileText, LayoutDashboard,
  LineChart, PenSquare, Settings, Timer, History, ImageIcon,
  FileSearch, Sigma, BookCopy, MessageCircle, FileCheck,
  SpellCheck, Briefcase, CheckSquare, Plug, Sparkles, Wrench, HardDrive,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SidebarContent, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { useNotification } from "@/context/notification-context";
import { memo, useState, useEffect } from "react";
import { AthenaLogo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

type NavIcon = React.ComponentType<{ className?: string }>;

/* ─── Nav structure ─────────────────────────────────────────────────────── */
const navSections: {
  label: string | null;
  categoryIcon?: NavIcon;
  /** Spotlight target for product tour (visible in collapsed + expanded sidebar). */
  tourId?: string;
  items: { href: string; label: string; icon: NavIcon; notificationKey?: string; tourId?: string }[];
}[] = [
    {
      label: null,
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, notificationKey: "dashboard", tourId: "onborda-nav-dashboard" },
        { href: "/chat", label: "AI Chat", icon: MessageCircle, notificationKey: "chat" },
      ],
    },
    {
      label: "Generate",
      categoryIcon: Sparkles,
      items: [
        { href: "/quiz", label: "Quiz Generator", icon: BrainCircuit },
        { href: "/paper-generator", label: "Paper Generator", icon: PenSquare },
        { href: "/guess-paper", label: "Guess Paper", icon: FileCheck },
      ],
    },
    {
      label: "Analyze",
      categoryIcon: Sigma,
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
      categoryIcon: PenSquare,
      items: [
        { href: "/writing/essay", label: "Essay Writer", icon: PenSquare },
        { href: "/writing/email", label: "Email Writer", icon: FileText },
        { href: "/writing/application", label: "Application Writer", icon: Briefcase },
        { href: "/writing/letter", label: "Letter Writer", icon: BookOpen },
      ],
    },
    {
      label: "Tools",
      categoryIcon: Wrench,
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
      categoryIcon: Plug,
      tourId: "onborda-nav-connectors",
      items: [
        { href: "/connectors", label: "All connectors", icon: Plug },
        { href: "/connectors?section=drive", label: "Google Drive", icon: HardDrive },
      ],
    },
  ];

function navHrefIsActive(pathname: string, search: URLSearchParams, href: string): boolean {
  const [path, qs] = href.split("?");
  if (pathname !== path && !pathname.startsWith(path + "/")) return false;
  if (qs) {
    const want = new URLSearchParams(qs);
    for (const [k, v] of want.entries()) {
      if (search.get(k) !== v) return false;
    }
    return true;
  }
  if (href === "/connectors" && search.get("section") === "drive") return false;
  return pathname === path || pathname.startsWith(path + "/");
}

/* ─── Single nav item ───────────────────────────────────────────────────── */
function NavItem({
  item, collapsed, notificationKey,
}: {
  item: { href: string; label: string; icon: NavIcon; tourId?: string };
  collapsed: boolean;
  notificationKey?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { notifications } = useNotification();
  const isActive = navHrefIsActive(pathname, searchParams, item.href);

  const inner = (
    <Link
      id={item.tourId}
      href={item.href}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-medium transition-all duration-150",
        collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-2.5 px-3 py-2 w-full",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
          : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-r-full" />
      )}
      <item.icon className={cn(
        "flex-shrink-0",
        collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
        isActive ? "text-sidebar-primary" : "text-sidebar-foreground/45 group-hover:text-sidebar-foreground/80"
      )} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {notificationKey && (notifications as any)[notificationKey] && (
        <span className={cn(
          "rounded-full bg-primary animate-pulse",
          collapsed ? "absolute top-1 right-1 h-1.5 w-1.5" : "h-1.5 w-1.5"
        )} />
      )}
    </Link>
  );

  if (!collapsed) return inner;
  return (
    <Tooltip delayDuration={80}>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="right" className="text-xs font-medium">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/* ─── Category row (collapsed mode) ────────────────────────────────────── */
function CollapsedCategory({
  label, icon: Icon, items, open, onToggle, showLabel = false, tourId,
}: {
  label: string;
  icon: NavIcon;
  items: { href: string; label: string; icon: NavIcon; notificationKey?: string; tourId?: string }[];
  open: boolean;
  onToggle: () => void;
  showLabel?: boolean;
  tourId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isGroupActive = items.some((i) => navHrefIsActive(pathname, searchParams, i.href));

  return (
    <div className={cn("flex flex-col", showLabel ? "w-full" : "items-center")}>
      <Tooltip delayDuration={80}>
        <TooltipTrigger asChild>
          <button
            type="button"
            id={!showLabel ? tourId : undefined}
            onClick={onToggle}
            className={cn(
              "flex items-center rounded-lg transition-all duration-150",
              showLabel
                ? "gap-2.5 px-3 py-2 w-full text-sm font-medium"
                : "justify-center w-9 h-9",
              isGroupActive || open
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            )}
          >
            <Icon className="h-[18px] w-[18px] flex-shrink-0" />
            {showLabel && <span className="flex-1 text-left">{label}</span>}
          </button>
        </TooltipTrigger>
        {!showLabel && (
          <TooltipContent side="right" className="text-xs font-medium">{label}</TooltipContent>
        )}
      </Tooltip>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "overflow-hidden w-full mt-0.5",
              showLabel ? "pl-2" : "flex flex-col items-center gap-0.5"
            )}
          >
            {items.map(item => (
              showLabel ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 w-full",
                    navHrefIsActive(pathname, searchParams, item.href)
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : (
                <NavItem key={item.href} item={item} collapsed notificationKey={(item as any).notificationKey} />
              )
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main sidebar ──────────────────────────────────────────────────────── */
const AppSidebar = memo(function AppSidebar({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/connectors")) setOpenCategory("Connectors");
  }, [pathname]);

  const toggleCategory = (label: string) =>
    setOpenCategory(prev => (prev === label ? null : label));

  return (
    <TooltipProvider>
      <div id="onborda-app-sidebar" className="flex flex-col h-full bg-sidebar w-full">

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
              <TooltipContent side="right" className="text-xs font-medium">AthenaAI</TooltipContent>
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
          <div className={cn("space-y-0.5", collapsed && "flex flex-col items-center gap-0.5 px-0")}>
            {navSections.map((section, si) => {
              if (!section.label) {
                return (
                  <div key={si} className={cn("space-y-0.5", collapsed && "flex flex-col items-center w-full")}>
                    {section.items.map(item => (
                      <NavItem key={item.href} item={item} collapsed={collapsed} notificationKey={(item as any).notificationKey} />
                    ))}
                  </div>
                );
              }

              // Collapsed: category icon only, click to expand sub-items
              if (collapsed) {
                return (
                  <div key={si} className="w-full">
                    <div className="my-1 mx-1 border-t border-sidebar-border/40" />
                    <CollapsedCategory
                      label={section.label}
                      icon={section.categoryIcon!}
                      items={section.items}
                      open={openCategory === section.label}
                      onToggle={() => toggleCategory(section.label!)}
                      showLabel={false}
                      tourId={section.tourId}
                    />
                  </div>
                );
              }

              // Expanded: section label + flat items
              return (
                <div key={si}>
                  <p
                    id={section.tourId}
                    className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 select-none"
                  >
                    {section.label}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map(item => (
                      <NavItem key={item.href} item={item} collapsed={false} notificationKey={(item as any).notificationKey} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="flex-shrink-0 px-1.5 py-2 border-t border-sidebar-border">
          <NavItem item={{ href: "/settings", label: "Settings", icon: Settings }} collapsed={collapsed} />
        </SidebarFooter>
      </div>
    </TooltipProvider>
  );
});

export default AppSidebar;
