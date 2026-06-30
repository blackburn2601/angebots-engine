"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, LayoutGrid, Settings2, ListChecks, ShoppingCart,
  Users, Key, LogOut, ChevronRight, ChevronLeft, Zap, BookOpen,
  Menu, X, Activity, Webhook, Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import type { UserRolle } from "@/lib/auth-helpers";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRolle[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/domains", label: "Domänen", icon: LayoutGrid },
  { href: "/pricelists", label: "Preislisten", icon: ListChecks, roles: ["SUPER_ADMIN", "DOMAIN_ADMIN"] },
  { href: "/configurator", label: "Konfigurator", icon: ShoppingCart },
  { href: "/admin/users", label: "Benutzer", icon: Users, roles: ["SUPER_ADMIN"] },
  { href: "/admin/api-keys", label: "API-Keys", icon: Key, roles: ["SUPER_ADMIN"] },
  { href: "/admin/logs", label: "API-Logs", icon: Activity, roles: ["SUPER_ADMIN"] },
  { href: "/admin/webhooks", label: "Webhooks", icon: Webhook, roles: ["SUPER_ADMIN", "DOMAIN_ADMIN"] },
  { href: "/docs", label: "Dokumentation", icon: BookOpen },
  { href: "/docs/developer", label: "Entwickler-Docs", icon: Code2, roles: ["SUPER_ADMIN"] },
];

interface SidebarProps {
  userRolle: UserRolle;
  userName: string;
  userEmail: string;
}

function SidebarContent({
  userRolle,
  userName,
  userEmail,
  onNavigate,
  collapsed,
}: SidebarProps & { onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRolle)
  );

  // Highlight only the most specific match so nested routes (e.g. /docs vs
  // /docs/developer) don't light up their parent entry too.
  const activeHref = visibleItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .reduce<string | null>(
      (best, item) => (best && best.length >= item.href.length ? best : item.href),
      null
    );

  return (
    <>
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const active = activeHref === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    "group relative",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:bg-accent/80 hover:text-foreground hover:translate-x-0.5",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0", active && "drop-shadow-sm")} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
                    </>
                  )}
                  {/* Tooltip for collapsed mode */}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 z-50 rounded-md bg-popover text-popover-foreground text-xs px-2 py-1 shadow-md border whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.label}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-2">
        <Link
          href="/settings/profile"
          onClick={onNavigate}
          title={collapsed ? `${userName} – Profil` : undefined}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 group relative",
            pathname.startsWith("/settings")
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent/80 hover:text-foreground hover:translate-x-0.5",
            collapsed && "justify-center px-2"
          )}
        >
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shrink-0 ring-2",
            pathname.startsWith("/settings")
              ? "bg-primary-foreground text-primary ring-primary-foreground/30"
              : "bg-primary text-primary-foreground ring-primary/20"
          )}>
            {userName?.[0]?.toUpperCase() ?? "?"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold leading-tight">{userName}</p>
              <p className="truncate text-[11px] text-muted-foreground leading-tight">{userEmail}</p>
            </div>
          )}
          {!collapsed && <Settings2 className="h-3.5 w-3.5 shrink-0 opacity-50" />}
          {collapsed && (
            <span className="pointer-events-none absolute left-full ml-2 z-50 rounded-md bg-popover text-popover-foreground text-xs px-2 py-1 shadow-md border whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {userName} – Profil
            </span>
          )}
        </Link>
        <Button
          variant="ghost"
          size="sm"
          title={collapsed ? "Abmelden" : undefined}
          className={cn(
            "mt-0.5 w-full transition-all duration-150 text-muted-foreground hover:text-destructive hover:bg-destructive/10",
            collapsed ? "justify-center px-2" : "justify-start gap-3 px-3"
          )}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </Button>
      </div>
    </>
  );
}

export function Sidebar({ userRolle, userName, userEmail }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Load collapse state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const logoBar = (
    <div className={cn("flex h-14 shrink-0 items-center border-b px-3 gap-2", collapsed && "justify-center")}>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/30 shrink-0">
        <Zap className="h-4 w-4 text-primary-foreground" />
      </div>
      {!collapsed && (
        <span className="font-semibold text-sm flex-1 truncate">Angebots-Engine</span>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen shrink-0 flex-col border-r bg-card/80 backdrop-blur-sm transition-all duration-300 ease-in-out relative",
          collapsed ? "w-[60px]" : "w-60"
        )}
      >
        {logoBar}
        <SidebarContent
          userRolle={userRolle}
          userName={userName}
          userEmail={userEmail}
          collapsed={collapsed}
        />
        {/* Toggle handle — sits on the sidebar border, never overlaps content */}
        <button
          aria-label={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
          onClick={toggleCollapse}
          className="absolute -right-3 top-[18px] z-20 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-foreground transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex h-14 items-center gap-3 border-b bg-card/90 backdrop-blur-sm px-4 shadow-sm">
        <button
          aria-label="Menü öffnen"
          onClick={() => setMobileOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary shadow-sm">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Angebots-Engine</span>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" aria-modal="true" role="dialog">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-card shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                  <Zap className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-sm">Angebots-Engine</span>
              </div>
              <button
                aria-label="Menü schließen"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              userRolle={userRolle}
              userName={userName}
              userEmail={userEmail}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}
    </>
  );
}
