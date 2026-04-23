"use client";

import {
  BookOpen, BrainCircuit, CalendarDays, FileText, LayoutDashboard,
  LineChart, PenSquare, Settings, Timer, History, ImageIcon,
  FileSearch, Sigma, BookCopy, MessageCircle, Sparkles, FileCheck,
  SpellCheck, Briefcase, CheckSquare, ChevronDown,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarContent, SidebarHeader, SidebarFooter } from "@/components/ui/sidebar";
import { useNotification } from "@/context/notification-context";
import { memo, useState } from "react";
import { AthenaLogo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavIcon = React.ComponentType<{ className?: string }>;

/* ─── Nav data ─────────────────────────────────────────────────────────── */

const mainItems: { href: string; label: string; icon: NavIcon; notificationKey?: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, notificationKey: "dashboard" },
  { href: "/chat", label: "AI Chat", icon: MessageCircle, notificationKey: "chat" },
];

const generatorItems: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/quiz", label: "Quiz Generator", icon: BrainCircuit },
  { href: "/paper-generator", label: "Paper Generator", icon: PenSquare },
  { href: "/guess-paper", label: "Guess Paper", icon: FileCheck },
];

const analysisItems: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/analyzer/text-analyzer", label: "Text Analyzer", icon: Sigma },
  { href: "/summarize", label: "Summarizer", icon: FileSearch },
  { href: "/notes-maker", label: "Notes Maker", icon: BookCopy },
  { href: "/image-to-text", label: "Image to Text", icon: ImageIcon },
  { href: "/analyzer/grammar-checker", label: "Grammar Checker", icon: SpellCheck },
];

const writingItems: { href: string; label: string; icon: NavIcon }[] = [
  { href: "/writing/essay", label: "Essay Writer", icon: PenSquare },
  { href: "/writing/email", label: "Email Writer", icon: FileText },
  { href: "/writing/application", label: "Application Writer", icon: Briefcase },
  { href: "/writing/letter", label: "Letter Writer", icon: BookOpen },
];

const toolItems: { href: string; label: string; icon: NavIcon; notificationKey?: string }[] = [
  { href: "/tasks", label: "My Tasks", icon: CheckSquare, notificationKey: "tasks" },
  { href: "/planner", label: "Study Planner", icon: CalendarDays, notificationKey: "planner" },
  { href: "/timer", label: "Study Timer", icon: Timer, notificationKey: "timer" },
  { href: "/progress", label: "Progress", icon: LineChart, notificationKey: "progress" },
  { href: "/history", label: "History", icon: History, notificationKey: "history" },
];

/* ─── Tooltip wrapper (only active when collapsed) ──────────────────────── */

function NavTooltip({ label, collapsed, children }: { label: string; collapsed: boolean; children: React.ReactNode }) {
  if (!collapsed) return <>{children}</>;
  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
    </Tooltip>
  );
}

/* ─── Single nav item ───────────────────────────────────────────────────── */

function NavItem({
  item,
  pathname,
  indent = false,
  notificationKey,
  collapsed,
}: {
  item: { href: string; label: string; icon: NavIcon };
  pathname: string;
  indent?: boolean;
  notificationKey?: string;
  collapsed: boolean;
}) {
  const { notifications } = useNotification();
  const isActive = pathname === item.href || (!indent && pathname.startsWith(item.href + "/"));

  return (
    <NavTooltip label={item.label} collapsed={collapsed}>
      <Link
        href={item.href}
        className={cn(
          "group flex items-center gap-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative",
          collapsed ? "justify-center px-0 py-2.5 mx-1" : "px-3 py-2",
          indent && !collapsed ? "py-1.5" : "",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
            : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
        )}
      >
        {isActive && !collapsed && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-r-full" />
        )}
        <item.icon className={cn(
          "flex-shrink-0 transition-all duration-150",
          collapsed ? "h-5 w-5" : "h-4 w-4",
          isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
        )} />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && notificationKey && (notifications as any)[notificationKey] && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
        {collapsed && notificationKey && (notifications as any)[notificationKey] && (
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        )}
      </Link>
    </NavTooltip>
  );
}

/* ─── Section label ─────────────────────────────────────────────────────── */

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="my-1 mx-2 border-t border-sidebar-border/50" />;
  return <p className="section-label mt-3 mb-0.5">{children}</p>;
}

/* ─── Collapsible group ─────────────────────────────────────────────────── */

function NavGroup({
  label,
  icon: Icon,
  href,
  items,
  pathname,
  collapsed,
}: {
  label: string;
  icon: NavIcon;
  href: string;
  items: { href: string; label: string; icon: NavIcon }[];
  pathname: string;
  collapsed: boolean;
}) {
  const isGroupActive = pathname.startsWith(href) || items.some(i => pathname.startsWith(i.href));
  const [open, setOpen] = useState(isGroupActive);

  // Collapsed mode: show all child items as icon-only
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {items.map(item => (
          <NavItem key={item.href} item={item} pathname={pathname} indent collapsed={collapsed} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
          "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
          isGroupActive && "text-sidebar-primary bg-sidebar-accent"
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="ml-3 mt-0.5 pl-3 border-l border-sidebar-border space-y-0.5 py-1">
              {items.map(item => (
                <NavItem key={item.href} item={item} pathname={pathname} indent collapsed={collapsed} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
          "flex-shrink-0 py-4 border-b border-sidebar-border transition-all duration-300",
          collapsed ? "px-0 flex justify-center" : "px-4"
        )}>
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <NavTooltip label="AthenaAI" collapsed={collapsed}>
              <AthenaLogo className="h-9 w-9 flex-shrink-0 ring-2 ring-sidebar-border group-hover:ring-sidebar-primary/40 transition-all duration-200" />
            </NavTooltip>
            {!collapsed && (
              <div className="flex flex-col leading-none overflow-hidden">
                <span className="font-headline text-base font-bold text-sidebar-foreground">AthenaAI</span>
                <span className="text-[11px] text-sidebar-foreground/50 font-medium tracking-wide">Study Buddy</span>
              </div>
            )}
          </Link>
        </SidebarHeader>

        {/* Nav */}
        <SidebarContent className="flex-1 overflow-y-auto scrollbar-hide py-2 px-1">
          <div className="space-y-0.5">
            {mainItems.map(item => (
              <NavItem key={item.href} item={item} pathname={pathname} notificationKey={item.notificationKey} collapsed={collapsed} />
            ))}

            <SectionLabel collapsed={collapsed}>Generate</SectionLabel>
            <NavGroup label="Generator Tools" icon={Sparkles} href="/generator" items={generatorItems} pathname={pathname} collapsed={collapsed} />

            <SectionLabel collapsed={collapsed}>Analyze</SectionLabel>
            <NavGroup label="Analysis Tools" icon={Sigma} href="/analyzer" items={analysisItems} pathname={pathname} collapsed={collapsed} />

            <SectionLabel collapsed={collapsed}>Write</SectionLabel>
            <NavGroup label="Writing Tools" icon={PenSquare} href="/writing" items={writingItems} pathname={pathname} collapsed={collapsed} />

            <SectionLabel collapsed={collapsed}>Tools</SectionLabel>
            {toolItems.map(item => (
              <NavItem key={item.href} item={item} pathname={pathname} notificationKey={item.notificationKey} collapsed={collapsed} />
            ))}
          </div>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="flex-shrink-0 px-1 py-2 border-t border-sidebar-border">
          <NavItem item={{ href: "/settings", label: "Settings", icon: Settings }} pathname={pathname} collapsed={collapsed} />
        </SidebarFooter>
      </div>
    </TooltipProvider>
  );
});

export default AppSidebar;
