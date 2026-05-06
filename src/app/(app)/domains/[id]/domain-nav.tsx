"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface DomainNavProps {
  domainId: string;
  domainName: string;
}

export function DomainNav({ domainId, domainName }: DomainNavProps) {
  const pathname = usePathname();
  const base = `/domains/${domainId}`;

  const tabs = [
    { href: `${base}/dashboard`, label: "Übersicht" },
    { href: `${base}/fields`, label: "Felder" },
    { href: `${base}/form`, label: "Formular" },
    { href: `${base}/rules`, label: "Regelwerk" },
    { href: `${base}/components`, label: "Komponenten" },
    { href: `${base}/simulator`, label: "Simulator" },
  ];

  return (
    <div className="border-b bg-card">
      <div className="flex items-center gap-2 px-6 pt-4 text-sm text-muted-foreground">
        <Link href="/domains" className="hover:text-foreground transition-colors">
          Domänen
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{domainName}</span>
      </div>
      <nav className="flex gap-0 px-6 pt-3">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-3 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
