"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Settings2, ListChecks, ShoppingCart, Users, Key,
  LogOut, ChevronRight, Zap, BookOpen, Menu, X
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
  children?: { href: string; label: string }[];
}

const navItems: NavItem[] = [
  { href: "/domains", label: "Domänen", icon: LayoutGrid },
  { href: "/pricelists", label: "Preislisten", icon: ListChecks, roles: ["SUPER_ADMIN", "DOMAIN_ADMIN"] },
  { href: "/configurator", label: "Konfigurator", icon: ShoppingCart },
  { href: "/admin/users", label: "Benutzer", icon: Users, roles: ["SUPER_ADMIN"] },
  { href: "/admin/api-keys", label: "API-Keys", icon: Key, roles: ["SUPER_ADMIN"] },
  { href: "/docs", label: "Dokumentation", icon: BookOpen },
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
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRolle)
  );

  return (
    <>
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {active && <ChevronRight className="ml-auto h-3 w-3 opacity-60" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-3">
        <Link
          href="/settings/profile"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname.startsWith("/settings")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {userName?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <Settings2 className="h-3.5 w-3.5 shrink-0" />
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 w-full justify-start gap-3 px-3 text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          Abmelden
        </Button>
      </div>
    </>
  );
}

export function Sidebar({ userRolle, userName, userEmail }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const logoBar = (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
        <Zap className="h-4 w-4 text-primary-foreground" />
      </div>
      <span className="font-semibold text-sm">Angebots-Engine</span>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — always visible on md+ */}
      <aside className="hidden md:flex h-screen w-60 shrink-0 flex-col border-r bg-card">
        {logoBar}
        <SidebarContent
          userRolle={userRolle}
          userName={userName}
          userEmail={userEmail}
        />
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex h-14 items-center gap-3 border-b bg-card px-4">
        <button
          aria-label="Menü öffnen"
          onClick={() => setMobileOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">Angebots-Engine</span>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer */}
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
