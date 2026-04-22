"use client";

import {
  BookOpen, BrainCircuit, CalendarDays, FileText, LayoutDashboard,
  LineChart, PenSquare, Settings, Timer, History, ImageIcon,
  FileSearch, Sigma, BookCopy, MessageCircle, Sparkles, FileCheck,
  SpellCheck, Briefcase, CheckSquare, ChevronDown,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarFooter,
} from "@/components/ui/sidebar";
import { useNotification } from "@/context/notification-context";
import { memo, useState } from "react";
import { AthenaLogo } from "@/components/app/logo";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

/* ─── Nav data ─────────────────────────────────────────────────────────── */

const mainItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, notificationKey: "dashboard" },
  { href: "/chat", label: "AI Chat", icon: MessageCircle, notificationKey: "chat" },
];

const generatorItems = [
  { href: "/quiz", label: "Quiz Generator", icon: BrainCircuit },
  { href: "/paper-generator", label: "Paper Generator", icon: PenSquare },
  { href: "/guess-paper", label: "Guess Paper", icon: FileCheck },
];

const analysisItems = [
  { href: "/analyzer/text-analyzer", label: "Text Analyzer", icon: Sigma },
  { href: "/summarize", label: "Summarizer", icon: FileSearch },
  { href: "/notes-maker", label: "Notes Maker", icon: BookCopy },
  { href: "/image-to-text", label: "Image to Text", icon: ImageIcon },
  { href: "/analyzer/grammar-checker", label: "Grammar Checker", icon: SpellCheck },
];

const writingItems = [
  { href: "/writing/essay", label: "Essay Writer", icon: PenSquare },
  { href: "/writing/email", label: "Email Writer", icon: FileText },
  { href: "/writing/application", label: "Application Writer", icon: Briefcase },
  { href: "/writing/letter", label: "Letter Writer", icon: BookOpen },
];

const toolItems = [
  { href: "/tasks", label: "My Tasks", icon: CheckSquare, notificationKey: "tasks" },
  { href: "/planner", label: "Study Planner", icon: CalendarDays, notificationKey: "planner" },
  { href: "/timer", label: "Study Timer", icon: Timer, notificationKey: "timer" },
  { href: "/progress", label: "Progress", icon: LineChart, notificationKey: "progress" },
  { href: "/history", label: "History", icon: History, notificationKey: "history" },
];

/* ─── Collapsible group ─────────────────────────────────────────────────── */

function NavGroup({
  label,
  icon: Icon,
  href,
  items,
  pathname,
}: {
  label: string;
  icon: React.ElementType;
  href: string;
  items: { href: string; label: string; icon: React.ElementType }[];
  pathname: string;
}) {
  const isGroupActive = pathname.startsWith(href) || items.some(i => pathname.startsWith(i.href));
  const [open, setOpen] = useState(isGroupActive);

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
                <NavItem key={item.href} item={item} pathname={pathname} indent />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Single nav item ───────────────────────────────────────────────────── */

function NavItem({
  item,
  pathname,
  indent = false,
  notificationKey,
}: {
  item: { href: string; label: string; icon: React.ElementType };
  pathname: string;
  indent?: boolean;
  notificationKey?: string;
}) {
  const { notifications } = useNotification();
  const isActive = pathname === item.href || (!indent && pathname.startsWith(item.href + "/"));

  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 relative",
        indent ? "py-1.5" : "",
        isActive
          ? "bg-sidebar-accent text-sidebar-primary shadow-sm"
          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-sidebar-primary rounded-r-full" />
      )}
      <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80")} />
      <span className="flex-1 truncate">{item.label}</span>
      {notificationKey && (notifications as any)[notificationKey] && (
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      )}
    </Link>
  );
}

/* ─── Section label ─────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="section-label mt-3 mb-0.5">{children}</p>
  );
}

/* ─── Main sidebar ──────────────────────────────────────────────────────── */

const AppSidebar = memo(function AppSidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <SidebarHeader className="flex-shrink-0 px-4 py-4 border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <AthenaLogo className="h-9 w-9 ring-2 ring-sidebar-border group-hover:ring-sidebar-primary/40 transition-all duration-200" />
          <div className="flex flex-col leading-none">
            <span className="font-headline text-base font-bold text-sidebar-foreground">AthenaAI</span>
            <span className="text-[11px] text-sidebar-foreground/50 font-medium tracking-wide">Study Buddy</span>
          </div>
        </Link>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="flex-1 overflow-y-auto scrollbar-hide px-2 py-2">
        <div className="space-y-0.5">
          {/* Main */}
          {mainItems.map(item => (
            <NavItem key={item.href} item={item} pathname={pathname} notificationKey={item.notificationKey} />
          ))}

          {/* Generator */}
          <SectionLabel>Generate</SectionLabel>
          <NavGroup label="Generator Tools" icon={Sparkles} href="/generator" items={generatorItems} pathname={pathname} />

          {/* Analysis */}
          <SectionLabel>Analyze</SectionLabel>
          <NavGroup label="Analysis Tools" icon={Sigma} href="/analyzer" items={analysisItems} pathname={pathname} />

          {/* Writing */}
          <SectionLabel>Write</SectionLabel>
          <NavGroup label="Writing Tools" icon={PenSquare} href="/writing" items={writingItems} pathname={pathname} />

          {/* Tools */}
          <SectionLabel>Tools</SectionLabel>
          {toolItems.map(item => (
            <NavItem key={item.href} item={item} pathname={pathname} notificationKey={(item as any).notificationKey} />
          ))}
        </div>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="flex-shrink-0 px-2 py-2 border-t border-sidebar-border">
        <NavItem item={{ href: "/settings", label: "Settings", icon: Settings }} pathname={pathname} />
      </SidebarFooter>
    </div>
  );
});

export default AppSidebar;
