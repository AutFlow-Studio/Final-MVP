import React from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CalendarDays, 
  CreditCard, 
  Files, 
  BarChart3, 
  CheckSquare, 
  Settings,
  Search,
  Command,
  Bell,
  User,
  LogOut,
  AlertCircle,
  DollarSign,
  Clock,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetDashboard } from "@workspace/api-client-react";
import { useAuth } from "@/components/auth-provider";
import { useAgencyProfile } from "@/components/agency-profile-provider";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const SEEN_NOTIFICATIONS_KEY = "autflow-studio-seen-notifications";

function loadSeenNotificationIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_NOTIFICATIONS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenNotificationIds(ids: Set<string>) {
  localStorage.setItem(SEEN_NOTIFICATIONS_KEY, JSON.stringify(Array.from(ids)));
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/projects", label: "Projects", icon: Briefcase },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/documents", label: "Documents", icon: Files },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { data: stats } = useGetDashboard();
  const { user, logout } = useAuth();
  const { profile: agencyProfile } = useAgencyProfile();
  const initials = (user?.name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase())
    .slice(0, 2)
    .join("") || "?";

  const notifications = [
    ...(stats?.projectsAtRisk?.slice(0, 3).map((project) => ({
      id: `risk-${project.id}`,
      icon: AlertCircle,
      iconClass: "text-destructive",
      title: `${project.name} is at risk`,
      description: project.clientName,
      href: `/projects/${project.id}`,
    })) || []),
    ...(stats?.upcomingDeadlines?.slice(0, 3).map((project) => ({
      id: `deadline-${project.id}`,
      icon: Clock,
      iconClass: "text-amber-500",
      title: `Deadline: ${project.name}`,
      description: project.deadline ? format(new Date(project.deadline), "MMM d, yyyy") : "No deadline",
      href: `/projects/${project.id}`,
    })) || []),
    ...(stats && stats.invoicesAwaitingPayment > 0
      ? [{
          id: "unpaid-invoices",
          icon: DollarSign,
          iconClass: "text-emerald-500",
          title: `${stats.invoicesAwaitingPayment} unpaid invoice${stats.invoicesAwaitingPayment === 1 ? "" : "s"}`,
          description: `${stats.outstandingPayments.toLocaleString()} outstanding`,
          href: "/payments",
        }]
      : []),
  ];

  // Track which notification IDs the owner has already viewed, so the
  // purple unread dot only reappears when a genuinely new notification
  // shows up -- not every time the dashboard stats refetch.
  const [seenIds, setSeenIds] = useState<Set<string>>(() => loadSeenNotificationIds());
  const hasUnread = notifications.some((n) => !seenIds.has(n.id));

  function handleNotificationsOpenChange(open: boolean) {
    if (open) {
      const next = new Set(seenIds);
      for (const n of notifications) next.add(n.id);
      setSeenIds(next);
      saveSeenNotificationIds(next);
    }
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const query = new FormData(e.currentTarget).get("q");
    if (query) {
      setLocation(`/search?q=${encodeURIComponent(query.toString())}`);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      {/* Mobile Nav Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 border-r border-border/50 bg-card/95 backdrop-blur-xl flex flex-col z-40 transition-transform duration-300 md:hidden",
        mobileNavOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-border/50">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Command size={14} />
            </div>
            <span className="truncate">{agencyProfile.agencyName}</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          <div className="px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                )}
              >
                <item.icon size={16} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="p-4 border-t border-border/50">
          <Link href="/settings" onClick={() => setMobileNavOpen(false)} className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
            location.startsWith("/settings")
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          )}>
            <Settings size={16} />
            Settings
          </Link>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className="w-64 border-r border-border/50 bg-card/50 backdrop-blur-xl flex flex-col flex-shrink-0 z-20 hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-border/50">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
              <Command size={14} />
            </div>
            <span className="truncate">{agencyProfile.agencyName}</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          <div className="px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )}>
                <item.icon size={16} className={cn(isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </Link>
            );
          })}
        </div>
        
        <div className="p-4 border-t border-border/50">
          <Link href="/settings" className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200",
            location.startsWith("/settings")
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
          )}>
            <Settings size={16} />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-4 md:px-6 border-b border-border/50 bg-background/80 backdrop-blur-md z-10 sticky top-0">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <button
              type="button"
              className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors flex-shrink-0"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <form onSubmit={handleSearch} className="relative group flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16} />
              <input 
                type="search" 
                name="q"
                placeholder="Search clients, projects, invoices..." 
                className="w-full h-10 pl-10 pr-4 bg-secondary/50 border border-transparent rounded-full text-sm focus:outline-none focus:bg-background focus:border-primary/30 focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/70"
                defaultValue={new URLSearchParams(window.location.search).get("q") || ""}
              />
            </form>
          </div>
          
          <div className="flex items-center gap-4">
            <DropdownMenu onOpenChange={handleNotificationsOpenChange}>
              <DropdownMenuTrigger asChild>
                <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/80 transition-colors relative">
                  <Bell size={18} />
                  {hasUnread && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-accent border-2 border-background"></span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    You're all caught up.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <DropdownMenuItem key={n.id} asChild className="cursor-pointer">
                      <Link href={n.href} className="flex items-start gap-3 py-2">
                        <n.icon size={16} className={cn("mt-0.5 shrink-0", n.iconClass)} />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium leading-tight">{n.title}</span>
                          <span className="text-xs text-muted-foreground">{n.description}</span>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-background cursor-pointer">
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{user?.name ?? ""}</span>
                    <span className="text-xs font-normal text-muted-foreground">{user?.email ?? ""}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings" className="flex items-center gap-2">
                    <User size={14} />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/settings" className="flex items-center gap-2">
                    <Settings size={14} />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer text-destructive focus:text-destructive"
                  onClick={async () => {
                    await logout();
                    toast({ title: "Signed out", description: "You have been signed out of AutFlow Studio." });
                  }}
                >
                  <LogOut size={14} className="mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
